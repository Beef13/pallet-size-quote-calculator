-- Pallet Quote: accounts and online storage.
--
-- Everything a business saves belongs to a row in `businesses`. People reach it through
-- `business_members`. For now each person has exactly one business and is its owner; the
-- membership table is there so staff can be added later without reshaping the data.
--
-- Privacy is enforced here, in the database, by row-level security: a signed-in person can
-- only ever read or change rows of a business they are a member of. The app is not trusted
-- to get this right.

-- Helpers live outside the schema the API exposes
create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null default '' check (char_length(name) <= 200),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.business_members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create index business_members_user_id_idx on public.business_members (user_id);

-- One row each for the price list, the saved presets and the business details.
-- `data` is the same JSON the app keeps on the device.
create table public.documents (
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind text not null check (kind in ('prices', 'presets', 'business')),
  data jsonb not null check (octet_length(data::text) <= 1500000),
  updated_at timestamptz not null,
  primary key (business_id, kind)
);

-- One row per saved quote, so two devices can change different quotes without clashing.
-- A deleted quote keeps its row with `deleted_at` set and no data, so the deletion
-- reaches the other devices too.
create table public.quotes (
  business_id uuid not null references public.businesses (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  data jsonb check (data is null or octet_length(data::text) <= 400000),
  updated_at timestamptz not null,
  deleted_at timestamptz,
  primary key (business_id, id),
  check ((deleted_at is null) = (data is not null))
);

-- ---------------------------------------------------------------------------
-- Newest change wins
-- ---------------------------------------------------------------------------
-- The app sends the time each change was made. A device with a wrong clock must not be
-- able to "win" forever, and a slow device must not overwrite something newer.

create function private.keep_newest()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- A time in the future is treated as "now"
  if new.updated_at > now() + interval '5 minutes' then
    new.updated_at := now();
  end if;
  -- An update older than what is stored is ignored
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;
  return new;
end;
$$;

create trigger documents_keep_newest
  before insert or update on public.documents
  for each row execute function private.keep_newest();

create trigger quotes_keep_newest
  before insert or update on public.quotes
  for each row execute function private.keep_newest();

-- ---------------------------------------------------------------------------
-- Who can see what
-- ---------------------------------------------------------------------------

-- True when the signed-in person belongs to the business. Runs with the owner's rights so
-- it can read the membership table without tripping that table's own rules.
create function private.is_member(target_business uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members m
    where m.business_id = target_business
      and m.user_id = (select auth.uid())
  );
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke all on function private.is_member(uuid) from public;
grant execute on function private.is_member(uuid) to authenticated;

alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.documents enable row level security;
alter table public.quotes enable row level security;

-- Visitors who are not signed in get nothing at all
revoke all on public.businesses, public.business_members, public.documents, public.quotes from anon;

-- Signed-in people get only the operations they need; the policies below then narrow
-- those to their own business. Businesses and memberships are created and removed only
-- through the functions further down.
revoke all on public.businesses, public.business_members, public.documents, public.quotes from authenticated;
grant select, update (name) on public.businesses to authenticated;
grant select on public.business_members to authenticated;
grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, update, delete on public.quotes to authenticated;

create policy "Members can see their business"
  on public.businesses for select to authenticated
  using (private.is_member(id));

create policy "Members can rename their business"
  on public.businesses for update to authenticated
  using (private.is_member(id))
  with check (private.is_member(id));

create policy "People can see their own memberships"
  on public.business_members for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Members can read their documents"
  on public.documents for select to authenticated
  using (private.is_member(business_id));

create policy "Members can add documents"
  on public.documents for insert to authenticated
  with check (private.is_member(business_id));

create policy "Members can change their documents"
  on public.documents for update to authenticated
  using (private.is_member(business_id))
  with check (private.is_member(business_id));

create policy "Members can remove their documents"
  on public.documents for delete to authenticated
  using (private.is_member(business_id));

create policy "Members can read their quotes"
  on public.quotes for select to authenticated
  using (private.is_member(business_id));

create policy "Members can add quotes"
  on public.quotes for insert to authenticated
  with check (private.is_member(business_id));

create policy "Members can change their quotes"
  on public.quotes for update to authenticated
  using (private.is_member(business_id))
  with check (private.is_member(business_id));

create policy "Members can remove their quotes"
  on public.quotes for delete to authenticated
  using (private.is_member(business_id));

-- ---------------------------------------------------------------------------
-- Functions the app calls
-- ---------------------------------------------------------------------------

-- Returns the signed-in person's business, creating it (with them as owner) the first time.
create function public.ensure_business()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  found uuid;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  -- Two tabs signing in at once must not create two businesses
  perform pg_advisory_xact_lock(hashtextextended(me::text, 0));

  select m.business_id into found
  from public.business_members m
  where m.user_id = me
  order by m.created_at
  limit 1;

  if found is null then
    insert into public.businesses (created_by) values (me) returning id into found;
    insert into public.business_members (business_id, user_id, role) values (found, me, 'owner');
  end if;

  return found;
end;
$$;

-- Removes everything the signed-in person's own businesses have stored online.
-- Their sign-in itself is removed separately.
create function public.delete_my_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  delete from public.businesses b
  where exists (
    select 1 from public.business_members m
    where m.business_id = b.id and m.user_id = me and m.role = 'owner'
  );
end;
$$;

revoke all on function public.ensure_business() from public, anon;
revoke all on function public.delete_my_data() from public, anon;
grant execute on function public.ensure_business() to authenticated;
grant execute on function public.delete_my_data() to authenticated;
