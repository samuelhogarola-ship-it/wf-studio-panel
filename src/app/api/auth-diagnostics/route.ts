import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? null
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? null

  if (!supabaseUrl || !publicKey) {
    return NextResponse.json(
      {
        ok: false,
        supabaseUrl,
        publicKeyPresent: Boolean(publicKey),
        publicKeyPrefix: publicKey?.slice(0, 24) ?? null,
        publicKeyLength: publicKey?.length ?? 0,
        error: 'missing_public_supabase_env',
      },
      { status: 500 },
    )
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
    headers: {
      apikey: publicKey,
    },
    cache: 'no-store',
  })

  return NextResponse.json(
    {
      ok: response.ok,
      supabaseUrl,
      publicKeyPresent: true,
      publicKeyPrefix: publicKey.slice(0, 24),
      publicKeyLength: publicKey.length,
      settingsStatus: response.status,
      settingsStatusText: response.statusText,
    },
    { status: response.ok ? 200 : 500 },
  )
}
