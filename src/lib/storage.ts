import "server-only";

import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import type {
  AdminScheduleSummary,
  FileAttachment,
  LinkAttachment,
  PaginatedScheduleResult,
  ScheduleRecord,
  ScheduleStatus,
  ScheduleSummary,
  TextAttachment,
} from "@/lib/types";

const DATA_ROOT = path.join(process.cwd(), "data");
const SCHEDULE_ROOT = path.join(DATA_ROOT, "schedules");
const SCHEDULE_ITEM_ROOT = path.join(SCHEDULE_ROOT, "items");
const FILE_ROOT = path.join(DATA_ROOT, "files");
const SCHEDULE_INDEX_PATH = path.join(SCHEDULE_ROOT, "index.json");

interface ScheduleIndexFile {
  items: ScheduleSummary[];
}

interface CreateScheduleInput {
  id?: string;
  title: string;
  body: string;
  status: ScheduleStatus;
  fileAttachments: FileAttachment[];
  linkAttachments: LinkAttachment[];
  textAttachments: TextAttachment[];
}

interface UpdateScheduleInput {
  id: string;
  title: string;
  body: string;
  status: ScheduleStatus;
  keepFileIds: string[];
  newFileAttachments: FileAttachment[];
  linkAttachments: LinkAttachment[];
  textAttachments: TextAttachment[];
}

const EMPTY_INDEX: ScheduleIndexFile = { items: [] };
const ACTIVE_STATUS: ScheduleStatus = "active";
let mutationQueue: Promise<void> = Promise.resolve();

function nowIso(): string {
  return new Date().toISOString();
}

function schedulePath(scheduleId: string): string {
  return path.join(SCHEDULE_ITEM_ROOT, `${scheduleId}.json`);
}

function statusWeight(status: ScheduleStatus): number {
  return status === ACTIVE_STATUS ? 0 : 1;
}

function sortForDisplay(items: ScheduleSummary[]): ScheduleSummary[] {
  return [...items].sort((left, right) => {
    const statusDiff = statusWeight(left.status) - statusWeight(right.status);
    if (statusDiff !== 0) {
      return statusDiff;
    }

    const orderDiff = left.order - right.order;
    if (orderDiff !== 0) {
      return orderDiff;
    }

    return left.createdAt.localeCompare(right.createdAt);
  });
}

