"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { balanceTeams, type Player } from "@/lib/teams";
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

  if (!title || !date || !time) throw new Error("필수 항목을 입력하세요.");

  const starts_at = new Date(`${date}T${time}`).toISOString();
  const capacity = capacityRaw ? Number(capacityRaw) : null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      title,
      location: location || null,
      starts_at,
      capacity,
      num_teams: numTeams,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // 전체 회원에게 새 모임 알림
  await notifyAllMembers(
    "새 모임이 등록되었습니다 ⚽",
    `${title} — ${date} ${time}`,
    `/events/${data.id}`
  );

  revalidatePath("/");
  return data.id as string;
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

// ── (내부) 전체 회원에게 푸시 발송 ─────────────────────────
async function notifyAllMembers(title: string, body: string, url: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id");
  const ids = (data ?? []).map((p: { id: string }) => p.id);
  await sendPushToUsers(ids, { title, body, url });
}
