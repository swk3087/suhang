"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  AdminScheduleSummary,
  FileAttachment,
  LinkAttachment,
  ScheduleRecord,
  ScheduleStatus,
  TextAttachment,
} from "@/lib/types";

type EditableLink = LinkAttachment;
type EditableText = TextAttachment;

function defaultLink(): EditableLink {
  return {
    id: crypto.randomUUID(),
    label: "",
    url: "",
  };
}

function defaultText(): EditableText {
  return {
    id: crypto.randomUUID(),
    title: "",
    content: "",
  };
}

function statusKorean(status: ScheduleStatus): string {
  return status === "active" ? "활성" : "비활성";
}

export default function AdminConsole() {
  const [items, setItems] = useState<AdminScheduleSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<ScheduleStatus>("active");
  const [links, setLinks] = useState<EditableLink[]>([]);
  const [texts, setTexts] = useState<EditableText[]>([]);
  const [existingFiles, setExistingFiles] = useState<FileAttachment[]>([]);
  const [removedFileIds, setRemovedFileIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadSchedules = useCallback(async () => {
    setListLoading(true);
    setListError("");

    try {
      const response = await fetch("/api/admin/schedules", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("관리자 목록을 불러오지 못했습니다.");
      }

      const payload = (await response.json()) as { items: AdminScheduleSummary[] };
      setItems(payload.items);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "알 수 없는 오류");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSchedules();
  }, [loadSchedules]);

  const resetForm = useCallback(() => {
    setMode("create");
    setEditingId(null);
    setTitle("");
    setBody("");
    setStatus("active");
    setLinks([]);
    setTexts([]);
    setExistingFiles([]);
    setRemovedFileIds(new Set());
    setFormError("");
    setFormMessage("");
    setFileInputKey((prev) => prev + 1);
  }, []);

  const activeKeepFileIds = useMemo(() => {
    return existingFiles
      .filter((file) => !removedFileIds.has(file.id))
      .map((file) => file.id);
  }, [existingFiles, removedFileIds]);

  const loadForEdit = async (id: string) => {
    setFormError("");
    setFormMessage("");
    const response = await fetch(`/api/schedules/${id}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("일정 상세를 불러오지 못했습니다.");
    }

    const detail = (await response.json()) as ScheduleRecord;
    setMode("edit");
    setEditingId(detail.id);
    setTitle(detail.title);
    setBody(detail.body);
    setStatus(detail.status);
    setLinks(detail.linkAttachments.length > 0 ? detail.linkAttachments : []);
    setTexts(detail.textAttachments.length > 0 ? detail.textAttachments : []);
    setExistingFiles(detail.fileAttachments);
    setRemovedFileIds(new Set());
    setFileInputKey((prev) => prev + 1);
  };

  const submitForm = async () => {
    setSubmitting(true);
    setFormError("");
    setFormMessage("");

    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("body", body.trim());
      formData.append("status", status);
      formData.append(
        "linksJson",
        JSON.stringify(
          links.map((link) => ({
            id: link.id,
            label: link.label.trim(),
            url: link.url.trim(),
          })),
        ),
      );
      formData.append(
        "textsJson",
        JSON.stringify(
          texts.map((entry) => ({
            id: entry.id,
            title: entry.title.trim(),
            content: entry.content.trim(),
          })),
        ),
      );
      formData.append("keepFileIdsJson", JSON.stringify(activeKeepFileIds));

      const selectedFiles = fileInputRef.current?.files;
      if (selectedFiles) {
        Array.from(selectedFiles).forEach((file, index) => {
          formData.append(`files[${index}]`, file);
        });
      }

      const isEdit = mode === "edit" && editingId;
      const targetUrl = isEdit ? `/api/admin/schedules/${editingId}` : "/api/admin/schedules";
      const method = isEdit ? "PUT" : "POST";

      const response = await fetch(targetUrl, {
        method,
        body: formData,
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(errorPayload?.message ?? "저장에 실패했습니다.");
      }

      setFormMessage(isEdit ? "수정 완료" : "등록 완료");
      if (!isEdit) {
        resetForm();
      } else {
        const latest = (await response.json()) as ScheduleRecord;
        setExistingFiles(latest.fileAttachments);
        setRemovedFileIds(new Set());
        setFileInputKey((prev) => prev + 1);
      }

      await loadSchedules();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "알 수 없는 오류");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteItem = async (id: string) => {
    if (!window.confirm("정말 삭제할까요? 메타데이터만 삭제되고 파일은 디스크에 남습니다.")) {
      return;
    }

    const response = await fetch(`/api/admin/schedules/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      setListError(payload?.message ?? "삭제 실패");
      return;
    }

    if (editingId === id) {
      resetForm();
    }
    await loadSchedules();
  };

  const toggleStatus = async (id: string) => {
    const response = await fetch(`/api/admin/schedules/${id}/toggle`, { method: "POST" });
    if (!response.ok) {
      setListError("상태 변경에 실패했습니다.");
      return;
    }
    await loadSchedules();
  };

  const moveItem = async (id: string, direction: "up" | "down") => {
    const response = await fetch(`/api/admin/schedules/${id}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
    });
    if (!response.ok) {
      setListError("순서 변경에 실패했습니다.");
      return;
    }
    await loadSchedules();
  };

  return (
    <div className="adminGrid">
      <section className="card">
        <div className="formHeader">
          <h2 className="sectionTitle">
            {mode === "create" ? "새 일정 등록" : "일정 수정"}
          </h2>
          {mode === "edit" ? (
            <button type="button" className="miniButton" onClick={resetForm}>
              새로 작성
            </button>
          ) : null}
        </div>

        <div className="formBlock">
          <label className="fieldLabel">
            제목
            <input
              className="textField"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="예: 수학 일정"
            />
          </label>

          <label className="fieldLabel">
            본문
            <textarea
              className="textArea"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={6}
              placeholder="세부 내용을 입력하세요."
            />
          </label>

          <label className="fieldLabel">
            상태
            <select
              className="selectField"
              value={status}
              onChange={(event) => setStatus(event.target.value as ScheduleStatus)}
            >
              <option value="active">활성</option>
              <option value="inactive">비활성</option>
            </select>
          </label>

          <label className="fieldLabel">
            파일 첨부 (여러 개 가능)
            <input key={fileInputKey} ref={fileInputRef} className="fileField" type="file" multiple />
          </label>

          {existingFiles.length > 0 ? (
            <div>
              <p className="fieldTitle">기존 파일</p>
              <ul className="inlineList">
                {existingFiles.map((file) => {
                  const removed = removedFileIds.has(file.id);
                  return (
                    <li key={file.id} className={`inlineListRow ${removed ? "muted" : ""}`}>
                      <span>{file.originalName}</span>
                      <button
                        type="button"
                        className="miniButton"
                        onClick={() => {
                          setRemovedFileIds((previous) => {
                            const next = new Set(previous);
                            if (next.has(file.id)) {
                              next.delete(file.id);
                            } else {
                              next.add(file.id);
                            }
                            return next;
                          });
                        }}
                      >
                        {removed ? "복원" : "제외"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="subCard">
          <div className="subCardHeader">
            <h3>링크 첨부</h3>
            <button
              type="button"
              className="miniButton"
              onClick={() => setLinks((prev) => [...prev, defaultLink()])}
            >
              + 링크
            </button>
          </div>
          {links.length === 0 ? <p className="subtle">링크 첨부 없음</p> : null}
          {links.map((entry, index) => (
            <div key={entry.id} className="stackRow">
              <input
                className="textField"
                value={entry.label}
                placeholder="링크 이름"
                onChange={(event) =>
                  setLinks((prev) =>
                    prev.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, label: event.target.value } : item,
                    ),
                  )
                }
              />
              <input
                className="textField"
                value={entry.url}
                placeholder="https://..."
                onChange={(event) =>
                  setLinks((prev) =>
                    prev.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, url: event.target.value } : item,
                    ),
                  )
                }
              />
              <button
                type="button"
                className="miniButton danger"
                onClick={() => setLinks((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
              >
                삭제
              </button>
            </div>
          ))}
        </div>

        <div className="subCard">
          <div className="subCardHeader">
            <h3>텍스트 첨부</h3>
            <button
              type="button"
              className="miniButton"
              onClick={() => setTexts((prev) => [...prev, defaultText()])}
            >
              + 텍스트
            </button>
          </div>
          {texts.length === 0 ? <p className="subtle">텍스트 첨부 없음</p> : null}
          {texts.map((entry, index) => (
            <div key={entry.id} className="stackRow">
              <input
                className="textField"
                value={entry.title}
                placeholder="첨부 제목(선택)"
                onChange={(event) =>
                  setTexts((prev) =>
                    prev.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, title: event.target.value } : item,
                    ),
                  )
                }
              />
              <textarea
                className="textArea compact"
                value={entry.content}
                placeholder="텍스트 첨부 내용"
                onChange={(event) =>
                  setTexts((prev) =>
                    prev.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, content: event.target.value } : item,
                    ),
                  )
                }
              />
              <button
                type="button"
                className="miniButton danger"
                onClick={() => setTexts((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
              >
                삭제
              </button>
            </div>
          ))}
        </div>

        {formError ? <p className="errorText">{formError}</p> : null}
        {formMessage ? <p className="successText">{formMessage}</p> : null}
        <button
          type="button"
          className="primaryButton"
          disabled={submitting}
          onClick={() => void submitForm()}
        >
          {submitting ? "저장 중..." : mode === "create" ? "등록" : "수정 저장"}
        </button>
      </section>

      <section className="card">
        <h2 className="sectionTitle">등록된 일정</h2>
        <p className="subtle">
          위/아래 버튼은 같은 상태 그룹 안에서만 이동합니다. 공개 홈에서는 활성 목록이 먼저 보입니다.
        </p>
        {listError ? <p className="errorText">{listError}</p> : null}
        {listLoading ? <p className="subtle">불러오는 중...</p> : null}
        <ul className="adminList">
          {items.map((item) => (
            <li key={item.id} className="adminRow">
              <div>
                <p className="adminTitle">{item.title}</p>
                <p className="subtle">
                  {statusKorean(item.status)} · 파일 {item.fileCount} · 링크 {item.linkCount} ·
                  텍스트 {item.textCount}
                </p>
              </div>
              <div className="adminActions">
                <button type="button" className="miniButton" onClick={() => void loadForEdit(item.id)}>
                  수정
                </button>
                <button type="button" className="miniButton" onClick={() => void moveItem(item.id, "up")}>
                  위
                </button>
                <button
                  type="button"
                  className="miniButton"
                  onClick={() => void moveItem(item.id, "down")}
                >
                  아래
                </button>
                <button
                  type="button"
                  className="miniButton"
                  onClick={() => void toggleStatus(item.id)}
                >
                  {item.status === "active" ? "비활성화" : "활성화"}
                </button>
                <button
                  type="button"
                  className="miniButton danger"
                  onClick={() => void deleteItem(item.id)}
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
          {items.length === 0 && !listLoading ? (
            <li className="emptyRow">아직 등록된 일정이 없습니다.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
