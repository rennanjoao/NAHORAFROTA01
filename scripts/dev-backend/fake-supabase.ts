/**
 * Fake mínimo do cliente admin do Supabase, em memória.
 * Cobre só o que as funções de checkout usam: from().insert/select/update/upsert/delete + eq/maybeSingle/single
 * e auth.admin.createUser/deleteUser. Usado pelo servidor de desenvolvimento e pelos testes.
 */
type Row = Record<string, unknown>;

export class FakeDb {
  tables: Record<string, Row[]> = { orders: [], tenants: [], profiles: [], user_roles: [], tenant_memberships: [], payment_history: [], platform_admins: [] };
  users: { id: string; email: string; password: string; user_metadata: Row }[] = [];
  seq = 0;

  uuid(): string {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  /** Tabelas com UNIQUE que o Postgres aplicaria. */
  private uniques: Record<string, string[][]> = {
    tenants: [["cnpj"], ["slug"]],
    profiles: [["id"]],
    user_roles: [["user_id", "role"]],
    tenant_memberships: [["tenant_id", "user_id"]],
    orders: [["id"]],
  };

  private checkUnique(table: string, row: Row, ignoreIndex = -1): string | null {
    for (const cols of this.uniques[table] ?? []) {
      const dup = (this.tables[table] ?? []).findIndex((r, i) => i !== ignoreIndex && cols.every((c) => r[c] !== undefined && r[c] === row[c]));
      if (dup >= 0) return `duplicate key value violates unique constraint "${table}_${cols.join("_")}_key"`;
    }
    return null;
  }

  client() {
    const db = this;
    const from = (table: string) => {
      db.tables[table] ??= [];
      type Op = { kind: "select" | "insert" | "update" | "upsert" | "delete"; payload?: Row; filters: [string, unknown][]; single?: "single" | "maybe"; failOnError?: boolean };
      const op: Op = { kind: "select", filters: [] };
      const run = () => {
        const rows = db.tables[table];
        const match = (r: Row) => op.filters.every(([k, v]) => r[k] === v);
        if (op.kind === "insert") {
          const row: Row = { id: db.uuid(), created_at: new Date().toISOString(), ...op.payload };
          const err = db.checkUnique(table, row);
          if (err) return { data: null, error: { message: err, code: "23505" } };
          rows.push(row);
          return { data: op.single ? row : [row], error: null };
        }
        if (op.kind === "upsert") {
          const row: Row = { ...op.payload };
          const conflictCols = (op as Op & { onConflict?: string }).onConflict?.split(",") ?? ["id"];
          const idx = rows.findIndex((r) => conflictCols.every((c) => r[c] === row[c]));
          if (idx >= 0) rows[idx] = { ...rows[idx], ...row };
          else {
            const full = { id: db.uuid(), ...row };
            const err = db.checkUnique(table, full);
            if (err) return { data: null, error: { message: err, code: "23505" } };
            rows.push(full);
          }
          return { data: null, error: null };
        }
        if (op.kind === "update") {
          let n = 0;
          rows.forEach((r, i) => {
            if (match(r)) {
              rows[i] = { ...r, ...op.payload };
              n++;
            }
          });
          return { data: null, error: null, count: n };
        }
        if (op.kind === "delete") {
          db.tables[table] = rows.filter((r) => !match(r));
          return { data: null, error: null };
        }
        const found = rows.filter(match);
        if (op.single === "single") return found.length === 1 ? { data: found[0], error: null } : { data: null, error: { message: `expected 1 row, got ${found.length}` } };
        if (op.single === "maybe") return found.length <= 1 ? { data: found[0] ?? null, error: null } : { data: null, error: { message: "multiple rows" } };
        return { data: found, error: null };
      };
      const builder: Record<string, unknown> = {
        select(_cols?: string) { if (op.kind === "select") op.kind = "select"; return builder; },
        insert(payload: Row) { op.kind = "insert"; op.payload = payload; return builder; },
        upsert(payload: Row, opts?: { onConflict?: string }) { op.kind = "upsert"; op.payload = payload; (op as Op & { onConflict?: string }).onConflict = opts?.onConflict; return builder; },
        update(payload: Row) { op.kind = "update"; op.payload = payload; return builder; },
        delete() { op.kind = "delete"; return builder; },
        eq(k: string, v: unknown) { op.filters.push([k, v]); return builder; },
        single() { op.single = "single"; return builder; },
        maybeSingle() { op.single = "maybe"; return builder; },
        then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) { return Promise.resolve().then(run).then(resolve, reject); },
      };
      return builder;
    };
    return {
      from,
      auth: {
        admin: {
          createUser: async ({ email, password, user_metadata }: { email: string; password: string; user_metadata?: Row }) => {
            if (db.users.some((u) => u.email === email)) return { data: { user: null }, error: { message: "A user with this email address has already been registered" } };
            const u = { id: db.uuid(), email, password, user_metadata: user_metadata ?? {} };
            db.users.push(u);
            return { data: { user: { id: u.id, email } }, error: null };
          },
          deleteUser: async (id: string) => {
            db.users = db.users.filter((u) => u.id !== id);
            return { data: null, error: null };
          },
          updateUserById: async (id: string, attrs: { password?: string; user_metadata?: Row }) => {
            const u = db.users.find((x) => x.id === id);
            if (!u) return { data: { user: null }, error: { message: "User not found" } };
            if (attrs.password) u.password = attrs.password;
            if (attrs.user_metadata) u.user_metadata = { ...u.user_metadata, ...attrs.user_metadata };
            return { data: { user: { id } }, error: null };
          },
        },
        /** Tokens de teste: "token:<user_id>". */
        getUser: async (token?: string) => {
          const id = String(token || "").replace(/^token:/, "");
          const u = db.users.find((x) => x.id === id);
          return u ? { data: { user: { id: u.id, email: u.email } }, error: null } : { data: { user: null }, error: { message: "invalid token" } };
        },
      },
    };
  }
}
