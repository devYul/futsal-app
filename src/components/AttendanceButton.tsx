"use client";

import { useState, useTransition } from "react";
import { checkIn } from "@/app/actions";

export default function AttendanceButton({
  eventId,
  checkedIn,
  isLate,
  canCheckIn,
  windowMsg,
}: {
  eventId: string;
  checkedIn: boolean;
  isLate: boolean;
  canCheckIn: boolean;
  windowMsg: string | null;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  // 이미 출석한 경우: 상태만 표시 (취소 불가)
  if (checkedIn) {
    return (
      <button disabled className="btn w-full py-4 btn-primary opacity-100">
        {isLate ? "🕒 지각 출석 완료" : "✅ 출석 완료"}
      </button>
    );
  }

  function run() {
    setErr(null);
    start(async () => {
      try {
        await checkIn(eventId);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "오류가 발생했습니다.");
      }
    });
  }

  return (
    <div>
      <button
        onClick={run}
        disabled={pending || !canCheckIn}
        className="btn w-full py-4 btn-ghost"
      >
        {pending ? "처리 중..." : "👋 출석 체크하기"}
      </button>
      {!canCheckIn && windowMsg && (
        <p className="text-xs text-muted mt-2">{windowMsg}</p>
      )}
      {err && <p className="text-sm text-amber-400 mt-2">{err}</p>}
    </div>
  );
}
