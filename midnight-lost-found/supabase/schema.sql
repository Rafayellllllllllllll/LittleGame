-- 《午夜失物招领处》新项目专用表结构
-- 用法：在一个全新的 Supabase 项目里跑这份 SQL，不要跑进错题本的项目。
-- 前端只用 anon 公开密钥；不要把 service_role 密钥放进前端代码或仓库。
-- 未登录游客只用本地存档；登录用户（Supabase Auth）才能同步云端。

create table if not exists public.game_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  device_id text not null,
  save_data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.game_achievements (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  unique (user_id, achievement_id)
);

create table if not exists public.game_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_game_achievements_user on public.game_achievements (user_id);
create index if not exists idx_game_saves_updated on public.game_saves (updated_at desc);

alter table public.game_profiles enable row level security;
alter table public.game_saves enable row level security;
alter table public.game_achievements enable row level security;
alter table public.game_settings enable row level security;

-- 每个登录用户只能读写自己的行；未登录 anon 没有任何读写权限。
drop policy if exists "own profile" on public.game_profiles;
create policy "own profile" on public.game_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own save" on public.game_saves;
create policy "own save" on public.game_saves
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own achievements" on public.game_achievements;
create policy "own achievements" on public.game_achievements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own settings" on public.game_settings;
create policy "own settings" on public.game_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
