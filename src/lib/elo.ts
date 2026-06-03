// ============================================================
//  경기 결과 기반 자동 레이팅 (Elo)
//
//  팀 단위 경기라 각 팀의 "평균 Elo" 로 기대 승률을 구하고,
//  실제 결과와의 차이만큼 팀원 전원의 Elo 를 가감합니다.
//
//  핵심: 전체 경기를 시간순으로 "재생(replay)" 하므로 멱등적입니다.
//        (경기 추가/삭제 시 전체를 다시 계산해도 항상 같은 결과)
// ============================================================

export const BASE_ELO = 1000;
const K = 24; // 변동 계수 (클수록 한 경기 영향 ↑)

export interface EloMatch {
  teamA: string[]; // A팀 선수 id 목록
  teamB: string[]; // B팀 선수 id 목록
  scoreA: number;
  scoreB: number;
}

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

// 모든 멤버를 BASE_ELO 에서 시작해 경기들을 순서대로 재생하며 레이팅을 계산.
// allUserIds: 전체 멤버 (경기를 안 뛴 사람도 BASE 로 결과에 포함)
// matches: created_at 오름차순으로 정렬된 경기 목록
export function replayElo(
  allUserIds: string[],
  matches: EloMatch[]
): Map<string, number> {
  const elo = new Map<string, number>();
  for (const id of allUserIds) elo.set(id, BASE_ELO);

  for (const m of matches) {
    const a = m.teamA.filter((id) => elo.has(id));
    const b = m.teamB.filter((id) => elo.has(id));
    if (a.length === 0 || b.length === 0) continue;
    if (m.scoreA === m.scoreB && m.scoreA === 0) continue; // 0:0 미기록 취급

    const avgA = a.reduce((s, id) => s + elo.get(id)!, 0) / a.length;
    const avgB = b.reduce((s, id) => s + elo.get(id)!, 0) / b.length;

    const resultA = m.scoreA > m.scoreB ? 1 : m.scoreA < m.scoreB ? 0 : 0.5;
    const expA = expectedScore(avgA, avgB);

    // 골득실 가중: 점수차가 클수록 변동 폭 ↑ (1골차 ≈ ×1.69, 3골차 ≈ ×2.39)
    const margin = Math.abs(m.scoreA - m.scoreB);
    const mult = Math.log(margin + 1) + 1;
    const delta = K * mult * (resultA - expA);

    for (const id of a) elo.set(id, elo.get(id)! + delta);
    for (const id of b) elo.set(id, elo.get(id)! - delta);
  }

  // 소수점 1자리로 정리
  for (const [id, v] of elo) elo.set(id, Math.round(v * 10) / 10);
  return elo;
}
