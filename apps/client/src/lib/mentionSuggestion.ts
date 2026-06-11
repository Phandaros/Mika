import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, { type SuggestionKeyDownProps, type SuggestionOptions, type SuggestionProps } from "@tiptap/suggestion";
import type { RefObject } from "react";
import { MentionList, type MentionListHandle } from "../components/shared/MentionList";
import {
  buildMentionMarkdown,
  buildMentionSuggestions,
  type MentionContext,
  type MentionSuggestionItem
} from "./mentionUtils";
import type { Project, User } from "shared";

type MentionDataSource = {
  usersRef: RefObject<User[]>;
  projectsRef: RefObject<Project[]>;
  contextRef: RefObject<MentionContext | null>;
};

const POPUP_GAP = 4;
const POPUP_MAX_HEIGHT = 256;
const POPUP_WIDTH = 320;

function updatePopupPosition(element: HTMLElement, clientRect?: (() => DOMRect | null) | null) {
  const rect = clientRect?.();

  if (!rect) {
    return;
  }

  const popupHeight = element.offsetHeight || POPUP_MAX_HEIGHT;
  const popupWidth = element.offsetWidth || POPUP_WIDTH;
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const openUpward = spaceBelow < popupHeight + POPUP_GAP && spaceAbove > spaceBelow;
  const maxLeft = Math.max(0, window.innerWidth - popupWidth);
  const left = Math.min(Math.max(0, rect.left), maxLeft);

  element.style.position = "fixed";
  element.style.left = `${left}px`;
  element.style.top = openUpward
    ? `${Math.max(POPUP_GAP, rect.top - popupHeight - POPUP_GAP)}px`
    : `${rect.bottom + POPUP_GAP}px`;
  element.style.zIndex = "60";
}

export function createMentionSuggestionExtension(dataSource: MentionDataSource) {
  const suggestionOptions: Omit<SuggestionOptions<MentionSuggestionItem>, "editor"> = {
    char: "@",
    allowSpaces: true,
    items: ({ query }: { query: string }) => {
      const context = dataSource.contextRef.current;

      if (!context) {
        return [];
      }

      return buildMentionSuggestions(
        query,
        context,
        dataSource.usersRef.current ?? [],
        dataSource.projectsRef.current ?? []
      );
    },
    command: ({
      editor,
      range,
      props
    }: {
      editor: SuggestionProps<MentionSuggestionItem>["editor"];
      range: SuggestionProps<MentionSuggestionItem>["range"];
      props: MentionSuggestionItem;
    }) => {
      const markdown = `${buildMentionMarkdown(props)} `;
      editor.chain().focus().deleteRange(range).insertContent(markdown, { contentType: "markdown" }).run();
    },
    render: () => {
      let component: ReactRenderer<MentionListHandle> | null = null;
      let element: HTMLElement | null = null;

      return {
        onStart: (props: SuggestionProps<MentionSuggestionItem>) => {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor
          });

          element = component.element as HTMLElement;
          element.setAttribute("data-mika-mention-suggestion", "true");
          element.style.pointerEvents = "auto";
          document.body.appendChild(element);
          updatePopupPosition(element, props.clientRect);
        },
        onUpdate: (props: SuggestionProps<MentionSuggestionItem>) => {
          component?.updateProps(props);
          if (element) {
            updatePopupPosition(element, props.clientRect);
          }
        },
        onKeyDown: (props: SuggestionKeyDownProps) => component?.ref?.onKeyDown(props.event) ?? false,
        onExit: () => {
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

  return Extension.create({
    name: "mkMentionSuggestion",
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          ...suggestionOptions
        })
      ];
    }
  });
}
