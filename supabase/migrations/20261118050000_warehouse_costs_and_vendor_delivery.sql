-- Record outbound cost at posting time and queue one delivery per released vendor PO.
begin;

alter table warehouse_private.stock_movements add column outbound_value numeric(20,2);

create table warehouse_private.vendor_deliveries (
  po_id text not null,
  vendor_name text not null,
  recipient text,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'unknown')),
  attempt_id uuid,
  attempted_by uuid,
  attempted_at timestamptz,
  message_id text,
  last_error text,
  primary key (po_id, vendor_name)
);
alter table warehouse_private.vendor_deliveries enable row level security;
revoke all on warehouse_private.vendor_deliveries from public, anon, authenticated;

-- Previously released POs may already have been emailed. Require reconciliation before any resend.
insert into warehouse_private.vendor_deliveries (po_id, vendor_name, status, last_error)
select distinct r.id, l->>'vendorName', 'unknown',
  'PO dirilis sebelum pelacakan email. Periksa folder Terkirim sebelum mengirim kembali.'
from warehouse_private.records r
cross join lateral jsonb_array_elements(r.data->'items') l
where r.kind = 'po' and r.data->>'status' = 'Sent to Receiving'
  and nullif(trim(l->>'vendorName'), '') is not null;

create or replace function warehouse_private.snapshot()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p warehouse_private.profiles := warehouse_private.actor();
begin
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'kind', r.kind, 'id', r.id, 'version', r.version, 'data',
    case when p.position = 'Outlet' and r.kind = 'stock' then
      r.data - array['priceActual', 'inboundValue', 'outbondValue', 'beginningValue', 'endingValue', 'soValue', 'gapValue']
    when p.position = 'Outlet' and r.kind = 'order' then
      r.data - array['postedStockCost', 'postedStockCosts']
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

alter function warehouse_private.commit(jsonb) rename to commit_documents;
revoke all on function warehouse_private.commit_documents(jsonb) from public, anon, authenticated;

