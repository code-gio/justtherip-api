import { getSupabaseAdmin } from '../lib/supabase.js';

export interface MediaFolder {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  breadcrumbs?: unknown[];
  created_at?: string;
  [key: string]: unknown;
}

export interface MediaAsset {
  id: string;
  user_id: string;
  folder_id: string | null;
  name?: string;
  url?: string;
  size?: number;
  description?: string;
  tags?: unknown[];
  created_at?: string;
  [key: string]: unknown;
}

export async function getFolders(
  userId: string,
  parentId: string | null
): Promise<MediaFolder[]> {
  const admin = getSupabaseAdmin();
  let query = admin.from('media_folders').select('*').eq('user_id', userId);
  if (parentId === null || parentId === undefined || parentId === '') {
    query = query.is('parent_id', null);
  } else {
    query = query.eq('parent_id', parentId);
  }
  const { data, error } = await query.order('name');
  if (error) throw new Error('Failed to fetch folders');
  return (data as MediaFolder[]) ?? [];
}

export interface CreateFolderParams {
  userId: string;
  name: string;
  parentId: string | null;
  breadcrumbs?: unknown[];
}

export async function createFolder(params: CreateFolderParams): Promise<{
  success: boolean;
  folder?: MediaFolder;
  error?: string;
  message?: string;
}> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('media_folders')
    .insert({
      user_id: params.userId,
      name: params.name,
      parent_id: params.parentId,
      breadcrumbs: params.breadcrumbs ?? [],
    })
    .select()
    .single();
  if (error) return { success: false, error: error.message, message: error.message };
  return { success: true, folder: data as MediaFolder };
}

export async function getMediaAssets(
  userId: string,
  folderId: string | null
): Promise<MediaAsset[]> {
  const admin = getSupabaseAdmin();
  let query = admin.from('media_assets').select('*').eq('user_id', userId);
  if (folderId !== null && folderId !== undefined && folderId !== '') {
    query = query.eq('folder_id', folderId);
  } else {
    query = query.is('folder_id', null);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw new Error('Failed to fetch assets');
  return (data as MediaAsset[]) ?? [];
}

export async function getMediaAsset(id: string): Promise<MediaAsset | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from('media_assets').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return data as MediaAsset;
}

export async function deleteMediaAsset(id: string): Promise<{ success: boolean; error?: string; message?: string }> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from('media_assets').delete().eq('id', id);
  if (error) return { success: false, error: error.message, message: error.message };
  return { success: true };
}

export async function getAssetCountForFolder(folderId: string): Promise<number> {
  const admin = getSupabaseAdmin();
  const { count, error } = await admin
    .from('media_assets')
    .select('*', { count: 'exact', head: true })
    .eq('folder_id', folderId);
  if (error) return 0;
  return count ?? 0;
}

export interface UploadMediaParams {
  userId: string;
  folderId: string | null;
  breadcrumbs?: unknown[];
  tags?: unknown[];
  description?: string;
  file: { buffer: Buffer; originalname: string; mimetype: string; size: number };
}

export async function uploadMedia(params: UploadMediaParams): Promise<{
  success: boolean;
  asset?: MediaAsset;
  error?: string;
  message?: string;
}> {
  const admin = getSupabaseAdmin();
  const path = `${params.userId}/${Date.now()}-${params.file.originalname}`;
  const { error: uploadError } = await admin.storage.from('media').upload(path, params.file.buffer, {
    contentType: params.file.mimetype,
    upsert: false,
  });
  if (uploadError) {
    return { success: false, error: uploadError.message, message: uploadError.message };
  }
  const { data: urlData } = admin.storage.from('media').getPublicUrl(path);
  const { data: asset, error } = await admin
    .from('media_assets')
    .insert({
      user_id: params.userId,
      folder_id: params.folderId,
      name: params.file.originalname,
      url: urlData.publicUrl,
      size: params.file.size,
      description: params.description ?? null,
      tags: params.tags ?? [],
      storage_path: path,
    })
    .select()
    .single();
  if (error) return { success: false, error: error.message, message: error.message };
  return { success: true, asset: asset as MediaAsset };
}
