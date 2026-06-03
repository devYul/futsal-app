import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { formatDateTime, isPast } from "@/lib/format";
import type { FutsalEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .order("starts_at", { ascending: true });

  const all = (events ?? []) as FutsalEvent[];
  const upcoming = all.filter((e) => !isPast(e.starts_at) || e.status !== "done");
  const past = all.filter((e) => isPast(e.starts_at) && e.status === "done");

  // 참석(yes) 인원 집계
  const { data: rsvps } = await supabase
    .from("rsvps")
    .select("event_id, status")
    .eq("status", "yes");
  const yesCount = new Map<string, number>();
  (rsvps ?? []).forEach((r: { event_id: string }) =>
    yesCount.set(r.event_id, (yesCount.get(r.event_id) ?? 0) + 1)
  );

  return (
    <div className="px-4 pt-6">
      <header className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold">안녕하세요, {profile?.name} 님 ⚽</h1>
          <p className="text-muted text-sm mt-0.5">다가오는 모임을 확인하세요</p>
        </div>
      </header>

      {profile?.role === "admin" && (
        <Link href="/events/new" className="btn btn-primary w-full mb-5">
          + 새 모임 만들기
        </Link>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted">다가오는 모임</h2>
        {upcoming.length === 0 && (
          <p className="card p-6 text-center text-muted text-sm">
            예정된 모임이 없습니다.
          </p>
        )}
        {upcoming.map((e) => (
          <EventCard key={e.id} event={e} yes={yesCount.get(e.id) ?? 0} />
        ))}
      </section>

      {past.length > 0 && (
        <section className="space-y-3 mt-7">
          <h2 className="text-sm font-semibold text-muted">지난 모임</h2>
          {past.slice(0, 10).map((e) => (
            <EventCard key={e.id} event={e} yes={yesCount.get(e.id) ?? 0} dim />
          ))}
        </section>
      )}
    </div>
  );
}

function EventCard({
  event,
  yes,
  dim,
}: {
  event: FutsalEvent;
  yes: number;
  dim?: boolean;
}) {
  return (
    <Link
      href={`/events/${event.id}`}
      className={`card p-4 block ${dim ? "opacity-60" : ""}`}
    >
      <div className="flex justify-between items-start gap-3">
        <div>
          <h3 className="font-semibold">{event.title}</h3>
          <p className="text-sm text-muted mt-1">
            {formatDateTime(event.starts_at)}
          </p>
          {event.location && (
            <p className="text-sm text-muted">📍 {event.location}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-primary font-bold text-lg">{yes}</div>
          <div className="text-xs text-muted">참석</div>
        </div>
      </div>
    </Link>
  );
}
