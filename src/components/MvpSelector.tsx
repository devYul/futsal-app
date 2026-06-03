"use client";

import { useState, useTransition } from "react";
import { setMvp } from "@/app/actions";

// 운영진이 당일 MVP 를 선택합니다.
export default function MvpSelector({
  eventId,
  current,
  candidates,
}: {
  eventId: string;
  current: string | null;
  candidates: { id: string; name: string }[];
}) {
  const [sel, setSel] = useState(current ?? "");
  const [pending, start] = useTransition();

  function choose(v: string) {
    setSel(v);
    start(() => setMvp(eventId, v || null));
  }

  return (
    <select
      value={sel}
      disabled={pending}
      onChange={(e) => choose(e.target.value)}
      className="input"
    >
      <option value="">MVP 선택 안함</option>
      {candidates.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
