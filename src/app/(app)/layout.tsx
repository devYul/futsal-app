import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import BottomNav from "@/components/BottomNav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="max-w-md mx-auto w-full pb-20">
      {children}
      <BottomNav />
    </div>
  );
}
