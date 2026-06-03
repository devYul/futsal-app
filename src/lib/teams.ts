// ============================================================
//  실력 기반 공평한 팀 배분 알고리즘
//
//  목표: N개 팀으로 나누되
//    (1) 팀별 인원 차이 최소 (최대 1명 차이)
//    (2) 팀별 실력 점수 합 최대한 균등
//
//  방법: 점수 내림차순 정렬 → 스네이크 드래프트로 초기 배분
//        → 팀 간 선수 교환(swap)으로 점수 편차를 더 줄이는 지역 최적화
// ============================================================

export interface Player {
  id: string;
  name: string;
  skill: number;
  position?: string | null;
}

export interface Team {
  teamNo: number;
  players: Player[];
  total: number; // 실력 점수 합
}

function totalOf(players: Player[]): number {
  return players.reduce((s, p) => s + p.skill, 0);
}

// 팀 점수 합들의 표준편차 (작을수록 균등)
function spread(teams: Team[]): number {
  const totals = teams.map((t) => t.total);
  const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
  const variance =
    totals.reduce((a, b) => a + (b - mean) ** 2, 0) / totals.length;
  return Math.sqrt(variance);
}

export function balanceTeams(players: Player[], numTeams: number): Team[] {
  const n = Math.max(2, Math.min(numTeams, players.length || 2));

  // 1. 점수 내림차순 정렬
  const sorted = [...players].sort((a, b) => b.skill - a.skill);

  // 2. 스네이크 드래프트: 0,1,2,..,n-1, n-1,..,1,0, 0,1,.. 순서로 배분
  const buckets: Player[][] = Array.from({ length: n }, () => []);
  let idx = 0;
  let dir = 1;
  for (const p of sorted) {
    buckets[idx].push(p);
    if (dir === 1 && idx === n - 1) dir = -1;
    else if (dir === -1 && idx === 0) dir = 1;
    else idx += dir;
  }

  let teams: Team[] = buckets.map((players, i) => ({
    teamNo: i + 1,
    players,
    total: totalOf(players),
  }));

  // 3. 지역 최적화: 인원수가 같은 두 팀 사이에서 선수 1:1 교환으로
  //    점수 편차가 줄어들면 교환. 더 이상 개선이 없을 때까지 반복.
  let improved = true;
  let guard = 0;
  while (improved && guard < 1000) {
    improved = false;
    guard++;
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        // 인원수가 다르면 교환 시 인원 균형이 깨지므로 같은 경우만
        if (teams[a].players.length !== teams[b].players.length) continue;
        for (let i = 0; i < teams[a].players.length; i++) {
          for (let j = 0; j < teams[b].players.length; j++) {
            const pa = teams[a].players[i];
            const pb = teams[b].players[j];
            const before = spread(teams);

            // 교환 시뮬레이션
            const newA = [...teams[a].players];
            const newB = [...teams[b].players];
            newA[i] = pb;
            newB[j] = pa;
            const trial = teams.map((t, k) =>
              k === a
                ? { ...t, players: newA, total: totalOf(newA) }
                : k === b
                ? { ...t, players: newB, total: totalOf(newB) }
                : t
            );
            if (spread(trial) < before - 1e-9) {
              teams = trial;
              improved = true;
            }
          }
        }
      }
    }
  }

  return teams;
}
