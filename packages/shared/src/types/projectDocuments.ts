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
