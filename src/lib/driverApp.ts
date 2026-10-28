import { supabase } from "@/integrations/supabase/client";

const IMAGE_MAX_EDGE = 1280;
const IMAGE_QUALITY = 0.72;

function loadImageFromObjectUrl(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Erro ao carregar imagem"));
    image.src = objectUrl;
  });
}

export function revokeObjectUrl(url?: string | null) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

export async function prepareImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageFromObjectUrl(objectUrl);
    const longestSide = Math.max(image.width, image.height);
    const scale = longestSide > IMAGE_MAX_EDGE ? IMAGE_MAX_EDGE / longestSide : 1;
    const targetWidth = Math.max(1, Math.round(image.width * scale));
    const targetHeight = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Navegador não conseguiu preparar a imagem");
    }

    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const compressedBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao compactar imagem"))),
        "image/jpeg",
        IMAGE_QUALITY,
      );
    });

    return new File(
      [compressedBlob],
      file.name.replace(/\.[^.]+$/, ".jpg"),
      { type: "image/jpeg", lastModified: Date.now() },
    );
  } finally {
    revokeObjectUrl(objectUrl);
  }
}

export async function getDriverTenantId(driverId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("drivers")
    .select("tenant_id")
    .eq("id", driverId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.tenant_id ?? null;
}

export async function getProofStorageOwnerId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user?.id) {
    throw new Error("Sessão expirada. Entre novamente para enviar a foto.");
  }

  return data.user.id;
}
