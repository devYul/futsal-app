import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

// 현재 로그인한 사용자의 프로필을 반환 (없으면 null)
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (data as Profile) ?? null;
}
