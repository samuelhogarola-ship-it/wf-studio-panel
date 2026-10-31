import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'

const enabled = Boolean(process.env.WF_SUPPORT_TEST_DATABASE_URL)
const digest = value => createHash('sha256').update(value).digest('hex')

test('Postgres keeps business intake human-reviewed, draft-only and idempotent', { skip: !enabled }, async t => {
  const { Client } = await import('pg')
  const db = new Client({ connectionString: process.env.WF_SUPPORT_TEST_DATABASE_URL })
  const adminId = randomUUID()
  const clientId = randomUUID()
  const requestId = randomUUID()
  const rejectedRequestId = randomUUID()
  const requestIds = [requestId, rejectedRequestId]

  const queryAs = async (role, uid, sql, params = []) => {
    await db.query('begin')
    try {
      await db.query(`set local role ${role}`)
      await db.query(
        "select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', $2, true), set_config('request.jwt.claims', $3, true)",
        [uid, role, JSON.stringify({ sub: uid, role })],
      )
      const result = await db.query(sql, params)
      await db.query('commit')
      return result
    } catch (error) {
      await db.query('rollback')
      throw error
    }
  }

  const profile = (slug, cif) => ({
    canonicalSlug: slug,
    legalName: 'Directorio Fuengirola SL',
    displayName: 'Directorio Fuengirola',
    cif,
    contactEmail: `${slug}@example.test`,
    phone: '+34952000000',
    whatsapp: null,
    website: `https://${slug}.example.test`,
    address: 'Calle Test 1, Fuengirola',
    latitude: 36.539,
    longitude: -4.624,
    categoryKey: 'servicios',
    categoryLabel: 'Servicios',
    neighborhoodKeys: ['centro'],
    shortDescription: 'Ficha de prueba',
    longDescription: 'Ficha de prueba para verificar el flujo editorial.',
    seoTitle: null,
    seoDescription: null,
    services: ['Servicio uno'],
    schedule: ['L-V 09:00-18:00'],
    photos: [],
    plan: 'gratis',
  })

  const insertRequest = async (id, slug, cif) => {
    const payload = {
      schema_version: 'fichero.v1',
      catalog: 'fuengirola',
      profile: profile(slug, cif),
      identity: { cif, email: `${slug}@example.test`, domain: `${slug}.example.test`, name: 'directorio fuengirola' },
    }
    await db.query(
      `insert into public.platform_requests
       (id, platform, request_type, name, email, company, profile_data, fingerprint)
       values ($1, 'vivir-fuengirola-negocios', 'business', 'Directorio Fuengirola', $2, 'Directorio Fuengirola SL', $3, $4)`,
      [id, `${slug}@example.test`, payload, digest(`business|fuengirola|cif:${cif}`)],
    )
  }

  await db.connect()
  try {
    for (const [id, role] of [[adminId, 'admin'], [clientId, 'client']]) {
      await db.query('insert into auth.users (id, email) values ($1, $2)', [id, `${id}@fichero.test`])
      await db.query(
        'insert into public.profiles (id, email, role) values ($1, $2, $3) on conflict (id) do update set role = excluded.role',
        [id, `${id}@fichero.test`, role],
      )
    }
    await insertRequest(requestId, `draft-${requestId}`, `B${requestId.replaceAll('-', '').slice(0, 8)}`)
    await insertRequest(rejectedRequestId, `rejected-${rejectedRequestId}`, `B${rejectedRequestId.replaceAll('-', '').slice(0, 8)}`)

    await t.test('clients and anonymous callers cannot approve', async () => {
      await assert.rejects(
        queryAs('authenticated', clientId, 'select * from public.approve_directory_request($1)', [requestId]),
        /administrator access required/i,
      )
      await assert.rejects(
        queryAs('anon', '', 'select * from public.approve_directory_request($1)', [requestId]),
        error => error.code === '42501',
      )
    })

    let profileId
    await t.test('approval creates one canonical draft across both channels without publishing', async () => {
      const result = await queryAs(
        'authenticated',
        adminId,
        'select * from public.approve_directory_request($1)',
        [requestId],
      )
      assert.equal(result.rows[0].outcome, 'created_profile')
      profileId = result.rows[0].profile_id

      const stored = await db.query(
        `select p.review_status, p.plan, p.approved_at, p.published_at,
                r.status as request_status, r.reviewed_by,
                count(distinct c.channel_id)::int as channel_count,
                count(distinct review.id)::int as review_count,
                bool_or(c.editorial_placement) as has_editorial_placement
         from public.directory_profiles p
         join public.platform_requests r on r.id = p.source_request_id
         left join public.directory_profile_channels c on c.profile_id = p.id
         left join public.directory_profile_reviews review on review.profile_id = p.id
         where p.id = $1
         group by p.id, r.id`,
        [profileId],
      )
      assert.deepEqual(stored.rows[0], {
        review_status: 'draft',
        plan: 'gratis',
        approved_at: null,
        published_at: null,
        request_status: 'approved',
        reviewed_by: adminId,
        channel_count: 2,
        review_count: 1,
        has_editorial_placement: false,
      })
    })

    await t.test('repeated approval returns the same profile and creates no duplicate rows', async () => {
      const repeated = await queryAs(
        'authenticated',
        adminId,
        'select * from public.approve_directory_request($1)',
        [requestId],
      )
      assert.deepEqual(repeated.rows[0], { outcome: 'existing_profile', profile_id: profileId })
      assert.equal((await db.query('select count(*)::int as count from public.directory_profiles where source_request_id = $1', [requestId])).rows[0].count, 1)
      assert.equal((await db.query('select count(*)::int as count from public.directory_profile_channels where profile_id = $1', [profileId])).rows[0].count, 2)
      assert.equal((await db.query('select count(*)::int as count from public.directory_profile_reviews where profile_id = $1', [profileId])).rows[0].count, 1)
    })

    await t.test('publication preparation increments once and channel results remain independent and retryable', async () => {
      const reviewed = await queryAs('authenticated', adminId, "select public.review_directory_profile($1, 'approved', $2) as status", [profileId, 'Revisión editorial completada'])
      assert.equal(reviewed.rows[0].status, 'approved')
      assert.equal((await db.query('select count(*)::int as count from public.directory_profile_reviews where profile_id = $1', [profileId])).rows[0].count, 2)
      const current = (await db.query('select updated_at::text as updated_at from public.directory_profiles where id = $1', [profileId])).rows[0]
      const links = (await db.query(
        `select link.channel_id, channel.key
         from public.directory_profile_channels link
         join public.directory_channels channel on channel.id = link.channel_id
         where link.profile_id = $1 order by channel.key`,
        [profileId],
      )).rows
      const projections = links.map((link, index) => ({
        channelId: link.channel_id,
        channelKey: link.key,
        publicSlug: `draft-${requestId}`,
        payloadHash: String(index + 1).repeat(64),
      }))
      const prepared = await queryAs(
        'authenticated',
        adminId,
        'select * from public.prepare_directory_publication($1, $2, $3)',
        [profileId, current.updated_at, JSON.stringify(projections)],
      )
      assert.equal(prepared.rowCount, 2)
      assert.deepEqual(new Set(prepared.rows.map(row => row.source_version)), new Set(['1']))
      assert.deepEqual(new Set(prepared.rows.map(row => row.status)), new Set(['pending']))

      const refreshed = (await db.query('select content_version, review_status, updated_at::text as updated_at from public.directory_profiles where id = $1', [profileId])).rows[0]
      assert.equal(refreshed.content_version, '1')
      assert.equal(refreshed.review_status, 'approved')
      const repeated = await queryAs(
        'authenticated',
        adminId,
        'select * from public.prepare_directory_publication($1, $2, $3)',
        [profileId, refreshed.updated_at, JSON.stringify(projections)],
      )
      assert.deepEqual(repeated.rows.map(row => row.event_id).sort(), prepared.rows.map(row => row.event_id).sort())
      assert.equal((await db.query('select count(*)::int as count from public.directory_publication_events where profile_id = $1', [profileId])).rows[0].count, 2)

      const [failedEvent, publishedEvent] = prepared.rows
      assert.equal((await queryAs('authenticated', adminId, 'select public.begin_directory_publication_event($1) as claimed', [publishedEvent.event_id])).rows[0].claimed, true)
      assert.equal((await queryAs('authenticated', adminId, "select public.finish_directory_publication_event($1, 'published', $2, null, null) as finished", [publishedEvent.event_id, 'remote-published'])).rows[0].finished, true)
      assert.equal((await queryAs('authenticated', adminId, 'select public.begin_directory_publication_event($1) as claimed', [failedEvent.event_id])).rows[0].claimed, true)
      assert.equal((await queryAs('authenticated', adminId, "select public.finish_directory_publication_event($1, 'failed', null, $2, $3) as finished", [failedEvent.event_id, 'destination_unavailable', 'No se pudo completar la publicación.'])).rows[0].finished, true)

      const states = (await db.query('select status from public.directory_publication_events where profile_id = $1 order by status', [profileId])).rows.map(row => row.status)
      assert.deepEqual(states, ['failed', 'published'])
      const afterPartial = (await db.query('select review_status, published_at from public.directory_profiles where id = $1', [profileId])).rows[0]
      assert.equal(afterPartial.review_status, 'approved')
      assert.ok(afterPartial.published_at instanceof Date)

      assert.equal((await queryAs('authenticated', adminId, 'select public.begin_directory_publication_event($1) as claimed', [failedEvent.event_id])).rows[0].claimed, true)
      await queryAs('authenticated', adminId, "select public.finish_directory_publication_event($1, 'published', $2, null, null)", [failedEvent.event_id, 'remote-retried'])
      assert.equal((await db.query('select count(*)::int as count from public.directory_publication_events where profile_id = $1 and status = $2', [profileId, 'published'])).rows[0].count, 2)
      assert.equal((await db.query('select count(*)::int as count from public.directory_publication_events where profile_id = $1', [profileId])).rows[0].count, 2)
    })

    await t.test('editing and reapproving creates a new publication version', async () => {
      const links = (await db.query(
        `select link.channel_id, channel.key from public.directory_profile_channels link
         join public.directory_channels channel on channel.id = link.channel_id
         where link.profile_id = $1 order by channel.key`, [profileId],
      )).rows
      const projections = links.map((link, index) => ({
        channelId: link.channel_id, channelKey: link.key, publicSlug: `draft-${requestId}`,
        payloadHash: String(index + 3).repeat(64),
      }))
      const before = (await db.query('select approved_at::text as approved_at from public.directory_profiles where id = $1', [profileId])).rows[0]
      await queryAs('authenticated', adminId, "select public.review_directory_profile($1, 'approved', null)", [profileId])
      const repeated = (await db.query('select approved_at::text as approved_at from public.directory_profiles where id = $1', [profileId])).rows[0]
      assert.equal(repeated.approved_at, before.approved_at)

      await db.query("update public.directory_profiles set display_name = 'Ficha editada', review_status = 'draft', approved_at = null, approved_by = null where id = $1", [profileId])
      await queryAs('authenticated', adminId, "select public.review_directory_profile($1, 'approved', null)", [profileId])
      const current = (await db.query('select updated_at::text as updated_at from public.directory_profiles where id = $1', [profileId])).rows[0]
      const next = await queryAs('authenticated', adminId,
        'select * from public.prepare_directory_publication($1, $2, $3)',
        [profileId, current.updated_at, JSON.stringify(projections)])
      assert.equal(next.rowCount, 2)
      assert.deepEqual(new Set(next.rows.map(row => row.source_version)), new Set(['2']))
      assert.deepEqual(new Set(next.rows.map(row => row.status)), new Set(['pending']))
      assert.equal((await db.query('select count(*)::int as count from public.directory_publication_events where profile_id = $1', [profileId])).rows[0].count, 4)
    })

    await t.test('confirmed disabling prepares and records withdrawal from both channels', async () => {
      const pending = (await db.query('select id from public.directory_publication_events where profile_id=$1 and source_version=2', [profileId])).rows
      for (const event of pending) {
        await queryAs('authenticated', adminId, 'select public.begin_directory_publication_event($1)', [event.id])
        await queryAs('authenticated', adminId, "select public.finish_directory_publication_event($1, 'published', 'remote', null, null)", [event.id])
      }
      await db.query("update public.directory_profiles set review_status='draft',approved_at=null,approved_by=null where id=$1", [profileId])
      await db.query('update public.directory_profile_channels set enabled=false, editorial_placement=false where profile_id=$1', [profileId])
      await queryAs('authenticated', adminId, "select public.review_directory_profile($1, 'approved', null)", [profileId])
      const current = (await db.query('select updated_at::text as updated_at from public.directory_profiles where id=$1', [profileId])).rows[0]
      const links = (await db.query(`select link.channel_id,channel.key,link.public_slug from public.directory_profile_channels link
        join public.directory_channels channel on channel.id=link.channel_id where link.profile_id=$1 order by channel.key`, [profileId])).rows
      const projections = links.map((link, index) => ({ channelId: link.channel_id, channelKey: link.key,
        publicSlug: link.public_slug, payloadHash: String(index + 5).repeat(64) }))
      const prepared = await queryAs('authenticated', adminId, 'select * from public.prepare_directory_publication($1,$2,$3)', [profileId, current.updated_at, JSON.stringify(projections)])
      assert.equal(prepared.rowCount, 2)
      assert.deepEqual(new Set(prepared.rows.map(row => row.source_version)), new Set(['3']))
      for (const event of prepared.rows) {
        assert.equal((await queryAs('authenticated', adminId, 'select public.begin_directory_publication_event($1) as claimed', [event.event_id])).rows[0].claimed, true)
        await queryAs('authenticated', adminId, "select public.finish_directory_publication_event($1, 'withdrawn', 'remote', null, null)", [event.event_id])
      }
      const stored = await db.query('select enabled,last_publication_status from public.directory_profile_channels where profile_id=$1', [profileId])
      assert.deepEqual(stored.rows.map(row => [row.enabled,row.last_publication_status]), [[false,'withdrawn'],[false,'withdrawn']])
      const after = (await db.query('select updated_at::text as updated_at from public.directory_profiles where id=$1', [profileId])).rows[0]
      const repeat = await queryAs('authenticated', adminId, 'select * from public.prepare_directory_publication($1,$2,$3)', [profileId, after.updated_at, JSON.stringify(projections)])
      assert.deepEqual(new Set(repeat.rows.map(row => row.status)), new Set(['withdrawn']))
    })

    await t.test('rejection records the human decision and never creates a profile', async () => {
      const rejected = await queryAs(
        'authenticated',
        adminId,
        'select public.reject_platform_request($1, $2) as rejected',
        [rejectedRequestId, 'Datos insuficientes'],
      )
      assert.equal(rejected.rows[0].rejected, true)
      const request = (await db.query('select status, rejection_reason, reviewed_by, reviewed_at from public.platform_requests where id = $1', [rejectedRequestId])).rows[0]
      assert.equal(request.status, 'rejected')
      assert.equal(request.rejection_reason, 'Datos insuficientes')
      assert.equal(request.reviewed_by, adminId)
      assert.ok(request.reviewed_at instanceof Date)
      assert.equal((await db.query('select count(*)::int as count from public.directory_profiles where source_request_id = $1', [rejectedRequestId])).rows[0].count, 0)
    })
  } finally {
    await db.query('rollback')
    try {
      await db.query('delete from public.directory_profiles where source_request_id = any($1::uuid[])', [requestIds])
      await db.query('delete from public.platform_requests where id = any($1::uuid[])', [requestIds])
      await db.query('delete from public.profiles where id = any($1::uuid[])', [[adminId, clientId]])
      // auth.users are intentionally left to the disposable database: other
      // append-only audit tables may still reference the acting administrator.
    } finally {
      await db.end()
    }
  }
})
