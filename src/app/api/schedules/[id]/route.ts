import { NextResponse } from "next/server";

import { getSchedule } from "@/lib/storage";

interface Params {
  params: { id: string };
}

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: Params) {
  const schedule = await getSchedule(params.id);
  if (!schedule) {
    return NextResponse.json({ message: "일정을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({
    ...schedule,
    sharePath: `/schedule/${schedule.id}`,
  });
}
