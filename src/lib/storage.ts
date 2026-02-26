import { getSupabaseAdmin } from './supabase.js';

const AVATAR_SIGNED_URL_EXPIRY_SEC = 3600;

/**
 * Returns a signed URL for an avatar path in the "avatars" bucket.
 * If the path is null, empty, or already an absolute URL (e.g. external), returns null or the URL as-is.
 */
export async function getSignedAvatarUrl(
  avatarPath: string | null | undefined
): Promise<string | null> {
  if (!avatarPath || avatarPath.trim() === '') return null;
  if (avatarPath.startsWith('http')) return avatarPath;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from('avatars')
    .createSignedUrl(avatarPath, AVATAR_SIGNED_URL_EXPIRY_SEC);

  if (error) {
    console.error('Error creating signed avatar URL:', error);
    return null;
  }
  return data?.signedUrl ?? null;
}
