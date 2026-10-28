const fs = require("fs");
const { Client } = require("pg");

const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: node scripts/apply-sql-file.cjs <path-to-sql>");
  process.exit(1);
}

const sql = fs.readFileSync(filePath, "utf8");

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
  await client.query(sql);
  console.log(`Applied ${filePath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
