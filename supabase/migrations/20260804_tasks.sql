-- ══ PULI LIFE — denné úlohy (checklist) ══
-- Spusti v Supabase: Dashboard → SQL Editor → New query → vlož → Run.

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  kind text not null default 'once' check (kind in ('once','recurring')),
  date date,            -- pre jednorazové
  weekdays int[],       -- pre opakované: 1=Po ... 7=Ne
  time text,            -- voliteľný čas "HH:MM"
  done boolean not null default false,  -- pre jednorazové
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.task_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  date date not null default current_date,
  unique (task_id, date)
);

create index tasks_user_idx on public.tasks (user_id, date);
create index task_logs_user_idx on public.task_logs (user_id, date);
create index task_logs_task_idx on public.task_logs (task_id);

alter table public.tasks enable row level security;
alter table public.task_logs enable row level security;

create policy "own rows" on public.tasks for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.task_logs for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