create function warehouse_private.commit(changes jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  saved jsonb;
  document jsonb;
  previous_rows jsonb;
  previous jsonb;
  stock jsonb;
  current_period text;
  ledger_start bigint;
  movement warehouse_private.stock_movements;
  opening_qty numeric;
  opening_value numeric;
  recorded_inbound_value numeric;
  elapsed_out_value numeric;
  running_qty numeric;
  running_value numeric;
  issued_value numeric;
  last_unit_cost numeric;
  previous_period_value jsonb;
  prior_close_count jsonb;
  previous_vendor_emails jsonb;
begin
  if jsonb_typeof(changes) is distinct from 'array' or jsonb_array_length(changes) > 12000 then
    raise exception 'Paket perubahan tidak valid.';
  end if;
  perform pg_advisory_xact_lock(811013, 1);
  select coalesce(max(id), 0) into ledger_start from warehouse_private.stock_movements;
  select coalesce(jsonb_object_agg(jsonb_build_array(r.kind, r.id)::text, r.data), '{}')
    into previous_rows
    from jsonb_array_elements(changes) c
    join warehouse_private.records r on r.kind = c->>'kind' and r.id = c->>'id'
    where r.kind in ('stock', 'po');

  saved := warehouse_private.commit_documents(changes);

  for document in select value from jsonb_array_elements(saved)
  loop
    if document->>'kind' = 'po' then
      previous_vendor_emails := previous_rows->(jsonb_build_array('po', document->>'id')::text)->'emailedVendors';
      if document#>'{data,emailedVendors}' is distinct from previous_vendor_emails
      then raise exception 'Status email vendor hanya diperbarui dari hasil pengiriman.'; end if;
    elsif document->>'kind' = 'order' and (document->'data' ?| array['postedStockCost', 'postedStockCosts']) then
      raise exception 'Biaya pengiriman dihitung pada saat posting.';
    elsif document->>'kind' = 'stock' then
      previous := previous_rows->(jsonb_build_array('stock', document->>'id')::text);
      if coalesce((previous->>'beginningInventory')::numeric, 0)
           + coalesce((previous->>'inbound')::numeric, 0)
           + coalesce((previous->>'outbond')::numeric, 0) > 0
        and previous->>'unit' is distinct from document#>>'{data,unit}'
      then raise exception 'Satuan SKU dengan saldo atau transaksi tidak dapat diubah.'; end if;
    end if;
  end loop;

  for document in select value from jsonb_array_elements(saved) where value->>'kind' = 'stock'
  loop
    stock := document->'data';
    current_period := stock->>'period';
    previous := previous_rows->(jsonb_build_array('stock', document->>'id')::text);
    opening_qty := (stock->>'beginningInventory')::numeric;
    opening_value := round(opening_qty * coalesce((stock->>'priceActual')::numeric,
      (stock->>'priceBudget')::numeric, (stock->>'price')::numeric, 0), 2);
    if previous is not null and previous->'beginningInventory' = stock->'beginningInventory' then
      opening_value := coalesce((previous->>'beginningValue')::numeric,
        round(opening_qty * coalesce((previous->>'priceBudget')::numeric, (previous->>'price')::numeric, 0), 2));
    end if;

    select i into prior_close_count
    from jsonb_array_elements(saved) x
    cross join lateral jsonb_array_elements(case when x->>'kind' = 'opname' then x#>'{data,items}' end) i
    where x->>'kind' = 'opname' and x#>>'{data,status}' = 'Finalized (Generated)'
      and x#>>'{data,nextPeriodGenerated}' = current_period and i->>'sku' = stock->>'sku';
    if found then
      select r.data into previous_period_value from warehouse_private.records r
      where r.kind = 'stock' and r.id =
        to_char((current_period || '-01')::date - interval '1 month', 'YYYY-MM') || ':' || (stock->>'sku');
      opening_value := round(opening_qty * coalesce(
        (previous_period_value->>'endingValue')::numeric /
          nullif((previous_period_value->>'endingInventory')::numeric, 0),
        (previous_period_value->>'priceActual')::numeric,
        (prior_close_count->>'priceActual')::numeric, 0
      ), 2);
    end if;

    recorded_inbound_value := coalesce((previous->>'inboundValue')::numeric, 0);
    elapsed_out_value := coalesce((previous->>'outbondValue')::numeric, 0);
    running_qty := opening_qty + coalesce((previous->>'inbound')::numeric, 0)
      - coalesce((previous->>'outbond')::numeric, 0);
    running_value := opening_value + recorded_inbound_value - elapsed_out_value;
    if (prior_close_count is not null or (previous is not null and previous->'beginningInventory' is distinct from stock->'beginningInventory'))
      and (running_qty < 0 or running_value < 0 or (running_qty = 0 and running_value <> 0)) then
      raise exception 'Perubahan saldo awal membutuhkan rekonsiliasi biaya untuk SKU %.', stock->>'sku';
    end if;
    last_unit_cost := coalesce(running_value / nullif(running_qty, 0),
      (previous->>'priceActual')::numeric, (stock->>'priceActual')::numeric,
      (stock->>'priceBudget')::numeric, 0);

    for movement in
      select m.* from warehouse_private.stock_movements m
      where m.id > ledger_start and m.period = current_period and m.sku = stock->>'sku'
      order by m.id
    loop
      issued_value := 0;
      if movement.outbound > 0 then
        if movement.outbound > running_qty or running_value < 0 then
          raise exception 'Saldo kuantitas atau biaya tidak cukup untuk SKU %.', stock->>'sku';
        end if;
        last_unit_cost := running_value / running_qty;
        issued_value := round(movement.outbound * last_unit_cost, 2);
      elsif movement.outbound < 0 then
        select -m.outbound_value into issued_value
        from warehouse_private.stock_movements m
        where m.source_kind = movement.source_kind and m.source_id = movement.source_id
          and m.line_id = movement.line_id and m.source_version = 1 and m.outbound = -movement.outbound;
        if issued_value is null then
          raise exception 'Biaya pengeluaran lama tidak tercatat. Koordinasikan koreksi dengan Finance.';
        end if;
      end if;
      running_qty := running_qty + movement.inbound - movement.outbound;
      running_value := running_value + movement.inbound_value - issued_value;
      if running_qty < 0 or running_value < 0 or (running_qty = 0 and running_value <> 0) then
        raise exception 'Koreksi membuat saldo biaya atau kuantitas tidak konsisten untuk SKU %.', stock->>'sku';
      end if;
      elapsed_out_value := elapsed_out_value + issued_value;
      recorded_inbound_value := recorded_inbound_value + movement.inbound_value;
      if movement.outbound <> 0 then
        update warehouse_private.stock_movements set outbound_value = issued_value where id = movement.id;
      end if;
      if running_qty > 0 then
        last_unit_cost := running_value / running_qty;
      end if;
    end loop;

    stock := stock || jsonb_build_object(
      'beginningValue', opening_value, 'inboundValue', recorded_inbound_value, 'outbondValue', elapsed_out_value,
      'endingValue', running_value, 'priceActual', round(last_unit_cost, 6),
      'soValue', round((stock->>'stockOpname')::numeric * last_unit_cost, 2),
      'gapValue', running_value - round((stock->>'stockOpname')::numeric * last_unit_cost, 2)
    );
    update warehouse_private.records set data = stock where kind = 'stock' and id = document->>'id';
  end loop;

  update warehouse_private.records r set data = r.data || jsonb_build_object(
    'postedStockCost', costs.total, 'postedStockCosts', costs.by_line)
  from (
    select m.source_id, sum(m.outbound_value) as total, jsonb_object_agg(m.line_id, m.outbound_value) as by_line
    from warehouse_private.stock_movements m
    where m.id > ledger_start and m.source_kind = 'order' and m.outbound > 0
    group by m.source_id
  ) costs
  where r.kind = 'order' and r.id = costs.source_id;

  insert into warehouse_private.vendor_deliveries (po_id, vendor_name, recipient)
  select distinct d->>'id', l->>'vendorName', v.email
  from jsonb_array_elements(saved) d
  cross join lateral jsonb_array_elements(case when d->>'kind' = 'po' then d#>'{data,items}' end) l
  left join lateral (
    select nullif(trim(r.data->>'email'), '') as email from warehouse_private.records r
    where r.kind = 'vendor' and r.data->>'namaVendor' = l->>'vendorName'
    order by r.id limit 1
  ) v on true
  where d->>'kind' = 'po' and d#>>'{data,status}' = 'Sent to Receiving'
    and previous_rows->(jsonb_build_array('po', d->>'id')::text)->>'status'
      is distinct from 'Sent to Receiving'
  on conflict (po_id, vendor_name) do nothing;

  return (select coalesce(jsonb_agg(d || jsonb_build_object('data', r.data) order by n), '[]')
    from jsonb_array_elements(saved) with ordinality as s(d,n)
    join warehouse_private.records r on r.kind = d->>'kind' and r.id = d->>'id');
end;
$$;

-- Keep the existing API name. Rebind the dependency after renaming the old function.
create or replace function public.warehouse_commit(changes jsonb)
returns jsonb language sql set search_path = '' as $$
  select warehouse_private.commit(changes);
$$;
revoke all on function warehouse_private.commit(jsonb) from public, anon, authenticated;
grant execute on function warehouse_private.commit(jsonb) to authenticated;

create function warehouse_private.vendor_delivery(
  po_key text, action text, vendor_key text, attempt uuid, gmail_id text, detail text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor warehouse_private.profiles := warehouse_private.actor();
  po jsonb;
  job warehouse_private.vendor_deliveries;
  recipient_count integer;
  recipient_address text;
begin
  if actor.position not in ('Administrator', 'Purchasing') then
    raise exception 'Akses email vendor ditolak.' using errcode = '42501';
  end if;
  if action = 'list' then
    return (select coalesce(jsonb_agg(jsonb_build_object(
      'vendorName', j.vendor_name, 'status', j.status, 'recipient', j.recipient,
      'lastError', j.last_error, 'messageId', j.message_id,
      'attemptId', case when j.attempted_by = actor.id then j.attempt_id end
    ) order by j.vendor_name), '[]')
    from warehouse_private.vendor_deliveries j where j.po_id = po_key);
  end if;

  perform pg_advisory_xact_lock(811013, 1);
  select r.data into po from warehouse_private.records r where r.kind = 'po' and r.id = po_key
    and r.data->>'status' = 'Sent to Receiving';
  if not found then raise exception 'Rilis PO harus tersimpan sebelum email dikirim.'; end if;
  select * into job from warehouse_private.vendor_deliveries j
    where j.po_id = po_key and j.vendor_name = vendor_key;
  if not found then raise exception 'Vendor tidak terdaftar pada rilis PO ini.'; end if;
  if attempt is null then raise exception 'ID pengiriman wajib diisi.'; end if;

  if action = 'claim' then
    if job.status = 'sending' and job.attempt_id = attempt and job.attempted_by = actor.id then
      return jsonb_build_object('recipient', job.recipient, 'po', po);
    end if;
    if job.status <> 'pending' then raise exception 'Email sudah dikirim atau perlu diperiksa sebelum dicoba lagi.'; end if;
    select count(*), min(trim(r.data->>'email')) into recipient_count, recipient_address
    from warehouse_private.records r where r.kind = 'vendor' and r.data->>'namaVendor' = vendor_key;
    if recipient_count <> 1 or coalesce(recipient_address, '') !~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+[.][^[:space:]@,;<>]+$'
    then raise exception 'Isi satu alamat email yang valid di master vendor.'; end if;
    if lower(recipient_address) is distinct from lower(trim(detail)) then
      raise exception 'Alamat vendor berubah. Buka ulang konfirmasi sebelum mengirim.';
    end if;
    update warehouse_private.vendor_deliveries
      set status = 'sending', attempt_id = attempt, attempted_by = actor.id, attempted_at = now(),
          recipient = recipient_address, last_error = null
      where po_id = po_key and vendor_name = vendor_key;
    return jsonb_build_object('recipient', recipient_address, 'po', po);
  end if;

  if action = 'sent' and job.status = 'sent' and job.attempt_id = attempt
      and job.attempted_by = actor.id and job.message_id = gmail_id then
    return jsonb_build_object('status', 'sent', 'messageId', gmail_id);
  end if;
  if (job.status <> 'sending' and not (job.status = 'unknown' and action = 'sent'))
    or job.attempt_id is distinct from attempt
    or job.attempted_by is distinct from actor.id
  then raise exception 'Pengiriman tidak sedang diproses oleh akun ini.'; end if;

  if action = 'sent' then
    if coalesce(trim(gmail_id), '') = '' or length(gmail_id) > 250 then
      raise exception 'ID pesan Gmail tidak valid.';
    end if;
    update warehouse_private.vendor_deliveries
      set status = 'sent', message_id = gmail_id, last_error = null
      where po_id = po_key and vendor_name = vendor_key;
    update warehouse_private.records
      set data = jsonb_set(data, '{emailedVendors}',
        (select coalesce(jsonb_agg(e), '[]') from jsonb_array_elements(coalesce(data->'emailedVendors', '[]')) e
         where e->>'vendorName' is distinct from vendor_key)
        || jsonb_build_array(jsonb_build_object(
          'vendorName', vendor_key, 'email', job.recipient, 'sentAt', now(), 'sentBy', actor.username,
          'subject', left(detail, 250), 'messageId', gmail_id
        ))),
        version = version + 1, updated_at = now(), updated_by = actor.id
      where kind = 'po' and id = po_key;
    return jsonb_build_object('status', 'sent', 'messageId', gmail_id);
  elsif action in ('failed', 'unknown') then
    update warehouse_private.vendor_deliveries
      set status = case when action = 'failed' then 'pending' else 'unknown' end,
          last_error = left(detail, 400)
      where po_id = po_key and vendor_name = vendor_key;
    return jsonb_build_object('status', case when action = 'failed' then 'pending' else 'unknown' end);
  end if;
  raise exception 'Tindakan pengiriman tidak valid.';
end;
$$;

create function public.warehouse_vendor_delivery(
  po_key text, action text, vendor_key text default null, attempt uuid default null,
  gmail_id text default null, detail text default null
)
returns jsonb language sql set search_path = '' as $$
  select warehouse_private.vendor_delivery(po_key, action, vendor_key, attempt, gmail_id, detail);
$$;
revoke all on function warehouse_private.vendor_delivery(text,text,text,uuid,text,text) from public, anon, authenticated;
revoke all on function public.warehouse_vendor_delivery(text,text,text,uuid,text,text) from public, anon, authenticated;
grant execute on function warehouse_private.vendor_delivery(text,text,text,uuid,text,text) to authenticated;
grant execute on function public.warehouse_vendor_delivery(text,text,text,uuid,text,text) to authenticated;
commit;
