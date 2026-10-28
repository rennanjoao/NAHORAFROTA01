const { Client } = require("pg");

const nfeNumber = process.argv[2];

if (!nfeNumber) {
  console.error("Usage: node scripts/inspect-invoice-occurrence.cjs <nfe-number>");
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

  const invoices = await client.query(
    `
      select id, nfe_number, status, occurrence_type, observation, manifest_id, driver_id, updated_at
      from public.invoices
      where nfe_number = $1
      order by updated_at desc
      limit 10
    `,
    [nfeNumber],
  );

  const invoiceIds = invoices.rows.map((invoice) => invoice.id);
  const deliveries = invoiceIds.length
    ? await client.query(
        `
          select id, invoice_id, driver_id, status, updated_at
          from public.deliveries
          where invoice_id = any($1::uuid[])
          order by updated_at desc nulls last
        `,
        [invoiceIds],
      )
    : { rows: [] };

  const deliveryIds = deliveries.rows.map((delivery) => delivery.id);
  const occurrencesByInvoice = invoiceIds.length
    ? await client.query(
        `
          select id, invoice_id, delivery_id, driver_id, type, description, photo_url, created_at
          from public.delivery_occurrences
          where invoice_id = any($1::uuid[])
          order by created_at desc
        `,
        [invoiceIds],
      )
    : { rows: [] };

  const occurrencesByDelivery = deliveryIds.length
    ? await client.query(
        `
          select id, invoice_id, delivery_id, driver_id, type, description, photo_url, created_at
          from public.delivery_occurrences
          where delivery_id = any($1::uuid[])
          order by created_at desc
        `,
        [deliveryIds],
      )
    : { rows: [] };

  console.log(
    JSON.stringify(
      {
        invoices: invoices.rows,
        deliveries: deliveries.rows,
        occurrencesByInvoice: occurrencesByInvoice.rows,
        occurrencesByDelivery: occurrencesByDelivery.rows,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => client.end());
