import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="pageShell">
      <section className="hero">
        <p className="eyebrow">404</p>
        <h1>일정을 찾을 수 없습니다</h1>
        <p>삭제되었거나 잘못된 링크일 수 있습니다.</p>
        <Link href="/" className="secondaryLink">
          홈으로 이동
        </Link>
      </section>
    </main>
  );
}

