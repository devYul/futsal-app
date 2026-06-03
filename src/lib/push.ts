import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/server";

let configured = false;

function ensureConfigured(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!pub || !priv) return false;
  if (!configured) {
    webpush.setVapidDetails(subject, pub, priv);
    configured = true;
  }
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

// 지정한 사용자들의 모든 구독 단말로 푸시 발송.
// 만료된 구독(410/404)은 자동 삭제.
export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  if (userIds.length === 0) return;
  if (!ensureConfigured()) {
    console.warn("[push] VAPID 키가 없어 푸시를 건너뜁니다.");
    return;
  }

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, keys")
    .in("user_id", userIds);

  if (!subs || subs.length === 0) return;

  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(
      async (s: {
        id: string;
        endpoint: string;
        keys: { p256dh: string; auth: string };
      }) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: s.keys },
            body
          );
        } catch (err: unknown) {
          const code = (err as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) {
            // 만료된 구독 제거
            await admin.from("push_subscriptions").delete().eq("id", s.id);
          }
        }
      }
    )
  );
}
