export type ScheduleStatus = "active" | "inactive";

export interface LinkAttachment {
  id: string;
  label: string;
  url: string;
}

export interface TextAttachment {
  id: string;
  title: string;
  content: string;
}

export interface FileAttachment {
  id: string;
  originalName: string;
  storedName: string;
  relativePath: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface ScheduleSummary {
  id: string;
  title: string;
  status: ScheduleStatus;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleRecord extends ScheduleSummary {
  body: string;
  fileAttachments: FileAttachment[];
  linkAttachments: LinkAttachment[];
  textAttachments: TextAttachment[];
}

export interface PaginatedScheduleResult {
  items: ScheduleSummary[];
  nextCursor: string | null;
}

export interface AdminScheduleSummary extends ScheduleSummary {
  fileCount: number;
  linkCount: number;
  textCount: number;
}

