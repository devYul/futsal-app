// 날짜/시간 포맷 유틸 (한국어, KST 기준 표시)
const WD = ["일", "월", "화", "수", "목", "금", "토"];

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const wd = WD[d.getDay()];
  let h = d.getHours();
  const min = d.getMinutes().toString().padStart(2, "0");
  const ampm = h < 12 ? "오전" : "오후";
  h = h % 12 || 12;
  return `${m}월 ${day}일 (${wd}) ${ampm} ${h}:${min}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})`;
}

export function isPast(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

const KST_OFFSET = 9 * 60 * 60 * 1000;

// 한국시간(KST) 기준 해당 날짜의 마지막 순간(23:59:59.999)을 UTC instant(ms)로 반환
function kstEndOfDay(ms: number): number {
  const kst = new Date(ms + KST_OFFSET);
  const end = Date.UTC(
    kst.getUTCFullYear(),
    kst.getUTCMonth(),
    kst.getUTCDate(),
    23,
    59,
    59,
    999
  );
  return end - KST_OFFSET;
}

// 출석체크 가능 시간대: 모임 시작 1시간 전 ~ 모임 당일(KST) 종료
export function attendanceWindow(startsAtIso: string): {
  openMs: number;
  closeMs: number;
} {
  const startMs = new Date(startsAtIso).getTime();
  return {
    openMs: startMs - 60 * 60 * 1000, // 시작 1시간 전
    closeMs: kstEndOfDay(startMs), // 당일 23:59:59.999 (KST)
  };
}

// 현재 시각 기준 출석체크 가능 여부와 안내 문구
export function attendanceState(startsAtIso: string): {
  canCheckIn: boolean;
  windowMsg: string | null;
} {
  const now = Date.now();
  const { openMs, closeMs } = attendanceWindow(startsAtIso);
  if (now < openMs)
    return {
      canCheckIn: false,
      windowMsg: "모임 시작 1시간 전부터 출석체크가 열립니다.",
    };
  if (now > closeMs)
    return { canCheckIn: false, windowMsg: "출석체크 가능 시간이 지났습니다." };
  return { canCheckIn: true, windowMsg: null };
}

// 참석 응답 마감 시각이 지났는지
export function isRsvpLocked(deadlineIso: string | null): boolean {
  if (!deadlineIso) return false;
  return Date.now() > new Date(deadlineIso).getTime();
}
