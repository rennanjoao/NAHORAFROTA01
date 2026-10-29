import { supabase } from "@/integrations/supabase/client";

export const PROOF_PHOTOS_BUCKET = "delivery-proofs";
const VIEW_TTL_SECONDS = 60 * 60;
const SIGNED_MARKER = `/storage/v1/object/sign/${PROOF_PHOTOS_BUCKET}/`;
const PUBLIC_MARKER = `/storage/v1/object/public/${PROOF_PHOTOS_BUCKET}/`;

/**
 * Caminho do arquivo no bucket de comprovantes a partir do valor gravado no banco
 * (link assinado, link publico ou o proprio caminho). null = nao e do bucket.
 */
export function proofPhotoPath(value: string | null | undefined): string | null {
  if (!value) return null;
  for (const marker of [SIGNED_MARKER, PUBLIC_MARKER]) {
    const index = value.indexOf(marker);
    if (index >= 0) {
      const path = value.slice(index + marker.length).split("?")[0];
      return path ? decodeURIComponent(path) : null;
    }
  }
  if (/^[a-z]+:/i.test(value) || value.startsWith("/")) return null;
  return value;
}

/**
 * Gera links novos para as fotos de comprovante/ocorrencia. Os links gravados
 * pelo app expiram (alguns em 1 hora), entao a tela sempre assina de novo.
 * Valores que nao sao do bucket voltam como estao.
 */
export async function resolveProofPhotoUrls(values: Array<string | null | undefined>): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  const pathsByValue = new Map<string, string>();

  for (const value of values) {
    if (!value || resolved.has(value) || pathsByValue.has(value)) continue;
    const path = proofPhotoPath(value);
    if (path) pathsByValue.set(value, path);
    else resolved.set(value, value);
  }

  const paths = [...new Set(pathsByValue.values())];
  if (paths.length === 0) return resolved;

  const { data, error } = await supabase.storage.from(PROOF_PHOTOS_BUCKET).createSignedUrls(paths, VIEW_TTL_SECONDS);
  const signedByPath = new Map<string, string>();
  if (!error) {
    for (const item of data || []) {
      if (item.path && item.signedUrl) signedByPath.set(item.path, item.signedUrl);
    }
  } else {
    console.warn("Nao foi possivel assinar as fotos de comprovante:", error);
  }

  for (const [value, path] of pathsByValue) {
    resolved.set(value, signedByPath.get(path) ?? value);
  }
  return resolved;
}

/** Copia dos registros com os campos de foto trocados por links validos. */
export async function withFreshProofPhotos<T extends object>(rows: T[], fields: Array<keyof T>): Promise<T[]> {
  const values = rows.flatMap((row) => fields.map((field) => row[field] as unknown as string | null));
  if (!values.some(Boolean)) return rows;
  const resolved = await resolveProofPhotoUrls(values);
  return rows.map((row) => {
    const copy = { ...row };
    for (const field of fields) {
      const value = row[field] as unknown as string | null;
      if (value) (copy as Record<keyof T, unknown>)[field] = resolved.get(value) ?? value;
    }
    return copy;
  });
}
