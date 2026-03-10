import Link from "next/link";

import ScheduleFeed from "@/components/schedule-feed";
import { listPublicSchedules } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const initial = await listPublicSchedules(0, 30);
  const seededItems = initial.items.map((item) => ({
    ...item,
    detailPath: `/schedule/${item.id}`,
  }));

  return (
    <main className="pageShell">
      <section className="hero">
        <p className="eyebrow">NO LOGIN · MOBILE READY</p>
        <h1>수행 일정 보드</h1>
        <p>
          관리자가 설정한 순서대로 수행 목록을 확인하고, 제목을 눌러 본문과 첨부 파일/링크를 볼
          수 있습니다.
        </p>
        <Link href="/adminpw" className="primaryLink">
          관리자 화면 열기
        </Link>
      </section>

      <ScheduleFeed initialItems={seededItems} initialCursor={initial.nextCursor} />
    </main>
  );
}
