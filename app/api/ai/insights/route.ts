import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { currentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/serverSupabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const u = await currentUser();
  if (!u || u.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  const { periodDays = 180, town } = await req.json().catch(() => ({}));
  const since = new Date(Date.now() - Number(periodDays) * 86400000).toISOString();
  const sb = supabaseServer();
  const [sales, products, lots] = await Promise.all([
    sb.from('sales').select('product_id,lot_id,selling_price,discount,sales_channel,town,sold_at').gte('sold_at', since).limit(5000),
    sb.from('products').select('id,name,brand,category,grade,purchase_cost,landed_cost,market_price,selling_price,status,location').limit(5000),
    sb.from('lots').select('id,lot_name,total_landed_cost,expected_recovery,actual_sales,purchase_date,status').limit(2000)
  ]);
  if (sales.error) return NextResponse.json({ error: sales.error.message }, { status: 500 });
  if (products.error) return NextResponse.json({ error: products.error.message }, { status: 500 });
  if (lots.error) return NextResponse.json({ error: lots.error.message }, { status: 500 });
  const filteredSales = town ? (sales.data || []).filter((s: any) => s.town === town) : (sales.data || []);
  const productMap = new Map((products.data || []).map((p: any) => [p.id, p]));
  const summary = filteredSales.map((s: any) => ({ ...s, product: productMap.get(s.product_id) || null }));
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'AI service is not configured' }, { status: 503 });
  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({
    model: process.env.OPENAI_INSIGHTS_MODEL || 'gpt-5-mini',
    input: `You are the procurement and commercial intelligence agent for a liquidation business. Analyze the supplied sales, inventory and lot data. Identify winning products, profitable products, slow-moving products, town demand, seasonal/monthly patterns, day-of-week patterns, recurring demand, stock ageing risks and procurement opportunities. Do not invent facts; clearly label insufficient data. Recommend concrete actions and quantities only when supported by the data. Return concise structured sections. Data: ${JSON.stringify({ periodDays, town: town || null, sales: summary, lots: lots.data })}`
  });
  return NextResponse.json({ period_days: periodDays, town: town || null, generated_at: new Date().toISOString(), insights: response.output_text });
}
