export class PublicationAdapterError extends Error {
  constructor(code, message) {
    super(message.slice(0, 240))
    this.name = 'PublicationAdapterError'
    this.code = code
  }
}

export function safePublicationError(error) {
  if (error instanceof PublicationAdapterError) {
    return { code: error.code.slice(0, 80), message: error.message.slice(0, 240) }
  }
  return {
    code: 'destination_unavailable',
    message: 'No se pudo completar la publicación en el destino.',
  }
}

export function createSupabaseChannelAdapter({ channelKey, schema, table, client, getClient, map }) {
  return {
    async publish(snapshot, channel, sourceVersion) {
      if (channel.channelKey !== channelKey) throw new PublicationAdapterError('channel_mismatch', 'El canal de publicación no coincide.')
      const projection = map(snapshot, channel, sourceVersion)
      const destinationClient = getClient ? getClient() : client
      const { data, error } = await destinationClient
        .schema(schema)
        .from(table)
        .upsert(projection, { onConflict: 'canonical_profile_id' })
        .select('canonical_profile_id')
        .single()
      if (error || !data?.canonical_profile_id) {
        throw new PublicationAdapterError('destination_rejected', 'El destino rechazó la publicación.')
      }
      return { remoteRecordId: data.canonical_profile_id }
    },
  }
}
