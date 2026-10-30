import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";

/*
 * Um canal de tempo real por tabela, compartilhado pelo painel inteiro.
 *
 * Antes cada bloco abria o proprio canal e recarregava tudo a cada mudanca: no Inicio,
 * uma entrega confirmada disparava umas 7 recargas pesadas ao mesmo tempo (o SLA de 6
 * meses tres vezes). Agora as mudancas de uma tabela sao agrupadas por alguns instantes
 * e cada interessado e avisado uma vez so.
 */
type Listener = () => void;
interface TableSub {
  channel: RealtimeChannel;
  listeners: Map<Listener, number>;
  timers: Map<Listener, ReturnType<typeof setTimeout>>;
}
const tables = new Map<string, TableSub>();

function notify(sub: TableSub) {
  sub.listeners.forEach((wait, listener) => {
    if (sub.timers.has(listener)) return; // ja agendado: a rajada vira uma recarga so
    sub.timers.set(listener, setTimeout(() => {
      sub.timers.delete(listener);
      listener();
    }, wait));
  });
}

/** Avisa `listener` quando `table` mudar, agrupando rajadas de `waitMs`. Devolve a funcao para sair. */
export function onTableChange(table: string, listener: Listener, waitMs = 1200): () => void {
  let sub = tables.get(table);
  if (!sub) {
    const created: TableSub = { channel: null as unknown as RealtimeChannel, listeners: new Map(), timers: new Map() };
    created.channel = supabase
      .channel(uniqueChannelName(`shared-${table}`))
      .on("postgres_changes", { event: "*", schema: "public", table }, () => notify(created))
      .subscribe();
    tables.set(table, created);
    sub = created;
  }
  sub.listeners.set(listener, waitMs);
  return () => {
    const s = tables.get(table);
    if (!s) return;
    s.listeners.delete(listener);
    const t = s.timers.get(listener);
    if (t) clearTimeout(t);
    s.timers.delete(listener);
    if (s.listeners.size === 0) {
      supabase.removeChannel(s.channel);
      tables.delete(table);
    }
  };
}

/** Hook: chama `onChange` (sempre a versao mais nova) quando alguma das tabelas mudar. */
export function useTableChanges(tablesToWatch: string[], onChange: () => void, waitMs = 1200) {
  const latest = useRef(onChange);
  latest.current = onChange;
  const key = tablesToWatch.join(",");
  useEffect(() => {
    const listener = () => latest.current();
    const offs = key.split(",").filter(Boolean).map((t) => onTableChange(t, listener, waitMs));
    return () => offs.forEach((off) => off());
  }, [key, waitMs]);
}
