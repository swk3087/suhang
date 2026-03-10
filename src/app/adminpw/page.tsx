import Link from "next/link";

import AdminConsole from "@/components/admin-console";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <main className="pageShell">
      <section className="hero">
        <p className="eyebrow">ADMIN PANEL · NO AUTH</p>
        <h1>관리자 일정 제어</h1>
        <p>
          이 페이지는 인증 없이 동작합니다. 생성/수정/삭제/비활성화/순서 변경과 다중 첨부 업로드를
          바로 처리할 수 있습니다.
        </p>
        <Link href="/" className="secondaryLink">
          공개 홈으로
        </Link>
      </section>
      <AdminConsole />
    </main>
  );
}
