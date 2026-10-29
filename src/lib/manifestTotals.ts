import { supabase } from "@/integrations/supabase/client";

/**
 * Recalcula quantidade, valor e peso do romaneio pelas NFs vinculadas. No frete
 * "fixo por NF" o valor do frete acompanha a quantidade de NFs.
 */
export async function recalculateManifestTotals(manifestId: string): Promise<boolean> {
  try {
    const [{ data: invoices, error: fetchError }, { data: current, error: manifestFetchError }] = await Promise.all([
      supabase.from("invoices").select("total_value, total_weight").eq("manifest_id", manifestId),
      supabase
        .from("manifests")
        .select("deliveries_count, freight_type, freight_value, is_own_fleet")
        .eq("id", manifestId)
        .maybeSingle(),
    ]);

    if (fetchError) throw fetchError;
    if (manifestFetchError) throw manifestFetchError;

    const deliveriesCount = invoices?.length || 0;
    const totalValue = invoices?.reduce((sum, inv) => sum + (inv.total_value || 0), 0) || 0;
    const totalWeight = invoices?.reduce((sum, inv) => sum + (inv.total_weight || 0), 0) || 0;

    const updates: Record<string, unknown> = {
      deliveries_count: deliveriesCount,
      total_value: totalValue,
      total_weight: totalWeight,
      updated_at: new Date().toISOString(),
    };

    const previousCount = Number(current?.deliveries_count) || 0;
    if (
      current &&
      !current.is_own_fleet &&
      current.freight_type === "fixed" &&
      previousCount > 0 &&
      previousCount !== deliveriesCount
    ) {
      const unitValue = (Number(current.freight_value) || 0) / previousCount;
      updates.freight_value = Math.round(unitValue * deliveriesCount * 100) / 100;
    }

    const { error: updateError } = await supabase.from("manifests").update(updates).eq("id", manifestId);
    if (updateError) throw updateError;

    return true;
  } catch (err) {
    console.error("Error updating manifest totals:", err);
    return false;
  }
}
