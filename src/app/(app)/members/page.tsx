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
    .order("skill_rating", { ascending: false });

  const members = (data ?? []) as Profile[];
  const isAdmin = profile?.role === "admin";

  return (
    <div className="px-4 pt-6">
      <header className="mb-5">
        <h1 className="text-xl font-bold">멤버 ({members.length})</h1>
        <p className="text-muted text-sm mt-0.5">
          {isAdmin
            ? "실력 점수는 팀 배분에 사용됩니다. 탭하여 조정하세요."
            : "동호회 멤버 목록"}
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
              />
            ))
          : members.map((m) => (
              <div
                key={m.id}
                className="card p-4 flex justify-between items-center"
              >
                <span className="font-semibold">
                  {m.name}
                  {m.position && (
                    <span className="text-muted text-xs ml-2">{m.position}</span>
                  )}
                </span>
                <span className="text-sm text-muted">
                  {"⭐".repeat(Math.round(Number(m.skill_rating)))}
                </span>
              </div>
            ))}
      </div>
    </div>
  );
}
