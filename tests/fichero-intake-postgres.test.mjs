import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { handlePlatformRequestPost, persistPlatformRequest } from '../src/lib/platform-requests/public-api.mjs'

const enabled = Boolean(process.env.WF_SUPPORT_TEST_DATABASE_URL)

test('both web forms persist one request each and produce only reviewed drafts', { skip: !enabled }, async () => {
  const { Client } = await import('pg')
  const db = new Client({ connectionString: process.env.WF_SUPPORT_TEST_DATABASE_URL })
  const adminId = randomUUID()
  const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()
  const received = []
  await db.connect()
  try {
    await db.query('insert into auth.users (id, email) values ($1, $2)', [adminId, `${adminId}@fichero.test`])
    await db.query('insert into public.profiles (id, email, role) values ($1, $2, $3) on conflict (id) do update set role = excluded.role', [adminId, `${adminId}@fichero.test`, 'admin'])
    const supabase = {
      from(table) {
        assert.equal(table, 'platform_requests')
        return {
          async insert(payload) {
            try {
              await db.query(`insert into public.platform_requests
                (platform, request_type, name, email, phone, company, profile_data, message, source_url, fingerprint)
                values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
              [payload.platform, payload.request_type, payload.name, payload.email, payload.phone, payload.company,
                payload.profile_data, payload.message, payload.source_url, payload.fingerprint])
              return { error: null }
            } catch (error) { return { error: { code: error.code } } }
          },
          select() {
            const filters = {}
            return {
              eq(key, value) { filters[key] = value; return this },
              async maybeSingle() {
                const rows = await db.query('select id,status from public.platform_requests where fingerprint=$1 and status=$2', [filters.fingerprint, filters.status])
                return { data: rows.rows[0] ?? null, error: null }
              },
            }
          },
        }
      },
    }
    const options = origin => ({
      env: { NODE_ENV: 'production', NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'test-site', TURNSTILE_SECRET_KEY: 'test-secret' },
      verifyToken: async () => ({ success: true, hostname: new URL(origin).hostname }),
      createRequest: payload => persistPlatformRequest(supabase, payload),
    })
    async function submit(origin, platform, index) {
      const slug = `fichero-api-${suffix.toLowerCase()}-${index}`
      const body = {
        platform, requestType: 'business', name: 'Contacto Test', email: `${slug}@example.test`, phone: '600000000',
        company: 'Empresa Test', message: '', sourceUrl: `${origin}/registrar`, website: '', token: 'test-token',
        profile: { schema_version: 'fichero.v1', catalog: 'fuengirola', canonicalSlug: slug, displayName: 'Empresa Test',
          cif: `${index}${suffix}`, contactEmail: `${slug}@example.test`, categoryKey: 'servicios', categoryLabel: 'Servicios',
          neighborhoodKeys: ['centro'], services: ['Servicio'], schedule: [], photos: [], shortDescription: 'Prueba', plan: 'gratis' },
      }
      const req = new Request('https://admin.webfuengirola.com/api/platform-requests', {
        method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
      })
      return handlePlatformRequestPost(req, options(origin))
    }
    for (const [origin, platform, index] of [
      ['https://vivirenfuengirola.com', 'vivir-fuengirola-negocios', 'V'],
      ['https://conocefuengirola.com', 'conoce-fuengirola', 'C'],
    ]) {
      const first = await submit(origin, platform, index)
      assert.equal(first.status, 201)
      assert.equal((await first.json()).outcome, 'created')
      const repeated = await submit(origin, platform, index)
      assert.equal(repeated.status, 200)
      assert.equal((await repeated.json()).outcome, 'existing')
    }
    const pending = await db.query('select id,profile_data from public.platform_requests where email like $1 and status=$2', [`fichero-api-${suffix.toLowerCase()}-%@example.test`, 'pending'])
    assert.equal(pending.rowCount, 2)
    for (const row of pending.rows) {
      received.push(row.id)
      assert.deepEqual(row.profile_data.profile.neighborhoodKeys, ['centro'])
      assert.equal((await db.query('select count(*)::int as n from public.directory_profiles where source_request_id=$1', [row.id])).rows[0].n, 0)
      await db.query('begin')
      await db.query('set local role authenticated')
      await db.query("select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claim.role','authenticated',true)", [adminId])
      const approved = await db.query('select * from public.approve_directory_request($1)', [row.id])
      await db.query('commit')
      assert.equal(approved.rows[0].outcome, 'created_profile')
      const draft = (await db.query('select review_status,published_at from public.directory_profiles where source_request_id=$1', [row.id])).rows[0]
      assert.equal(draft.review_status, 'draft')
      assert.equal(draft.published_at, null)
    }
  } finally {
    await db.query('rollback')
    if (received.length) {
      await db.query('delete from public.directory_profiles where source_request_id = any($1::uuid[])', [received])
      await db.query('delete from public.platform_requests where id = any($1::uuid[])', [received])
    }
    await db.query('delete from public.profiles where id=$1', [adminId])
    await db.end()
  }
})
