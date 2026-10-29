// Rastreamento do funil de aquisicao (visita -> cadastro -> teste -> conversao).
// Os eventos vao para a RPC track_funnel_event, que aceita visitantes anonimos.

import { supabase } from "@/integrations/supabase/client";

export type FunnelEvent = "page_view" | "register_view" | "register_started" | "register_submitted";

const VISITOR_KEY = "nahorafrota:visitor-id";
const ATTRIBUTION_KEY = "nahorafrota:attribution";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/** Identificador anonimo e persistente do visitante neste navegador. */
export function getVisitorId(): string {
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const created = randomId();
    window.localStorage.setItem(VISITOR_KEY, created);
    return created;
  } catch {
    // Sem storage (aba anonima/bloqueada): id valido apenas nesta pagina.
    return randomId();
  }
}

/** Origem da primeira visita (UTMs + referrer), guardada para os eventos seguintes. */
function getAttribution(): Record<string, string> {
  try {
    const stored = window.localStorage.getItem(ATTRIBUTION_KEY);
    if (stored) return JSON.parse(stored);

    const params = new URLSearchParams(window.location.search);
    const attribution: Record<string, string> = {};
    UTM_KEYS.forEach((key) => {
      const value = params.get(key);
      if (value) attribution[key] = value.slice(0, 100);
    });
    if (document.referrer && !document.referrer.startsWith(window.location.origin)) {
      attribution.referrer = document.referrer.slice(0, 200);
    }
    window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
    return attribution;
  } catch {
    return {};
  }
}

export function trackFunnelEvent(event: FunnelEvent, metadata: Record<string, string | number | boolean> = {}) {
  try {
    const payload = {
      p_visitor_id: getVisitorId(),
      p_event: event,
      p_path: window.location.pathname,
      p_metadata: { ...getAttribution(), ...metadata },
    };
    // Fire-and-forget: analytics nunca deve travar a tela.
    void supabase.rpc("track_funnel_event", payload).then(
      ({ error }) => {
        if (error) console.debug("[funnel] evento nao registrado", error);
      },
      () => undefined,
    );
  } catch {
    // ignore
  }
}
