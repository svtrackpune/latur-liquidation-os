-- Production migration already applied to Supabase.
create or replace function public.confirm_handpick_purchase(p_handpick_id uuid,p_qty numeric,p_unit_price numeric,p_confirmed_by text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare h public.handpick_items%rowtype; l public.lots%rowtype; r public.receiving_sessions%rowtype; i integer; lot_no text; sku text;
begin
 if p_qty is null or p_qty<=0 or p_unit_price is null or p_unit_price<0 then raise exception 'Invalid purchase quantity or price'; end if;
 select * into h from public.handpick_items where id=p_handpick_id for update;
 if not found then raise exception 'Handpick item not found'; end if;
 if h.purchase_status='confirmed' then raise exception 'Purchase already confirmed'; end if;
 lot_no := 'LLO-'||to_char(current_date,'YYYYMMDD')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
 insert into public.lots(lot_no,supplier_id,purchase_date,purchase_amount,expected_recovery,status,notes)
 values(lot_no,h.vendor_id,current_date,p_qty*p_unit_price,coalesce(p_qty*h.recommended_sell_price,0),'purchased','Created from handpick item '||p_handpick_id::text)
 returning * into l;
 for i in 1..floor(p_qty)::integer loop
   sku := 'LLO-'||substr(replace(l.id::text,'-',''),1,8)||'-'||lpad(i::text,4,'0');
   insert into public.products(sku,lot_id,category_id,product_name,brand,model,serial_no,grade,condition_notes,purchase_cost,market_price,selling_price,status,location,warranty)
   values(sku,l.id,null,h.product_name,h.brand,h.model,h.serial_no,'A',h.observed_condition,p_unit_price,h.market_price,h.recommended_sell_price,'receiving','Latur Warehouse',null);
 end loop;
 insert into public.receiving_sessions(lot_id,status,expected_units,received_units,discrepancy_units,started_by)
 values(l.id,'pending',p_qty,0,0,p_confirmed_by) returning * into r;
 update public.handpick_items set lot_id=l.id,purchase_status='confirmed',purchase_qty=p_qty,purchase_unit_price=p_unit_price,purchase_confirmed_at=now(),purchase_confirmed_by=p_confirmed_by,decision='approved',promotion_decision='pending',promotion_status='not_started' where id=p_handpick_id;
 return jsonb_build_object('lot_id',l.id,'lot_no',l.lot_no,'receiving_id',r.id,'expected_qty',p_qty);
end; $$;
revoke all on function public.confirm_handpick_purchase(uuid,numeric,numeric,text) from public;
grant execute on function public.confirm_handpick_purchase(uuid,numeric,numeric,text) to service_role;
