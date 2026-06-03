"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(
    searchParams.get("error") === "oauth"
      ? "카카오 로그인에 실패했습니다. 다시 시도해주세요."
      : null
  );

  async function handleKakao() {
    setMsg(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setMsg(translateError(error.message));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (error) throw error;
        // 이메일 확인이 꺼져 있으면 바로 로그인됨
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          router.replace("/");
          router.refresh();
        } else {
          setMsg("가입 완료! 이메일 확인이 필요하면 메일을 확인하세요.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.replace("/");
        router.refresh();
      }
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : "오류가 발생했습니다.";
      setMsg(translateError(m));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh flex flex-col justify-center px-6 max-w-md mx-auto w-full">
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">⚽</div>
        <h1 className="text-2xl font-bold">풋살 동호회</h1>
        <p className="text-muted mt-1 text-sm">일정 · 출석 · 팀 배분을 한 곳에서</p>
      </div>

      <form onSubmit={handleSubmit} className="card p-5 space-y-4">
        {mode === "signup" && (
          <div>
            <label className="label">이름</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              required
            />
          </div>
        )}
        <div>
          <label className="label">이메일</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>
        <div>
          <label className="label">비밀번호</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="6자 이상"
            minLength={6}
            required
          />
        </div>

        {msg && <p className="text-sm text-amber-400">{msg}</p>}

        <button className="btn btn-primary w-full" disabled={loading}>
          {loading ? "처리 중..." : mode === "signin" ? "로그인" : "회원가입"}
        </button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <div className="h-px bg-border flex-1" />
        <span className="text-xs text-muted">또는</span>
        <div className="h-px bg-border flex-1" />
      </div>

      <button
        type="button"
        onClick={handleKakao}
        className="btn w-full"
        style={{ background: "#FEE500", color: "#191600" }}
      >
        <span className="text-lg">💬</span> 카카오로 시작하기
      </button>

      <button
        className="text-sm text-muted mt-5 mx-auto hover:text-foreground"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setMsg(null);
        }}
      >
        {mode === "signin"
          ? "처음이신가요? 회원가입"
          : "이미 계정이 있으신가요? 로그인"}
      </button>
    </main>
  );
}

function translateError(m: string): string {
  if (m.includes("Invalid login credentials"))
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (m.includes("already registered") || m.includes("already exists"))
    return "이미 가입된 이메일입니다.";
  if (m.includes("Password should be"))
    return "비밀번호는 6자 이상이어야 합니다.";
  return m;
}
