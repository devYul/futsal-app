"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { balanceTeams, type Player } from "@/lib/teams";
import { replayElo, type EloMatch } from "@/lib/elo";
import { sendPushToUsers } from "@/lib/push";
import type { RsvpStatus } from "@/lib/types";

// ── 모임 생성 (admin) ──────────────────────────────────────
export async function createEvent(formData: FormData) {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") throw new Error("권한이 없습니다.");

  const title = String(formData.get("title") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const capacityRaw = String(formData.get("capacity") ?? "");
  const numTeams = Number(formData.get("num_teams") ?? 2);
  // 정기(반복) 모임: 매주 같은 요일·시간으로 N회 생성 (1 = 반복 없음)
  const repeat = Math.min(Math.max(Number(formData.get("repeat") ?? 1) || 1, 1), 26);

  if (!title || !date || !time) throw new Error("필수 항목을 입력하세요.");

  const base = new Date(`${date}T${time}`);
  const capacity = capacityRaw ? Number(capacityRaw) : null;
  const seriesId = repeat > 1 ? randomUUID() : null;

  // 매주 +7일씩 반복 일정 생성
  const rows = Array.from({ length: repeat }, (_, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() + i * 7);
    return {
      title,
      location: location || null,
      starts_at: d.toISOString(),
      capacity,
      num_teams: numTeams,
      series_id: seriesId,
      created_by: profile.id,
    };
  });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .insert(rows)
    .select("id")
    .order("starts_at", { ascending: true });

  if (error) throw new Error(error.message);
  const firstId = data![0].id as string;

  // 전체 회원에게 새 모임 알림 (반복이면 회차 수 표기)
  await notifyAllMembers(
    "새 모임이 등록되었습니다 ⚽",
    repeat > 1
      ? `${title} — ${date} ${time}부터 매주 ${repeat}회`
      : `${title} — ${date} ${time}`,
    `/events/${firstId}`
  );

  revalidatePath("/");
  return firstId;
}

// ── 참석 응답(RSVP) 등록/변경 ──────────────────────────────
export async function setRsvp(eventId: string, status: RsvpStatus) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("로그인이 필요합니다.");

  const supabase = await createClient();
  const { error } = await supabase.from("rsvps").upsert(
    {
      event_id: eventId,
      user_id: profile.id,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id,user_id" }
  );
  if (error) throw new Error(error.message);

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/");
}

// ── 당일 출석 체크인/취소 (토글) ───────────────────────────
export async function toggleAttendance(eventId: string) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("로그인이 필요합니다.");

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("attendance")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("attendance").delete().eq("id", existing.id);
  } else {
    await supabase
      .from("attendance")
      .insert({ event_id: eventId, user_id: profile.id });
  }

  revalidatePath(`/events/${eventId}`);
}

// ── 실력 기반 팀 자동 배분 (admin) ─────────────────────────
//   출석한 사람을 기준으로 팀을 나눕니다. 출석자가 없으면 참석(yes) 응답자 기준.
export async function generateTeams(eventId: string) {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") throw new Error("권한이 없습니다.");

  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("num_teams")
    .eq("id", eventId)
    .single();
  const numTeams = event?.num_teams ?? 2;

  // 우선순위: 출석체크한 사람 → 없으면 참석(yes) 응답자
  const { data: att } = await supabase
    .from("attendance")
    .select("user_id")
    .eq("event_id", eventId);

  let userIds = (att ?? []).map((a: { user_id: string }) => a.user_id);

  if (userIds.length === 0) {
    const { data: yes } = await supabase
      .from("rsvps")
      .select("user_id")
      .eq("event_id", eventId)
      .eq("status", "yes");
    userIds = (yes ?? []).map((r: { user_id: string }) => r.user_id);
  }

  if (userIds.length < 2) throw new Error("팀을 나눌 인원이 부족합니다 (최소 2명).");

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, skill_rating, position")
    .in("id", userIds);

  const players: Player[] = (profiles ?? []).map(
    (p: { id: string; name: string; skill_rating: number; position: string | null }) => ({
      id: p.id,
      name: p.name,
      skill: Number(p.skill_rating),
      position: p.position,
    })
  );

  const teams = balanceTeams(players, numTeams);

  // 기존 배분 삭제 후 재저장
  await supabase.from("team_assignments").delete().eq("event_id", eventId);
  const rows = teams.flatMap((t) =>
    t.players.map((p) => ({
      event_id: eventId,
      user_id: p.id,
      team_no: t.teamNo,
    }))
  );
  const { error } = await supabase.from("team_assignments").insert(rows);
  if (error) throw new Error(error.message);

  revalidatePath(`/events/${eventId}`);
}

