import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/serverSupabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const supplied = req.headers.get('x-cron-secret');
  const expected = process.env.AUTOMATION_CRON_SECRET;
  if (!expected || supplied !== expected) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sb = supabaseServer();
  const now = new Date().toISOString();
  const results: any = { promotion_reminders: 0, promotion_jobs_ready: 0, tasks: 0 };

  const { data: reminders } = await sb.from('handpick_items').select('id,promotion_decision,promotion_next_reminder_at').eq('promotion_decision', 'no').lte('promotion_next_reminder_at', now).limit(100);
  for (const item of reminders || []) {
    await sb.from('automation_tasks').insert({ task_type: 'promotion_reminder', subject: 'Product promotion reminder', reference_id: item.id, scheduled_for: now, status: 'pending' });
    await sb.from('handpick_items').update({ promotion_last_reminded_at: now, promotion_next_reminder_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }).eq('id', item.id);
    results.promotion_reminders++;
  }

  const { data: jobs } = await sb.from('social_promotions').select('id,channel,lot_id,status,scheduled_at').eq('status', 'queued').lte('scheduled_at', now).limit(100);
  if (jobs?.length) {
    await sb.from('social_promotions').update({ status: 'ready' }).in('id', jobs.map((j: any) => j.id));
    results.promotion_jobs_ready = jobs.length;
  }

  const { data: tasks } = await sb.from('automation_tasks').select('id').eq('status', 'pending').lte('scheduled_for', now).limit(100);
  results.tasks = tasks?.length || 0;
  return NextResponse.json({ ok: true, ran_at: now, results });
}
