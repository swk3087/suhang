import { NextResponse } from "next/server";

import {
  normalizeString,
  parseFiles,
  parseKeepFileIds,
  parseLinks,
  parseStatus,
  parseTextAttachments,
} from "@/lib/route-utils";
import { deleteSchedule, storeUploadedFiles, updateSchedule } from "@/lib/storage";

interface Params {
  params: { id: string };
}

export async function PUT(request: Request, { params }: Params) {
  const formData = await request.formData();
  const title = normalizeString(formData.get("title"));
  const body = normalizeString(formData.get("body"));
  const status = parseStatus(formData.get("status"));
  const keepFileIds = parseKeepFileIds(formData.get("keepFileIdsJson"));
  const linkAttachments = parseLinks(formData.get("linksJson"));
  const textAttachments = parseTextAttachments(formData.get("textsJson"));

  if (!title) {
    return NextResponse.json({ message: "제목은 필수입니다." }, { status: 400 });
  }

  const newFiles = parseFiles(formData);
  const storedFiles = await storeUploadedFiles(params.id, newFiles);

  const updated = await updateSchedule({
    id: params.id,
    title,
    body,
    status,
    keepFileIds,
    newFileAttachments: storedFiles,
    linkAttachments,
    textAttachments,
  });

  if (!updated) {
    return NextResponse.json({ message: "일정을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: Params) {
  const removed = await deleteSchedule(params.id);
  if (!removed) {
    return NextResponse.json({ message: "일정을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

