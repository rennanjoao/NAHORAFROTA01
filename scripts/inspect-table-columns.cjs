const { Client } = require("pg");

const tables = process.argv.slice(2);

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
  const result = await client.query(
    `
      select table_name, column_name, data_type
      from information_schema.columns
      where table_schema = 'public'
        and table_name = any($1::text[])
      order by table_name, ordinal_position
    `,
    [tables],
  );
  console.log(JSON.stringify(result.rows, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
