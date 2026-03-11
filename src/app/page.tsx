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
      <ScheduleFeed initialItems={seededItems} initialCursor={initial.nextCursor} />
    </main>
  );
}
