-- 삼색펜 블로그 설정
-- 운영 원칙: 글은 관리자만 쓴다. 회원은 읽기와 댓글만 할 수 있다.
-- Supabase 화면의 SQL Editor에 통째로 붙여 넣고 Run을 누르세요.
-- 예전 설정을 이미 실행했어도 다시 실행하면 새 규칙으로 바뀝니다.

-- 1. 회원 등급 표: member(회원), banned(추방), admin(관리자)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'member',
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists warns int not null default 0;

-- 예전 등급(승인 대기, 글쓴이)은 모두 회원으로 바꿈
alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'member' where role in ('pending', 'writer');
alter table public.profiles alter column role set default 'member';
alter table public.profiles add constraint profiles_role_check check (role in ('member', 'banned', 'admin'));
alter table public.profiles drop constraint if exists profiles_warns_check;
alter table public.profiles add constraint profiles_warns_check check (warns between 0 and 3);
alter table public.profiles enable row level security;

-- 지금 로그인한 사람의 등급
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

-- 특정 사람의 등급 (추방된 회원의 댓글을 숨길 때 씀)
create or replace function public.role_of(uid uuid) returns text
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = uid $$;

-- 회원가입하면 바로 회원 등급을 만들어 줌
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role) values (new.id, new.email, 'member')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- 경고 3회면 자동 추방, 관리자는 추방되지 않음, 추방을 되돌리면 경고 0회
create or replace function public.profiles_guard() returns trigger
language plpgsql
as $$
begin
  if old.role = 'admin' then
    new.role := 'admin';
    new.warns := 0;
    return new;
  end if;
  if new.role = 'admin' and old.role <> 'admin' then
    raise exception '관리자 지정은 SQL Editor에서만 할 수 있습니다';
  end if;
  if old.role = 'banned' and new.role = 'member' then
    new.warns := 0;
  end if;
  if new.warns >= 3 then
    new.warns := 3;
    new.role := 'banned';
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.profiles_guard();

-- 등급표 읽기: 본인 것만, 관리자는 전체
drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles
  for select using (id = auth.uid() or public.my_role() = 'admin');

-- 경고, 추방, 되돌림: 관리자만
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update to authenticated
  using (public.my_role() = 'admin')
  with check (public.my_role() = 'admin');

-- 2. 글 표: 관리자만 쓰고 고치고 지움
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

-- 읽기: 공개글은 누구나, 나만보기 글은 관리자만
drop policy if exists "posts_read" on public.posts;
create policy "posts_read" on public.posts
  for select using (visibility = 'public' or public.my_role() = 'admin');

drop policy if exists "posts_insert" on public.posts;
create policy "posts_insert" on public.posts
  for insert to authenticated
  with check (public.my_role() = 'admin' and auth.uid() = author_id);

drop policy if exists "posts_update" on public.posts;
create policy "posts_update" on public.posts
  for update to authenticated
  using (public.my_role() = 'admin')
  with check (public.my_role() = 'admin');

drop policy if exists "posts_delete" on public.posts;
create policy "posts_delete" on public.posts
  for delete to authenticated using (public.my_role() = 'admin');

-- 3. 댓글 표: 회원과 관리자가 씀
create table if not exists public.comments (
  id bigint generated always as identity primary key,
  post_id text not null check (char_length(post_id) between 1 and 100),
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text not null default '',
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists comments_post_idx on public.comments (post_id, created_at);
alter table public.comments enable row level security;

-- 댓글 쓴 사람 이름은 서버가 정함: 이메일 앞 3글자 + ***
create or replace function public.comments_fill() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.author_id := auth.uid();
    new.author_name := coalesce(left(split_part((select email from auth.users where id = auth.uid()), '@', 1), 3), '회원') || '***';
    new.created_at := now();
    new.updated_at := null;
  else
    new.author_id := old.author_id;
    new.author_name := old.author_name;
    new.post_id := old.post_id;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists comments_fill on public.comments;
create trigger comments_fill
  before insert or update on public.comments
  for each row execute function public.comments_fill();

-- 읽기: 누구나. 단, 추방된 회원의 댓글은 관리자만 봄
drop policy if exists "comments_read" on public.comments;
create policy "comments_read" on public.comments
  for select using (public.role_of(author_id) <> 'banned' or public.my_role() = 'admin');

-- 쓰기: 회원과 관리자만. 추방된 회원은 못 씀
drop policy if exists "comments_insert" on public.comments;
create policy "comments_insert" on public.comments
  for insert to authenticated
  with check (public.my_role() in ('member', 'admin'));

-- 고치기: 내 댓글만. 추방되면 못 고침
drop policy if exists "comments_update" on public.comments;
create policy "comments_update" on public.comments
  for update to authenticated
  using (author_id = auth.uid() and public.my_role() in ('member', 'admin'))
  with check (author_id = auth.uid());

-- 지우기: 내 댓글, 또는 관리자는 모든 댓글
drop policy if exists "comments_delete" on public.comments;
create policy "comments_delete" on public.comments
  for delete to authenticated
  using (author_id = auth.uid() or public.my_role() = 'admin');

-- 4. 나를 관리자로 만들기
-- 블로그에서 먼저 회원가입한 뒤, 아래 줄 맨 앞의 -- 두 개를 지우고 내 이메일로 바꿔 한 번만 실행하세요.
-- 관리자 지정은 화면에서 막혀 있어서 이 방법으로만 할 수 있습니다.
-- 아래 줄은 profiles_guard 규칙을 잠깐 끄고 실행합니다.
-- alter table public.profiles disable trigger profiles_guard; update public.profiles set role = 'admin', warns = 0 where email = '내이메일@example.com'; alter table public.profiles enable trigger profiles_guard;
