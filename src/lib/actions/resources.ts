'use server'
import { requireAdmin } from '@/lib/auth'
import { getOptionalSupportViewer } from '@/lib/support/portal-viewer'
import { SUPPORT_READ_ONLY_ACTION_RESULT } from '@/lib/support/read-only'
import { saveResource, type ResourceState } from '@/lib/resources/save'

export async function publishResource(_prev: ResourceState, form: FormData): Promise<ResourceState> {
  if (await getOptionalSupportViewer()) return SUPPORT_READ_ONLY_ACTION_RESULT
  const identity = await requireAdmin()
  return saveResource(form, String(form.get('clientId') || ''), identity.userId, false)
}
