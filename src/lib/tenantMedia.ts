import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/tenant";

/*
 * Imagens da empresa no bucket publico "tenant-media": logo (romaneio), foto do
 * motorista e foto do veiculo. Sempre na pasta da empresa ({tenant_id}/...), com nome
 * aleatorio; o banco so deixa a equipe da propria empresa enviar ou apagar.
 */
export type TenantMediaKind = "logo" | "drivers" | "vehicles";

const BUCKET = "tenant-media";
const MAX_EDGE: Record<TenantMediaKind, number> = { logo: 800, drivers: 640, vehicles: 1280 };
export const ACCEPTED_IMAGES = "image/png,image/jpeg,image/webp";

/** O navegador tem camera acessivel? (exige https ou localhost) */
export function canUseCamera() {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível abrir essa imagem."));
    };
    image.src = url;
  });
}

/** Reduz a imagem; logo mantem o fundo transparente (PNG), foto vira JPEG leve. */
export async function resizeImage(file: Blob, maxEdge: number, keepTransparency: boolean): Promise<Blob> {
  const image = await loadImage(file);
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("O navegador não conseguiu preparar a imagem.");
  const type = keepTransparency ? "image/png" : "image/jpeg";
  if (!keepTransparency) {
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Falha ao preparar a imagem."))), type, 0.82),
  );
}

/** Envia a imagem e devolve o link publico. */
export async function uploadTenantImage(kind: TenantMediaKind, file: Blob): Promise<string> {
  if (file.size > 15 * 1024 * 1024) throw new Error("Imagem muito grande. Escolha uma de até 15 MB.");
  const tenantId = await getCurrentTenantId();
  if (!tenantId) throw new Error("Empresa não encontrada. Entre de novo e tente outra vez.");
  const keepTransparency = kind === "logo" && file.type !== "image/jpeg";
  const blob = await resizeImage(file, MAX_EDGE[kind], keepTransparency);
  const path = `${tenantId}/${kind}/${crypto.randomUUID()}.${keepTransparency ? "png" : "jpg"}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
  if (error) throw new Error("Não foi possível enviar a imagem. Confira a internet e tente de novo.");
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Apaga uma imagem antiga do bucket (quando foi trocada). Falha nao atrapalha. */
export async function removeTenantImage(url: string | null | undefined) {
  const marker = `/object/public/${BUCKET}/`;
  const index = url?.indexOf(marker) ?? -1;
  if (!url || index < 0) return;
  await supabase.storage.from(BUCKET).remove([decodeURIComponent(url.slice(index + marker.length))]).catch(() => undefined);
}

/** Envia o logo e grava em tenants.logo_url. Devolve o link novo (null = removido). */
export async function saveCompanyLogo(file: Blob | null, previousUrl?: string | null): Promise<string | null> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) throw new Error("Empresa não encontrada. Entre de novo e tente outra vez.");
  const url = file ? await uploadTenantImage("logo", file) : null;
  const { error } = await supabase.from("tenants").update({ logo_url: url }).eq("id", tenantId);
  if (error) {
    void removeTenantImage(url);
    throw new Error("Não foi possível salvar o logo. Só o administrador da conta pode trocar.");
  }
  if (previousUrl && previousUrl !== url) void removeTenantImage(previousUrl);
  return url;
}
