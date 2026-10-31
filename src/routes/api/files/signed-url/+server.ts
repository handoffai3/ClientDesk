import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';

export const POST: RequestHandler = async ({ request }) => {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw error(401, 'Missing or invalid Authorization header');
  }
  const token = authHeader.slice(7);

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) {
    throw error(401, 'Invalid token');
  }

  const body = await request.json();
  const { type, id } = body;

  if (!type || !id) {
    throw error(400, 'type and id are required');
  }

  if (!['file', 'deliverable', 'message'].includes(type)) {
    throw error(400, 'type must be file, deliverable, or message');
  }

  // Determine caller role
  const [agencyUserRes, clientUserRes] = await Promise.all([
    supabaseAdmin.from('users').select('agency_id').eq('id', user.id).maybeSingle(),
    supabaseAdmin.from('client_users').select('client_id').eq('id', user.id).maybeSingle(),
  ]);
  const callerAgencyId = agencyUserRes.data?.agency_id;
  const callerClientId = clientUserRes.data?.client_id;

  let storagePath: string | null = null;

  if (type === 'file') {
    const { data: file } = await supabaseAdmin
      .from('files')
      .select('id, agency_id, client_id, is_locked, unlocked_at, file_path, file_url')
      .eq('id', id)
      .single();

    if (!file) throw error(404, 'File not found');

    const isAgencyOwner = callerAgencyId && callerAgencyId === file.agency_id;
    const isFileClient = callerClientId && callerClientId === file.client_id;
    if (!isAgencyOwner && !isFileClient) throw error(403, 'Access denied');

    if (isFileClient && !isAgencyOwner) {
      if (file.is_locked && !file.unlocked_at) {
        throw error(403, 'File is locked');
      }
    }

    storagePath = file.file_path || extractPathFromUrl(file.file_url);

  } else if (type === 'deliverable') {
    const { data: del } = await supabaseAdmin
      .from('deliverables')
      .select('id, agency_id, client_id, file_path, file_url, file_type')
      .eq('id', id)
      .single();

    if (!del) throw error(404, 'Deliverable not found');

    const isAgencyOwner = callerAgencyId && callerAgencyId === del.agency_id;
    const isDelClient = callerClientId && callerClientId === del.client_id;
    if (!isAgencyOwner && !isDelClient) throw error(403, 'Access denied');

    storagePath = del.file_path || extractPathFromUrl(del.file_url);

  } else if (type === 'message') {
    const { data: msg } = await supabaseAdmin
      .from('messages')
      .select('id, agency_id, client_id, file_path, file_url')
      .eq('id', id)
      .single();

    if (!msg) throw error(404, 'Message not found');
    if (!msg.file_url && !msg.file_path) throw error(400, 'Message has no attachment');

    const isAgencyOwner = callerAgencyId && callerAgencyId === msg.agency_id;
    const isMsgClient = callerClientId && callerClientId === msg.client_id;
    if (!isAgencyOwner && !isMsgClient) throw error(403, 'Access denied');

    storagePath = msg.file_path || extractPathFromUrl(msg.file_url);
  }

  if (!storagePath) {
    throw error(500, 'File path not available');
  }

  const { data: signedData, error: signedErr } = await supabaseAdmin.storage
    .from('ClientDeskBucket')
    .createSignedUrl(storagePath, 300);

  if (signedErr || !signedData?.signedUrl) {
    throw error(500, 'Could not generate signed URL');
  }

  return json({ url: signedData.signedUrl });
};

function extractPathFromUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = '/ClientDeskBucket/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.substring(idx + marker.length));
}
