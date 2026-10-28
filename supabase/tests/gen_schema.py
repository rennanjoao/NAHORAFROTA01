"""Generate a plain-Postgres schema from src/integrations/supabase/types.ts Row types.

Usage: gen_schema.py <types.ts> [table_to_skip ...]
Tables created by the migration under test must be skipped, so the generated
schema matches the database as it was before that migration.
"""
import re, sys
src = open(sys.argv[1]).read()
skip = set(sys.argv[2:])
tables_block = src[src.index("    Tables: {"):src.index("    Views: {")]
out = ["DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin','fleet_manager','dispatcher','viewer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;"]
for m in re.finditer(r"\n      (\w+): \{\n        Row: \{\n(.*?)\n        \}", tables_block, re.S):
    name, body = m.group(1), m.group(2)
    if name in skip:
        continue
    cols = []
    for line in body.splitlines():
        cm = re.match(r"\s+(\w+): (.+)$", line)
        if not cm:
            continue
        col, ts = cm.groups()
        nullable = "| null" in ts
        base = ts.replace("| null", "").strip()
        if "app_role" in base:
            typ = "public.app_role"
        elif base == "number":
            typ = "numeric"
        elif base == "boolean":
            typ = "boolean"
        elif base == "Json":
            typ = "jsonb"
        elif base.endswith("[]"):
            typ = "text[]"
        elif col == "id" or col.endswith("_id") or col in ("created_by", "updated_by", "performed_by", "paid_by", "imported_by", "recorded_by", "user_id"):
            typ = "uuid"
        elif col.endswith("_at") or col in ("last_update",):
            typ = "timestamptz"
        elif col.endswith("_date") or col in ("period_start", "period_end"):
            typ = "date"
        else:
            typ = "text"
        default = ""
        if col == "id":
            default = " PRIMARY KEY DEFAULT gen_random_uuid()" if typ == "uuid" else " PRIMARY KEY"
        elif col in ("created_at", "updated_at", "imported_at"):
            default = " DEFAULT now()"
        elif not nullable:
            default = {"numeric": " DEFAULT 0", "boolean": " DEFAULT false", "text": " DEFAULT ''", "jsonb": " DEFAULT '{}'"}.get(typ, "")
        cols.append(f"  {col} {typ}{'' if nullable or col == 'id' else ' NOT NULL'}{default}")
    out.append(f"CREATE TABLE IF NOT EXISTS public.{name} (\n" + ",\n".join(cols) + "\n);")
print("\n".join(out))
