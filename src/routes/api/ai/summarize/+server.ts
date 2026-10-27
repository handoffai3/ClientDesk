import { json, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { supabaseAdmin } from '$lib/server/supabase';
import { requireCaller } from '$lib/server/auth';

const RATE_LIMIT = 10;

async function consumeAiQuota(agencyId: string): Promise<'ok' | 'limited' | 'error'> {
  const { data, error } = await supabaseAdmin.rpc('consume_ai_quota', { p_agency_id: agencyId, p_limit: RATE_LIMIT });
  if (error) return 'error';
  return data === true ? 'ok' : 'limited';
}

export const POST: RequestHandler = async ({ request }) => {
  const caller = await requireCaller(request);
  const agencyId = caller.agencyId;

  const baseUrl = (env.AI_BASE_URL || '').trim().replace(/\/+$/, '');
  const apiKey = (env.AI_API_KEY || '').trim();
  const model = (env.AI_MODEL || '').trim();
  if (!baseUrl || !apiKey || !model) {
    return json({ error: 'AI service not configured' }, { status: 503 });
  }

  const body = await request.json();
  const { type, data } = body;

  if (!type) {
    return json({ error: 'Missing required fields' }, { status: 400 });
  }

  let prompt = '';

  if (type === 'messages') {
    const messages = data?.messages;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return json({ error: 'No messages to summarize' }, { status: 400 });
    }
    const thread = messages
      .map((m: any) => `[${m.sender_type}] ${m.content || '(file attachment)'}`)
      .join('\n');
    prompt = `Summarize this client-agency message thread in 3-5 bullet points. Focus on key decisions, action items, and outstanding questions. Be concise.\n\n${thread}`;
  } else if (type === 'pins') {
    const pins = data?.pins;
    if (!pins || !Array.isArray(pins) || pins.length === 0) {
      return json({ error: 'No feedback pins to summarize' }, { status: 400 });
    }
    const feedback = pins.map((p: any) => {
      const replies = (p.replies || []).map((r: any) => `  - [${r.author_type}] ${r.content}`).join('\n');
      return `Pin #${p.number} (${p.is_resolved ? 'Resolved' : 'Open'}): ${p.content}${replies ? '\n' + replies : ''}`;
    }).join('\n\n');
    prompt = `Summarize this visual proofing feedback in 3-5 bullet points. Group by theme (design, copy, layout, etc). Highlight unresolved items. Be concise.\n\n${feedback}`;
  } else if (type === 'project') {
    const { projectName, timeline, milestones, deliverables, recentMessages } = data || {};
    const parts: string[] = [`Project: ${projectName || 'Unnamed'}`];
    if (timeline?.length) {
      parts.push('Timeline:\n' + timeline.map((t: any) => `- [${t.status}] ${t.content}`).join('\n'));
    }
    if (milestones?.length) {
      parts.push('Milestones:\n' + milestones.map((m: any) => `- ${m.title} (${m.is_completed ? 'Done' : 'Pending'}${m.due_date ? ', due ' + m.due_date : ''})`).join('\n'));
    }
    if (deliverables?.length) {
      parts.push('Deliverables:\n' + deliverables.map((d: any) => `- ${d.title} v${d.version} [${d.status}]`).join('\n'));
    }
    if (recentMessages?.length) {
      parts.push('Recent Messages:\n' + recentMessages.slice(0, 10).map((m: any) => `- [${m.sender_type}] ${m.content || '(file)'}`).join('\n'));
    }
    prompt = `Provide a brief project status summary in 3-5 bullet points. Cover: progress, upcoming deadlines, blockers, and next steps. Be concise.\n\n${parts.join('\n\n')}`;
  } else {
    return json({ error: 'Invalid summary type' }, { status: 400 });
  }

  const quota = await consumeAiQuota(agencyId);
  if (quota === 'limited') {
    return json({ error: 'Rate limit exceeded. Max 10 AI summaries per hour.' }, { status: 429 });
  }
  if (quota === 'error') {
    return json({ error: 'Usage check is unavailable right now. Please try again shortly.' }, { status: 503 });
  }

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.3 }),
      signal: AbortSignal.timeout(30_000)
    });
    if (!res.ok) throw new Error(`upstream status ${res.status}`);
    const payload = await res.json();
    const summary = payload?.choices?.[0]?.message?.content;
    if (typeof summary !== 'string' || !summary.trim()) throw new Error('empty completion');
    return json({ summary: summary.trim() });
  } catch {
    return json({ error: 'AI summarization failed. Please try again.' }, { status: 502 });
  }
};
