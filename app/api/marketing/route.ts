import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/serverSupabase';

export const dynamic = 'force-dynamic';

async function adminOnly() {
  const u = await currentUser();
  if (!u || u.role !== 'admin') return null;
  return u;
}

export async function POST(req: NextRequest) {
  const u = await adminOnly();
  if (!u) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  const body = await req.json();
  const lotId = String(body.lotId || '');
  if (!lotId) return NextResponse.json({ error: 'lotId is required' }, { status: 400 });

  const sb = supabaseServer();
  const { data: lot, error: lotError } = await sb.from('lots').select('id,lot_name,status,expected_recovery,actual_sales').eq('id', lotId).single();
  if (lotError || !lot) return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
  const { data: products, error: productsError } = await sb.from('products').select('id,sku,name,brand,grade,condition,market_price,selling_price,status,location').eq('lot_id', lotId).order('selling_price', { ascending: true });
  if (productsError) return NextResponse.json({ error: productsError.message }, { status: 500 });

  const highlights = (products || []).filter((p: any) => p.status !== 'sold').sort((a: any, b: any) => {
    const da = Number(a.market_price || 0) - Number(a.selling_price || 0);
    const db = Number(b.market_price || 0) - Number(b.selling_price || 0);
    return db - da;
  }).slice(0, 6);

  const banner = {
    lot_id: lotId,
    title: `${lot.lot_name} — Limited Stock`,
    highlighted_items: highlights.map((p: any) => ({ id: p.id, sku: p.sku, name: p.name, brand: p.brand, grade: p.grade, selling_price: p.selling_price, market_price: p.market_price })),
    caption: `Limited liquidation stock. Selected products available at attractive prices. Contact us for availability and purchase.`,
    status: 'generated'
  };
  const { data: created, error } = await sb.from('product_banners').insert(banner).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const channels = ['instagram', 'facebook', 'whatsapp'];
  const jobs = channels.map(channel => ({ lot_id: lotId, channel, status: 'queued', scheduled_at: new Date().toISOString(), creative_path: null, copy_text: banner.caption }));
  const { data: promotions, error: promotionError } = await sb.from('social_promotions').insert(jobs).select();
  if (promotionError) return NextResponse.json({ error: promotionError.message }, { status: 500 });
  return NextResponse.json({ lot, banner: created, promotions });
}
