import { supabase } from './supabase';

/**
 * Uploads a local file URI to Cloudflare R2 via a Supabase Edge Function
 * that generates a pre-signed PUT URL. Credentials never touch the mobile app.
 *
 * @param uri       Local file URI (from expo-image-picker, expo-document-picker, etc.)
 * @param key       Storage path/filename inside the bucket, e.g. "avatars/user_123.jpg"
 * @param contentType  MIME type, e.g. "image/jpeg"
 * @returns         The public URL of the uploaded object
 */
export async function uploadToR2(
  uri: string,
  key: string,
  contentType: string,
): Promise<string> {
  // 1. Get a pre-signed PUT URL from our edge function
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;

  const fnRes = await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/r2-presign`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      },
      body: JSON.stringify({ key, contentType }),
    },
  );

  if (!fnRes.ok) {
    const errText = await fnRes.text();
    throw new Error(`r2-presign failed: ${errText}`);
  }

  const { uploadUrl, publicUrl } = (await fnRes.json()) as {
    uploadUrl: string;
    publicUrl: string;
  };

  // 2. Fetch the local file as a blob
  const fileRes = await fetch(uri);
  const blob = await fileRes.blob();

  // 3. PUT directly to R2 using the pre-signed URL
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });

  if (!uploadRes.ok) {
    throw new Error(`R2 upload failed: ${uploadRes.status} ${uploadRes.statusText}`);
  }

  return publicUrl;
}

/**
 * Returns a short-lived signed GET URL so images/PDFs load in-app when the bucket is not public.
 * Falls back to the original URL if the edge function is unavailable or rejects the request.
 */
export async function getR2SignedViewUrl(publicFileUrl: string | null | undefined): Promise<string | null> {
  const u = publicFileUrl?.trim();
  if (!u) return null;

  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;
  if (!token) return u;

  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!base) return u;

  try {
    const fnRes = await fetch(`${base}/functions/v1/r2-presign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: anon,
      },
      body: JSON.stringify({ mode: 'get', publicUrl: u }),
    });
    if (!fnRes.ok) return u;
    const json = (await fnRes.json()) as { viewUrl?: string; error?: string };
    if (json.viewUrl) return json.viewUrl;
  } catch {
    // ignore
  }
  return u;
}

/**
 * Derive a MIME type from a file extension.
 */
export function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    pdf: 'application/pdf',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
  };
  return map[ext.toLowerCase()] ?? 'application/octet-stream';
}
