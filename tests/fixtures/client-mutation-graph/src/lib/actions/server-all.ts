'use server'

type HiddenServerType = { ok: true }
export { type HiddenServerType }

export async function selectedFixtureAction() {
  return { ok: true }
}

export async function siblingFixtureAction() {
  return { ok: true }
}

export { reexportedFixtureAction } from './server-reexport'
export * from './server-star'

export default async function defaultSiblingFixtureAction() {
  return { ok: true }
}
