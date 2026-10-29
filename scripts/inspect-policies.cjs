const { Client } = require("pg");

const table = process.argv[2];
if (!table) {
  console.error("Usage: node scripts/inspect-policies.cjs <table>");
  process.exit(1);
}

const client = new Client({
  host: "db.mhnzhwqroyyxpbxrylax.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

client
  .connect()
  .then(async () => {
    const result = await client.query(
      `select schemaname, tablename, policyname, cmd, qual, with_check
       from pg_policies
       where schemaname = 'public' and tablename = $1
       order by policyname`,
      [table]
    );
    console.log(JSON.stringify(result.rows, null, 2));
  })
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