// ── 내 프로필 수정 ─────────────────────────────────────────
export async function updateProfile(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("로그인이 필요합니다.");

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const position = String(formData.get("position") ?? "") || null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ name, phone: phone || null, position })
    .eq("id", profile.id);
  if (error) throw new Error(error.message);

  revalidatePath("/profile");
  revalidatePath("/members");
}

// ── 멤버 실력 점수/포지션 수정 (admin) ─────────────────────
export async function updateMemberRating(
  userId: string,
  rating: number,
  position: string | null
) {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") throw new Error("권한이 없습니다.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ skill_rating: rating, position })
    .eq("id", userId);
  if (error) throw new Error(error.message);

  revalidatePath("/members");
}

// ── 푸시 구독 저장 ─────────────────────────────────────────
export async function savePushSubscription(sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("로그인이 필요합니다.");

  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: profile.id,
      endpoint: sub.endpoint,
      keys: sub.keys,
    },
    { onConflict: "endpoint" }
  );
  if (error) throw new Error(error.message);
}

// ── 경기 결과 기록 (admin) ─────────────────────────────────
//   팀 간 경기 결과를 저장하고 Elo 레이팅을 다시 계산합니다.
export async function recordMatch(
  eventId: string,
  teamA: number,
  teamB: number,
  scoreA: number,
  scoreB: number
) {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") throw new Error("권한이 없습니다.");
  if (teamA === teamB) throw new Error("서로 다른 두 팀을 선택하세요.");

  const supabase = await createClient();
  const { error } = await supabase.from("matches").insert({
    event_id: eventId,
    team_a: teamA,
    team_b: teamB,
    score_a: Math.max(0, Math.trunc(scoreA)),
    score_b: Math.max(0, Math.trunc(scoreB)),
  });
  if (error) throw new Error(error.message);

  await recomputeElo();
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/members");
}

// ── 경기 결과 삭제 (admin) ─────────────────────────────────
export async function deleteMatch(matchId: string, eventId: string) {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") throw new Error("권한이 없습니다.");

  const supabase = await createClient();
  const { error } = await supabase.from("matches").delete().eq("id", matchId);
  if (error) throw new Error(error.message);

  await recomputeElo();
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/members");
}

