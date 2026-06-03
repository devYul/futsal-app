"use client";

import { useState, useTransition } from "react";
import { setRsvp } from "@/app/actions";
import type { RsvpStatus } from "@/lib/types";

const options: { value: RsvpStatus; label: string; emoji: string }[] = [
  { value: "yes", label: "참석", emoji: "✅" },
  { value: "maybe", label: "미정", emoji: "🤔" },
  { value: "no", label: "불참", emoji: "❌" },
];

export default function RsvpButtons({
  eventId,
  current,
  locked = false,
}: {
  eventId: string;
  current: RsvpStatus | null;
  locked?: boolean;
}) {
  const [sel, setSel] = useState<RsvpStatus | null>(current);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function choose(v: RsvpStatus) {
    if (locked) return;
    const prev = sel;
    setSel(v);
    setErr(null);
    start(async () => {
      try {
        await setRsvp(eventId, v);
      } catch (e: unknown) {
        setSel(prev);
        setErr(e instanceof Error ? e.message : "오류가 발생했습니다.");
      }
    });
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            disabled={pending || locked}
            onClick={() => choose(o.value)}
            className={`btn ${
              sel === o.value ? "btn-primary" : "btn-ghost"
            } flex-col py-3`}
          >
            <span className="text-xl">{o.emoji}</span>
            <span className="text-xs">{o.label}</span>
          </button>
        ))}
      </div>
      {locked && (
        <p className="text-xs text-muted mt-2">참석 응답이 마감되었습니다.</p>
      )}
      {err && <p className="text-sm text-amber-400 mt-2">{err}</p>}
    </div>
  );
}
