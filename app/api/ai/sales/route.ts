import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { currentUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/serverSupabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { message, town, channel = 'whatsapp' } = await req.json();
  if (!message) return NextResponse.json({ error: 'message is required' }, { status: 400 });

  const sb = supabaseServer();
  const { data: products, error } = await sb.from('products').select('sku,name,brand,category,grade,condition,selling_price,market_price,warranty,location,status').eq('status', 'in_stock').limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'AI service is not configured' }, { status: 503 });
  const client = new OpenAI({ apiKey });
  const inventory = (products || []).map((p: any) => ({ sku: p.sku, name: p.name, brand: p.brand, category: p.category, grade: p.grade, condition: p.condition, price: p.selling_price, market_price: p.market_price, warranty: p.warranty, location: p.location }));
  const response = await client.responses.create({
    model: process.env.OPENAI_SALES_MODEL || 'gpt-5-mini',
    input: `You are the sales assistant for Latur Liquidation OS. Never invent stock, price, warranty or product facts. Recommend only products present in the supplied live inventory. Explain savings only when market_price is present. If the customer asks for unavailable products, say they are unavailable and suggest close alternatives. Keep replies concise and sales-oriented. Channel: ${channel}. Town: ${town || 'unknown'}. Live inventory JSON: ${JSON.stringify(inventory)}\nCustomer message: ${message}`
  });
  return NextResponse.json({ reply: response.output_text, inventory_checked_at: new Date().toISOString() });
}
