#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'

import { createClient } from '@supabase/supabase-js'

import { buildReconciliationReport } from '../src/lib/fichero/reconciliation.mjs'

function parseArguments(argv) {
  const args = { dryRun: false, apply: false, output: null, input: null, decisions: null }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--dry-run') args.dryRun = true
    else if (value === '--apply') args.apply = true
    else if (value === '--output') args.output = argv[++index]
    else if (value === '--input') args.input = argv[++index]
    else if (value === '--decisions') args.decisions = argv[++index]
    else throw new Error(`unknown_argument:${value}`)
  }
  if (args.dryRun === args.apply) throw new Error('choose_exactly_one_mode')
  if (!args.output) throw new Error('output_path_required')
  if (args.apply && !args.decisions) throw new Error('apply_requires_decisions')
  return args
}

const requiredEnvironment = env => ({
  panelUrl: env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
  panelKey: (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY)?.trim(),
  vivirUrl: env.VIVIR_FUENGIROLA_SUPABASE_URL?.trim(),
  vivirKey: env.VIVIR_FUENGIROLA_SUPABASE_SERVICE_ROLE_KEY?.trim(),
  conoceUrl: env.CONOCE_FUENGIROLA_SUPABASE_URL?.trim(),
  conoceKey: env.CONOCE_FUENGIROLA_SUPABASE_SERVICE_ROLE_KEY?.trim(),
})

function assertEnvironment(configuration) {
  if (Object.values(configuration).some(value => !value)) {
    throw new Error('reconciliation_configuration_missing')
  }
}

const client = (url, key, schema = 'public') => createClient(url, key, {
  db: { schema },
  auth: { autoRefreshToken: false, persistSession: false },
})

async function loadLiveDataset(configuration) {
  assertEnvironment(configuration)
  const panel = client(configuration.panelUrl, configuration.panelKey)
  const vivir = client(configuration.vivirUrl, configuration.vivirKey)
  const conoce = client(configuration.conoceUrl, configuration.conoceKey, 'conoce')

  const [profilesResult, linksResult, vivirResult, conoceResult] = await Promise.all([
    panel.from('directory_profiles').select('id,display_name,cif,website,contact_email'),
    panel.from('directory_profile_channels').select('profile_id,public_slug,directory_channels!inner(key)'),
    vivir.from('businesses').select('canonical_profile_id,slug,name,cif,website,contact_email,phone,category_slug,category_label,short_description,long_description,plan'),
    conoce.from('businesses').select('canonical_profile_id,slug,name,cif,website,contact_email,phone,category_slug,category,summary,description,plan'),
  ])
  for (const result of [profilesResult, linksResult, vivirResult, conoceResult]) {
    if (result.error) throw new Error('reconciliation_read_failed')
  }

  const slugsByProfile = new Map()
  for (const link of linksResult.data ?? []) {
    const channel = Array.isArray(link.directory_channels)
      ? link.directory_channels[0]?.key
      : link.directory_channels?.key
    if (!channel) continue
    const current = slugsByProfile.get(link.profile_id) ?? {}
    current[channel] = link.public_slug
    slugsByProfile.set(link.profile_id, current)
  }
  const canonicalProfiles = (profilesResult.data ?? []).map(profile => ({
    id: profile.id,
    displayName: profile.display_name,
    cif: profile.cif,
    website: profile.website,
    contactEmail: profile.contact_email,
    channelSlugs: slugsByProfile.get(profile.id) ?? {},
  }))
  const mapRow = (row, channelKey) => ({
    id: `${channelKey}:${row.slug}`,
    channelKey,
    canonicalProfileId: row.canonical_profile_id,
    slug: row.slug,
    name: row.name,
    cif: row.cif,
    website: row.website,
    contactEmail: row.contact_email,
    phone: row.phone,
    categoryKey: row.category_slug,
    categoryLabel: row.category_label ?? row.category,
    shortDescription: row.short_description ?? row.summary,
    longDescription: row.long_description ?? row.description,
    plan: row.plan,
  })
  return {
    canonicalProfiles,
    vivirBusinesses: (vivirResult.data ?? []).map(row => mapRow(row, 'vivir-fuengirola')),
    conoceBusinesses: (conoceResult.data ?? []).map(row => mapRow(row, 'conoce-fuengirola')),
  }
}

async function loadDataset(args, configuration) {
  if (args.input) return JSON.parse(await readFile(args.input, 'utf8'))
  return loadLiveDataset(configuration)
}

function decisionMap(document) {
  if (!document || !Array.isArray(document.decisions)) throw new Error('invalid_decisions_file')
  return new Map(document.decisions.map(decision => [`${decision.channelKey}:${decision.rowId}`, decision]))
}

function ensureConflictDecisions(report, decisions) {
  for (const item of [...report.ambiguous, ...report.conflict]) {
    if (!decisions.has(`${item.channelKey}:${item.rowId}`)) {
      throw new Error('apply_requires_decisions')
    }
  }
}

