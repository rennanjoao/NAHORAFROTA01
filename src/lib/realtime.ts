/**
 * Nome de canal unico por assinatura. O supabase-js devolve o canal ja existente
 * quando o nome se repete: dois componentes com o mesmo hook dividiam o canal e,
 * quando um desmontava, o outro parava de receber as atualizacoes.
 * (Nao usar em canais de presenca/broadcast, que precisam do mesmo nome entre clientes.)
 */
export function uniqueChannelName(base: string): string {
  return `${base}-${Math.random().toString(36).slice(2, 10)}`;
}
