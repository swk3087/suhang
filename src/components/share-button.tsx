"use client";

import { useState } from "react";

interface ShareButtonProps {
  path: string;
  label: string;
  title?: string;
}

function toAbsoluteUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}

async function copyFallback(value: string): Promise<boolean> {
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "true");
  input.style.position = "fixed";
  input.style.top = "-1000px";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(input);
  return copied;
}

export default function ShareButton({ path, label, title }: ShareButtonProps) {
  const [message, setMessage] = useState("");

  const handleShare = async () => {
    const absoluteUrl = toAbsoluteUrl(path);

    if (navigator.share) {
      try {
        await navigator.share({
          title: title ?? "링크 공유",
          text: absoluteUrl,
          url: absoluteUrl,
        });
        setMessage("공유됨");
        return;
      } catch {
        // 사용자가 공유를 취소한 경우를 포함해 클립보드 폴백으로 이동한다.
      }
    }

    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setMessage("복사됨");
      return;
    } catch {
      const copied = await copyFallback(absoluteUrl);
      setMessage(copied ? "복사됨" : "실패");
    }
  };

  return (
    <button type="button" className="miniButton" onClick={handleShare}>
      {label}
      {message ? <span className="miniButtonHint">{message}</span> : null}
    </button>
  );
}

