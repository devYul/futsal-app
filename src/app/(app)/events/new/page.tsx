import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { createEvent } from "@/app/actions";

export default async function NewEventPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") redirect("/");

  async function action(formData: FormData) {
    "use server";
    const id = await createEvent(formData);
    redirect(`/events/${id}`);
  }

  return (
    <div className="px-4 pt-6">
      <header className="flex items-center gap-3 mb-5">
        <Link href="/" className="text-muted">
          ←
        </Link>
        <h1 className="text-lg font-bold">새 모임 만들기</h1>
      </header>

      <form action={action} className="card p-5 space-y-4">
        <div>
          <label className="label">모임 이름 *</label>
          <input
            name="title"
            className="input"
            placeholder="예: 수요일 정기 풋살"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">날짜 *</label>
            <input name="date" type="date" className="input" required />
          </div>
          <div>
            <label className="label">시간 *</label>
            <input name="time" type="time" className="input" required />
          </div>
        </div>
        <div>
          <label className="label">장소</label>
          <input
            name="location"
            className="input"
            placeholder="예: ○○ 풋살장 A구장"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">정원 (선택)</label>
            <input
              name="capacity"
              type="number"
              min={2}
              className="input"
              placeholder="무제한"
            />
          </div>
          <div>
            <label className="label">팀 수</label>
            <select name="num_teams" className="input" defaultValue={2}>
              <option value={2}>2팀</option>
              <option value={3}>3팀</option>
              <option value={4}>4팀</option>
            </select>
          </div>
        </div>

        <button className="btn btn-primary w-full">모임 등록</button>
      </form>
    </div>
  );
}
