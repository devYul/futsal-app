# ⚽ 풋살 동호회 앱

동호회 일정·참석응답·당일 출석체크·**실력 기반 공평한 팀 배분**·푸시 알림을 한 곳에서.
PWA(웹앱)라 카카오톡으로 링크만 공유하면 누구나 **홈 화면에 추가**해서 앱처럼 씁니다.

## 기술 스택

- **Next.js 16** (App Router, PWA)
- **Supabase** (인증 + Postgres DB)
- **Web Push** (VAPID) — 푸시 알림
- 배포: **Vercel** (무료)

---

## 처음 한 번만: 설정 순서

### 1) Supabase 프로젝트 만들기

1. https://supabase.com 가입 → **New project** 생성 (Region: Northeast Asia (Seoul) 권장)
2. 좌측 **SQL Editor → New query** 에 `supabase/schema.sql` 내용을 통째로 붙여넣고 **Run**
   - 테이블·보안정책(RLS)·가입 트리거가 한 번에 생성됩니다.
3. **Authentication → Sign In / Providers → Email** 에서
   - 빠른 사용을 원하면 **"Confirm email" 을 끄세요** (가입 즉시 로그인 가능).
   - 메일 인증을 쓰려면 켜둔 채로 둡니다.

### 2) API 키를 `.env.local` 에 넣기

`.env.local.example` 을 복사해 `.env.local` 을 만들고, Supabase **Project Settings → API** 값으로 채웁니다.

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...        # anon public
SUPABASE_SERVICE_ROLE_KEY=eyJ...            # service_role (서버 전용, 절대 노출 금지)
```

VAPID 키는 이미 생성되어 있습니다. (다시 만들려면 `npm run gen:vapid`)

### 3) 로컬 실행

```bash
npm run dev
```

http://localhost:3000 접속 → **회원가입** → 가입 완료.

### 4) 본인을 운영진(admin)으로 지정

운영진만 모임 생성·실력점수 수정·팀 배분이 가능합니다.
Supabase **SQL Editor** 에서 (가입한 이메일로 교체):

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'shcho@wace.me');
```

---

## 배포 (Vercel)

1. 이 폴더를 GitHub 저장소로 푸시
2. https://vercel.com 가입 → **Add New → Project** → 저장소 선택
3. **Environment Variables** 에 `.env.local` 의 값들(SUPABASE 3개 + VAPID 3개) 등록
4. **Deploy** → `https://여러분앱.vercel.app` 주소 생성
5. Supabase **Authentication → URL Configuration → Site URL** 에 배포 주소 등록

### 핸드폰 설치 (PWA)

- 배포 주소를 카카오톡 등으로 공유
- **안드로이드(Chrome)**: 접속 → 메뉴 → "홈 화면에 추가"
- **iOS(Safari)**: 접속 → 공유 → "홈 화면에 추가"
  - ⚠️ iOS는 **홈 화면에 추가한 뒤** 앱을 열어야 푸시 알림이 동작합니다 (Safari 16.4+).

---

## 주요 기능 사용법

| 기능 | 설명 |
|------|------|
| **모임 만들기** | 운영진이 홈에서 `+ 새 모임 만들기` → 자동으로 전원에게 푸시 알림 |
| **참석 응답** | 모임 상세에서 참석/미정/불참 선택 |
| **출석 체크** | 당일 본인 계정에서 `출석 체크하기` 탭 |
| **팀 배분** | 운영진이 모임 상세에서 `실력 기반 팀 자동 배분` → 출석자(없으면 참석자) 기준으로 점수 합이 균등하게 N팀 편성 |
| **실력 점수** | 멤버 탭에서 운영진이 1.0~5.0 조정 (팀 배분 기준) |
| **푸시 알림** | 내정보 → `푸시 알림 켜기` |

## 팀 배분 알고리즘

`src/lib/teams.ts` — 실력 점수 내림차순 정렬 후 **스네이크 드래프트**로 초기 배분하고,
인원수가 같은 팀끼리 선수를 **1:1 교환**하며 팀 점수 합 편차를 더 줄입니다 (지역 최적화).
인원은 최대 1명 차이로 맞춰집니다.

## 폴더 구조

```
src/
  app/
    login/page.tsx          로그인·회원가입
    (app)/                  로그인 후 영역 (하단 네비)
      page.tsx              홈 — 모임 목록
      events/new/page.tsx   모임 생성 (운영진)
      events/[id]/page.tsx  모임 상세 — RSVP·출석·팀배분
      members/page.tsx      멤버·실력점수
      profile/page.tsx      내정보·푸시 설정
    actions.ts              서버 액션 (모든 데이터 변경)
  lib/
    teams.ts                팀 배분 알고리즘
    push.ts                 푸시 발송
    supabase/               DB 클라이언트
  proxy.ts                  인증 가드 (Next 16 middleware)
public/
  manifest.json, sw.js      PWA + 서비스워커
supabase/schema.sql         DB 스키마 (한 번 실행)
```

## 다음에 확장하면 좋은 것

- 카카오 로그인 (가입 마찰 ↓)
- 회비/정산 관리, 경기 결과·MVP 기록
- 경기 결과 기반 자동 레이팅(Elo)
- 정기 모임 반복 생성, 대기자 명단
