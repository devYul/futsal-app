"use client";

import { useState, useTransition } from "react";
import { updateMemberRating } from "@/app/actions";

const POSITIONS = ["", "GK", "DF", "MF", "FW"];

export default function MemberEditor({
  userId,
  name,
  rating,
  position,
}: {
  userId: string;
  name: string;
  rating: number;
  position: string | null;
}) {
  const [r, setR] = useState(rating);
  const [pos, setPos] = useState(position ?? "");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function save(newR: number, newPos: string) {
    setSaved(false);
    start(async () => {
      await updateMemberRating(userId, newR, newPos || null);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <div className="card p-4">
      <div className="flex justify-between items-center mb-3">
        <span className="font-semibold">{name}</span>
        {saved && <span className="text-xs text-primary">저장됨 ✓</span>}
      </div>

      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs text-muted w-12">포지션</span>
        <div className="flex gap-1.5">
          {POSITIONS.map((p) => (
            <button
              key={p || "none"}
              disabled={pending}
              onClick={() => {
                setPos(p);
                save(r, p);
              }}
              className={`text-xs px-2.5 py-1 rounded-md border ${
                pos === p
                  ? "bg-primary text-white border-primary"
                  : "border-border text-muted"
              }`}
            >
              {p || "-"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-muted w-12">실력</span>
        <input
          type="range"
          min={1}
          max={5}
          step={0.5}
          value={r}
          disabled={pending}
          onChange={(e) => setR(Number(e.target.value))}
          onPointerUp={() => save(r, pos)}
          className="flex-1 accent-[var(--primary)]"
        />
        <span className="text-sm font-bold w-8 text-right">{r.toFixed(1)}</span>
      </div>
    </div>
  );
}
