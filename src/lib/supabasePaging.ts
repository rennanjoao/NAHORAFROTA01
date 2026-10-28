// O PostgREST do Supabase devolve no maximo 1000 linhas por requisicao.
// Para relatorios e historicos, buscamos pagina a pagina ate acabar.

export const SUPABASE_PAGE_SIZE = 1000;
const DEFAULT_MAX_ROWS = 50000;

type PageResult<T> = { data: T[] | null; error: unknown };

/**
 * `buildPage(from, to)` deve devolver a consulta com `.range(from, to)` e uma
 * ordenacao estavel (ex.: por data e id), para nao pular nem repetir linhas.
 */
export async function fetchAllPages<T>(
  buildPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  maxRows: number = DEFAULT_MAX_ROWS,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; from < maxRows; from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await buildPage(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < SUPABASE_PAGE_SIZE) break;
  }

  return rows;
}
