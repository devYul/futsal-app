"use client";

import { useState, useTransition } from "react";
import { toggleDuePaid } from "@/app/actions";

export interface DuesRow {
  id: string; // user id
  name: string;
  amount: number;
  paid: boolean;
  hasDue: boolean;
}

// 운영진용: 멤버별 납부 여부를 탭하여 토글합니다.
export default function DuesManager({
  period,
  rows,
}: {
  period: string;
  rows: DuesRow[];
}) {
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <Row key={r.id} period={period} row={r} />
      ))}
    </div>
  );
}

function Row({ period, row }: { period: string; row: DuesRow }) {
  const [paid, setPaid] = useState(row.paid);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function toggle() {
    if (!row.hasDue) {
      setErr("먼저 '월 회비 생성'을 눌러주세요.");
      return;
    }
    const prev = paid;
    setPaid(!prev);
    setErr(null);
    start(async () => {
      try {
        await toggleDuePaid(row.id, period);
      } catch (e: unknown) {
        setPaid(prev);
        setErr(e instanceof Error ? e.message : "오류가 발생했습니다.");
      }
    });
  }

  return (
    <div className="card p-3 flex justify-between items-center gap-3">
      <span className="font-semibold">{row.name}</span>
      <div className="text-right">
        <button
          onClick={toggle}
          disabled={pending}
          className={`text-sm px-3 py-1 rounded-md border ${
            !row.hasDue
              ? "border-border text-muted"
              : paid
              ? "bg-primary text-white border-primary"
              : "border-amber-500/60 text-amber-400"
          }`}
        >
          {!row.hasDue
            ? "미생성"
            : paid
            ? `납부 ✓ ${row.amount.toLocaleString()}원`
            : `미납 ${row.amount.toLocaleString()}원`}
        </button>
        {err && <p className="text-xs text-amber-400 mt-1">{err}</p>}
      </div>
    </div>
  );
}
