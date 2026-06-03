import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { formatDateTime, attendanceState, isRsvpLocked } from "@/lib/format";
import RsvpButtons from "@/components/RsvpButtons";
import AttendanceButton from "@/components/AttendanceButton";
import GenerateTeamsButton from "@/components/GenerateTeamsButton";
import MatchRecorder from "@/components/MatchRecorder";
import DeleteMatchButton from "@/components/DeleteMatchButton";
import MvpSelector from "@/components/MvpSelector";
import type { FutsalEvent, Match, RsvpStatus } from "@/lib/types";

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

  const [{ data: rsvpRows }, { data: attRows }, { data: teamRows }, { data: matchRows }] =
    await Promise.all([
      supabase
        .from("rsvps")
        .select("user_id, status, updated_at, profiles(name, position)")
        .eq("event_id", id)
        .order("updated_at", { ascending: true }),
      supabase
        .from("attendance")
        .select("user_id, is_late, profiles(name, position)")
        .eq("event_id", id),
      supabase
        .from("team_assignments")
        .select("user_id, team_no, profiles(name, position, skill_rating)")
        .eq("event_id", id)
        .order("team_no"),
      supabase
        .from("matches")
        .select("*")
        .eq("event_id", id)
        .order("created_at", { ascending: true }),
    ]);

  // Supabase는 임베드 관계를 배열로 추론하므로 unknown 경유로 캐스팅
  const rsvps = (rsvpRows ?? []) as unknown as (NamedRow & {
    status: RsvpStatus;
  })[];
  const attendance = (attRows ?? []) as unknown as (NamedRow & {
    is_late: boolean;
  })[];
  const matches = (matchRows ?? []) as Match[];

  const myRsvp = rsvps.find((r) => r.user_id === profile?.id)?.status ?? null;
  const myAtt = attendance.find((a) => a.user_id === profile?.id);
  const iAmCheckedIn = !!myAtt;
  const iAmLate = myAtt?.is_late ?? false;
  const lateCount = attendance.filter((a) => a.is_late).length;

  // 출석체크 가능 시간대 / 참석 응답 마감 여부
  const { canCheckIn, windowMsg: attnWindowMsg } = attendanceState(
    event.starts_at
  );
  const rsvpLocked = isRsvpLocked(event.rsvp_deadline);

  // 참석(yes) 은 응답 시각 오름차순 → 정원까지 "확정", 초과분은 "대기자"
  const yes = rsvps.filter((r) => r.status === "yes");
  const maybe = rsvps.filter((r) => r.status === "maybe");
  const no = rsvps.filter((r) => r.status === "no");
  const cap = event.capacity;
  const confirmed = cap ? yes.slice(0, cap) : yes;
  const waitlist = cap ? yes.slice(cap) : [];

  const isAdmin = profile?.role === "admin";

  // 이름 조회용 맵 (MVP 표시·후보 구성에 사용)
  const nameById = new Map<string, string>();
  rsvps.forEach((r) => nameById.set(r.user_id, r.profiles?.name ?? "?"));
  attendance.forEach((a) => nameById.set(a.user_id, a.profiles?.name ?? "?"));

  // MVP 후보: 출석자 우선, 없으면 참석 응답자
  const candidateIds =
    attendance.length > 0
      ? attendance.map((a) => a.user_id)
      : yes.map((r) => r.user_id);
  const candidates = candidateIds.map((uid) => ({
    id: uid,
    name: nameById.get(uid) ?? "?",
  }));

  // 팀 배분 결과 그룹화
  const teams = new Map<
    number,
    { name: string; position: string | null; skill: number }[]
  >();
  const teamList = (teamRows ?? []) as unknown as {
    team_no: number;
    profiles: { name: string; position: string | null; skill_rating: number } | null;
  }[];
  teamList.forEach((t) => {
    const arr = teams.get(t.team_no) ?? [];
    arr.push({
      name: t.profiles?.name ?? "?",
      position: t.profiles?.position ?? null,
      skill: Number(t.profiles?.skill_rating ?? 0),
    });
    teams.set(t.team_no, arr);
  });
  const teamNos = [...teams.keys()].sort((a, b) => a - b);

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
          참석 {confirmed.length}명
          {cap ? ` / 정원 ${cap}명` : ""}
          {waitlist.length > 0 ? ` · 대기 ${waitlist.length}명` : ""} ·{" "}
          {event.num_teams}팀
        </p>
        {event.rsvp_deadline && (
          <p className={`text-sm ${rsvpLocked ? "text-muted" : ""}`}>
            ⏰ 참석 마감 {formatDateTime(event.rsvp_deadline)}
            {rsvpLocked ? " (마감됨)" : ""}
          </p>
        )}
        {event.mvp_user_id && (
          <p className="text-sm">
            🏅 MVP <b>{nameById.get(event.mvp_user_id) ?? "?"}</b>
          </p>
        )}
      </div>

      {/* 참석 응답 */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted">참석 여부</h2>
        <RsvpButtons eventId={event.id} current={myRsvp} locked={rsvpLocked} />
        {cap && waitlist.some((r) => r.user_id === profile?.id) && (
          <p className="text-xs text-amber-400">
            정원이 가득 차 대기자 명단에 등록되었습니다. 빈자리가 나면 자동으로
            확정됩니다.
          </p>
        )}
      </section>

      {/* 출석 체크 (당일 본인) */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted">
          출석 체크 · {attendance.length}명 출석
          {lateCount > 0 ? ` (지각 ${lateCount})` : ""}
        </h2>
        <AttendanceButton
          eventId={event.id}
          checkedIn={iAmCheckedIn}
          isLate={iAmLate}
          canCheckIn={canCheckIn}
          windowMsg={attnWindowMsg}
        />
        {attendance.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attendance.map((a) => (
              <span
                key={a.user_id}
                className={`text-xs rounded-full px-3 py-1 border ${
                  a.is_late
                    ? "border-amber-500/50 text-amber-400"
                    : "bg-surface-2 border-border"
                }`}
              >
                {a.profiles?.name}
                {a.is_late ? " 🕒지각" : ""}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 참석자 명단 */}
      <section className="space-y-3">
        <NameGroup title="✅ 참석 확정" rows={confirmed} />
        <NameGroup title="⏳ 대기자" rows={waitlist} />
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

      {/* 경기 결과 & MVP (팀 배분 후) */}
      {teams.size >= 2 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted">경기 결과 & MVP</h2>

          {matches.length === 0 && !isAdmin && (
            <p className="text-sm text-muted">아직 기록된 경기가 없습니다.</p>
          )}

          {matches.length > 0 && (
            <ul className="space-y-2">
              {matches.map((m) => {
                const aWin = m.score_a > m.score_b;
                const bWin = m.score_b > m.score_a;
                return (
                  <li
                    key={m.id}
                    className="card p-3 flex items-center justify-center gap-3 text-sm"
                  >
                    <span className={aWin ? "font-bold text-primary" : ""}>
                      {m.team_a}팀
                    </span>
                    <span className="font-bold tabular-nums">
                      {m.score_a} : {m.score_b}
                    </span>
                    <span className={bWin ? "font-bold text-primary" : ""}>
                      {m.team_b}팀
                    </span>
                    {isAdmin && (
                      <span className="ml-2">
                        <DeleteMatchButton matchId={m.id} eventId={event.id} />
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {isAdmin && (
            <>
              <MatchRecorder eventId={event.id} teamNos={teamNos} />
              <div>
                <label className="label">당일 MVP</label>
                <MvpSelector
                  eventId={event.id}
                  current={event.mvp_user_id}
                  candidates={candidates}
                />
              </div>
              <p className="text-xs text-muted">
                경기 결과를 저장하면 멤버들의 Elo 레이팅이 자동으로 갱신됩니다.
              </p>
            </>
          )}
        </section>
      )}
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
