create table if not exists public.journal_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  lumloom_id text not null,
  record_type text not null check (record_type in ('daily', 'weekly-review')),
  record_date date not null,
  payload jsonb not null default '{}'::jsonb,
  version bigint not null default 1 check (version > 0),
  status text not null default 'active' check (status in ('active', 'archived', 'deleted')),
  client_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, lumloom_id)
);

create index if not exists journal_records_user_date_idx
  on public.journal_records (user_id, record_date desc);

alter table public.journal_records enable row level security;

revoke all on table public.journal_records from anon, authenticated;
grant select, insert, update, delete on table public.journal_records to authenticated;

drop policy if exists "journal_records_select_own" on public.journal_records;
create policy "journal_records_select_own"
  on public.journal_records for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "journal_records_insert_own" on public.journal_records;
create policy "journal_records_insert_own"
  on public.journal_records for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "journal_records_update_own" on public.journal_records;
create policy "journal_records_update_own"
  on public.journal_records for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "journal_records_delete_own" on public.journal_records;
create policy "journal_records_delete_own"
  on public.journal_records for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.set_journal_record_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_journal_record_updated_at on public.journal_records;
create trigger set_journal_record_updated_at
before update on public.journal_records
for each row execute function public.set_journal_record_updated_at();
