const { Client } = require("pg");

const emailPattern = process.argv[2] || "";
const cpfPattern = process.argv[3] || "";

if (!emailPattern && !cpfPattern) {
  console.error("Usage: node scripts/check-driver-login.cjs <email-pattern> <cpf-digits-pattern>");
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

async function main() {
  await client.connect();

  const users = await client.query(
    `
      select id, email, created_at, email_confirmed_at, raw_user_meta_data
      from auth.users
      where lower(email) like lower($1)
      order by created_at desc
      limit 20
    `,
    [emailPattern],
  );

  const drivers = await client.query(
    `
      select id, user_id, email, name, cpf, phone, vehicle_plate, vehicle_type,
             status, tenant_id, created_at
      from public.drivers
      where lower(coalesce(email, '')) like lower($1)
         or regexp_replace(coalesce(cpf, ''), '[^0-9]', '', 'g') like $2
      order by created_at desc
      limit 20
    `,
    [emailPattern, cpfPattern],
  );

  console.log(JSON.stringify({ users: users.rows, drivers: drivers.rows }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
