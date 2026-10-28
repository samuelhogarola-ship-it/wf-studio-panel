import pg from 'pg'

const { Client } = pg

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`
}

export function createLocalDataDb(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl })
  return {
    connect: () => client.connect(),
    query: (sql, values) => client.query(sql, values),
    close: () => client.end(),
  }
}

export async function collectLocalDataStatus({ db }) {
  const tableResult = await db.query(`
    select table_schema as schema, table_name as name
    from information_schema.tables
    where table_type = 'BASE TABLE'
      and (table_schema = 'public' or (table_schema = 'auth' and table_name in ('users', 'identities')))
    order by table_schema, table_name
  `)
  const tables = []
  for (const table of tableResult.rows) {
    const countResult = await db.query(`select count(*)::text as count from ${quoteIdentifier(table.schema)}.${quoteIdentifier(table.name)}`)
    tables.push({ schema: table.schema, name: table.name, count: Number(countResult.rows[0]?.count ?? 0) })
  }

  const migrationResult = await db.query('select version::text as version from supabase_migrations.schema_migrations order by version')
  const [clients, billingDocuments, expenses] = await Promise.all([
    db.query("select id::text as id, email from public.clients where lower(email) = 'cliente.demo@local.test' order by id"),
    db.query("select id::text as id, document_type, recipient_email from public.invoices where document_type = 'proposal' and lower(recipient_email) = 'prueba@local.test' order by id"),
    db.query("select id::text as id, supplier, concept from public.expenses where supplier = 'Prueba local WF-Panel' and lower(concept) like '%prueba local%' order by id"),
  ])

  return {
    migrations: migrationResult.rows.map((row) => String(row.version)),
    tables,
    demoSnapshot: {
      clients: clients.rows,
      billingDocuments: billingDocuments.rows,
      expenses: expenses.rows,
    },
  }
}
