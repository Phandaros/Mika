import type { AttachmentDto } from "./attachment.js";
import type { User } from "./user.js";

export interface ProjectDocumentListResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ProjectNoteDto {
  id: string;
  projectId: string;
  title: string;
  content: string | null;
  noteDate: string;
  authorId: string;
  author: User;
  attachments: AttachmentDto[];
  createdAt: string;
  updatedAt: string;
}

export interface MeetingMinuteParticipantDto {
  id: string;
  userId: string;
  user: User;
}

export interface MeetingMinuteDto {
  id: string;
  projectId: string;
  title: string;
  meetingDate: string;
  meetingTime: string | null;
  content: string | null;
  externalParticipants: string[];
  authorId: string;
  author: User;
  participants: MeetingMinuteParticipantDto[];
  attachments: AttachmentDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectNoteRequest {
  title: string;
  noteDate: string;
  content?: string | null;
}

export interface UpdateProjectNoteRequest extends CreateProjectNoteRequest {
  expectedUpdatedAt: string;
}

export interface CreateMeetingMinuteRequest {
  title: string;
  meetingDate: string;
  meetingTime?: string | null;
  content?: string | null;
  participantUserIds?: string[];
  externalParticipants?: string[];
}

export interface UpdateMeetingMinuteRequest extends CreateMeetingMinuteRequest {
  expectedUpdatedAt: string;
}

export type ProjectNotesResponse = ProjectDocumentListResponse<ProjectNoteDto>;
export type MeetingMinutesResponse = ProjectDocumentListResponse<MeetingMinuteDto>;

export type ProjectTimelineEventType = "NOTE" | "MEETING_MINUTE";

export interface ProjectTimelineEventDto {
  id: string;
  projectId: string;
  type: ProjectTimelineEventType;
  title: string;
  eventDate: string;
  author: Pick<User, "id" | "name" | "avatarUrl">;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTimelineEventsResponse {
  events: ProjectTimelineEventDto[];
}

export type ProjectLogEntryType =
  | "NOTE"
  | "MEETING_MINUTE"
  | "TASK_CREATED"
  | "TASK_COMPLETED"
  | "TASK_REOPENED"
  | "TASK_UPDATED"
  | "TASK_REVIEW"
  | "TASK_DELETED"
  | "TASK_COMMENT";

export interface ProjectLogEntryDto {
  id: string;
  type: ProjectLogEntryType;
  occurredAt: string;
  actor: Pick<User, "id" | "name" | "avatarUrl"> | null;
  task: { id: string; name: string; deleted: boolean } | null;
  /** Tipo bruto de TaskActivity (ex.: REVIEW_APPROVED), quando a entrada vem do histórico da tarefa. */
  activityType: string | null;
  field: string | null;
  fromValue: string | null;
  toValue: string | null;
  metadata: Record<string, unknown> | null;
  note: ProjectNoteDto | null;
  meetingMinute: Pick<MeetingMinuteDto, "id" | "title" | "meetingDate" | "meetingTime"> | null;
  comment: { id: string; content: string } | null;
  /** Evento reconstruído a partir das datas da tarefa (ex.: import do Asana), sem registro de atividade. */
  derived: boolean;
}

export interface ProjectLogResponse {
  entries: ProjectLogEntryDto[];
  nextCursor: string | null;
}
