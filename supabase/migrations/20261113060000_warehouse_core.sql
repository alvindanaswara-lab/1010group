-- Warehouse app. Run with the Supabase migration role.
begin;

create schema if not exists warehouse_private;
revoke all on schema warehouse_private from public, anon, authenticated;
grant usage on schema warehouse_private to authenticated;

create table warehouse_private.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  username text not null check (length(trim(username)) > 0),
  position text not null check (position in (
    'Administrator', 'Outlet', 'Storage Inbound', 'Storage Outbond',
    'Storage-Mailer', 'Purchasing', 'Cost Control'
  )),
  outlet_name text,
  department text,
  check (position <> 'Outlet' or (
    outlet_name is not null and trim(outlet_name) <> '' and department is not null
    and department in ('Kitchen', 'Bar', 'Pastry', 'Floor & Operations')
  ))
);

create table warehouse_private.records (
  kind text not null check (kind in (
    'outlet', 'order', 'stock', 'po', 'vendor', 'receipt', 'inbound', 'outbound', 'opname', 'audit'
  )),
  id text not null,
  version bigint not null default 1,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now(),
  updated_by uuid not null,
  primary key (kind, id)
);

create table warehouse_private.stock_movements (
  id bigint generated always as identity primary key,
  recorded_at timestamptz not null default now(),
  actor_id uuid not null,
  source_kind text not null,
  source_id text not null,
  source_version bigint not null,
  line_id text not null,
  period text not null,
  sku text not null,
  inbound numeric(15,3) not null,
  outbound numeric(15,3) not null,
  inbound_value numeric(20,2) not null,
  unique (source_kind, source_id, source_version, line_id)
);
create index warehouse_movements_period_sku on warehouse_private.stock_movements(period, sku);
alter table warehouse_private.stock_movements enable row level security;

create index warehouse_order_scope on warehouse_private.records
  ((data->>'outletName'), (data->>'department')) where kind = 'order';
create index warehouse_stock_period on warehouse_private.records
  ((data->>'period')) where kind = 'stock';
create index warehouse_receipt_po on warehouse_private.records
  ((data->>'poVendorId'), (data->>'vendorName')) where kind = 'receipt';

alter table warehouse_private.profiles enable row level security;
alter table warehouse_private.records enable row level security;
revoke all on all tables in schema warehouse_private from public, anon, authenticated;
alter default privileges in schema warehouse_private revoke execute on functions from public;

create function warehouse_private.as_user(p warehouse_private.profiles)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', p.id, 'email', p.email, 'username', p.username, 'position', p.position,
    'outletName', p.outlet_name, 'department', p.department,
    'placement', coalesce(p.outlet_name, 'Head Office/Warehouse'), 'access', '[]'::jsonb
  ));
$$;

create function warehouse_private.actor()
returns warehouse_private.profiles language plpgsql stable set search_path = '' as $$
declare p warehouse_private.profiles;
begin
  select * into p from warehouse_private.profiles where id = auth.uid();
  if not found then raise exception 'Akun belum diberikan akses gudang.' using errcode = '42501'; end if;
  return p;
end;
$$;

create function warehouse_private.profile()
returns jsonb language sql stable security definer set search_path = '' as $$
  select warehouse_private.as_user(warehouse_private.actor());
$$;

create function warehouse_private.users()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p warehouse_private.profiles := warehouse_private.actor();
begin
  if p.position = 'Administrator' then
    return (select coalesce(jsonb_agg(warehouse_private.as_user(u) order by u.username), '[]')
      from warehouse_private.profiles u);
  end if;
  return jsonb_build_array(warehouse_private.as_user(p));
end;
$$;

create function warehouse_private.save_user(profile jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p warehouse_private.profiles := warehouse_private.actor();
  saved warehouse_private.profiles;
begin
  if p.position <> 'Administrator' or
     (p.id = (profile->>'id')::uuid and profile->>'position' is distinct from 'Administrator')
  then raise exception 'Akses ditolak.' using errcode = '42501'; end if;
  if profile->>'position' = 'Outlet' and not exists (
    select 1 from warehouse_private.records r where r.kind = 'outlet'
      and r.data->>'namaOutlet' = profile->>'outlet_name'
      and (r.data->'department') ? (profile->>'department')
  ) then raise exception 'Outlet dan departemen belum terdaftar.'; end if;
  insert into warehouse_private.profiles(id, email, username, position, outlet_name, department)
  select u.id, u.email, trim(profile->>'username'), profile->>'position',
    profile->>'outlet_name', profile->>'department'
  from auth.users u where u.id = (profile->>'id')::uuid
  on conflict (id) do update set email = excluded.email, username = excluded.username,
    position = excluded.position, outlet_name = excluded.outlet_name, department = excluded.department
  returning * into saved;
  if not found then raise exception 'Akun Auth tidak ditemukan.'; end if;
  return warehouse_private.as_user(saved);
end;
$$;

create function warehouse_private.update_own_name(display_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p warehouse_private.profiles := warehouse_private.actor();
begin
  update warehouse_private.profiles set username = trim(display_name) where id = p.id returning * into p;
  return warehouse_private.as_user(p);
end;
$$;

create function warehouse_private.snapshot()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p warehouse_private.profiles := warehouse_private.actor();
begin
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'kind', r.kind, 'id', r.id, 'version', r.version, 'data',
    case when p.position = 'Outlet' and r.kind = 'stock' then
      r.data - array['priceActual', 'inboundValue', 'outbondValue', 'beginningValue', 'endingValue', 'soValue', 'gapValue']
    else r.data end
  ) order by r.kind, r.id), '[]')
  from warehouse_private.records r
  where p.position <> 'Outlet'
    or (r.kind = 'outlet' and r.data->>'namaOutlet' = p.outlet_name)
    or (r.kind = 'order' and r.data->>'outletName' = p.outlet_name and r.data->>'department' = p.department)
    or (r.kind = 'stock' and (r.data->'allowedDepartments') ? p.department)
    or (r.kind = 'audit' and r.data->>'outletName' = p.outlet_name and r.data->>'department' = p.department));
