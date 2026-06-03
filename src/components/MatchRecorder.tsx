"use client";

import { useState, useTransition } from "react";
import { recordMatch } from "@/app/actions";

// 운영진이 한 모임 안의 팀 간 경기 결과를 입력합니다.
export default function MatchRecorder({
  eventId,
  teamNos,
}: {
  eventId: string;
  teamNos: number[];
}) {
  const [a, setA] = useState(teamNos[0] ?? 1);
  const [b, setB] = useState(teamNos[1] ?? 2);
  const [sa, setSa] = useState(0);
  const [sb, setSb] = useState(0);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function save() {
    setErr(null);
    start(async () => {
      try {
        await recordMatch(eventId, a, b, sa, sb);
        setSa(0);
        setSb(0);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "오류가 발생했습니다.");
      }
    });
  }

  return (
    <div className="card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={a}
          onChange={(e) => setA(Number(e.target.value))}
          className="input flex-1 py-1.5"
        >
          {teamNos.map((n) => (
            <option key={n} value={n}>
              {n}팀
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          value={sa}
          onChange={(e) => setSa(Number(e.target.value))}
          className="input w-14 text-center py-1.5"
        />
        <span className="text-muted">:</span>
        <input
          type="number"
          min={0}
          value={sb}
          onChange={(e) => setSb(Number(e.target.value))}
          className="input w-14 text-center py-1.5"
        />
        <select
          value={b}
          onChange={(e) => setB(Number(e.target.value))}
          className="input flex-1 py-1.5"
        >
          {teamNos.map((n) => (
            <option key={n} value={n}>
              {n}팀
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={save}
        disabled={pending}
        className="btn btn-ghost w-full py-2 text-sm"
      >
        {pending ? "저장 중..." : "＋ 경기 결과 추가"}
      </button>
      {err && <p className="text-sm text-amber-400">{err}</p>}
    </div>
  );
}
