"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ScheduleStatus, ScheduleSummary } from "@/lib/types";

interface PublicListItem extends ScheduleSummary {
  detailPath: string;
}

interface ScheduleFeedProps {
  initialItems: PublicListItem[];
  initialCursor: string | null;
}

function statusLabel(status: ScheduleStatus): string {
  return status === "active" ? "활성" : "비활성";
}

export default function ScheduleFeed({
  initialItems,
  initialCursor,
}: ScheduleFeedProps) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const anchorRef = useRef<HTMLDivElement | null>(null);

  const hasNext = useMemo(() => Boolean(cursor), [cursor]);

  const loadMore = useCallback(async () => {
    if (!cursor || loading) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/schedules?cursor=${cursor}&limit=30`, {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("목록을 불러오지 못했습니다.");
      }

      const payload = (await response.json()) as {
        items: PublicListItem[];
        nextCursor: string | null;
      };

      setItems((previous) => [...previous, ...payload.items]);
      setCursor(payload.nextCursor);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }, [cursor, loading]);

  useEffect(() => {
    if (!hasNext || !anchorRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(anchorRef.current);
    return () => observer.disconnect();
  }, [hasNext, loadMore]);

  return (
    <section className="card">
      <h2 className="sectionTitle">3-3 수행평가 일정</h2>
      <p className="subtle"></p>
      <ul className="scheduleList">
        {items.map((item) => (
          <li
            key={item.id}
            className={`scheduleRow ${item.status === "inactive" ? "isInactive" : ""}`}
          >
            <div className="scheduleRowMain">
              <Link href={item.detailPath} className="scheduleLink">
                {item.title}
              </Link>
              <span className="scheduleMeta">{statusLabel(item.status)}</span>
            </div>
            <time className="scheduleTime">
              {new Date(item.updatedAt).toLocaleString("ko-KR")}
            </time>
          </li>
        ))}
      </ul>
      {error ? <p className="errorText">{error}</p> : null}
      {loading ? <p className="subtle">불러오는 중...</p> : null}
      {hasNext ? <div ref={anchorRef} className="feedAnchor" /> : null}
    </section>
  );
}
