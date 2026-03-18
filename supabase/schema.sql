create table if not exists public.user_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, item_id)
);

create table if not exists public.user_review_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  quality int not null,
  timestamp timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, item_id, timestamp, quality)
);

alter table public.user_progress enable row level security;
alter table public.user_review_events enable row level security;

create policy "users_can_read_own_progress"
  on public.user_progress
  for select
  using (auth.uid() = user_id);

create policy "users_can_write_own_progress"
  on public.user_progress
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users_can_read_own_review_events"
  on public.user_review_events
  for select
  using (auth.uid() = user_id);

create policy "users_can_write_own_review_events"
  on public.user_review_events
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
