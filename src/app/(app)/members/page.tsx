import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import MemberEditor from "@/components/MemberEditor";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("elo_rating", { ascending: false });

  const members = (data ?? []) as Profile[];
  const isAdmin = profile?.role === "admin";
  const medal = ["🥇", "🥈", "🥉"];

  return (
    <div className="px-4 pt-6">
      <header className="mb-5">
        <h1 className="text-xl font-bold">멤버 ({members.length})</h1>
        <p className="text-muted text-sm mt-0.5">
          {isAdmin
            ? "ELO 레이팅 순위입니다. 실력 점수는 팀 배분 기준이며 탭하여 조정하세요."
            : "경기 결과로 매겨지는 ELO 레이팅 순위"}
        </p>
      </header>

      <div className="space-y-3">
        {isAdmin
          ? members.map((m) => (
              <MemberEditor
                key={m.id}
                userId={m.id}
                name={m.name}
                rating={Number(m.skill_rating)}
                position={m.position}
                elo={Number(m.elo_rating)}
              />
            ))
          : members.map((m, i) => (
              <div
                key={m.id}
                className="card p-4 flex justify-between items-center"
              >
                <span className="font-semibold">
                  <span className="text-muted text-sm mr-1.5">
                    {medal[i] ?? `${i + 1}`}
                  </span>
                  {m.name}
                  {m.position && (
                    <span className="text-muted text-xs ml-2">{m.position}</span>
                  )}
                </span>
                <span className="text-sm">
                  <span className="font-bold">{Math.round(Number(m.elo_rating))}</span>
                  <span className="text-muted text-xs ml-1">ELO</span>
                </span>
              </div>
            ))}
      </div>
    </div>
  );
}
