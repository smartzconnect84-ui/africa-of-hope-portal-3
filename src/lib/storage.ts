import { supabase } from "@/integrations/supabase/client";

const MB = 1024 * 1024;

const AVATAR_BUCKET = "avatars";
const PROGRAM_IMAGE_BUCKET = "program-images";
const DOCUMENT_BUCKET = "documents";
const SITE_ASSETS_BUCKET = "site-assets";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
export const MAX_IMAGE_BYTES = 5 * MB;
export const MAX_DOCUMENT_BYTES = 10 * MB;

export const DOCUMENT_CATEGORIES = [
  "ID card",
  "Transcript",
  "Certificate",
  "CV / Resume",
  "Passport photo",
  "Other",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export interface ProfileDocument {
  path: string;
  name: string;
  category: DocumentCategory;
  size: number;
  uploadedAt: string;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

/** Returns an error message, or null when the file is acceptable. */
export function validateFile(file: File, types: string[], maxBytes: number): string | null {
  if (!types.includes(file.type)) return `"${file.name}" is not a supported file type.`;
  if (file.size > maxBytes) return `"${file.name}" is larger than ${formatBytes(maxBytes)}.`;
  return null;
}

function extension(file: File): string {
  const fromName = file.name.includes(".") ? file.name.split(".").pop() : "";
  return (fromName || file.type.split("/")[1] || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function safeName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 80) || "file";
}

/**
 * A missing bucket ("Bucket not found") or missing upload policies
 * ("row-level security") both mean the storage migration has not run yet.
 */
function explain(message: string): string {
  return /bucket not found|row-level security/i.test(message)
    ? "File storage is not set up yet. Ask an administrator to apply the latest database migration."
    : message;
}

async function uploadPublicImage(bucket: string, folder: string, file: File): Promise<string> {
  const path = `${folder}/${Date.now()}.${extension(file)}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type });
  if (error) throw new Error(explain(error.message));
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Removes every object in the folder except `keepUrl`. Best effort, never throws. */
async function pruneFolder(bucket: string, folder: string, keepUrl?: string) {
  try {
    const { data } = await supabase.storage.from(bucket).list(folder, { limit: 100 });
    const stale = (data ?? [])
      .map((o) => `${folder}/${o.name}`)
      .filter((path) => !keepUrl || !keepUrl.endsWith(path));
    if (stale.length) await supabase.storage.from(bucket).remove(stale);
  } catch {
    /* stale files are harmless */
  }
}

/** Uploads a new profile photo and returns its public URL. */
export const uploadAvatar = (userId: string, file: File) =>
  uploadPublicImage(AVATAR_BUCKET, userId, file);

/** Call after the profile row is saved so the previous photos can go. */
export const pruneAvatars = (userId: string, keepUrl?: string) =>
  pruneFolder(AVATAR_BUCKET, userId, keepUrl);

export const uploadProgramImage = (programId: string, file: File) =>
  uploadPublicImage(PROGRAM_IMAGE_BUCKET, programId, file);

export const pruneProgramImages = (programId: string, keepUrl?: string) =>
  pruneFolder(PROGRAM_IMAGE_BUCKET, programId, keepUrl);

/** Uploads a CMS image (logo, favicon, hero slide, section photo…) and returns its public URL. */
export const uploadSiteAsset = (folder: string, file: File) =>
  uploadPublicImage(SITE_ASSETS_BUCKET, folder, file);

// ── Personal documents (private bucket, "profiles/<uid>/<ts>__<category>__<name>") ──

const docFolder = (userId: string) => `profiles/${userId}`;
const SEP = "__";

function parseDocument(folder: string, name: string, size: number, createdAt: string): ProfileDocument {
  const [stamp, rawCategory, ...rest] = name.split(SEP);
  const category = DOCUMENT_CATEGORIES.find(
    (c) => safeName(c) === rawCategory,
  ) ?? "Other";
  const ts = Number(stamp);
  return {
    path: `${folder}/${name}`,
    name: rest.length ? rest.join(SEP) : name,
    category,
    size,
    uploadedAt: Number.isFinite(ts) && ts > 0 ? new Date(ts).toISOString() : createdAt,
  };
}

export async function listDocuments(userId: string): Promise<ProfileDocument[]> {
  const folder = docFolder(userId);
  const { data, error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .list(folder, { limit: 100 });
  if (error) throw new Error(explain(error.message));
  return (data ?? [])
    .filter((o) => o.id && o.name !== ".emptyFolderPlaceholder")
    .map((o) =>
      parseDocument(
        folder,
        o.name,
        Number((o.metadata as { size?: number } | null)?.size ?? 0),
        o.created_at ?? new Date().toISOString(),
      ),
    )
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function uploadDocument(
  userId: string,
  file: File,
  category: DocumentCategory,
): Promise<void> {
  const path = `${docFolder(userId)}/${Date.now()}${SEP}${safeName(category)}${SEP}${safeName(file.name)}`;
  const { error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(explain(error.message));
}

export async function documentUrl(path: string, download = false): Promise<string> {
  const name = path.split("/").pop()?.split(SEP).slice(2).join(SEP) || undefined;
  const { data, error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(path, 60 * 10, download ? { download: name ?? true } : undefined);
  if (error || !data) throw new Error(explain(error?.message ?? "Could not open the file"));
  return data.signedUrl;
}

export async function deleteDocument(path: string): Promise<void> {
  const { error } = await supabase.storage.from(DOCUMENT_BUCKET).remove([path]);
  if (error) throw new Error(explain(error.message));
}
