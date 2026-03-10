import { NextResponse } from "next/server";

import { toggleScheduleStatus } from "@/lib/storage";

interface Params {
  params: { id: string };
}

export async function POST(_: Request, { params }: Params) {
  const updated = await toggleScheduleStatus(params.id);
  if (!updated) {
    return NextResponse.json({ message: "일정을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(updated);
}

