import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/auth';
import {supabaseAdmin} from '@/lib/serverSupabase';

const fail=(message:string,status=400)=>NextResponse.json({error:message},{status});

export async function POST(req:Request){
  try{
    const u=await currentUser();
    if(!u||u.role!=='admin')return fail('Admin access required',403);
    const {lotId}=await req.json();if(!lotId)return fail('lotId is required');
    const sb=supabaseAdmin();
    const [{data:lot,error:le},{data:products,error:pe}]=await Promise.all([
      sb.from('lots').select('*').eq('id',lotId).single(),
      sb.from('products').select('id,sku,product_name,brand,model,grade,selling_price,status,location,landed_cost,market_price').eq('lot_id',lotId).limit(500)
    ]);
    if(le)throw le;if(pe)throw pe;
    const candidates=(products||[]).filter((p:any)=>p.status!=='sold').map((p:any)=>{
      const sell=Number(p.selling_price||0),market=Number(p.market_price||0),landed=Number(p.landed_cost||0);
      const discount=market>0?Math.max(0,(market-sell)/market*100):0;
      const margin=sell>0?(sell-landed)/sell*100:0;
      const score=discount*0.45+margin*0.35+(p.grade==='A'?20:p.grade==='B'?12:5);
      return {...p,discount_pct:Number(discount.toFixed(1)),margin_pct:Number(margin.toFixed(1)),highlight_score:Number(score.toFixed(2))};
    }).sort((a:any,b:any)=>b.highlight_score-a.highlight_score).slice(0,6);
    const title=`${lot?.lot_code||'New Stock'} — Limited Availability`;
    const highlighted=candidates.map((p:any)=>({product_id:p.id,sku:p.sku,product_name:p.product_name,brand:p.brand,grade:p.grade,selling_price:p.selling_price,discount_pct:p.discount_pct,margin_pct:p.margin_pct}));
    const lines=candidates.map((p:any)=>`${p.product_name}${p.brand?` (${p.brand})`:''} — ₹${Number(p.selling_price||0).toLocaleString('en-IN')}${p.discount_pct>=20?` — up to ${p.discount_pct}% below comparable price`:''}`);
    const copy=`Fresh stock at Latur Liquidation OS.\n${lines.join('\n')}\nLimited quantities. Contact us for availability.`;
    const {data:banner,error:be}=await sb.from('product_banners').insert({lot_id:lotId,title,highlighted_items:highlighted,caption:copy,status:'generated'}).select().single();
    if(be)throw be;
    return NextResponse.json({ok:true,banner,highlights:highlighted,copy,can_publish:false,publish_note:'Social publishing requires Meta/WhatsApp credentials; content is ready for review.'});
  }catch(e:any){return fail(e?.message||'Lot marketing generation failed',500)}
}
