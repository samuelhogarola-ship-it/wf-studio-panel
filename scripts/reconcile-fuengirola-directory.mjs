#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'

import { createClient } from '@supabase/supabase-js'

import { buildReconciliationReport, prepareReconciliationActions } from '../src/lib/fichero/reconciliation.mjs'

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
    vivir.from('businesses').select('canonical_profile_id,slug,name,cif,website,contact_email,phone,category_slug,category_label,short_description,long_description,plan,status,publication_status,channel_enabled'),
    conoce.from('businesses').select('canonical_profile_id,slug,name,cif,website,contact_email,phone,category_slug,category,summary,description,plan,publication_status,channel_enabled'),
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
    isPublished: row.publication_status === 'published' && row.channel_enabled === true
      && (channelKey !== 'vivir-fuengirola' || row.status === 'publicado'),
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

async function applyReconciliation(dataset, report, decisionsDocument, configuration) {
  assertEnvironment(configuration)
  const actions = prepareReconciliationActions(dataset, report, decisionsDocument)
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

  for (const action of actions) {
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
    if (row.canonicalProfileId) {
      const { data: current, error: currentError } = await destinations[action.channelKey]
        .from('businesses').select('canonical_profile_id').eq('slug', row.slug).maybeSingle()
      if (currentError || current?.canonical_profile_id !== profileId) throw new Error('destination_link_failed_or_changed')
    }
    const { data: existingLink, error: lookupError } = await panel.from('directory_profile_channels')
      .select('public_slug').eq('profile_id', profileId).eq('channel_id', channelId).maybeSingle()
    if (lookupError) throw new Error('profile_channel_lookup_failed')
    if (existingLink && existingLink.public_slug !== row.slug) throw new Error('profile_channel_already_linked')
    if (!existingLink) {
      const { error: linkError } = await panel.from('directory_profile_channels').insert({
        profile_id: profileId, channel_id: channelId, enabled: true,
        public_slug: row.slug, category_slug: row.categoryKey || null, editorial_placement: false,
        last_publication_status: row.isPublished ? 'published' : null,
      })
      if (linkError) throw new Error('profile_channel_link_failed')
    }
    if (!row.canonicalProfileId) {
      const { data: linked, error: destinationError } = await destinations[action.channelKey]
        .from('businesses')
        .update({ canonical_profile_id: profileId })
        .eq('slug', row.slug).is('canonical_profile_id', null).select('slug')
      if (destinationError || linked?.length !== 1) throw new Error('destination_link_failed_or_changed')
    }
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
