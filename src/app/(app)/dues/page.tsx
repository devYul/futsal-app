import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { generateDues } from "@/app/actions";
import DuesManager, { type DuesRow } from "@/components/DuesManager";
import type { Dues } from "@/lib/types";

export const dynamic = "force-dynamic";

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function periodLabel(p: string): string {
  const [y, m] = p.split("-");
  return `${y}년 ${Number(m)}월`;
}

export default async function DuesPage(props: PageProps<"/dues">) {
  const sp = await props.searchParams;
  const raw = typeof sp.period === "string" ? sp.period : "";
  const period = /^\d{4}-\d{2}$/.test(raw) ? raw : currentPeriod();

  const profile = await getCurrentProfile();
  if (!profile) return null;
  const isAdmin = profile.role === "admin";
  const supabase = await createClient();

  // ── 일반 멤버: 본인 회비 내역 ─────────────────────────────
  if (!isAdmin) {
    const { data } = await supabase
      .from("dues")
      .select("*")
      .eq("user_id", profile.id)
      .order("period", { ascending: false });
    const mine = (data ?? []) as Dues[];
    const unpaid = mine.filter((d) => !d.paid && d.amount > 0);

    return (
      <div className="px-4 pt-6">
        <header className="mb-5">
          <h1 className="text-xl font-bold">내 회비</h1>
          <p className="text-muted text-sm mt-0.5">
            {unpaid.length > 0
              ? `미납 ${unpaid.length}건 (${unpaid
                  .reduce((s, d) => s + d.amount, 0)
                  .toLocaleString()}원)`
              : "미납 내역이 없습니다 👍"}
          </p>
        </header>

        {mine.length === 0 ? (
          <p className="card p-6 text-center text-muted text-sm">
            아직 등록된 회비가 없습니다.
          </p>
        ) : (
          <div className="space-y-2">
            {mine.map((d) => (
              <div
                key={d.id}
                className="card p-3 flex justify-between items-center"
              >
                <span className="font-semibold">{periodLabel(d.period)}</span>
                <span
                  className={`text-sm ${
                    d.paid ? "text-primary" : "text-amber-400"
                  }`}
                >
                  {d.amount.toLocaleString()}원 ·{" "}
                  {d.paid ? "납부 완료 ✓" : "미납"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── 운영진: 월별 회비 관리 ────────────────────────────────
  const [{ data: members }, { data: dues }] = await Promise.all([
    supabase.from("profiles").select("id, name").order("name"),
    supabase.from("dues").select("*").eq("period", period),
  ]);

  const dueByUser = new Map(
    (dues ?? []).map((d: Dues) => [d.user_id, d])
  );
  const rows: DuesRow[] = (members ?? []).map(
    (m: { id: string; name: string }) => {
      const d = dueByUser.get(m.id);
      return {
        id: m.id,
        name: m.name,
        amount: d?.amount ?? 0,
        paid: d?.paid ?? false,
        hasDue: !!d,
      };
    }
  );

  const totalDue = rows.filter((r) => r.hasDue);
  const paidCount = totalDue.filter((r) => r.paid).length;
  const collected = totalDue
    .filter((r) => r.paid)
    .reduce((s, r) => s + r.amount, 0);
  const expected = totalDue.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="px-4 pt-6 space-y-5">
      <header>
        <h1 className="text-xl font-bold">회비 관리</h1>
        <p className="text-muted text-sm mt-0.5">월별 회비 생성·납부 관리</p>
      </header>

      {/* 월 선택 (GET 폼) */}
      <form method="get" className="flex items-end gap-2">
        <div className="flex-1">
          <label className="label">조회 월</label>
          <input
            type="month"
            name="period"
            defaultValue={period}
            className="input"
          />
        </div>
        <button className="btn btn-ghost">조회</button>
      </form>

      {/* 회비 생성/갱신 (서버 액션 폼) */}
      <form action={generateDues} className="card p-4 space-y-3">
        <input type="hidden" name="period" value={period} />
        <div>
          <label className="label">
            {periodLabel(period)} 1인당 회비 (원)
          </label>
          <input
            type="number"
            name="amount"
            min={0}
            step={1000}
            defaultValue={10000}
            className="input"
          />
        </div>
        <button className="btn btn-primary w-full">
          월 회비 생성 / 금액 갱신
        </button>
        <p className="text-xs text-muted">
          전체 멤버에게 해당 월 회비가 생성됩니다. 이미 납부한 멤버의 금액은
          변경되지 않습니다.
        </p>
      </form>

      {/* 집계 */}
      {totalDue.length > 0 && (
        <div className="card p-4 flex justify-around text-center">
          <div>
            <div className="text-primary font-bold text-lg">
              {paidCount}/{totalDue.length}
            </div>
            <div className="text-xs text-muted">납부</div>
          </div>
          <div>
            <div className="font-bold text-lg">
              {collected.toLocaleString()}
            </div>
            <div className="text-xs text-muted">걷힌 금액</div>
          </div>
          <div>
            <div className="text-muted font-bold text-lg">
              {expected.toLocaleString()}
            </div>
            <div className="text-xs text-muted">목표 금액</div>
          </div>
        </div>
      )}

      {/* 멤버별 납부 토글 */}
      <DuesManager period={period} rows={rows} />
    </div>
  );
}
