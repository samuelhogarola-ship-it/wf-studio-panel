declare module '@/lib/fichero/publication/adapter.mjs' {
  import type { CanonicalPublicationSnapshot, DirectoryChannelKey, PublicationAdapter, PublicationChannel, PublicationProjection } from '@/lib/fichero/publication/types'

  export class PublicationAdapterError extends Error {
    code: string
    constructor(code: string, message: string)
  }
  export function safePublicationError(error: unknown): { code: string; message: string }
  export function createSupabaseChannelAdapter(input: {
    channelKey: DirectoryChannelKey
    schema: string
    table: string
    client: unknown
    map: (snapshot: CanonicalPublicationSnapshot, channel: PublicationChannel, sourceVersion: number) => PublicationProjection
  }): PublicationAdapter
}

declare module '@/lib/fichero/publication/map-vivir.mjs' {
  import type { CanonicalPublicationSnapshot, ChannelProjection, PublicationChannel, VivirChannelProjection } from '@/lib/fichero/publication/types'
  export function mapCanonicalPublication(snapshot: CanonicalPublicationSnapshot, channel: PublicationChannel, sourceVersion: number): ChannelProjection
  export function mapVivirPublication(snapshot: CanonicalPublicationSnapshot, channel: PublicationChannel, sourceVersion: number): VivirChannelProjection
}

declare module '@/lib/fichero/publication/map-conoce.mjs' {
  import type { CanonicalPublicationSnapshot, ChannelProjection, PublicationChannel } from '@/lib/fichero/publication/types'
  export function mapConocePublication(snapshot: CanonicalPublicationSnapshot, channel: PublicationChannel, sourceVersion: number): ChannelProjection
}

declare module '@/lib/fichero/publication/publish.mjs' {
  import type { DirectoryChannelKey, PublicationAdapter, PublicationRepository, PublicationResult } from '@/lib/fichero/publication/types'
  type Dependencies = { repository: PublicationRepository; adapters: Partial<Record<DirectoryChannelKey, PublicationAdapter>> }
  export function publishApprovedProfileWithDependencies(profileId: string, dependencies: Dependencies): Promise<PublicationResult>
  export function retryProfileChannelWithDependencies(profileId: string, channelKey: DirectoryChannelKey, sourceVersion: number, dependencies: Dependencies): Promise<PublicationResult>
}
