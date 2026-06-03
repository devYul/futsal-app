"use client";

import { useEffect, useState } from "react";
import { savePushSubscription } from "@/app/actions";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export default function PushToggle() {
  const [status, setStatus] = useState<
    "loading" | "unsupported" | "on" | "off" | "denied"
  >("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "on" : "off");
    });
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        alert("서버에 VAPID 공개키가 설정되지 않았습니다.");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });
      const json = sub.toJSON();
      await savePushSubscription({
        endpoint: json.endpoint!,
        keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
      });
      setStatus("on");
    } catch {
      alert("알림 설정 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      setStatus("off");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading")
    return <p className="text-sm text-muted">확인 중...</p>;
  if (status === "unsupported")
    return (
      <p className="text-sm text-muted">
        이 브라우저는 푸시 알림을 지원하지 않습니다. (iOS는 홈 화면에 추가 후
        사용하세요)
      </p>
    );
  if (status === "denied")
    return (
      <p className="text-sm text-amber-400">
        알림이 차단되어 있습니다. 브라우저 설정에서 알림을 허용해 주세요.
      </p>
    );

  return status === "on" ? (
    <button onClick={disable} disabled={busy} className="btn btn-ghost w-full">
      🔕 알림 끄기
    </button>
  ) : (
    <button onClick={enable} disabled={busy} className="btn btn-primary w-full">
      🔔 푸시 알림 켜기
    </button>
  );
}
