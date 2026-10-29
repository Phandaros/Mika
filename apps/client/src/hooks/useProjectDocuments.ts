import { keepPreviousData, useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import type {
  MeetingMinuteDto,
  MeetingMinutesResponse,
  ProjectLogEntryType,
  ProjectLogResponse,
  ProjectNoteDto,
  ProjectNotesResponse,
  ProjectTimelineEventsResponse
} from "shared";
import { api } from "../lib/api";
import { queryClient } from "../lib/queryClient";
import type { PendingMarkdownFile } from "../components/shared/MarkdownEditor";

export type ProjectDocumentKind = "notes" | "meeting-minutes";

interface DocumentListParams {
  projectId: string;
  kind: ProjectDocumentKind;
  page: number;
  search: string;
}

interface NoteResponse {
  note: ProjectNoteDto;
}

interface MeetingMinuteResponse {
  meetingMinute: MeetingMinuteDto;
}

interface BaseProjectDocumentFormValues {
  title: string;
  content: string;
  expectedUpdatedAt?: string;
}

export interface ProjectNoteFormValues extends BaseProjectDocumentFormValues {
  noteDate: string;
}

export interface MeetingMinuteFormValues extends BaseProjectDocumentFormValues {
  meetingDate: string;
  meetingTime: string | null;
  participantUserIds: string[];
  externalParticipants: string[];
}

function appendFiles(formData: FormData, files: PendingMarkdownFile[]) {
  for (const item of files) {
    formData.append("files", item.file);
  }
}

function baseDocumentFormData(values: BaseProjectDocumentFormValues, files: PendingMarkdownFile[]): FormData {
  const formData = new FormData();
  formData.append("title", values.title);
  formData.append("content", values.content);
  if (values.expectedUpdatedAt) {
    formData.append("expectedUpdatedAt", values.expectedUpdatedAt);
  }
  appendFiles(formData, files);
  return formData;
}

function noteFormData(values: ProjectNoteFormValues, files: PendingMarkdownFile[]): FormData {
  const formData = baseDocumentFormData(values, files);
  formData.append("noteDate", values.noteDate);
  return formData;
}

function meetingMinuteFormData(values: MeetingMinuteFormValues, files: PendingMarkdownFile[]): FormData {
  const formData = baseDocumentFormData(values, files);
  formData.append("meetingDate", values.meetingDate);
  formData.append("meetingTime", values.meetingTime ?? "");
  formData.append("participantUserIds", JSON.stringify(values.participantUserIds));
  formData.append("externalParticipants", JSON.stringify(values.externalParticipants));
  return formData;
}

export function useProjectTimelineEvents(projectId: string, enabled = true) {
  return useQuery({
    queryKey: ["projects", projectId, "timeline-events"],
    enabled: enabled && Boolean(projectId),
    queryFn: async () => {
      const response = await api.get<ProjectTimelineEventsResponse>(`/projects/${projectId}/timeline-events`);
      return response.data.events;
    }
  });
}

export function useProjectLog(projectId: string, types: ProjectLogEntryType[]) {
  return useInfiniteQuery({
    queryKey: ["projects", projectId, "log", types],
    enabled: Boolean(projectId) && types.length > 0,
    initialPageParam: undefined as string | undefined,
    // Tarefas mudam em outras áreas da página; o log sempre recarrega ao ser aberto.
    refetchOnMount: "always",
    queryFn: async ({ pageParam }) => {
      const response = await api.get<ProjectLogResponse>(`/projects/${projectId}/log`, {
        params: { limit: 40, cursor: pageParam, types: types.join(",") }
      });
      return response.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData: keepPreviousData
  });
}

export function useProjectNotes({ projectId, page, search }: Omit<DocumentListParams, "kind">) {
  return useQuery({
    queryKey: ["projects", projectId, "notes", page, search],
    queryFn: async () => {
      const response = await api.get<ProjectNotesResponse>(`/projects/${projectId}/notes`, {
        params: { page, limit: 25, search: search || undefined }
      });
      return response.data;
    }
  });
}

export function useMeetingMinutes({ projectId, page, search }: Omit<DocumentListParams, "kind">) {
  return useQuery({
    queryKey: ["projects", projectId, "meeting-minutes", page, search],
    queryFn: async () => {
      const response = await api.get<MeetingMinutesResponse>(`/projects/${projectId}/meeting-minutes`, {
        params: { page, limit: 25, search: search || undefined }
      });
      return response.data;
    }
  });
}

export function useProjectNote(noteId: string | null) {
  return useQuery({
    queryKey: ["project-notes", noteId],
    enabled: Boolean(noteId),
    queryFn: async () => {
      const response = await api.get<NoteResponse>(`/project-notes/${noteId}`);
      return response.data.note;
    }
  });
}

export function useMeetingMinute(minuteId: string | null) {
  return useQuery({
    queryKey: ["meeting-minutes", minuteId],
    enabled: Boolean(minuteId),
    queryFn: async () => {
      const response = await api.get<MeetingMinuteResponse>(`/meeting-minutes/${minuteId}`);
      return response.data.meetingMinute;
    }
  });
}

async function refreshDocumentQueries(projectId: string, kind: ProjectDocumentKind) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["projects", projectId, kind] }),
    queryClient.invalidateQueries({ queryKey: ["projects", projectId, "log"] }),
    queryClient.invalidateQueries({ queryKey: ["projects", projectId, "timeline-events"] })
  ]);
}