end;
$$;

create function warehouse_private.po_terms(po jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(line - array['status', 'approvalStatus', 'rejectionReason'] order by i), '[]')
  from jsonb_array_elements(coalesce(po->'items', '[]')) with ordinality as x(line, i);
$$;

create function warehouse_private.qty(value jsonb)
returns numeric language plpgsql immutable set search_path = '' as $$
declare n numeric;
begin
  if jsonb_typeof(value) is distinct from 'number' then raise exception 'Kuantitas harus berupa angka.'; end if;
  n := value::numeric;
  if n < 0 or n > 1000000000 or n <> round(n, 3) then
    raise exception 'Kuantitas harus non-negatif, maksimal tiga angka desimal.';
  end if;
  return n;
end;
$$;

create function warehouse_private.commit(changes jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p warehouse_private.profiles;
  c jsonb;
  old_data jsonb;
  new_data jsonb;
  old_version bigint;
  k text;
  row_id text;
  old_status text;
  new_status text;
  terms_changed boolean;
  finance boolean;
  warehouse boolean;
  stock_opening boolean;
  result jsonb := '[]';
  line jsonb;
  prior_line jsonb;
  idx bigint;
  period_key text;
  source_period text;
  other_data jsonb;
  qty_delta numeric;
  movements jsonb := '[]';
  movement jsonb;
  source_data jsonb;
  expected_in numeric;
  expected_out numeric;
  expected_value numeric;
  m_key text;
  jakarta_month text := to_char(now() at time zone 'Asia/Jakarta', 'YYYY-MM');
begin
  if jsonb_typeof(changes) is distinct from 'array' or jsonb_array_length(changes) > 12000 then
    raise exception 'Paket perubahan tidak valid.';
  end if;
  -- Serialize transactions while retaining per-record versions for stale browser writes.
  perform pg_advisory_xact_lock(811013, 1);
  p := warehouse_private.actor();
  finance := p.position in ('Administrator', 'Cost Control');
  warehouse := p.position in ('Administrator', 'Storage Inbound', 'Storage Outbond', 'Storage-Mailer');

  if (select count(*) from jsonb_array_elements(changes)) <>
     (select count(distinct (v->>'kind', v->>'id')) from jsonb_array_elements(changes) v) then
    raise exception 'Perubahan ganda untuk dokumen yang sama.';
  end if;

  for c in select value from jsonb_array_elements(changes)
    order by case value->>'kind'
      when 'po' then 1 when 'receipt' then 2 when 'order' then 3
      when 'inbound' then 4 when 'outbound' then 5 when 'stock' then 6
      when 'opname' then 7 else 8 end
  loop
    k := c->>'kind';
    row_id := c->>'id';
    new_data := nullif(c->'data', 'null');
    select r.data, r.version into old_data, old_version from warehouse_private.records r
      where r.kind = k and r.id = row_id;
    if old_version is distinct from (c->>'version')::bigint then
      raise exception 'Data diubah pada perangkat lain.' using errcode = '40001';
    end if;
    if new_data is not null and (
      jsonb_typeof(new_data) <> 'object' or
      (k <> 'stock' and new_data->>'id' is distinct from row_id)
    ) then raise exception 'Dokumen tidak valid.'; end if;
    old_status := old_data->>'status';
    new_status := new_data->>'status';

    if new_data is null and old_data is null then raise exception 'Dokumen tidak ditemukan.'; end if;
    case k
    when 'outlet' then
      if p.position <> 'Administrator' then raise exception 'Akses outlet ditolak.' using errcode = '42501'; end if;
      if old_data is not null and new_data->>'namaOutlet' is distinct from old_data->>'namaOutlet' and (
        exists (select 1 from warehouse_private.profiles u where u.outlet_name = old_data->>'namaOutlet')
        or exists (select 1 from warehouse_private.records r where r.kind = 'order' and r.data->>'outletName' = old_data->>'namaOutlet')
      ) then raise exception 'Nama outlet yang terpakai tidak dapat dihapus atau diubah.'; end if;
      if new_data is not null and (
        coalesce(trim(new_data->>'namaOutlet'), '') = ''
        or jsonb_typeof(new_data->'department') is distinct from 'array'
        or exists (select 1 from warehouse_private.records r where r.kind = 'outlet'
           and r.id <> row_id and lower(r.data->>'namaOutlet') = lower(new_data->>'namaOutlet'))
        or exists (select 1 from warehouse_private.profiles u where u.outlet_name = new_data->>'namaOutlet'
           and not (new_data->'department' ? u.department))
      ) then raise exception 'Nama outlet duplikat atau departemen masih digunakan.'; end if;
    when 'order' then
      if p.position = 'Outlet' then
        if (old_data is not null and (
          old_data->>'outletName' is distinct from p.outlet_name or old_data->>'department' is distinct from p.department
          or old_status not in ('Draft', 'Submitted')
        )) or (new_data is not null and (
          new_data->>'outletName' is distinct from p.outlet_name or new_data->>'department' is distinct from p.department
          or coalesce(new_status, '') not in ('Draft', 'Submitted', 'Cancelled')
        )) then raise exception 'Akses pesanan outlet ditolak.' using errcode = '42501'; end if;
      elsif not warehouse and p.position <> 'Purchasing' then
        raise exception 'Akses pesanan ditolak.' using errcode = '42501';
      end if;
      if old_status in ('Selesai', 'Deployed / Dikirim', 'Diterima Sebagian', 'Diterima Lengkap') or
         (old_status = 'PO Terkirim' and new_status is distinct from old_status and new_status is distinct from 'Selesai')
      then
        raise exception 'Dokumen pengiriman yang selesai terkunci.';
      end if;
      if new_data is not null then
        if coalesce(new_status,'') not in ('Draft','Submitted','PO Generated','Processing Gudang',
          'Siap Dikirim','PO Terkirim','Selesai','Cancelled') or
          jsonb_typeof(new_data->'items') is distinct from 'array'
        then raise exception 'Status atau baris pesanan tidak valid.'; end if;
        if old_status in ('PO Terkirim','Siap Dikirim') and new_data is not null and
          old_data->'items' is distinct from new_data->'items'
        then raise exception 'Baris pengiriman terkunci setelah siap dikirim.'; end if;
        for line in select value from jsonb_array_elements(new_data->'items') loop
          if warehouse_private.qty(line->'qty') <= 0 then raise exception 'Kuantitas pesanan harus positif.'; end if;
          if line ? 'qtyPrepared' and line->'qtyPrepared' <> 'null'
             and warehouse_private.qty(line->'qtyPrepared') > warehouse_private.qty(line->'qty')
          then raise exception 'Jumlah disiapkan melebihi pesanan.'; end if;
        end loop;
      end if;
      if new_status = 'PO Terkirim' and old_status is distinct from new_status
         and (p.position <> 'Administrator' or old_status is distinct from 'Siap Dikirim')
      then raise exception 'Pengiriman harus disetujui administrator.' using errcode = '42501'; end if;
      if new_status = 'Selesai' then
        if not exists (select 1 from jsonb_array_elements(new_data->'items') i
          where warehouse_private.qty(coalesce(nullif(i->'qtyPrepared', 'null'), i->'qty')) > 0)
        then raise exception 'Kuantitas pengiriman harus positif.'; end if;
        if p.position not in ('Administrator','Storage Outbond','Storage-Mailer') or old_status is distinct from 'PO Terkirim'
           or old_data->'items' is distinct from new_data->'items'
        then raise exception 'Status pengiriman belum siap atau jumlah telah berubah.'; end if;
        for line, idx in select value, ordinality from jsonb_array_elements(new_data->'items') with ordinality loop
          qty_delta := warehouse_private.qty(coalesce(nullif(line->'qtyPrepared', 'null'), line->'qty'));
          movements := movements || jsonb_build_object('period', jakarta_month, 'sku', line->>'sku',
            'in', 0, 'out', qty_delta, 'value', 0, 'source', k, 'id', row_id,
            'version', coalesce(old_version,0) + 1, 'line', idx);
        end loop;
      end if;
    when 'vendor' then
      if p.position not in ('Administrator', 'Purchasing') then
        raise exception 'Akses vendor ditolak.' using errcode = '42501';
      end if;
    when 'po' then
      if not (warehouse or finance or p.position = 'Purchasing') then
        raise exception 'Akses PO ditolak.' using errcode = '42501';
      end if;
      if old_data is null and new_status is distinct from 'Draft PO' then
        raise exception 'PO baru harus berstatus draf.';
      end if;
      if old_data is null then
        if p.position not in ('Administrator','Storage Inbound','Storage Outbond','Purchasing') or
          coalesce(jsonb_array_length(new_data->'sourceOrderIds'),0) = 0 or
          exists (select 1 from jsonb_array_elements_text(new_data->'sourceOrderIds') source_id
            where not exists (select 1 from warehouse_private.records r where r.kind = 'order' and r.id = source_id
              and r.data->>'status' = 'Submitted' and coalesce(r.data->>'poId','') = '')
            or not exists (select 1 from jsonb_array_elements(changes) x where x->>'kind' = 'order'
              and x->>'id' = source_id and x#>>'{data,poId}' = row_id and x#>>'{data,status}' = 'PO Generated'))
        then raise exception 'PO harus berasal dari pesanan outlet yang belum digunakan.'; end if;
      end if;
      terms_changed := warehouse_private.po_terms(new_data) is distinct from warehouse_private.po_terms(old_data);
      if new_data is null and old_status not in ('Draft PO', 'Submitted to Purchasing', 'Vendor Summary') then
        raise exception 'PO yang sudah masuk Finance atau dirilis tidak dapat dihapus.';
      end if;
      if old_status in ('Submitted to Vendor', 'Sent to Receiving', 'Completed', 'Approved by Vendor') and
         (terms_changed or new_status is distinct from old_status or
          new_data->'costControlApproval' is distinct from old_data->'costControlApproval')
      then raise exception 'PO yang sudah dirilis terkunci.'; end if;
      if new_data is not null then
        if coalesce(new_status,'') not in ('Draft PO','Submitted to Purchasing','Vendor Summary',
          'Review Cost Control','Approved by Cost Control','Rejected by Cost Control',
          'Submitted to Vendor','Approved by Vendor','Sent to Receiving','Completed')
          or jsonb_typeof(new_data->'items') is distinct from 'array'
          or (old_data is not null and new_data->'sourceOrderIds' is distinct from old_data->'sourceOrderIds')
        then raise exception 'Status atau sumber PO tidak valid.'; end if;
        if old_data is not null and new_status is distinct from old_status and not (
          (old_status = 'Draft PO' and new_status in ('Submitted to Purchasing','Vendor Summary')) or
          (old_status = 'Submitted to Purchasing' and new_status = 'Vendor Summary') or
          (old_status = 'Vendor Summary' and new_status = 'Review Cost Control') or
          (old_status = 'Review Cost Control' and new_status in ('Vendor Summary','Approved by Cost Control')) or
          (old_status = 'Approved by Cost Control' and new_status in ('Vendor Summary','Sent to Receiving')) or
          (old_status = 'Rejected by Cost Control' and new_status = 'Vendor Summary')
        ) then raise exception 'Urutan status PO tidak valid.'; end if;
        if new_status in ('Submitted to Vendor', 'Approved by Vendor', 'Completed')
           and old_status is distinct from new_status then
          raise exception 'Gunakan proses rilis PO ke penerimaan.';
        end if;
        for line in select value from jsonb_array_elements(new_data->'items') loop
          if warehouse_private.qty(line->'qty') <= 0
             or jsonb_typeof(line->'price') is distinct from 'number' or (line->>'price')::numeric < 0
             or jsonb_typeof(line->'total') is distinct from 'number'
             or abs((line->>'total')::numeric - (line->>'price')::numeric * (line->>'qty')::numeric) > 0.01
          then raise exception 'Harga atau kuantitas baris PO tidak valid.'; end if;
        end loop;
      end if;
      if new_status = 'Approved by Cost Control' and old_status is distinct from new_status then
        if not finance or old_status is distinct from 'Review Cost Control' or terms_changed
           or new_data#>>'{costControlApproval,status}' is distinct from 'Approved'
           or new_data#>>'{costControlApproval,approvedBy}' is distinct from p.username
           or jsonb_typeof(new_data#>'{costControlApproval,totalApprovedAmount}') is distinct from 'number'
           or coalesce(jsonb_array_length(new_data->'items'), 0) = 0
           or exists (select 1 from jsonb_array_elements(new_data->'items') i where
             i->>'approvalStatus' is distinct from 'Approved' or i->>'status' = 'Rejected'
             or coalesce(trim(i->>'vendorName'), '') = '')
        then raise exception 'Finance harus menyetujui setiap baris dengan vendor lengkap.' using errcode = '42501'; end if;
        if abs((new_data#>>'{costControlApproval,totalApprovedAmount}')::numeric -
          (select sum((i->>'qty')::numeric * (i->>'price')::numeric) from jsonb_array_elements(new_data->'items') i)
        ) > 0.01 then raise exception 'Total Finance tidak cocok dengan rincian.'; end if;
      elsif new_status = 'Sent to Receiving' and old_status is distinct from new_status then
        if p.position not in ('Administrator', 'Purchasing') or terms_changed
           or old_status is distinct from 'Approved by Cost Control'
           or old_data#>>'{costControlApproval,status}' is distinct from 'Approved'
           or new_data->'costControlApproval' is distinct from old_data->'costControlApproval'
           or new_data->'items' is distinct from old_data->'items'
           or exists (select 1 from jsonb_array_elements(old_data->'items') i
             where i->>'approvalStatus' is distinct from 'Approved' or i->>'status' = 'Rejected')
           or exists (select 1 from jsonb_array_elements(old_data->'items') i
             where not exists (select 1 from jsonb_array_elements(changes) r
                where r->>'kind' = 'receipt' and r->'version' = 'null'
                  and r#>>'{data,poVendorId}' = row_id and r#>>'{data,vendorName}' = i->>'vendorName'))
        then raise exception 'Rilis memerlukan persetujuan Finance dan penerimaan per vendor.' using errcode = '42501'; end if;
      elsif new_data is not null then
        if new_status = 'Approved by Cost Control' and
           (terms_changed or new_data->'items' is distinct from old_data->'items'
            or new_data->'costControlApproval' is distinct from old_data->'costControlApproval')
        then raise exception 'Perubahan rincian harus diajukan kembali ke Finance.'; end if;
        if (old_status = 'Review Cost Control' or old_status = 'Approved by Cost Control') and terms_changed
           and (new_status <> 'Vendor Summary' or new_data ? 'costControlApproval' or
             exists (select 1 from jsonb_array_elements(new_data->'items') i where i->>'approvalStatus' = 'Approved'))
        then raise exception 'Revisi PO harus menghapus persetujuan Finance.'; end if;
        if not finance and (
          exists (select 1 from jsonb_array_elements(new_data->'items') i
            where i->>'approvalStatus' = 'Approved' and not exists (
              select 1 from jsonb_array_elements(coalesce(old_data->'items', '[]')) o where o = i))
          or (new_data ? 'costControlApproval' and
            new_data->'costControlApproval' is distinct from old_data->'costControlApproval')
        ) then raise exception 'Persetujuan Finance memerlukan peran Cost Control.' using errcode = '42501'; end if;
        if new_status = 'Review Cost Control' and old_status is distinct from new_status and
           (p.position not in ('Administrator','Purchasing') or old_status is distinct from 'Vendor Summary'
            or new_data ? 'costControlApproval' or coalesce(jsonb_array_length(new_data->'items'), 0) = 0
            or exists (select 1 from jsonb_array_elements(new_data->'items') i
              where coalesce(trim(i->>'vendorName'), '') = '' or i->>'approvalStatus' is distinct from 'Pending'))
        then raise exception 'Kirim ke Finance dari Vendor Summary setelah semua vendor lengkap.'; end if;
      end if;
    when 'receipt' then
      if new_data is null then raise exception 'Penerimaan PO tidak dapat dihapus.'; end if;
      if old_data is null then
        if p.position not in ('Administrator', 'Purchasing') or not exists (
          select 1 from jsonb_array_elements(changes) x
          where x->>'kind' = 'po' and x->>'id' = new_data->>'poVendorId'
            and x#>>'{data,status}' = 'Sent to Receiving'
        ) or exists (select 1 from warehouse_private.records r where r.kind = 'receipt'
          and r.data->>'poVendorId' = new_data->>'poVendorId' and r.data->>'vendorName' = new_data->>'vendorName')
        then raise exception 'Dokumen penerimaan harus dibuat dari rilis PO yang sah.'; end if;
        select r.data into source_data from warehouse_private.records r where r.kind = 'po'
          and r.id = new_data->>'poVendorId' and r.data->>'status' = 'Sent to Receiving';
        if source_data is null or new_status is distinct from 'Menunggu Kedatangan' or
          (select coalesce(jsonb_agg(jsonb_build_array(i->>'sku', i->'qty', i->'price', i->>'unit') order by n), '[]')
           from jsonb_array_elements(source_data->'items') with ordinality as t(i,n)
           where i->>'vendorName' = new_data->>'vendorName')
          is distinct from
          (select coalesce(jsonb_agg(jsonb_build_array(i->>'sku', i->'orderedQty', i->'unitPrice', i->>'unit') order by n), '[]')
           from jsonb_array_elements(new_data->'items') with ordinality as t(i,n))
        then raise exception 'Baris penerimaan berbeda dari PO yang disetujui.'; end if;
        for line in select value from jsonb_array_elements(new_data->'items') loop
          if warehouse_private.qty(line->'receivedQty') <> 0
             or warehouse_private.qty(line->'pendingQty') <> warehouse_private.qty(line->'orderedQty')
             or (line->>'totalPrice')::numeric is distinct from 0::numeric
          then raise exception 'Penerimaan baru harus mulai dari nol.'; end if;
        end loop;
      else
        if p.position not in ('Administrator', 'Storage Inbound') or old_status = 'Diterima Keseluruhan'
           or new_data->>'receivedBy' is distinct from p.username
           or new_data->>'poVendorId' is distinct from old_data->>'poVendorId'
           or new_data->>'vendorName' is distinct from old_data->>'vendorName'
           or jsonb_array_length(new_data->'items') is distinct from jsonb_array_length(old_data->'items')
           or new_data->>'receiveDate' is distinct from to_char(now() at time zone 'Asia/Jakarta', 'YYYY-MM-DD')
        then raise exception 'Penerimaan terkunci atau tidak diizinkan.' using errcode = '42501'; end if;
        for line, idx in select value, ordinality - 1 from jsonb_array_elements(new_data->'items') with ordinality loop
          prior_line := old_data->'items'->(idx::int);
          if (line - array['receivedQty', 'pendingQty', 'totalPrice', 'lineId']) is distinct from
             (prior_line - array['receivedQty', 'pendingQty', 'totalPrice', 'lineId'])
          then raise exception 'Rincian PO pada penerimaan terkunci.'; end if;
          qty_delta := warehouse_private.qty(line->'receivedQty') - warehouse_private.qty(prior_line->'receivedQty');
          if qty_delta < 0 or warehouse_private.qty(line->'receivedQty') > warehouse_private.qty(line->'orderedQty')
             or warehouse_private.qty(line->'pendingQty') <>
               warehouse_private.qty(line->'orderedQty') - warehouse_private.qty(line->'receivedQty')
             or jsonb_typeof(line->'totalPrice') is distinct from 'number'
             or (line->>'totalPrice')::numeric < coalesce((prior_line->>'totalPrice')::numeric, 0)
             or (qty_delta = 0 and line->'totalPrice' is distinct from prior_line->'totalPrice')
          then raise exception 'Kuantitas atau nilai penerimaan tidak valid.'; end if;
          movements := movements || jsonb_build_object('period', jakarta_month, 'sku', line->>'sku',
            'in', qty_delta, 'out', 0,
            'value', (line->>'totalPrice')::numeric - coalesce((prior_line->>'totalPrice')::numeric, 0),
            'source', k, 'id', row_id, 'version', old_version + 1, 'line', idx);
        end loop;
        if new_status is distinct from (
          case when exists (select 1 from jsonb_array_elements(new_data->'items') i where (i->>'pendingQty')::numeric > 0)
            then 'Diterima Sebagian' else 'Diterima Keseluruhan' end
        ) then raise exception 'Status penerimaan tidak cocok dengan jumlah diterima.'; end if;
      end if;
    when 'inbound', 'outbound' then
      if p.position <> 'Administrator' and p.position <> (
        case when k = 'inbound' then 'Storage Inbound' else 'Storage Outbond' end
      ) then raise exception 'Akses koreksi stok ditolak.' using errcode = '42501'; end if;
      if old_data is not null and new_data is not null then raise exception 'Gunakan koreksi untuk perubahan stok.'; end if;
      other_data := coalesce(new_data, old_data);
      if coalesce(other_data->>'date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
         or (other_data->>'date')::date > (now() at time zone 'Asia/Jakarta')::date
         or (k = 'inbound' and ((other_data->>'price')::numeric < 0 or other_data->>'price' is null))
      then raise exception 'Tanggal atau harga transaksi tidak valid.'; end if;
      qty_delta := warehouse_private.qty(other_data->'qty') * case when new_data is null then -1 else 1 end;
      if qty_delta = 0 then raise exception 'Kuantitas stok harus positif.'; end if;
      movements := movements || jsonb_build_object(
        'period', left(other_data->>'date', 7), 'sku', other_data->>'sku',
        'in', case when k = 'inbound' then qty_delta else 0 end,
        'out', case when k = 'outbound' then qty_delta else 0 end,
        'value', case when k = 'inbound' then round(qty_delta * coalesce((other_data->>'price')::numeric, 0),2) else 0 end,
        'source', k, 'id', row_id, 'version', coalesce(old_version,0) + 1, 'line', 0);
    when 'stock' then
      if p.position not in ('Administrator', 'Storage Inbound', 'Storage Outbond', 'Storage-Mailer', 'Cost Control') then
        raise exception 'Akses stok ditolak.' using errcode = '42501';
      end if;
      other_data := coalesce(new_data, old_data);
      period_key := other_data->>'period';
      if coalesce(period_key, '') !~ '^\d{4}-(0[1-9]|1[0-2])$'
         or row_id is distinct from period_key || ':' || (other_data->>'sku')
      then raise exception 'Periode atau SKU stok tidak valid.'; end if;
      if exists (select 1 from warehouse_private.records r where r.kind = 'opname'
        and r.data->>'period' = period_key and r.data->>'status' in ('Disetujui', 'Finalized (Generated)'))
      then raise exception 'Periode stok sudah disetujui atau ditutup.'; end if;
      m_key := other_data->>'sku';
      select coalesce(sum((v->>'in')::numeric),0), coalesce(sum((v->>'out')::numeric),0),
        coalesce(sum((v->>'value')::numeric),0) into expected_in, expected_out, expected_value
      from jsonb_array_elements(movements) v where v->>'period' = period_key and v->>'sku' = m_key;
      stock_opening := exists (select 1 from jsonb_array_elements(changes) x
        cross join lateral jsonb_array_elements(x#>'{data,items}') i
        where x->>'kind' = 'opname' and x#>>'{data,status}' = 'Finalized (Generated)'
          and x#>>'{data,nextPeriodGenerated}' = period_key and i->>'sku' = m_key
          and i->'physicalCount' = new_data->'beginningInventory');
      if new_data is null then
        if p.position <> 'Administrator' or coalesce((old_data->>'inbound')::numeric,0) <> 0
           or coalesce((old_data->>'outbond')::numeric,0) <> 0
        then raise exception 'Saldo dengan transaksi tidak dapat dihapus.'; end if;
      else
        perform warehouse_private.qty(new_data->'beginningInventory');
        perform warehouse_private.qty(new_data->'stockOpname');
        if p.position <> 'Administrator' and not stock_opening and old_data is not null
           and (new_data - array['inbound','outbond','endingInventory','inboundValue','outbondValue',
             'endingValue','priceActual','soValue','gap','gapValue','stockOpname']) is distinct from
               (old_data - array['inbound','outbond','endingInventory','inboundValue','outbondValue',
             'endingValue','priceActual','soValue','gap','gapValue','stockOpname'])
        then raise exception 'Ubah data master melalui administrator.' using errcode = '42501'; end if;
        if warehouse_private.qty(new_data->'inbound') - coalesce((old_data->>'inbound')::numeric, 0) <> expected_in
           or warehouse_private.qty(new_data->'outbond') - coalesce((old_data->>'outbond')::numeric, 0) <> expected_out
        then raise exception 'Perubahan saldo harus cocok dengan dokumen penerimaan/pengiriman.'; end if;
        if abs(coalesce((new_data->>'inboundValue')::numeric, 0)
            - coalesce((old_data->>'inboundValue')::numeric, 0) - expected_value) > 0.01 then
          raise exception 'Nilai stok masuk harus cocok dengan dokumen.';
        end if;
        if (new_data->>'endingInventory')::numeric is distinct from
          (new_data->>'beginningInventory')::numeric + (new_data->>'inbound')::numeric - (new_data->>'outbond')::numeric
          or (new_data->>'endingInventory')::numeric < 0
        then raise exception 'Saldo akhir stok tidak valid atau negatif.'; end if;
        if new_data->'beginningInventory' is distinct from old_data->'beginningInventory' and
          not stock_opening
          and (p.position <> 'Administrator' or coalesce((old_data->>'inbound')::numeric,0) <> 0
            or coalesce((old_data->>'outbond')::numeric,0) <> 0)
        then raise exception 'Saldo awal berubah hanya lewat pembukaan yang sah.'; end if;
      end if;
    when 'opname' then
      if new_data is null or not (warehouse or finance) or old_status = 'Finalized (Generated)' then
        raise exception 'Laporan stock opname terkunci atau akses ditolak.' using errcode = '42501';
      end if;
      source_period := new_data->>'period';
      if coalesce(source_period, '') !~ '^\d{4}-(0[1-9]|1[0-2])$'
         or row_id is distinct from 'SO-' || source_period
         or left(new_data->>'conductedDate', 7) is distinct from source_period
      then raise exception 'Periode penghitungan fisik tidak valid.'; end if;
      if coalesce(new_status, '') not in ('Draft', 'Menunggu Review', 'Disetujui', 'Finalized (Generated)')
         or (new_status in ('Disetujui', 'Finalized (Generated)') and not finance)
         or (new_status = 'Disetujui' and old_status is distinct from 'Menunggu Review')
         or (new_status = 'Finalized (Generated)' and old_status is distinct from 'Disetujui')
         or (new_status in ('Disetujui', 'Finalized (Generated)') and new_data->'items' is distinct from old_data->'items')
         or (old_status in ('Menunggu Review', 'Disetujui') and new_status = 'Draft' and not finance)
      then raise exception 'Perubahan status stock opname ditolak.' using errcode = '42501'; end if;
      if new_status in ('Menunggu Review', 'Disetujui', 'Finalized (Generated)') then
        if coalesce(jsonb_array_length(new_data->'items'), 0) = 0 or
          jsonb_array_length(new_data->'items') <> (select count(*) from warehouse_private.records r
            where r.kind = 'stock' and r.data->>'period' = source_period) or
          jsonb_array_length(new_data->'items') <> (select count(distinct i->>'sku')
            from jsonb_array_elements(new_data->'items') i)
        then raise exception 'Penghitungan harus mencakup semua SKU periode.'; end if;
        for line in select value from jsonb_array_elements(new_data->'items') loop
          perform warehouse_private.qty(line->'physicalCount');
          if not exists (select 1 from warehouse_private.records r where r.kind = 'stock'
            and r.id = source_period || ':' || (line->>'sku') and r.data->'endingInventory' = line->'systemStock')
          then raise exception 'Saldo berubah sejak stock opname. Hitung ulang sebelum penutupan.'; end if;
        end loop;
      end if;
      if new_status = 'Finalized (Generated)' then
        period_key := to_char((source_period || '-01')::date + interval '1 month', 'YYYY-MM');
        if new_data->>'nextPeriodGenerated' is distinct from period_key or exists (
          select 1 from jsonb_array_elements(new_data->'items') i
          where not exists (select 1 from warehouse_private.records r where r.kind = 'stock'
            and r.id = period_key || ':' || (i->>'sku') and r.data->'beginningInventory' = i->'physicalCount')
        ) then raise exception 'Saldo awal periode berikutnya tidak cocok dengan hasil opname.'; end if;
      end if;
    when 'audit' then
      if old_data is not null or new_data is null then raise exception 'Riwayat audit tidak dapat diubah.'; end if;
      new_data := new_data || jsonb_build_object('actorName', p.username, 'actorRole', p.position);
      if p.position = 'Outlet' then
        new_data := new_data || jsonb_build_object('outletName', p.outlet_name, 'department', p.department);
      end if;
    else raise exception 'Jenis dokumen tidak tersedia.';
    end case;

    if new_data is null then
      delete from warehouse_private.records r where r.kind = k and r.id = row_id;
    else
      insert into warehouse_private.records(kind, id, version, data, updated_by)
      values(k, row_id, coalesce(old_version, 0) + 1, new_data, p.id)
      on conflict (kind, id) do update set version = excluded.version, data = excluded.data,
        updated_at = now(), updated_by = excluded.updated_by;
      result := result || jsonb_build_object('kind', k, 'id', row_id,
        'version', coalesce(old_version, 0) + 1, 'data', new_data);
    end if;
  end loop;
  for movement in select value from jsonb_array_elements(movements) loop
    if ((movement->>'in')::numeric <> 0 or (movement->>'out')::numeric <> 0) and not exists (
      select 1 from jsonb_array_elements(changes) v where v->>'kind' = 'stock' and
        v->>'id' = (movement->>'period') || ':' || (movement->>'sku') and v->'data' <> 'null'
    ) then raise exception 'SKU transaksi harus ada pada stok periode yang sesuai.'; end if;
    if (movement->>'in')::numeric <> 0 or (movement->>'out')::numeric <> 0 then
      insert into warehouse_private.stock_movements (
        actor_id, source_kind, source_id, source_version, line_id, period, sku, inbound, outbound, inbound_value
      ) values (
        p.id, movement->>'source', movement->>'id', (movement->>'version')::bigint, movement->>'line',
        movement->>'period', movement->>'sku', (movement->>'in')::numeric,
        (movement->>'out')::numeric, (movement->>'value')::numeric
      );
    end if;
  end loop;
  return result;
end;
$$;

-- Public Data API endpoints run with the caller's privileges; the private functions check auth.uid().
create function public.warehouse_profile() returns jsonb language sql stable
  set search_path = '' as $$ select warehouse_private.profile(); $$;
create function public.warehouse_users() returns jsonb language sql stable
  set search_path = '' as $$ select warehouse_private.users(); $$;
create function public.warehouse_save_user(profile jsonb) returns jsonb language sql
  set search_path = '' as $$ select warehouse_private.save_user(profile); $$;
create function public.warehouse_update_own_name(display_name text) returns jsonb language sql
  set search_path = '' as $$ select warehouse_private.update_own_name(display_name); $$;
create function public.warehouse_snapshot() returns jsonb language sql stable
  set search_path = '' as $$ select warehouse_private.snapshot(); $$;
create function public.warehouse_commit(changes jsonb) returns jsonb language sql
  set search_path = '' as $$ select warehouse_private.commit(changes); $$;

revoke all on all functions in schema warehouse_private from public, anon, authenticated;
grant execute on function warehouse_private.profile(), warehouse_private.users(),
  warehouse_private.save_user(jsonb), warehouse_private.update_own_name(text),
  warehouse_private.snapshot(), warehouse_private.commit(jsonb) to authenticated;
revoke all on function public.warehouse_profile(), public.warehouse_users(),
  public.warehouse_save_user(jsonb), public.warehouse_update_own_name(text),
  public.warehouse_snapshot(), public.warehouse_commit(jsonb) from public, anon, authenticated;
grant execute on function public.warehouse_profile(), public.warehouse_users(),
  public.warehouse_save_user(jsonb), public.warehouse_update_own_name(text),
  public.warehouse_snapshot(), public.warehouse_commit(jsonb) to authenticated;
commit;
