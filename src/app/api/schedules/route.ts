import { NextResponse } from "next/server";

import { listPublicSchedules } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cursor = Number(searchParams.get("cursor") ?? "0");
  const limit = Number(searchParams.get("limit") ?? "30");

  const result = await listPublicSchedules(cursor, limit);
  const items = result.items.map((item) => ({
    ...item,
    detailPath: `/schedule/${item.id}`,
  }));

  return NextResponse.json({
    items,
    nextCursor: result.nextCursor,
  });
}
