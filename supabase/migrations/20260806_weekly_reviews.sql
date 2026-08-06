-- ══ PULI LIFE — týždenný review ══
-- Spusti v Supabase: Dashboard → SQL Editor → New query → vlož → Run.

create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  worked text,
  next_week text,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create index weekly_reviews_user_idx on public.weekly_reviews (user_id, week_start);

alter table public.weekly_reviews enable row level security;

create policy "own rows" on public.weekly_reviews for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
