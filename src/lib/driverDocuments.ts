import { supabase } from "@/integrations/supabase/client";

export const DRIVER_DOCUMENTS_BUCKET = "driver-documents";
export const MAX_DRIVER_DOCUMENT_BYTES = 10 * 1024 * 1024;

export type DriverDocumentType = "cnh" | "addressProof" | "vehicleDoc" | "trailerDoc";

/** Envia o arquivo para o bucket de documentos e registra em driver_documents. */
export async function uploadDriverDocument(params: {
  driverId: string;
  tenantId: string | null;
  type: DriverDocumentType;
  file: File;
}): Promise<{ path: string }> {
  const { driverId, tenantId, type, file } = params;
  if (file.size > MAX_DRIVER_DOCUMENT_BYTES) {
    throw new Error(`${file.name}: arquivo acima de 10MB.`);
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const path = `${driverId}/${type}/${Date.now()}-${safeName}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(DRIVER_DOCUMENTS_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (uploadError) throw uploadError;

  // driver_documents ainda nao esta nos tipos gerados do Supabase.
  const untypedClient = supabase as unknown as { from: (table: string) => ReturnType<typeof supabase.from> };
  const { error: upsertError } = await untypedClient
    .from("driver_documents")
    .upsert(
      {
        driver_id: driverId,
        document_type: type,
        file_name: file.name,
        file_path: uploadData.path,
        mime_type: file.type || null,
        file_size: file.size,
        tenant_id: tenantId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "driver_id,document_type" },
    );
  if (upsertError) throw upsertError;

  return { path: uploadData.path };
}
