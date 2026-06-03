"use client";

import { useTransition } from "react";
import { deleteMatch } from "@/app/actions";

export default function DeleteMatchButton({
  matchId,
  eventId,
}: {
  matchId: string;
  eventId: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(() => deleteMatch(matchId, eventId))}
      disabled={pending}
      className="text-muted hover:text-amber-400 text-sm px-1"
      aria-label="경기 삭제"
    >
      ✕
    </button>
  );
}
