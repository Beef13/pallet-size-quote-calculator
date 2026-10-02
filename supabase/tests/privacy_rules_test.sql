-- Tries to break the privacy rules. Every check raises an error if it fails, so the script
-- only reaches its final line when all of them pass. Run with supabase/tests/run_local.sh.
\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'alice@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bob@example.com');

create temp table ids (who text primary key, business uuid);
grant all on ids to authenticated, anon;

-- Sign in as someone for the rest of the transaction
create function pg_temp.sign_in(who text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub',
    case who when 'alice' then 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' when 'bob' then 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' else '' end, true);
  execute format('set local role %I', case when who = 'nobody' then 'anon' else 'authenticated' end);
end $$;

-- 1. Each person gets their own business, and asking twice gives the same one
begin;
select pg_temp.sign_in('alice');
insert into ids values ('alice', public.ensure_business());
do $$ begin
  assert (select business from ids where who = 'alice') = public.ensure_business(), 'ensure_business must be stable';
end $$;
insert into public.documents values ((select business from ids where who = 'alice'), 'prices', '{"markup": 25}', now());
insert into public.quotes values ((select business from ids where who = 'alice'), 'q1', '{"number": "Q2026-0001", "customer": "Harbour Freight"}', now(), null);
commit;

begin;
select pg_temp.sign_in('bob');
insert into ids values ('bob', public.ensure_business());
insert into public.quotes values ((select business from ids where who = 'bob'), 'q1', '{"number": "Q2026-0001"}', now(), null);
commit;

do $$ begin
  assert (select count(*) from public.businesses) = 2, 'expected two businesses';
  assert (select count(distinct business) from ids) = 2, 'businesses must differ';
end $$;

-- 2. Alice sees her own data
begin;
select pg_temp.sign_in('alice');
do $$ begin
  assert (select count(*) from public.businesses) = 1, 'alice should see exactly her business';
  assert (select count(*) from public.documents) = 1, 'alice should see her document';
  assert (select count(*) from public.quotes) = 1, 'alice should see only her quote';
  assert (select count(*) from public.business_members) = 1, 'alice should see only her membership';
end $$;
commit;

-- 3. Bob cannot read, change, delete or add to Alice's data
begin;
select pg_temp.sign_in('bob');
do $$ begin
  -- a blanket delete as bob must touch only bob's business; run it in a sub-block and undo it
  declare n int; alice_business uuid := (select business from ids where who = 'alice');
  begin
    delete from public.businesses where id = alice_business;
    get diagnostics n = row_count; assert n = 0, 'bob deleted alice''s business';
    delete from public.businesses;
    get diagnostics n = row_count; assert n = 1, 'a blanket delete should remove only bob''s own business';
    raise exception 'undo';
  exception when raise_exception then null; end;
end $$;
do $$
declare
  alice_business uuid := (select business from ids where who = 'alice');
  n int;
begin
  assert (select count(*) from public.documents where business_id = alice_business) = 0, 'bob can read alice''s documents';
  assert (select count(*) from public.quotes where business_id = alice_business) = 0, 'bob can read alice''s quotes';
  assert (select count(*) from public.businesses where id = alice_business) = 0, 'bob can see alice''s business';
  assert (select count(*) from public.business_members where business_id = alice_business) = 0, 'bob can see alice''s membership';

  update public.quotes set data = '{"hacked": true}', updated_at = now() where business_id = alice_business;
  get diagnostics n = row_count; assert n = 0, 'bob changed alice''s quote';
  delete from public.documents where business_id = alice_business;
  get diagnostics n = row_count; assert n = 0, 'bob deleted alice''s document';
  update public.businesses set name = 'mine now' where id = alice_business;
  get diagnostics n = row_count; assert n = 0, 'bob renamed alice''s business';

  begin
    insert into public.quotes values (alice_business, 'planted', '{"x": 1}', now(), null);
    raise exception 'bob added a quote to alice''s business';
  exception when insufficient_privilege then null; end;

  begin
    -- moving one of his own quotes into her business must fail too
    update public.quotes set business_id = alice_business where id = 'q1';
    raise exception 'bob moved a quote into alice''s business';
  exception when insufficient_privilege then null; end;

  begin
    insert into public.business_members values (alice_business, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner');
    raise exception 'bob made himself a member of alice''s business';
  exception when insufficient_privilege then null; end;

  begin
    insert into public.businesses (created_by) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    raise exception 'bob created a business directly';
  exception when insufficient_privilege then null; end;
end $$;
commit;

-- 4. Someone who is not signed in gets nothing
begin;
select pg_temp.sign_in('nobody');
do $$ begin
  begin perform count(*) from public.quotes; raise exception 'a visitor can read quotes';
  exception when insufficient_privilege then null; end;
  begin perform count(*) from public.documents; raise exception 'a visitor can read documents';
  exception when insufficient_privilege then null; end;
  begin perform public.ensure_business(); raise exception 'a visitor can create a business';
  exception when insufficient_privilege then null; end;
  begin delete from public.businesses; raise exception 'a visitor can delete businesses';
  exception when insufficient_privilege then null; end;
end $$;
commit;

-- 5. Newest change wins: a stale update is ignored, a time in the future is pulled back to now
begin;
select pg_temp.sign_in('alice');
do $$
declare b uuid := (select business from ids where who = 'alice');
begin
  update public.documents set data = '{"markup": 30}', updated_at = now() + interval '1 second' where business_id = b and kind = 'prices';
  update public.documents set data = '{"markup": 1}', updated_at = now() - interval '1 day' where business_id = b and kind = 'prices';
  assert (select data->>'markup' from public.documents where business_id = b and kind = 'prices') = '30', 'a stale update overwrote a newer one';

  insert into public.quotes values (b, 'future', '{"n": 1}', now() + interval '10 years', null);
  assert (select updated_at from public.quotes where business_id = b and id = 'future') <= now() + interval '5 minutes', 'a future timestamp was accepted';

  begin
    insert into public.quotes values (b, 'bad', null, now(), null);
    raise exception 'a live quote with no data was accepted';
  exception when check_violation then null; end;
  begin
    insert into public.documents values (b, 'secrets', '{}', now());
    raise exception 'an unknown document kind was accepted';
  exception when check_violation then null; end;
end $$;
commit;

-- 6. Deleting your data removes yours and nobody else's
begin;
select pg_temp.sign_in('alice');
delete from public.businesses where id = (select business from ids where who = 'alice');
commit;

do $$ begin
  assert (select count(*) from public.businesses) = 1, 'deleting alice''s business should leave only bob''s';
  assert (select count(*) from public.quotes) = 1, 'bob''s quote should survive';
  assert (select count(*) from public.documents) = 0, 'alice''s documents should be gone';
  assert (select created_by from public.businesses) = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'the wrong business was deleted';
end $$;

-- 7. Removing a person removes their business and its data
delete from auth.users where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
do $$ begin
  assert (select count(*) from public.businesses) = 0 and (select count(*) from public.quotes) = 0, 'data outlived its owner';
end $$;

\echo ALL PRIVACY RULE TESTS PASSED
