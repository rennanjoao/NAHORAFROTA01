import { describe, expect, it } from "vitest";
import { fetchAllPages, SUPABASE_PAGE_SIZE } from "./supabasePaging";

function table(n: number) {
  const calls: number[] = [];
  const build = (from: number, to: number) => {
    calls.push(from);
    const data = Array.from({ length: Math.max(0, Math.min(n, to + 1) - from) }, (_, i) => from + i);
    return Promise.resolve({ data, error: null });
  };
  return { build, calls };
}

describe("fetchAllPages", () => {
  it("empresa pequena: uma chamada só", async () => {
    const t = table(120);
    expect(await fetchAllPages(t.build)).toHaveLength(120);
    expect(t.calls).toEqual([0]);
  });

  it("traz todas as linhas, sem repetir nem pular, em várias páginas", async () => {
    for (const n of [SUPABASE_PAGE_SIZE, SUPABASE_PAGE_SIZE + 1, 2 * SUPABASE_PAGE_SIZE, 4 * SUPABASE_PAGE_SIZE + 7, 9 * SUPABASE_PAGE_SIZE]) {
      const t = table(n);
      const rows = await fetchAllPages(t.build);
      expect(rows, `n=${n}`).toEqual(Array.from({ length: n }, (_, i) => i));
    }
  });

  it("páginas depois da primeira vão em paralelo (3 de cada vez)", async () => {
    const t = table(3 * SUPABASE_PAGE_SIZE + 10);
    await fetchAllPages(t.build);
    expect(t.calls).toEqual([0, 1000, 2000, 3000]);
  });

  it("respeita o limite de linhas", async () => {
    const t = table(10 * SUPABASE_PAGE_SIZE);
    expect(await fetchAllPages(t.build, 2 * SUPABASE_PAGE_SIZE)).toHaveLength(2 * SUPABASE_PAGE_SIZE);
  });

  it("erro em qualquer página sobe como erro", async () => {
    const build = (from: number) => Promise.resolve(from === 0 ? { data: Array(SUPABASE_PAGE_SIZE).fill(1), error: null } : { data: null, error: new Error("falhou") });
    await expect(fetchAllPages(build)).rejects.toThrow("falhou");
  });
});
