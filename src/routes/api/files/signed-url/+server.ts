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

  const { file_url } = await request.json();
  if (!file_url || typeof file_url !== 'string') {
    throw error(400, 'file_url is required');
  }

  const storagePath = extractPathFromUrl(file_url);
  if (!storagePath) {
    throw error(400, 'Invalid file URL');
  }

  // Look up the file record by matching storage path or URL
  const { data: file } = await supabaseAdmin
    .from('files')
    .select('id, agency_id, client_id, is_locked, unlocked_at, file_type')
    .or(`file_path.eq.${storagePath},file_url.ilike.%${storagePath}`)
    .maybeSingle();

  if (file) {
    // Check ownership
    const { data: agencyUser } = await supabaseAdmin
      .from('users')
      .select('agency_id')
      .eq('id', user.id)
      .single();

    const { data: clientUser } = await supabaseAdmin
      .from('client_users')
      .select('client_id')
      .eq('id', user.id)
      .single();

    const isAgencyOwner = agencyUser && agencyUser.agency_id === file.agency_id;
    const isFileClient = clientUser && clientUser.client_id === file.client_id;

    if (!isAgencyOwner && !isFileClient) {
      throw error(403, 'Access denied');
    }

    // Check lock for client users (allow deliverable images even when locked for proofing)
    if (isFileClient && !isAgencyOwner) {
      const locked = file.is_locked && !file.unlocked_at;
      if (locked && file.file_type !== 'image') {
        throw error(403, 'File is locked');
      }
    }
  }

  const { data: signedData, error: signedErr } = await supabaseAdmin.storage
    .from('ClientDeskBucket')
    .createSignedUrl(storagePath, 300);

  if (signedErr || !signedData?.signedUrl) {
    throw error(500, 'Could not generate signed URL');
  }

  return json({ url: signedData.signedUrl });
};

function extractPathFromUrl(url: string): string | null {
  if (!url) return null;
  const marker = '/ClientDeskBucket/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.substring(idx + marker.length));
}
