"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(
    searchParams.get("error") === "oauth"
      ? "카카오 로그인에 실패했습니다. 다시 시도해주세요."
      : null
  );

  async function handleKakao() {
    setMsg(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setMsg("로그인을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.");
      setLoading(false);
    }
    // 성공 시 카카오로 리다이렉트되므로 별도 처리 불필요
  }

  return (
    <main className="min-h-dvh flex flex-col justify-center px-6 max-w-md mx-auto w-full">
      <div className="text-center mb-10">
        <div className="text-5xl mb-3">⚽</div>
        <h1 className="text-2xl font-bold">풋살 동호회</h1>
        <p className="text-muted mt-2 text-sm">
          일정 · 출석 · 팀 배분을 한 곳에서
        </p>
      </div>

      <button
        type="button"
        onClick={handleKakao}
        disabled={loading}
        className="btn w-full py-3.5"
        style={{ background: "#FEE500", color: "#191600" }}
      >
        <span className="text-lg">💬</span>
        {loading ? "이동 중..." : "카카오로 시작하기"}
      </button>

      {msg && <p className="text-sm text-amber-400 mt-4 text-center">{msg}</p>}

      <p className="text-xs text-muted mt-8 text-center leading-relaxed">
        카카오 계정으로 간편하게 시작하세요.
        <br />
        가입 시 닉네임만 사용되며, 별도의 비밀번호가 필요 없습니다.
      </p>
    </main>
  );
}
