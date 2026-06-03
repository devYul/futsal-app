import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import RsvpButtons from "@/components/RsvpButtons";
import AttendanceButton from "@/components/AttendanceButton";
import GenerateTeamsButton from "@/components/GenerateTeamsButton";
import type { FutsalEvent, RsvpStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

interface NamedRow {
  user_id: string;
  profiles: { name: string; position: string | null } | null;
}

export default async function EventDetailPage(props: PageProps<"/events/[id]">) {
  const { id } = await props.params;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: eventData } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();
  if (!eventData) notFound();
  const event = eventData as FutsalEvent;

  const [{ data: rsvpRows }, { data: attRows }, { data: teamRows }] =
    await Promise.all([
      supabase
        .from("rsvps")
        .select("user_id, status, profiles(name, position)")
        .eq("event_id", id),
      supabase
        .from("attendance")
        .select("user_id, profiles(name, position)")
        .eq("event_id", id),
      supabase
        .from("team_assignments")
        .select("user_id, team_no, profiles(name, position, skill_rating)")
        .eq("event_id", id)
        .order("team_no"),
    ]);

  // Supabase는 임베드 관계를 배열로 추론하므로 unknown 경유로 캐스팅
  const rsvps = (rsvpRows ?? []) as unknown as (NamedRow & {
    status: RsvpStatus;
  })[];
  const attendance = (attRows ?? []) as unknown as NamedRow[];

  const myRsvp = rsvps.find((r) => r.user_id === profile?.id)?.status ?? null;
  const iAmCheckedIn = attendance.some((a) => a.user_id === profile?.id);

  const yes = rsvps.filter((r) => r.status === "yes");
  const maybe = rsvps.filter((r) => r.status === "maybe");
  const no = rsvps.filter((r) => r.status === "no");

  const isAdmin = profile?.role === "admin";

  // 팀 배분 결과 그룹화
  const teams = new Map<
    number,
    { name: string; position: string | null; skill: number }[]
  >();
  const teamList = (teamRows ?? []) as unknown as {
    team_no: number;
    profiles: { name: string; position: string | null; skill_rating: number } | null;
  }[];
  teamList.forEach(
    (t) => {
      const arr = teams.get(t.team_no) ?? [];
      arr.push({
        name: t.profiles?.name ?? "?",
        position: t.profiles?.position ?? null,
        skill: Number(t.profiles?.skill_rating ?? 0),
      });
      teams.set(t.team_no, arr);
    }
  );

  return (
    <div className="px-4 pt-6 space-y-6">
      <header className="flex items-center gap-3">
        <Link href="/" className="text-muted">
          ←
        </Link>
        <h1 className="text-lg font-bold flex-1">{event.title}</h1>
      </header>

      {/* 모임 정보 */}
      <div className="card p-4 space-y-1">
        <p className="text-sm">🗓️ {formatDateTime(event.starts_at)}</p>
        {event.location && <p className="text-sm">📍 {event.location}</p>}
        <p className="text-sm text-muted">
          참석 {yes.length}명
          {event.capacity ? ` / 정원 ${event.capacity}명` : ""} · {event.num_teams}팀
        </p>
      </div>

      {/* 참석 응답 */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted">참석 여부</h2>
        <RsvpButtons eventId={event.id} current={myRsvp} />
      </section>

      {/* 출석 체크 (당일 본인) */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted">
          출석 체크 · {attendance.length}명 출석
        </h2>
        <AttendanceButton eventId={event.id} checkedIn={iAmCheckedIn} />
        {attendance.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attendance.map((a) => (
              <span
                key={a.user_id}
                className="text-xs bg-surface-2 border border-border rounded-full px-3 py-1"
              >
                {a.profiles?.name}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 참석자 명단 */}
      <section className="space-y-3">
        <NameGroup title="✅ 참석" rows={yes} />
        <NameGroup title="🤔 미정" rows={maybe} />
        <NameGroup title="❌ 불참" rows={no} />
      </section>

      {/* 팀 배분 */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted">팀 배분</h2>
        {isAdmin && (
          <GenerateTeamsButton eventId={event.id} hasTeams={teams.size > 0} />
        )}
        {teams.size === 0 ? (
          <p className="text-sm text-muted">
            {isAdmin
              ? "출석체크 후 팀을 배분하세요. (출석자 없으면 참석 응답자 기준)"
              : "아직 팀이 배분되지 않았습니다."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {[...teams.entries()].map(([no, members]) => {
              const total = members.reduce((s, m) => s + m.skill, 0);
              return (
                <div key={no} className="card p-3">
                  <div className="flex justify-between items-baseline mb-2">
                    <h3 className="font-bold">{no}팀</h3>
                    <span className="text-xs text-muted">
                      합 {total.toFixed(1)}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {members.map((m, i) => (
                      <li key={i} className="text-sm flex justify-between">
                        <span>
                          {m.name}
                          {m.position && (
                            <span className="text-muted text-xs ml-1">
                              {m.position}
                            </span>
                          )}
                        </span>
                        <span className="text-muted text-xs">{m.skill}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function NameGroup({
  title,
  rows,
}: {
  title: string;
  rows: { user_id: string; profiles: { name: string } | null }[];
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="text-xs text-muted mb-1.5">
        {title} ({rows.length})
      </p>
      <div className="flex flex-wrap gap-2">
        {rows.map((r) => (
          <span
            key={r.user_id}
            className="text-sm bg-surface-2 border border-border rounded-full px-3 py-1"
          >
            {r.profiles?.name}
          </span>
        ))}
      </div>
    </div>
  );
}
