import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Se o usuario pode abrir/baixar os arquivos de documentos dos motoristas.
 * Somente o Super Admin (equipe NaHora) pode; a empresa envia e ve a lista,
 * mas o arquivo em si fica restrito (regra aplicada tambem no storage).
 */
export function useDriverDocumentsAccess() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["can-view-driver-documents", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("can_view_driver_documents", {});
      if (error) throw error;
      return data === true;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  return { canViewDocuments: query.data === true, isLoading: !!user && query.isLoading };
}
