"use client";

import { useEffect } from "react";

// 앱 로드 시 서비스워커를 등록합니다 (푸시 알림 수신용).
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // 등록 실패는 조용히 무시 (개발 중 HMR 등)
      });
    }
  }, []);

  return null;
}
