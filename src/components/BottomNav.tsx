"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const items = [
  { href: "/", label: "홈", icon: "🏠" },
  { href: "/members", label: "멤버", icon: "👥" },
  { href: "/dues", label: "회비", icon: "💰" },
  { href: "/profile", label: "내정보", icon: "⚙️" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <nav className="fixed bottom-0 inset-x-0 border-t border-border bg-surface/95 backdrop-blur z-40">
      <div className="max-w-md mx-auto grid grid-cols-5">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={`flex flex-col items-center gap-0.5 py-2.5 text-xs ${
              isActive(it.href) ? "text-primary" : "text-muted"
            }`}
          >
            <span className="text-lg leading-none">{it.icon}</span>
            {it.label}
          </Link>
        ))}
        <button
          onClick={signOut}
          className="flex flex-col items-center gap-0.5 py-2.5 text-xs text-muted"
        >
          <span className="text-lg leading-none">🚪</span>
          로그아웃
        </button>
      </div>
    </nav>
  );
}
