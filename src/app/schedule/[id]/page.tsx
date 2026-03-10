import Link from "next/link";
import { notFound } from "next/navigation";

import ShareButton from "@/components/share-button";
import { getSchedule } from "@/lib/storage";

interface Params {
  params: { id: string };
}

export const dynamic = "force-dynamic";

export default async function ScheduleDetailPage({ params }: Params) {
  const schedule = await getSchedule(params.id);
  if (!schedule) {
    notFound();
  }

  const scheduleSharePath = `/schedule/${schedule.id}`;

  return (
    <main className="pageShell">
      <section className="hero compactHero">
        <p className="eyebrow">{schedule.status === "active" ? "활성 일정" : "비활성 일정"}</p>
        <h1>{schedule.title}</h1>
        <p>{new Date(schedule.updatedAt).toLocaleString("ko-KR")}에 수정됨</p>
        <div className="heroActionRow">
          <ShareButton
            path={scheduleSharePath}
            label="일정 링크 공유"
            title={`${schedule.title} 공유`}
          />
          <Link href="/" className="secondaryLink">
            목록으로
          </Link>
        </div>
      </section>

      <section className="card">
        <h2 className="sectionTitle">본문</h2>
        <p className="bodyText">{schedule.body || "본문이 없습니다."}</p>
      </section>

      <section className="card">
        <h2 className="sectionTitle">파일 첨부</h2>
        {schedule.fileAttachments.length === 0 ? (
          <p className="subtle">첨부 파일이 없습니다.</p>
        ) : (
          <ul className="attachmentList">
            {schedule.fileAttachments.map((file) => {
              const downloadPath = `/api/files/${schedule.id}/${file.id}/download`;
              return (
                <li key={file.id} className="attachmentRow">
                  <div>
                    <p>{file.originalName}</p>
                    <p className="subtle">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <div className="attachmentActions">
                    <a href={downloadPath} className="miniButton">
                      다운로드
                    </a>
                    <ShareButton
                      path={downloadPath}
                      label="파일 링크 공유"
                      title={`${file.originalName} 다운로드 링크`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="sectionTitle">링크 첨부</h2>
        {schedule.linkAttachments.length === 0 ? (
          <p className="subtle">링크 첨부가 없습니다.</p>
        ) : (
          <ul className="attachmentList">
            {schedule.linkAttachments.map((link) => (
              <li key={link.id} className="attachmentRow">
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="scheduleLink">
                  {link.label}
                </a>
                <ShareButton path={link.url} label="링크 공유" title={link.label} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="sectionTitle">텍스트 첨부</h2>
        {schedule.textAttachments.length === 0 ? (
          <p className="subtle">텍스트 첨부가 없습니다.</p>
        ) : (
          <div className="textAttachmentGrid">
            {schedule.textAttachments.map((entry) => (
              <article key={entry.id} className="subCard">
                <h3>{entry.title || "텍스트 첨부"}</h3>
                <p className="bodyText">{entry.content}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
