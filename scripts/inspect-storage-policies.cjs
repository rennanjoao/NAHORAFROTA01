const { Client } = require("pg");

const client = new Client({
  host: "db.mhnzhwqroyyxpbxrylax.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  const result = await client.query(`
    select policyname, cmd, roles, qual, with_check
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        qual like '%delivery-proofs%'
        or with_check like '%delivery-proofs%'
      )
    order by policyname
  `);

  console.log(JSON.stringify(result.rows, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
