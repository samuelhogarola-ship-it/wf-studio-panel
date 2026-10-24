'use server'
import { requireClientMutationAccess } from '@/lib/support/portal-viewer'
import { isSupportReadOnlyError, SUPPORT_READ_ONLY_ACTION_RESULT } from '@/lib/support/read-only'
import { saveResource, type ResourceState } from '@/lib/resources/save'

export async function uploadClientPhoto(_prev: ResourceState, form: FormData): Promise<ResourceState> {
  let viewer
  try {
    viewer = await requireClientMutationAccess()
  } catch (error) {
    if (isSupportReadOnlyError(error)) return SUPPORT_READ_ONLY_ACTION_RESULT
    throw error
  }
  return saveResource(form, viewer.client.id, viewer.identity.userId, true)
}
