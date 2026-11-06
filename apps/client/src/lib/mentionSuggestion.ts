import Mention from "@tiptap/extension-mention";
import { ReactRenderer } from "@tiptap/react";
import { type SuggestionKeyDownProps, type SuggestionOptions, type SuggestionProps } from "@tiptap/suggestion";
import type { RefObject } from "react";
import type { GlobalSearchResponse, MeetingMinutesResponse } from "shared";
import { MentionList, type MentionListHandle } from "../components/shared/MentionList";
import {
  buildMentionSuggestions,
  type MentionContext,
  type MentionMeetingMinute,
  type MentionSearchTask,
  type MentionSuggestionItem
} from "./mentionUtils";
import type { MentionProject } from "./mentionUtils";
import { api } from "./api";
import type { User } from "shared";

type MentionDataSource = {
  usersRef: RefObject<User[]>;
  projectsRef: RefObject<MentionProject[]>;
  contextRef: RefObject<MentionContext | null>;
};

const POPUP_GAP = 4;
const POPUP_MAX_HEIGHT = 256;
const POPUP_WIDTH = 320;
const REMOTE_SEARCH_DELAY_MS = 200;

function updatePopupPosition(element: HTMLElement, props: SuggestionProps<MentionSuggestionItem>) {
  let rect = props.clientRect?.();

  if ((!rect || (rect.left === 0 && rect.top === 0 && rect.width === 0 && rect.height === 0)) && props.range) {
    try {
      const coords = props.editor.view.coordsAtPos(props.range.from);
      rect = new DOMRect(coords.left, coords.top, Math.max(1, coords.right - coords.left), Math.max(1, coords.bottom - coords.top));
    } catch {
      rect = null;
    }
  }

  if (!rect) {
    return;
  }

  const bounds = element.getBoundingClientRect();
  const popupHeight = Math.min(bounds.height || element.scrollHeight || POPUP_MAX_HEIGHT, POPUP_MAX_HEIGHT);
  const popupWidth = bounds.width || element.offsetWidth || POPUP_WIDTH;
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const openUpward = spaceBelow < popupHeight + POPUP_GAP && spaceAbove > spaceBelow;
  const maxLeft = Math.max(0, window.innerWidth - popupWidth);
  const left = Math.min(Math.max(0, rect.left), maxLeft);
  const nextTop = openUpward
    ? Math.max(POPUP_GAP, rect.top - popupHeight - POPUP_GAP)
    : Math.min(rect.bottom + POPUP_GAP, Math.max(POPUP_GAP, window.innerHeight - popupHeight - POPUP_GAP));

  element.style.position = "fixed";
  element.style.left = `${left}px`;
  element.style.top = `${nextTop}px`;
  element.style.zIndex = "60";
}

function schedulePopupPosition(element: HTMLElement, props: SuggestionProps<MentionSuggestionItem>) {
  updatePopupPosition(element, props);
  window.requestAnimationFrame(() => updatePopupPosition(element, props));
}

async function listMeetingMinuteSuggestions(query: string, projectId: string | null) {
  if (!projectId) {
    return [];
  }

  const response = await api.get<MeetingMinutesResponse>(`/projects/${projectId}/meeting-minutes`, {
    params: { page: 1, limit: 12, search: query.trim() || undefined }
  });

  return response.data.items.map((minute) => ({
    id: minute.id,
    projectId: minute.projectId,
    title: minute.title,
    meetingDate: minute.meetingDate
  }));
}

async function listTaskSuggestions(query: string, projectId: string | null): Promise<MentionSearchTask[]> {
  if (!query.trim()) {
    return [];
  }

  const response = await api.get<GlobalSearchResponse>("/search", {
    params: { q: query.trim(), limit: 25, projectId: projectId ?? undefined }
  });

  return response.data.tasks.map((task) => ({
    id: task.id,
    title: task.title,
    projectId: task.projectId,
    projectName: task.projectName,
    sectionName: task.sectionName
  }));
}

