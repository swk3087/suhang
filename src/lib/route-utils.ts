import crypto from "node:crypto";

import type { LinkAttachment, ScheduleStatus, TextAttachment } from "@/lib/types";

export function normalizeString(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

export function parseStatus(value: FormDataEntryValue | null): ScheduleStatus {
  return value === "inactive" ? "inactive" : "active";
}

export function parseLinks(value: FormDataEntryValue | null): LinkAttachment[] {
  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as Array<Partial<LinkAttachment>>;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => {
        const label = (entry.label ?? "").trim();
        const url = (entry.url ?? "").trim();
        if (!label || !url) {
          return null;
        }

        try {
          const normalizedUrl = new URL(url).toString();
          return {
            id: typeof entry.id === "string" && entry.id ? entry.id : crypto.randomUUID(),
            label,
            url: normalizedUrl,
          } satisfies LinkAttachment;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is LinkAttachment => Boolean(entry));
  } catch {
    return [];
  }
}

export function parseTextAttachments(value: FormDataEntryValue | null): TextAttachment[] {
  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as Array<Partial<TextAttachment>>;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => {
        const title = (entry.title ?? "").trim();
        const content = (entry.content ?? "").trim();
        if (!content) {
          return null;
        }

        return {
          id: typeof entry.id === "string" && entry.id ? entry.id : crypto.randomUUID(),
          title: title || "텍스트 첨부",
          content,
        } satisfies TextAttachment;
      })
      .filter((entry): entry is TextAttachment => Boolean(entry));
  } catch {
    return [];
  }
}

export function parseKeepFileIds(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function parseFiles(formData: FormData): File[] {
  const collected: File[] = [];

  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      continue;
    }

    if (key === "files" || /^files\[\d+\]$/.test(key)) {
      collected.push(value);
    }
  }

  return collected;
}

export function encodeDownloadFileName(name: string): string {
  return encodeURIComponent(name).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
