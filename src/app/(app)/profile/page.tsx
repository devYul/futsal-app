import { getCurrentProfile } from "@/lib/auth";
import { updateProfile } from "@/app/actions";
import PushToggle from "@/components/PushToggle";

export const dynamic = "force-dynamic";

const POSITIONS = ["", "GK", "DF", "MF", "FW"];

export default async function ProfilePage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  async function action(formData: FormData) {
    "use server";
    await updateProfile(formData);
  }

  return (
    <div className="px-4 pt-6 space-y-6">
      <header>
        <h1 className="text-xl font-bold">내 정보</h1>
        {profile.role === "admin" && (
          <span className="inline-block mt-1 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
            운영진
          </span>
        )}
      </header>

      <form action={action} className="card p-5 space-y-4">
        <div>
          <label className="label">이름</label>
          <input
            name="name"
            className="input"
            defaultValue={profile.name}
            required
          />
        </div>
        <div>
          <label className="label">전화번호</label>
          <input
            name="phone"
            className="input"
            defaultValue={profile.phone ?? ""}
            placeholder="010-0000-0000"
          />
        </div>
        <div>
          <label className="label">주 포지션</label>
          <select
            name="position"
            className="input"
            defaultValue={profile.position ?? ""}
          >
            {POSITIONS.map((p) => (
              <option key={p || "none"} value={p}>
                {p || "선택 안함"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">내 실력 점수 (운영진이 설정)</label>
          <p className="text-sm">
            {"⭐".repeat(Math.round(Number(profile.skill_rating)))}{" "}
            <span className="text-muted">
              {Number(profile.skill_rating).toFixed(1)} / 5.0
            </span>
          </p>
        </div>
        <button className="btn btn-primary w-full">저장</button>
      </form>

      <section className="card p-5 space-y-3">
        <h2 className="font-semibold">푸시 알림</h2>
        <p className="text-sm text-muted">
          새 모임 등록·출석 안내 알림을 받습니다.
        </p>
        <PushToggle />
      </section>
    </div>
  );
}