export function useSaveProjectNote(projectId: string) {
  return useMutation({
    mutationFn: async ({
      noteId,
      values,
      files
    }: {
      noteId?: string;
      values: ProjectNoteFormValues;
      files: PendingMarkdownFile[];
    }) => {
      const formData = noteFormData(values, files);
      const response = noteId
        ? await api.patch<NoteResponse>(`/project-notes/${noteId}`, formData)
        : await api.post<NoteResponse>(`/projects/${projectId}/notes`, formData);
      return response.data.note;
    },
    onSuccess: async (note) => {
      queryClient.setQueryData(["project-notes", note.id], note);
      await refreshDocumentQueries(projectId, "notes");
    }
  });
}

export function useSaveMeetingMinute(projectId: string) {
  return useMutation({
    mutationFn: async ({
      minuteId,
      values,
      files
    }: {
      minuteId?: string;
      values: MeetingMinuteFormValues;
      files: PendingMarkdownFile[];
    }) => {
      const formData = meetingMinuteFormData(values, files);
      const response = minuteId
        ? await api.patch<MeetingMinuteResponse>(`/meeting-minutes/${minuteId}`, formData)
        : await api.post<MeetingMinuteResponse>(`/projects/${projectId}/meeting-minutes`, formData);
      return response.data.meetingMinute;
    },
    onSuccess: async (minute) => {
      queryClient.setQueryData(["meeting-minutes", minute.id], minute);
      await refreshDocumentQueries(projectId, "meeting-minutes");
    }
  });
}

export function useDeleteProjectDocument(projectId: string, kind: ProjectDocumentKind) {
  return useMutation({
    mutationFn: async (id: string) => {
      const endpoint = kind === "notes" ? `/project-notes/${id}` : `/meeting-minutes/${id}`;
      await api.delete(endpoint);
      return id;
    },
    onSuccess: async (id) => {
      queryClient.removeQueries({
        queryKey: [kind === "notes" ? "project-notes" : "meeting-minutes", id]
      });
      await refreshDocumentQueries(projectId, kind);
    }
  });
}

export async function refreshProjectDocument(projectId: string, kind: ProjectDocumentKind, id: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["projects", projectId, kind] }),
    queryClient.invalidateQueries({ queryKey: ["projects", projectId, "log"] }),
    queryClient.invalidateQueries({ queryKey: ["projects", projectId, "timeline-events"] }),
    queryClient.invalidateQueries({
      queryKey: [kind === "notes" ? "project-notes" : "meeting-minutes", id]
    })
  ]);
}