async function applyReconciliation(dataset, report, decisionsDocument, configuration) {
  assertEnvironment(configuration)
  const decisions = decisionMap(decisionsDocument)
  ensureConflictDecisions(report, decisions)
  const panel = client(configuration.panelUrl, configuration.panelKey)
  const destinations = {
    'vivir-fuengirola': client(configuration.vivirUrl, configuration.vivirKey),
    'conoce-fuengirola': client(configuration.conoceUrl, configuration.conoceKey, 'conoce'),
  }
  const { data: catalog, error: catalogError } = await panel
    .from('directory_catalogs')
    .select('id')
    .eq('key', 'fuengirola')
    .single()
  const { data: channels, error: channelsError } = await panel
    .from('directory_channels')
    .select('id,key')
    .eq('catalog_id', catalog?.id)
  if (catalogError || channelsError || !catalog) throw new Error('reconciliation_catalog_unavailable')
  const channelIds = new Map((channels ?? []).map(channel => [channel.key, channel.id]))
  const rows = [...dataset.vivirBusinesses, ...dataset.conoceBusinesses]
  const rowsByKey = new Map(rows.map(row => [`${row.channelKey}:${row.id}`, row]))
  let changesApplied = 0

  const automatic = report.matched.map(item => ({
    channelKey: item.channelKey,
    rowId: item.rowId,
    profileId: item.profileId,
  }))
  const explicit = [...decisions.values()]
  const actions = new Map(
    automatic.map(action => [`${action.channelKey}:${action.rowId}`, action]),
  )
  for (const action of explicit) {
    actions.set(`${action.channelKey}:${action.rowId}`, action)
  }
  for (const action of actions.values()) {
    const row = rowsByKey.get(`${action.channelKey}:${action.rowId}`)
    if (!row) throw new Error('decision_row_not_found')
    let profileId = action.profileId
    if (!profileId && action.createProfile) {
      const profile = action.createProfile
      const { data, error } = await panel.from('directory_profiles').insert({
        catalog_id: catalog.id,
        canonical_slug: profile.canonicalSlug ?? row.slug,
        display_name: profile.displayName ?? row.name,
        legal_name: profile.legalName ?? null,
        cif: profile.cif ?? row.cif ?? null,
        contact_email: profile.contactEmail ?? row.contactEmail ?? null,
        phone: profile.phone ?? row.phone ?? null,
        website: profile.website ?? row.website ?? null,
        category_key: profile.categoryKey ?? row.categoryKey,
        category_label: profile.categoryLabel ?? row.categoryLabel,
        neighborhood_keys: profile.neighborhoodKeys ?? [],
        short_description: profile.shortDescription ?? row.shortDescription ?? '',
        long_description: profile.longDescription ?? row.longDescription ?? '',
        plan: profile.plan ?? row.plan ?? 'gratis',
        review_status: 'draft',
      }).select('id').single()
      if (error || !data) throw new Error('canonical_profile_create_failed')
      profileId = data.id
    }
    if (!profileId) throw new Error('decision_profile_required')
    const channelId = channelIds.get(action.channelKey)
    if (!channelId) throw new Error('reconciliation_channel_unavailable')
    const { error: linkError } = await panel.from('directory_profile_channels').upsert({
      profile_id: profileId,
      channel_id: channelId,
      enabled: true,
      public_slug: row.slug,
      editorial_placement: false,
    }, { onConflict: 'profile_id,channel_id' })
    if (linkError) throw new Error('profile_channel_link_failed')
    const { error: destinationError } = await destinations[action.channelKey]
      .from('businesses')
      .update({ canonical_profile_id: profileId })
      .eq('slug', row.slug)
    if (destinationError) throw new Error('destination_link_failed')
    changesApplied += 1
  }
  return changesApplied
}

async function main() {
  const args = parseArguments(process.argv.slice(2))
  const configuration = requiredEnvironment(process.env)
  let dataset
  let configurationError = null
  try {
    dataset = await loadDataset(args, configuration)
  } catch (error) {
    if (args.apply) throw error
    configurationError = error instanceof Error ? error.message : 'reconciliation_read_failed'
    dataset = { canonicalProfiles: [], vivirBusinesses: [], conoceBusinesses: [] }
  }
  const report = buildReconciliationReport(dataset)
  if (configurationError) {
    report.invalid.push({ rowId: 'configuration', reason: configurationError })
    report.counts.invalid += 1
  }
  if (args.apply) {
    const decisions = JSON.parse(await readFile(args.decisions, 'utf8'))
    report.changesApplied = await applyReconciliation(dataset, report, decisions, configuration)
    report.dryRun = false
  }
  await writeFile(args.output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
  process.stdout.write(`${JSON.stringify({ counts: report.counts, dryRun: report.dryRun, changesApplied: report.changesApplied })}\n`)
}

main().catch(error => {
  const code = error instanceof Error ? error.message : 'reconciliation_failed'
  process.stderr.write(`${code}\n`)
  process.exitCode = 1
})
