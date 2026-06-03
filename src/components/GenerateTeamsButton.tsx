"use client";

import { useState, useTransition } from "react";
import { generateTeams } from "@/app/actions";

export default function GenerateTeamsButton({
  eventId,
  hasTeams,
}: {
  eventId: string;
  hasTeams: boolean;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function run() {
    setErr(null);
    start(async () => {
      try {
        await generateTeams(eventId);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "오류가 발생했습니다.");
      }
    });
  }

  return (
    <div>
      <button onClick={run} disabled={pending} className="btn btn-ghost w-full">
        {pending
          ? "팀 짜는 중..."
          : hasTeams
          ? "🔄 팀 다시 짜기"
          : "⚖️ 실력 기반 팀 자동 배분"}
      </button>
      {err && <p className="text-sm text-amber-400 mt-2">{err}</p>}
    </div>
  );
}