// ── 당일 MVP 지정/해제 (admin) ─────────────────────────────
export async function setMvp(eventId: string, userId: string | null) {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") throw new Error("권한이 없습니다.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({ mvp_user_id: userId })
    .eq("id", eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/events/${eventId}`);
}

// ── (내부) 전체 경기 결과로 Elo 레이팅 재계산 ──────────────
//   모든 멤버를 기준점에서 시작해 경기를 시간순으로 재생하므로 멱등적.
async function recomputeElo() {
  const admin = createAdminClient();

  const [{ data: members }, { data: matches }, { data: assigns }] =
    await Promise.all([
      admin.from("profiles").select("id"),
      admin
        .from("matches")
        .select("event_id, team_a, team_b, score_a, score_b")
        .order("created_at", { ascending: true }),
      admin.from("team_assignments").select("event_id, user_id, team_no"),
    ]);

  // 모임·팀 별 선수 명단 구성: key = `${event_id}:${team_no}`
  const roster = new Map<string, string[]>();
  (assigns ?? []).forEach(
    (a: { event_id: string; user_id: string; team_no: number }) => {
      const k = `${a.event_id}:${a.team_no}`;
      const arr = roster.get(k) ?? [];
      arr.push(a.user_id);
      roster.set(k, arr);
    }
  );

  const eloMatches: EloMatch[] = (matches ?? []).map(
    (m: {
      event_id: string;
      team_a: number;
      team_b: number;
      score_a: number;
      score_b: number;
    }) => ({
      teamA: roster.get(`${m.event_id}:${m.team_a}`) ?? [],
      teamB: roster.get(`${m.event_id}:${m.team_b}`) ?? [],
      scoreA: m.score_a,
      scoreB: m.score_b,
    })
  );

  const ids = (members ?? []).map((p: { id: string }) => p.id);
  const elo = replayElo(ids, eloMatches);

  // 전 멤버 레이팅을 일괄 갱신 (RLS 우회 위해 admin 클라이언트 사용)
  await Promise.all(
    [...elo.entries()].map(([id, rating]) =>
      admin.from("profiles").update({ elo_rating: rating }).eq("id", id)
    )
  );
}

// ── 회비: 해당 월 회비 일괄 생성/갱신 (admin) ───────────────
//   이미 납부 완료된 회원의 금액은 건드리지 않습니다.
export async function generateDues(formData: FormData) {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") throw new Error("권한이 없습니다.");

  const period = String(formData.get("period") ?? "").trim();
  const amount = Math.max(0, Math.trunc(Number(formData.get("amount") ?? 0)));
  if (!/^\d{4}-\d{2}$/.test(period)) throw new Error("월(YYYY-MM)을 선택하세요.");

  const supabase = await createClient();
  const [{ data: members }, { data: existing }] = await Promise.all([
    supabase.from("profiles").select("id"),
    supabase.from("dues").select("user_id, paid").eq("period", period),
  ]);

  const existingMap = new Map(
    (existing ?? []).map((d: { user_id: string; paid: boolean }) => [
      d.user_id,
      d.paid,
    ])
  );

  // 신규 멤버 행 추가
  const toInsert = (members ?? [])
    .filter((m: { id: string }) => !existingMap.has(m.id))
    .map((m: { id: string }) => ({ user_id: m.id, period, amount }));
  if (toInsert.length) {
    const { error } = await supabase.from("dues").insert(toInsert);
    if (error) throw new Error(error.message);
  }

  // 아직 미납인 기존 행은 금액만 갱신
  const unpaidIds = (existing ?? [])
    .filter((d: { paid: boolean }) => !d.paid)
    .map((d: { user_id: string }) => d.user_id);
  if (unpaidIds.length) {
    const { error } = await supabase
      .from("dues")
      .update({ amount })
      .eq("period", period)
      .in("user_id", unpaidIds);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/dues");
}

// ── 회비: 납부 여부 토글 (admin) ───────────────────────────
export async function toggleDuePaid(userId: string, period: string) {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") throw new Error("권한이 없습니다.");

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("dues")
    .select("id, paid")
    .eq("user_id", userId)
    .eq("period", period)
    .maybeSingle();
  if (!row) throw new Error("회비 항목이 없습니다. 먼저 월 회비를 생성하세요.");

  const newPaid = !row.paid;
  const { error } = await supabase
    .from("dues")
    .update({ paid: newPaid, paid_at: newPaid ? new Date().toISOString() : null })
    .eq("id", row.id);
  if (error) throw new Error(error.message);

  revalidatePath("/dues");
}

// ── (내부) 전체 회원에게 푸시 발송 ─────────────────────────
async function notifyAllMembers(title: string, body: string, url: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id");
  const ids = (data ?? []).map((p: { id: string }) => p.id);
  await sendPushToUsers(ids, { title, body, url });
}
