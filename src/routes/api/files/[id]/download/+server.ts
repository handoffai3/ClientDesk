import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';

export const GET: RequestHandler = async ({ params, request }) => {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw error(401, 'Missing or invalid Authorization header');
  }
  const token = authHeader.slice(7);

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) {
    throw error(401, 'Invalid token');
  }

  const fileId = params.id;

  const { data: file, error: fileErr } = await supabaseAdmin
    .from('files')
    .select('*, clients(id)')
    .eq('id', fileId)
    .single();

  if (fileErr || !file) {
    throw error(404, 'File not found');
  }

  // Determine caller role
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

  // Check lock status for clients
  if (isFileClient && !isAgencyOwner) {
    const locked = file.is_locked && !file.unlocked_at;
    if (locked) {
      throw error(403, 'File is locked');
    }
  }

  // Get the storage path
  const storagePath = file.file_path || extractPathFromUrl(file.file_url);
  if (!storagePath) {
    throw error(500, 'File path not available');
  }

  // Generate a 60-second signed URL
  const { data: signedData, error: signedErr } = await supabaseAdmin.storage
    .from('ClientDeskBucket')
    .createSignedUrl(storagePath, 60);

  if (signedErr || !signedData?.signedUrl) {
    throw error(500, 'Could not generate download URL');
  }

  return json({ url: signedData.signedUrl });
};

function extractPathFromUrl(url: string): string | null {
  if (!url) return null;
  // URL format: .../storage/v1/object/public/ClientDeskBucket/path/to/file
  const marker = '/ClientDeskBucket/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.substring(idx + marker.length));
}