export function createMentionSuggestionExtension(dataSource: MentionDataSource) {
  // Consulta sem resultado que já tem espaço: é texto comum, não uma menção em andamento.
  let abandonedQuery: string | null = null;

  function currentContext(): MentionContext {
    return dataSource.contextRef.current ?? { projectId: null, taskId: null };
  }

  function buildItems(query: string, meetingMinutes: MentionMeetingMinute[] = [], searchTasks: MentionSearchTask[] = []) {
    return buildMentionSuggestions(
      query,
      currentContext(),
      dataSource.usersRef.current ?? [],
      dataSource.projectsRef.current ?? [],
      meetingMinutes,
      searchTasks
    );
  }

  const suggestionOptions: Omit<SuggestionOptions<MentionSuggestionItem>, "editor"> = {
    char: "@",
    allowSpaces: true,
    allow: ({ state, range }) => {
      if (abandonedQuery === null) {
        return true;
      }

      const query = state.doc.textBetween(range.from + 1, range.to, " ");

      if (query.startsWith(abandonedQuery)) {
        return false;
      }

      abandonedQuery = null;
      return true;
    },
    items: ({ query }: { query: string }) => buildItems(query),
    command: ({
      editor,
      range,
      props
    }: {
      editor: SuggestionProps<MentionSuggestionItem>["editor"];
      range: SuggestionProps<MentionSuggestionItem>["range"];
      props: MentionSuggestionItem;
    }) => {
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          {
            type: "mention",
            attrs: {
              id: `${props.type}/${props.id}`,
              label: props.label,
              mentionSuggestionChar: "@"
            }
          },
          { type: "text", text: " " }
        ])
        .run();
    },
    render: () => {
      let component: ReactRenderer<MentionListHandle> | null = null;
      let element: HTMLElement | null = null;
      let searchTimer: number | undefined;
      let searchId = 0;

      function searchRemote(query: string) {
        const id = ++searchId;
        window.clearTimeout(searchTimer);
        component?.updateProps({ loading: true });

        searchTimer = window.setTimeout(() => {
          void (async () => {
            const { projectId } = currentContext();
            const [meetingMinuteResult, taskResult] = await Promise.allSettled([
              listMeetingMinuteSuggestions(query, projectId),
              listTaskSuggestions(query, projectId)
            ]);

            if (id !== searchId) {
              return;
            }

            const items = buildItems(
              query,
              meetingMinuteResult.status === "fulfilled" ? meetingMinuteResult.value : [],
              taskResult.status === "fulfilled" ? taskResult.value : []
            );

            if (items.length === 0 && query.includes(" ")) {
              abandonedQuery = query;
            }

            component?.updateProps({ items, loading: false });
          })();
        }, REMOTE_SEARCH_DELAY_MS);
      }

      return {
        onStart: (props: SuggestionProps<MentionSuggestionItem>) => {
          abandonedQuery = null;
          component = new ReactRenderer(MentionList, {
            props: { ...props, loading: true },
            editor: props.editor
          });

          element = component.element as HTMLElement;
          element.setAttribute("data-mika-mention-suggestion", "true");
          element.style.pointerEvents = "auto";
          document.body.appendChild(element);
          schedulePopupPosition(element, props);
          searchRemote(props.query);
        },
        onUpdate: (props: SuggestionProps<MentionSuggestionItem>) => {
          component?.updateProps(props);
          if (element) {
            schedulePopupPosition(element, props);
          }
          searchRemote(props.query);
        },
        onKeyDown: (props: SuggestionKeyDownProps) => component?.ref?.onKeyDown(props.event) ?? false,
        onExit: () => {
          searchId += 1;
          window.clearTimeout(searchTimer);

          if (element?.parentNode) {
            element.parentNode.removeChild(element);
          }

          component?.destroy();
          component = null;
          element = null;
        }
      };
    }
  };

  return Mention.configure({
    HTMLAttributes: {
      class: "mika-mention"
    },
    deleteTriggerWithBackspace: true,
    renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
    renderHTML: ({ node }) => [
      "span",
      {
        class: "mika-mention",
        "data-type": "mention",
        "data-id": node.attrs.id,
        "data-label": node.attrs.label,
        "data-mention-suggestion-char": "@"
      },
      `@${node.attrs.label ?? node.attrs.id}`
    ],
    suggestion: suggestionOptions
  });
}
