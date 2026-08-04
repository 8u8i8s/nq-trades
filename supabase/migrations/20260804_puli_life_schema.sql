-- ══ PULI LIFE — databázová schéma ══
-- Ak tabuľky ešte neexistujú, spusti tento súbor v Supabase:
-- Dashboard → SQL Editor → New query → vlož celý obsah → Run.

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'bank' check (type in ('cash','bank','crypto','broker','other')),
  currency text not null default 'EUR',
  sort_order int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.account_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  date date not null default current_date,
  balance numeric(14,2) not null,
  created_at timestamptz not null default now(),
  unique (account_id, date)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  type text not null check (type in ('income','expense')),
  amount numeric(14,2) not null check (amount > 0),
  category text not null default 'Iné',
  note text,
  created_at timestamptz not null default now()
);

create table public.finance_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null,
  current_amount numeric(14,2) not null default 0,
  track_networth boolean not null default false,
  deadline date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.daily_pnl (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  amount numeric(14,2) not null,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  emoji text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  date date not null default current_date,
  unique (habit_id, date)
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  deadline date,
  status text not null default 'active' check (status in ('active','done','paused')),
  created_at timestamptz not null default now()
);

create table public.goal_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  sort_order int not null default 0
);

create table public.journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  rating int check (rating between 1 and 5),
  entry text,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table public.fitness_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  weight numeric(5,2),
  workout text,
  duration_min int,
  note text,
  created_at timestamptz not null default now()
);

-- indexy
create index accounts_user_idx on public.accounts (user_id);
create index snapshots_user_idx on public.account_snapshots (user_id, date);
create index snapshots_account_idx on public.account_snapshots (account_id);
create index transactions_user_idx on public.transactions (user_id, date);
create index finance_goals_user_idx on public.finance_goals (user_id);
create index daily_pnl_user_idx on public.daily_pnl (user_id, date);
create index habits_user_idx on public.habits (user_id);
create index habit_logs_user_idx on public.habit_logs (user_id, date);
create index habit_logs_habit_idx on public.habit_logs (habit_id);
create index goals_user_idx on public.goals (user_id);
create index goal_steps_user_idx on public.goal_steps (user_id);
create index goal_steps_goal_idx on public.goal_steps (goal_id);
create index journal_user_idx on public.journal (user_id, date);
create index fitness_user_idx on public.fitness_logs (user_id, date);

-- RLS: každý používateľ vidí len svoje riadky
alter table public.accounts enable row level security;
alter table public.account_snapshots enable row level security;
alter table public.transactions enable row level security;
alter table public.finance_goals enable row level security;
alter table public.daily_pnl enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.goals enable row level security;
alter table public.goal_steps enable row level security;
alter table public.journal enable row level security;
alter table public.fitness_logs enable row level security;

create policy "own rows" on public.accounts for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.account_snapshots for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.transactions for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.finance_goals for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.daily_pnl for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.habits for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.habit_logs for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.goals for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.goal_steps for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.journal for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.fitness_logs for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
