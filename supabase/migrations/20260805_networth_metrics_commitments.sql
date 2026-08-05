-- ══ PULI LIFE v2 — kategórie majetku, merateľné ciele, commitmenty ══
-- (Už aplikované v projekte — súbor je tu ako záznam schémy.)

alter table public.accounts drop constraint if exists accounts_type_check;
alter table public.accounts add constraint accounts_type_check
  check (type in ('cash','bank','crypto','broker','stocks','real_estate','debt','other'));

create table public.metric_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  unit text not null default '',
  target numeric not null,
  current numeric not null default 0,
  source text not null default 'manual' check (source in ('manual','workouts')),
  start_date date not null default current_date,
  deadline date not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  start_date date not null default current_date,
  end_date date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.commitment_criteria (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  commitment_id uuid not null references public.commitments(id) on delete cascade,
  text text not null,
  status text not null default 'pending' check (status in ('pending','met','failed')),
  sort_order int not null default 0
);

create index metric_goals_user_idx on public.metric_goals (user_id);
create index commitments_user_idx on public.commitments (user_id);
create index commitment_criteria_user_idx on public.commitment_criteria (user_id);
create index commitment_criteria_cid_idx on public.commitment_criteria (commitment_id);

alter table public.metric_goals enable row level security;
alter table public.commitments enable row level security;
alter table public.commitment_criteria enable row level security;

create policy "own rows" on public.metric_goals for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.commitments for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.commitment_criteria for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
