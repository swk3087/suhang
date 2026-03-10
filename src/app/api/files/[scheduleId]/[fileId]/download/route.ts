import { promises as fs } from "node:fs";

import { NextResponse } from "next/server";

import { encodeDownloadFileName } from "@/lib/route-utils";
import { getStoredFile } from "@/lib/storage";

interface Params {
  params: { scheduleId: string; fileId: string };
}

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: Params) {
  const found = await getStoredFile(params.scheduleId, params.fileId);
  if (!found) {
    return NextResponse.json(
      { message: "첨부파일을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const raw = await fs.readFile(found.absolutePath);
  const encodedName = encodeDownloadFileName(found.metadata.originalName);

  return new NextResponse(raw, {
    headers: {
      "Content-Type": found.metadata.mimeType || "application/octet-stream",
      "Content-Length": String(raw.byteLength),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
