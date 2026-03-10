import { NextResponse } from "next/server";

import { moveSchedule } from "@/lib/storage";

interface Params {
  params: { id: string };
}

interface MoveRequestBody {
  direction?: "up" | "down";
}

export async function POST(request: Request, { params }: Params) {
  const body = (await request.json().catch(() => ({}))) as MoveRequestBody;
  if (body.direction !== "up" && body.direction !== "down") {
    return NextResponse.json({ message: "잘못된 이동 방향입니다." }, { status: 400 });
  }

  const moved = await moveSchedule(params.id, body.direction);
  if (!moved) {
    return NextResponse.json({ message: "일정을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(moved);
}

