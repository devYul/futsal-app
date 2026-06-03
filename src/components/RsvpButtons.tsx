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
}: {
  eventId: string;
  current: RsvpStatus | null;
}) {
  const [sel, setSel] = useState<RsvpStatus | null>(current);
  const [pending, start] = useTransition();

  function choose(v: RsvpStatus) {
    setSel(v);
    start(() => setRsvp(eventId, v));
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          disabled={pending}
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
  );
}
