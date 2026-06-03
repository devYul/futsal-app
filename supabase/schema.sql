-- ============================================================
--  풋살 동호회 앱 - 데이터베이스 스키마
--  Supabase SQL Editor 에 그대로 붙여넣어 실행하세요.
--  (Dashboard > SQL Editor > New query > 붙여넣기 > Run)
-- ============================================================

-- ── 0. 확장 ────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── 1. 회원 프로필 (auth.users 1:1 확장) ───────────────────
--   skill_rating: 실력 점수 (1.0 ~ 5.0). 운영진이 부여하며 팀 배분의 기준이 됩니다.
--   role: 'admin' | 'member'. admin 만 모임 생성/실력점수 수정 가능.
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  name         text not null default '',
  phone        text,
  position     text check (position in ('GK','DF','MF','FW') or position is null),
  skill_rating numeric(3,1) not null default 3.0 check (skill_rating between 1.0 and 5.0),
  elo_rating   numeric(6,1) not null default 1000,   -- 경기 결과 기반 자동 레이팅 (Elo)
  role         text not null default 'member' check (role in ('admin','member')),
  created_at   timestamptz not null default now()
);
-- 기존 DB 업그레이드용 (재실행해도 안전)
alter table public.profiles add column if not exists elo_rating numeric(6,1) not null default 1000;

-- ── 2. 모임(이벤트) ────────────────────────────────────────
create table if not exists public.events (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  location      text,
  starts_at     timestamptz not null,
  capacity      int,                         -- 정원 (null = 무제한). 초과 응답자는 대기자 명단으로.
  num_teams     int not null default 2 check (num_teams between 2 and 6),
  status        text not null default 'upcoming' check (status in ('upcoming','closed','done')),
  mvp_user_id   uuid references public.profiles(id) on delete set null,  -- 당일 MVP
  series_id     uuid,                        -- 정기(반복) 모임 묶음 식별자
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
-- 기존 DB 업그레이드용 (재실행해도 안전)
alter table public.events add column if not exists mvp_user_id uuid references public.profiles(id) on delete set null;
alter table public.events add column if not exists series_id uuid;

-- ── 3. 참석 응답 (모임 전 RSVP) ────────────────────────────
create table if not exists public.rsvps (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  status     text not null check (status in ('yes','no','maybe')),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);

-- ── 4. 당일 출석체크 ───────────────────────────────────────
create table if not exists public.attendance (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  unique (event_id, user_id)
);

-- ── 5. 팀 배분 결과 ────────────────────────────────────────
create table if not exists public.team_assignments (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  team_no    int not null,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

-- ── 6. 푸시 구독 정보 ──────────────────────────────────────
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null unique,
  keys       jsonb not null,              -- { p256dh, auth }
  created_at timestamptz not null default now()
);

-- ── 7. 경기 결과 (한 모임 안에서 팀끼리 치른 경기들) ────────
--   team_a / team_b 는 team_assignments 의 team_no 를 가리킵니다.
--   결과는 Elo 레이팅 자동 계산의 입력으로 쓰입니다.
create table if not exists public.matches (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  team_a     int not null,
  team_b     int not null,
  score_a    int not null default 0 check (score_a >= 0),
  score_b    int not null default 0 check (score_b >= 0),
  created_at timestamptz not null default now()
);

-- ── 8. 회비 (월별 납부 관리) ───────────────────────────────
--   period: 'YYYY-MM'. 운영진이 월별로 생성하고 납부 여부를 관리합니다.
create table if not exists public.dues (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.profiles(id) on delete cascade,
  period    text not null,                 -- 'YYYY-MM'
  amount    int  not null default 0,
  paid      boolean not null default false,
  paid_at   timestamptz,
  note      text,
  unique (user_id, period)
);

-- ============================================================
--  헬퍼: 현재 사용자가 admin 인지
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================
--  신규 가입 시 프로필 자동 생성 트리거
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 이메일 가입은 메타데이터 name, 카카오 로그인은 name/full_name/nickname 을 사용.
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'nickname', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      '회원'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
--  Row Level Security
-- ============================================================
alter table public.profiles            enable row level security;
alter table public.events              enable row level security;
alter table public.rsvps               enable row level security;
alter table public.attendance          enable row level security;
alter table public.team_assignments    enable row level security;
alter table public.push_subscriptions  enable row level security;
alter table public.matches              enable row level security;
alter table public.dues                 enable row level security;

-- 프로필: 로그인 회원은 모두 조회 가능 / 본인 정보 수정 / admin 은 전체 수정(실력점수·role)
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (auth.role() = 'authenticated');

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update using (public.is_admin());

-- 모임: 회원 조회 / admin 만 생성·수정·삭제
drop policy if exists events_select on public.events;
create policy events_select on public.events
  for select using (auth.role() = 'authenticated');

drop policy if exists events_admin_write on public.events;
create policy events_admin_write on public.events
  for all using (public.is_admin()) with check (public.is_admin());

-- RSVP: 회원 조회 / 본인 것만 작성·수정·삭제
drop policy if exists rsvps_select on public.rsvps;
create policy rsvps_select on public.rsvps
  for select using (auth.role() = 'authenticated');

drop policy if exists rsvps_write_self on public.rsvps;
create policy rsvps_write_self on public.rsvps
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 출석: 회원 조회 / 본인 체크인·취소 / admin 도 관리 가능
drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance
  for select using (auth.role() = 'authenticated');

drop policy if exists attendance_write_self on public.attendance;
create policy attendance_write_self on public.attendance
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- 팀 배분: 회원 조회 / admin 만 작성·수정
drop policy if exists team_select on public.team_assignments;
create policy team_select on public.team_assignments
  for select using (auth.role() = 'authenticated');

drop policy if exists team_admin_write on public.team_assignments;
create policy team_admin_write on public.team_assignments
  for all using (public.is_admin()) with check (public.is_admin());

-- 푸시 구독: 본인 것만 관리
drop policy if exists push_self on public.push_subscriptions;
create policy push_self on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 경기 결과: 회원 조회 / admin 만 작성·수정·삭제
drop policy if exists matches_select on public.matches;
create policy matches_select on public.matches
  for select using (auth.role() = 'authenticated');

drop policy if exists matches_admin_write on public.matches;
create policy matches_admin_write on public.matches
  for all using (public.is_admin()) with check (public.is_admin());

-- 회비: 회원은 조회 가능(투명 공개) / admin 만 작성·수정
drop policy if exists dues_select on public.dues;
create policy dues_select on public.dues
  for select using (auth.role() = 'authenticated');

drop policy if exists dues_admin_write on public.dues;
create policy dues_admin_write on public.dues
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
--  최초 관리자 지정 (가입 후 이메일로 본인을 admin 으로)
--  아래 주석을 풀고 your-email 을 본인 가입 이메일로 바꿔 실행하세요.
-- ============================================================
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'your-email@example.com');
