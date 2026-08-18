import {NextResponse} from 'next/server';
import {currentUser, can} from '@/lib/auth';
import {supabaseAdmin} from '@/lib/serverSupabase';

export const dynamic='force-dynamic';

const fail=(message:string,status=400)=>NextResponse.json({error:message},{status});

function percentile(values:number[], p:number){
  if(!values.length)return 0;
  const a=[...values].sort((x,y)=>x-y);const i=(a.length-1)*p;const lo=Math.floor(i),hi=Math.ceil(i);
  return lo===hi?a[lo]:a[lo]+(a[hi]-a[lo])*(i-lo);
}

export async function GET(req:Request){
  try{
    const u=await currentUser();
    if(!u||!can(u.role,'dashboard'))return fail('Forbidden',403);
    const sb=supabaseAdmin();
    const days=Math.min(365,Math.max(7,Number(new URL(req.url).searchParams.get('days')||90)));
    const since=new Date(Date.now()-days*86400000).toISOString();

    const [{data:sales,error:se},{data:products,error:pe},{data:units,error:ue}]=await Promise.all([
      sb.from('sales').select('id,sale_date,total,town,channel,payment_status').gte('sale_date',since).order('sale_date',{ascending:false}).limit(5000),
      sb.from('products').select('id,sku,product_name,brand,model,grade,purchase_cost,landed_cost,selling_price,status,location,lot_id').limit(5000),
      sb.from('inventory_units').select('id,product_id,lot_id,product_name,selling_price,status,created_at,sold_at').limit(10000)
    ]);
    if(se)throw se;if(pe)throw pe;if(ue)throw ue;

    const rows=(sales||[]) as any[];const ps=(products||[]) as any[];const us=(units||[]) as any[];
    const byTown:Record<string,{sales:number;revenue:number;orders:number}>={};
    const byDay:Record<string,{sales:number;revenue:number}>={};
    const byProduct:Record<string,{product:string;qty:number;revenue:number}>={};
    for(const s of rows){
      const town=s.town||'Unknown';const total=Number(s.total||0);
      byTown[town]??={sales:0,revenue:0,orders:0};byTown[town].orders++;byTown[town].revenue+=total;
      const day=new Date(s.sale_date).getDay();const name=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][day];
      byDay[name]??={sales:0,revenue:0};byDay[name].sales++;byDay[name].revenue+=total;
    }
    const inventoryByProduct=new Map<string,number>();
    for(const x of us){if(x.status!=='sold')inventoryByProduct.set(x.product_id,(inventoryByProduct.get(x.product_id)||0)+1)}
    for(const p of ps){
      const sold=us.filter(x=>x.product_id===p.id&&x.status==='sold').length;
      if(sold)byProduct[p.id]={product:p.product_name,qty:sold,revenue:sold*Number(p.selling_price||0)};
    }
    const winners=Object.values(byProduct).sort((a,b)=>b.qty-a.qty).slice(0,10);
    const profitable=ps.map(p=>{const landed=Number(p.landed_cost||p.purchase_cost||0),sell=Number(p.selling_price||0);return {...p,margin:sell?((sell-landed)/sell)*100:0,stock:inventoryByProduct.get(p.id)||0}}).filter(x=>x.selling_price>0).sort((a,b)=>b.margin-a.margin).slice(0,10);
    const stockAges=us.filter(x=>x.status!=='sold').map(x=>(Date.now()-new Date(x.created_at).getTime())/86400000);
    return NextResponse.json({
      period_days:days,summary:{orders:rows.length,revenue:rows.reduce((n,x)=>n+Number(x.total||0),0),active_units:us.filter(x=>x.status!=='sold').length,avg_stock_age_days:Number(percentile(stockAges,0.5).toFixed(1))},
      towns:Object.entries(byTown).map(([town,v])=>({town,...v})).sort((a,b)=>b.revenue-a.revenue),
      best_days:Object.entries(byDay).map(([day,v])=>({day,...v})).sort((a,b)=>b.revenue-a.revenue),
      winning_products:winners,profitable_products:profitable.map(x=>({id:x.id,product:x.product_name,sku:x.sku,margin_pct:Number(x.margin.toFixed(1)),stock:x.stock,selling_price:x.selling_price})),
      stock_age:{over30:stockAges.filter(x=>x>30).length,over60:stockAges.filter(x=>x>60).length,over90:stockAges.filter(x=>x>90).length}
    });
  }catch(e:any){return fail(e?.message||'Intelligence analysis failed',500)}
}
