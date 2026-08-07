create extension if not exists pgcrypto;

create table if not exists public.admins (
  user_id uuid primary key,
  claimed_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.passwords (
  code text primary key,
  status text not null default 'unused' check (status in ('unused', 'active', 'used')),
  auth_uid uuid,
  used_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid,
  source text not null default 'generated'
);

create index if not exists passwords_created_at_idx on public.passwords (created_at desc);
create index if not exists passwords_status_idx on public.passwords (status);

alter table public.admins enable row level security;
alter table public.passwords enable row level security;

revoke all on public.admins from anon, authenticated;
revoke all on public.passwords from anon, authenticated;

create or replace function public.current_user_is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.admins
    where user_id = auth.uid()
  );
$$;

create or replace function public.get_admin_status()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  current_uid uuid := auth.uid();
  claimed boolean := exists(select 1 from public.admins);
  mine boolean := false;
begin
  if current_uid is not null then
    select exists(
      select 1 from public.admins where user_id = current_uid
    ) into mine;
  end if;

  return jsonb_build_object(
    'is_admin', mine,
    'admin_claimed', claimed,
    'claimed_by_current_user', mine
  );
end;
$$;

create or replace function public.claim_admin_access()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
  existing_claim_count integer;
begin
  if current_uid is null then
    raise exception '请先建立匿名身份，再领取管理员身份。';
  end if;

  if exists(select 1 from public.admins where user_id = current_uid) then
    return jsonb_build_object(
      'ok', true,
      'already_admin', true
    );
  end if;

  select count(*) into existing_claim_count from public.admins;

  if existing_claim_count > 0 then
    raise exception '这个项目的管理员身份已经在别的浏览器领取。';
  end if;

  insert into public.admins (user_id)
  values (current_uid);

  return jsonb_build_object(
    'ok', true,
    'already_admin', false
  );
end;
$$;

create or replace function public.generate_quiz_password_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  words text[] := array[
    'HEARTH','ARCHIVE','VELVET','LANTERN','PARLOR','CANDLE','OAKEN','ATLAS',
    'EMBER','MANOR','WALNUT','IVORY','GILDED','PARCH','STUDY','MIRROR',
    'AURORA','COPPER','MAPLE','VIOLET','CEDAR','HARBOR','QUILL','MEADOW',
    'SILVER','POETRY','BRIAR','CASCADE','MARBLE','RIBBON','WINDOW','VOYAGE'
  ];
  candidate text;
  attempts integer := 0;
begin
  loop
    attempts := attempts + 1;
    candidate := words[1 + floor(random() * array_length(words, 1))::integer]
      || '-'
      || words[1 + floor(random() * array_length(words, 1))::integer]
      || '-'
      || lpad(floor(random() * 10000)::integer::text, 4, '0');

    exit when not exists (
      select 1 from public.passwords where code = candidate
    ) or attempts >= 80;
  end loop;

  if exists(select 1 from public.passwords where code = candidate) then
    candidate := 'ARCHIVE-' || to_char(timezone('utc', now()), 'HH24MISS');
  end if;

  return candidate;
end;
$$;

create or replace function public.list_passwords()
returns setof public.passwords
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.current_user_is_admin() then
    raise exception '当前浏览器没有管理员权限。';
  end if;

  return query
  select *
  from public.passwords
  order by created_at desc, code asc;
end;
$$;

create or replace function public.create_password_code()
returns public.passwords
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
  generated_code text;
  created_row public.passwords;
begin
  if not public.current_user_is_admin() then
    raise exception '当前浏览器没有管理员权限。';
  end if;

  generated_code := public.generate_quiz_password_code();

  insert into public.passwords (
    code,
    status,
    auth_uid,
    used_at,
    activated_at,
    created_at,
    created_by,
    source
  )
  values (
    generated_code,
    'unused',
    null,
    null,
    null,
    timezone('utc', now()),
    current_uid,
    'generated'
  )
  returning * into created_row;

  return created_row;
end;
$$;

create or replace function public.verify_password_code(input_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
  normalized_code text := upper(trim(coalesce(input_code, '')));
  current_record public.passwords;
begin
  if current_uid is null then
    raise exception '请先建立当前浏览器身份，再输入测试密码。';
  end if;

  if normalized_code = '' then
    return jsonb_build_object(
      'ok', false,
      'code', 'empty',
      'message', '请先输入测试密码。'
    );
  end if;

  select *
  into current_record
  from public.passwords
  where code = normalized_code
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid',
      'message', '这个密码当前无效，请核对后再试。'
    );
  end if;

  if current_record.status = 'used' then
    return jsonb_build_object(
      'ok', false,
      'code', 'used',
      'message', '这个密码已经完成过测试，需要更换新的有效密码。'
    );
  end if;

  if current_record.status = 'active' and current_record.auth_uid is distinct from current_uid then
    return jsonb_build_object(
      'ok', false,
      'code', 'bound',
      'message', '这个密码已经绑定到其他设备，不能在当前浏览器继续。'
    );
  end if;

  if current_record.status = 'unused' then
    update public.passwords
    set
      status = 'active',
      auth_uid = current_uid,
      activated_at = coalesce(activated_at, timezone('utc', now()))
    where code = normalized_code
    returning * into current_record;
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', 'ok',
    'message', '验证成功，正在进入名人方向选择。',
    'record', to_jsonb(current_record)
  );
end;
$$;

create or replace function public.complete_password_code(input_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
  normalized_code text := upper(trim(coalesce(input_code, '')));
  current_record public.passwords;
begin
  if current_uid is null then
    raise exception '请先建立当前浏览器身份。';
  end if;

  select *
  into current_record
  from public.passwords
  where code = normalized_code
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'missing',
      'message', '密码记录不存在。'
    );
  end if;

  if current_record.status = 'used' and current_record.auth_uid = current_uid then
    return jsonb_build_object(
      'ok', true,
      'code', 'ok',
      'message', '这个密码已经作废。',
      'record', to_jsonb(current_record)
    );
  end if;

  if current_record.status <> 'active' or current_record.auth_uid is distinct from current_uid then
    return jsonb_build_object(
      'ok', false,
      'code', 'forbidden',
      'message', '当前浏览器没有权限作废这个密码。'
    );
  end if;

  update public.passwords
  set
    status = 'used',
    used_at = coalesce(used_at, timezone('utc', now()))
  where code = normalized_code
  returning * into current_record;

  return jsonb_build_object(
    'ok', true,
    'code', 'ok',
    'message', '这个密码已经作废。',
    'record', to_jsonb(current_record)
  );
end;
$$;

grant execute on function public.current_user_is_admin() to authenticated;
grant execute on function public.get_admin_status() to authenticated;
grant execute on function public.claim_admin_access() to authenticated;
grant execute on function public.list_passwords() to authenticated;
grant execute on function public.create_password_code() to authenticated;
grant execute on function public.verify_password_code(text) to authenticated;
grant execute on function public.complete_password_code(text) to authenticated;
