-- Elli's English Trail: family-code progress storage (applied to the "varosi-kresz" Supabase project).
-- Tables live in a private schema with no grants; the page only calls the three RPCs below.
create schema if not exists english;
revoke all on schema english from public, anon, authenticated;

create table english.households (
  code text primary key,
  created_at timestamptz not null default now()
);
create table english.state (
  code text primary key references english.households(code) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table english.households enable row level security;
alter table english.state enable row level security;
revoke all on english.households, english.state from public, anon, authenticated;

-- New family code: 10 characters from an unambiguous alphabet, shown as XXXXX-XXXXX
create or replace function public.english_create_household()
returns text language plpgsql security definer set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea; c text; i int;
begin
  loop
    bytes := extensions.gen_random_bytes(10);
    c := '';
    for i in 0..9 loop
      c := c || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
      if i = 4 then c := c || '-'; end if;
    end loop;
    begin
      insert into english.households(code) values (c);
      return c;
    exception when unique_violation then
      -- try another code
    end;
  end loop;
end $$;

create or replace function public.english_load(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if not exists (select 1 from english.households where code = upper(trim(p_code))) then
    raise exception 'unknown_code' using errcode = 'P0002';
  end if;
  select data, updated_at into r from english.state where code = upper(trim(p_code));
  if not found then return jsonb_build_object('data', null, 'updated_at', null); end if;
  return jsonb_build_object('data', r.data, 'updated_at', r.updated_at);
end $$;

create or replace function public.english_save(p_code text, p_data jsonb)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare k text := upper(trim(p_code)); t timestamptz := now();
begin
  if not exists (select 1 from english.households where code = k) then
    raise exception 'unknown_code' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 262144 then
    raise exception 'invalid_data' using errcode = '22023';
  end if;
  insert into english.state(code, data, updated_at) values (k, p_data, t)
  on conflict (code) do update set data = excluded.data, updated_at = excluded.updated_at;
  return t;
end $$;

revoke all on function public.english_create_household() from public;
revoke all on function public.english_load(text) from public;
revoke all on function public.english_save(text, jsonb) from public;
grant execute on function public.english_create_household() to anon, authenticated;
grant execute on function public.english_load(text) to anon, authenticated;
grant execute on function public.english_save(text, jsonb) to anon, authenticated;
