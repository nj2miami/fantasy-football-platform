import { supabase } from "@/lib/supabase";
import { mapSupabaseError } from "@/api/supabaseCore";

async function uploadFile({ file, bucket = import.meta.env.VITE_SUPABASE_UPLOAD_BUCKET || "uploads", path } = {}) {
  if (!file) throw new Error("No file provided");
  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
  const storagePath = path || `${new Date().getFullYear()}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(bucket).upload(storagePath, file, { upsert: true });
  if (error) throw mapSupabaseError(error);
  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return {
    file_url: data.publicUrl,
    storage_path: storagePath,
    bucket,
  };
}

async function createFileSignedUrl({ bucket = import.meta.env.VITE_SUPABASE_UPLOAD_BUCKET || "uploads", path, expiresIn = 3600, file_url } = {}) {
  if (!path && file_url) return { signed_url: file_url };
  if (!path) throw new Error("Storage path is required");
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw mapSupabaseError(error);
  return { signed_url: data.signedUrl };
}

export const integrations = {
  Core: {
    UploadFile: uploadFile,
    UploadPrivateFile: uploadFile,
    CreateFileSignedUrl: createFileSignedUrl,
  },
};
