create extension if not exists pgcrypto;

create table if not exists public.weekend_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  note text not null default '',
  target_date date not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists weekend_todos_user_id_target_date_idx
  on public.weekend_todos (user_id, target_date, created_at);

alter table public.weekend_todos enable row level security;

drop policy if exists "users can read own todos" on public.weekend_todos;
create policy "users can read own todos"
on public.weekend_todos
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "users can insert own todos" on public.weekend_todos;
create policy "users can insert own todos"
on public.weekend_todos
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "users can update own todos" on public.weekend_todos;
create policy "users can update own todos"
on public.weekend_todos
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users can delete own todos" on public.weekend_todos;
create policy "users can delete own todos"
on public.weekend_todos
for delete
to authenticated
using (auth.uid() = user_id);
