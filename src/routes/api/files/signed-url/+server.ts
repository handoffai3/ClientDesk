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
