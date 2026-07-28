/**
 * Runs a .sql migration file against the Supabase Postgres database using a
 * direct connection string (SUPABASE_DB_URL). Needed for DDL (CREATE TABLE /
 * FUNCTION) that the PostgREST API key cannot perform.
 *
 * Set SUPABASE_DB_URL in .env.local (Supabase Dashboard → Project Settings →
 * Database → Connection string → URI, "Direct connection"):
 *   SUPABASE_DB_URL="postgresql://postgres:PASSWORD@db.<ref>.supabase.co:5432/postgres"
 *
 * Usage:
 *   node scripts/db-migrate.mjs scripts/migrate-add-batches.sql
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import dns from 'node:dns/promises'
import pg from 'pg'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function parseEnv(file) {
  const out = {}
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/)
      if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* ignore */
  }
  return out
}

const env = { ...parseEnv(path.join(ROOT, '.env.local')), ...process.env }
const dbUrl = env.SUPABASE_DB_URL
const sqlArg = process.argv[2] || 'scripts/migrate-add-batches.sql'
const sqlPath = path.isAbsolute(sqlArg) ? sqlArg : path.join(ROOT, sqlArg)

if (!sqlPath) {
  console.error('Usage: node scripts/db-migrate.mjs <path-to.sql>')
  process.exit(1)
}
/**
 * Resolve a working connection. Supabase exposes two paths:
 *   - direct  db.<ref>.supabase.co  (IPv6-only; unreachable on some networks)
 *   - pooler  aws-<n>-<region>.pooler.supabase.com  (IPv4; user postgres.<ref>)
 * We try the direct IPv6 host first, then probe the regional poolers until one
 * authenticates, so the caller doesn't need to know the project's region.
 */
const REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'ca-central-1', 'sa-east-1',
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-central-2', 'eu-north-1',
  'ap-south-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-southeast-3',
  'ap-northeast-1', 'ap-northeast-2',
]

async function tryConnect(config) {
  const client = new pg.Client({ ...config, connectionTimeoutMillis: 6000 })
  try {
    await client.connect()
    return client
  } catch (err) {
    await client.end().catch(() => {})
    return { error: err.message }
  }
}

async function connect() {
  const ssl = { rejectUnauthorized: false }

  if (dbUrl) {
    const c = await tryConnect({ connectionString: dbUrl, ssl })
    if (c instanceof pg.Client) return { client: c, via: 'SUPABASE_DB_URL' }
    throw new Error(`SUPABASE_DB_URL failed: ${c.error}`)
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const password = env.DB_PASSWORD
  if (!supabaseUrl || !password) {
    throw new Error('Set SUPABASE_DB_URL, or NEXT_PUBLIC_SUPABASE_URL + DB_PASSWORD in .env.local.')
  }
  const ref = new URL(supabaseUrl).hostname.split('.')[0]

  // 1) Direct IPv6.
  try {
    const [v6] = await dns.resolve6(`db.${ref}.supabase.co`)
    if (v6) {
      const c = await tryConnect({ host: v6, port: 5432, user: 'postgres', password, database: 'postgres', ssl })
      if (c instanceof pg.Client) return { client: c, via: 'direct-ipv6' }
    }
  } catch {
    /* ignore, fall through to pooler */
  }

  // 2) Regional poolers (IPv4). Session mode on 5432 supports DDL + functions.
  for (const prefix of ['aws-0', 'aws-1']) {
    for (const region of REGIONS) {
      const host = `${prefix}-${region}.pooler.supabase.com`
      try {
        await dns.resolve4(host)
      } catch {
        continue // region host doesn't exist
      }
      const c = await tryConnect({
        host,
        port: 5432,
        user: `postgres.${ref}`,
        password,
        database: 'postgres',
        ssl,
      })
      if (c instanceof pg.Client) return { client: c, via: host }
    }
  }

  throw new Error('Could not reach Supabase over the direct IPv6 host or any regional pooler.')
}

const sql = readFileSync(sqlPath, 'utf8')
const { client, via } = await connect()
console.log(`Connected via ${via}`)

try {
  await client.query(sql)
  console.log(`Applied ${sqlPath} successfully.`)
} catch (err) {
  console.error('Migration failed:', err.message)
  process.exit(1)
} finally {
  await client.end()
}
