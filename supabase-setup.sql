-- 삼색펜 블로그 설정
-- Supabase 화면의 SQL Editor에 통째로 붙여 넣고 Run을 누르세요.
-- 여러 번 실행해도 괜찮습니다.

-- 1. 회원 등급 표: pending(승인 대기), writer(글쓴이), admin(관리자)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'pending' check (role in ('pending', 'writer', 'admin')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- 지금 로그인한 사람의 등급을 알려주는 함수
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

-- 회원가입하면 자동으로 승인 대기 등급을 만들어 줌
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 이미 가입한 사람이 있으면 등급표에 채워 넣기
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- 등급표 읽기: 본인 것만, 관리자는 전체
drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles
  for select using (id = auth.uid() or public.my_role() = 'admin');

-- 등급 바꾸기: 관리자만
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update to authenticated
  using (public.my_role() = 'admin')
  with check (public.my_role() = 'admin');

-- 2. 글 표
create table if not exists public.posts (
  id bigint generated always as identity primary key,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 50000),
  category text not null default '일반' check (char_length(category) between 1 and 20),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  created_at timestamptz not null default now()
);
alter table public.posts add column if not exists updated_at timestamptz;
alter table public.posts enable row level security;

-- 읽기: 공개글은 누구나, 나만보기 글은 쓴 사람만
drop policy if exists "posts_read" on public.posts;
create policy "posts_read" on public.posts
  for select using (visibility = 'public' or auth.uid() = author_id);

-- 쓰기: 관리자가 허용한 사람만, 본인 이름으로만
drop policy if exists "posts_insert" on public.posts;
create policy "posts_insert" on public.posts
  for insert to authenticated
  with check (auth.uid() = author_id and public.my_role() in ('writer', 'admin'));

-- 수정: 허용된 사람이 본인 글만
drop policy if exists "posts_update" on public.posts;
create policy "posts_update" on public.posts
  for update to authenticated
  using (auth.uid() = author_id and public.my_role() in ('writer', 'admin'))
  with check (auth.uid() = author_id and public.my_role() in ('writer', 'admin'));

-- 삭제: 본인 글만
drop policy if exists "posts_delete" on public.posts;
create policy "posts_delete" on public.posts
  for delete to authenticated using (auth.uid() = author_id);

-- 3. 나를 관리자로 만들기
-- 블로그에서 먼저 회원가입한 뒤, 아래 줄 맨 앞의 -- 두 개를 지우고 내 이메일로 바꿔 한 번만 실행하세요.
-- update public.profiles set role = 'admin' where email = '내이메일@example.com';
