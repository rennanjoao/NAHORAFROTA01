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
  const load = async (from: number) => {
    const { data, error } = await buildPage(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) throw error;
    return data ?? [];
  };

  // Primeira pagina sozinha (a maioria das empresas cabe nela). Se vier cheia, as
  // seguintes vao em paralelo, de 3 em 3, em vez de uma depois da outra.
  const first = await load(0);
  rows.push(...first);
  if (first.length < SUPABASE_PAGE_SIZE) return rows;

  for (let from = SUPABASE_PAGE_SIZE; from < maxRows; from += 3 * SUPABASE_PAGE_SIZE) {
    const starts = [0, 1, 2].map((i) => from + i * SUPABASE_PAGE_SIZE).filter((f) => f < maxRows);
    const pages = await Promise.all(starts.map(load));
    for (const page of pages) {
      rows.push(...page);
      if (page.length < SUPABASE_PAGE_SIZE) return rows;
    }
  }

  return rows;
}