function sortWithinStatus(
  items: ScheduleSummary[],
  status: ScheduleStatus,
): ScheduleSummary[] {
  return items
    .filter((item) => item.status === status)
    .sort((left, right) => left.order - right.order);
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tempPath = `${filePath}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(tempPath, filePath);
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureStore(): Promise<void> {
  await fs.mkdir(SCHEDULE_ITEM_ROOT, { recursive: true });
  await fs.mkdir(FILE_ROOT, { recursive: true });
}

async function readScheduleIndex(): Promise<ScheduleIndexFile> {
  await ensureStore();

  try {
    const raw = await fs.readFile(SCHEDULE_INDEX_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<ScheduleIndexFile>;
    if (!parsed.items || !Array.isArray(parsed.items)) {
      return { ...EMPTY_INDEX };
    }
    return {
      items: parsed.items.filter((item): item is ScheduleSummary => {
        return (
          typeof item?.id === "string" &&
          typeof item?.title === "string" &&
          (item?.status === "active" || item?.status === "inactive") &&
          typeof item?.order === "number" &&
          typeof item?.createdAt === "string" &&
          typeof item?.updatedAt === "string"
        );
      }),
    };
  } catch {
    return { ...EMPTY_INDEX };
  }
}

async function writeScheduleIndex(index: ScheduleIndexFile): Promise<void> {
  await ensureStore();
  await writeJsonAtomic(SCHEDULE_INDEX_PATH, index);
}

async function readScheduleFile(scheduleId: string): Promise<ScheduleRecord | null> {
  try {
    const raw = await fs.readFile(schedulePath(scheduleId), "utf8");
    return JSON.parse(raw) as ScheduleRecord;
  } catch {
    return null;
  }
}

async function writeScheduleFile(record: ScheduleRecord): Promise<void> {
  await ensureStore();
  await writeJsonAtomic(schedulePath(record.id), record);
}

function nextOrder(items: ScheduleSummary[], status: ScheduleStatus): number {
  const statusItems = items.filter((item) => item.status === status);
  if (statusItems.length === 0) {
    return 1;
  }

  return Math.max(...statusItems.map((item) => item.order)) + 1;
}

async function normalizeGroupOrder(
  indexItems: ScheduleSummary[],
  status: ScheduleStatus,
): Promise<void> {
  const ordered = sortWithinStatus(indexItems, status);
  const changedAt = nowIso();

  for (let index = 0; index < ordered.length; index += 1) {
    const expectedOrder = index + 1;
    const summary = ordered[index];
    if (summary.order === expectedOrder) {
      continue;
    }

    summary.order = expectedOrder;
    summary.updatedAt = changedAt;

    const record = await readScheduleFile(summary.id);
    if (!record) {
      continue;
    }

    record.order = expectedOrder;
    record.updatedAt = changedAt;
    await writeScheduleFile(record);
  }
}

async function withMutationLock<T>(task: () => Promise<T>): Promise<T> {
  const run = mutationQueue.then(task, task);
  mutationQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function safeExt(fileName: string): string {
  const extension = path.extname(fileName).slice(0, 12);
  return /^[a-zA-Z0-9.]+$/.test(extension) ? extension : "";
}

function toRelativeFilePath(scheduleId: string, storedName: string): string {
  return `${scheduleId}/${storedName}`.replaceAll("\\", "/");
}

export async function storeUploadedFiles(
  scheduleId: string,
  files: File[],
): Promise<FileAttachment[]> {
  await ensureStore();
  const scheduleFileRoot = path.join(FILE_ROOT, scheduleId);
  await fs.mkdir(scheduleFileRoot, { recursive: true });

  const storedFiles: FileAttachment[] = [];

  for (const file of files) {
    if (!file || file.size === 0) {
      continue;
    }

    const originalName = path.basename(file.name || "attachment");
    const extension = safeExt(originalName);
    const storedName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    const relativePath = toRelativeFilePath(scheduleId, storedName);
    const absolutePath = path.join(FILE_ROOT, relativePath);

    const raw = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(absolutePath, raw);

    storedFiles.push({
      id: crypto.randomUUID(),
      originalName,
      storedName,
      relativePath,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      createdAt: nowIso(),
    });
  }

  return storedFiles;
}

export async function listPublicSchedules(
  cursor: number,
  limit: number,
): Promise<PaginatedScheduleResult> {
  const safeCursor = Number.isFinite(cursor) && cursor >= 0 ? Math.floor(cursor) : 0;
  const safeLimit =
    Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 30;

  const index = await readScheduleIndex();
  const sorted = sortForDisplay(index.items);
  const page = sorted.slice(safeCursor, safeCursor + safeLimit);
  const nextCursor =
    safeCursor + safeLimit < sorted.length ? String(safeCursor + safeLimit) : null;

  return {
    items: page,
    nextCursor,
  };
}

export async function listAdminSchedules(): Promise<AdminScheduleSummary[]> {
  const index = await readScheduleIndex();
  const sorted = sortForDisplay(index.items);

  const withCounts = await Promise.all(
    sorted.map(async (summary) => {
      const detail = await readScheduleFile(summary.id);
      return {
        ...summary,
        fileCount: detail?.fileAttachments.length ?? 0,
        linkCount: detail?.linkAttachments.length ?? 0,
        textCount: detail?.textAttachments.length ?? 0,
      } satisfies AdminScheduleSummary;
    }),
  );

  return withCounts;
}

export async function getSchedule(scheduleId: string): Promise<ScheduleRecord | null> {
  return readScheduleFile(scheduleId);
}

export async function createSchedule(
  input: CreateScheduleInput,
): Promise<ScheduleRecord> {
  return withMutationLock(async () => {
    const index = await readScheduleIndex();
    const scheduleId = input.id ?? crypto.randomUUID();
    const createdAt = nowIso();

    const summary: ScheduleSummary = {
      id: scheduleId,
      title: input.title,
      status: input.status,
      order: nextOrder(index.items, input.status),
      createdAt,
      updatedAt: createdAt,
    };

    const record: ScheduleRecord = {
      ...summary,
      body: input.body,
      fileAttachments: input.fileAttachments,
      linkAttachments: input.linkAttachments,
      textAttachments: input.textAttachments,
    };

    index.items.push(summary);
    await writeScheduleFile(record);
    await writeScheduleIndex(index);
    return record;
  });
}

export async function updateSchedule(
  input: UpdateScheduleInput,
): Promise<ScheduleRecord | null> {
  return withMutationLock(async () => {
    const index = await readScheduleIndex();
    const summary = index.items.find((item) => item.id === input.id);
    if (!summary) {
      return null;
    }

    const current = await readScheduleFile(input.id);
    if (!current) {
      return null;
    }

    const keepSet = new Set(input.keepFileIds);
    const keptFiles = current.fileAttachments.filter((file) => keepSet.has(file.id));
    const mergedFiles = [...keptFiles, ...input.newFileAttachments];
    const isStatusChanged = summary.status !== input.status;
    const previousStatus = summary.status;
    const updatedAt = nowIso();

    summary.title = input.title;
    summary.updatedAt = updatedAt;

    if (isStatusChanged) {
      summary.status = input.status;
      summary.order = nextOrder(index.items.filter((item) => item.id !== input.id), input.status);
    }

    const updatedRecord: ScheduleRecord = {
      ...current,
      title: input.title,
      body: input.body,
      status: summary.status,
      order: summary.order,
      fileAttachments: mergedFiles,
      linkAttachments: input.linkAttachments,
      textAttachments: input.textAttachments,
      updatedAt,
    };

    await writeScheduleFile(updatedRecord);

    if (isStatusChanged) {
      await normalizeGroupOrder(index.items, previousStatus);
    }

    await writeScheduleIndex(index);
    return updatedRecord;
  });
}

export async function deleteSchedule(scheduleId: string): Promise<boolean> {
  return withMutationLock(async () => {
    const index = await readScheduleIndex();
    const itemIndex = index.items.findIndex((item) => item.id === scheduleId);
    if (itemIndex < 0) {
      return false;
    }

    const [removed] = index.items.splice(itemIndex, 1);
    await fs.rm(schedulePath(scheduleId), { force: true });
    await normalizeGroupOrder(index.items, removed.status);
    await writeScheduleIndex(index);
    return true;
  });
}

export async function toggleScheduleStatus(
  scheduleId: string,
): Promise<ScheduleRecord | null> {
  return withMutationLock(async () => {
    const index = await readScheduleIndex();
    const summary = index.items.find((item) => item.id === scheduleId);
    if (!summary) {
      return null;
    }

    const current = await readScheduleFile(scheduleId);
    if (!current) {
      return null;
    }

    const oldStatus = summary.status;
    const newStatus: ScheduleStatus = summary.status === "active" ? "inactive" : "active";
    const updatedAt = nowIso();

    summary.status = newStatus;
    summary.order = nextOrder(index.items.filter((item) => item.id !== scheduleId), newStatus);
    summary.updatedAt = updatedAt;

    current.status = newStatus;
    current.order = summary.order;
    current.updatedAt = updatedAt;

    await writeScheduleFile(current);
    await normalizeGroupOrder(index.items, oldStatus);
    await writeScheduleIndex(index);
    return current;
  });
}

export async function moveSchedule(
  scheduleId: string,
  direction: "up" | "down",
): Promise<ScheduleRecord | null> {
  return withMutationLock(async () => {
    const index = await readScheduleIndex();
    const summary = index.items.find((item) => item.id === scheduleId);
    if (!summary) {
      return null;
    }

    const group = sortWithinStatus(index.items, summary.status);
    const currentPosition = group.findIndex((item) => item.id === scheduleId);
    if (currentPosition < 0) {
      return null;
    }

    const targetPosition = direction === "up" ? currentPosition - 1 : currentPosition + 1;
    if (targetPosition < 0 || targetPosition >= group.length) {
      return readScheduleFile(scheduleId);
    }

    const target = group[targetPosition];
    const changedAt = nowIso();

    const previousOrder = summary.order;
    summary.order = target.order;
    target.order = previousOrder;
    summary.updatedAt = changedAt;
    target.updatedAt = changedAt;

    const [currentRecord, targetRecord] = await Promise.all([
      readScheduleFile(summary.id),
      readScheduleFile(target.id),
    ]);

    if (currentRecord) {
      currentRecord.order = summary.order;
      currentRecord.updatedAt = changedAt;
      await writeScheduleFile(currentRecord);
    }

    if (targetRecord) {
      targetRecord.order = target.order;
      targetRecord.updatedAt = changedAt;
      await writeScheduleFile(targetRecord);
    }

    await normalizeGroupOrder(index.items, summary.status);
    await writeScheduleIndex(index);
    return readScheduleFile(scheduleId);
  });
}

export async function getStoredFile(
  scheduleId: string,
  fileId: string,
): Promise<{ metadata: FileAttachment; absolutePath: string } | null> {
  const schedule = await readScheduleFile(scheduleId);
  if (!schedule) {
    return null;
  }

  const metadata = schedule.fileAttachments.find((file) => file.id === fileId);
  if (!metadata) {
    return null;
  }

  const absolutePath = path.join(FILE_ROOT, metadata.relativePath);
  if (!(await exists(absolutePath))) {
    return null;
  }

  return { metadata, absolutePath };
}
