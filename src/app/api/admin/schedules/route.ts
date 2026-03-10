import crypto from "node:crypto";

import { NextResponse } from "next/server";

import {
  normalizeString,
  parseFiles,
  parseLinks,
  parseStatus,
  parseTextAttachments,
} from "@/lib/route-utils";
import { createSchedule, listAdminSchedules, storeUploadedFiles } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const schedules = await listAdminSchedules();
  return NextResponse.json({ items: schedules });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const title = normalizeString(formData.get("title"));
  const body = normalizeString(formData.get("body"));
  const status = parseStatus(formData.get("status"));
  const linkAttachments = parseLinks(formData.get("linksJson"));
  const textAttachments = parseTextAttachments(formData.get("textsJson"));

  if (!title) {
    return NextResponse.json({ message: "제목은 필수입니다." }, { status: 400 });
  }

  const scheduleId = crypto.randomUUID();
  const files = parseFiles(formData);
  const fileAttachments = await storeUploadedFiles(scheduleId, files);

  const created = await createSchedule({
    id: scheduleId,
    title,
    body,
    status,
    fileAttachments,
    linkAttachments,
    textAttachments,
  });

  return NextResponse.json(created, { status: 201 });
}
