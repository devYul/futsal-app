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
