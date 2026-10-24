import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migrationPath = new URL('../supabase/migrations/202610240001_message_and_resource_rls.sql', import.meta.url)

test('message and resource RLS migration removes client-owned message updates', async () => {
 const sql = await readFile(migrationPath, 'utf8')
 assert.match(sql, /drop policy if exists messages_client_update_own on public\.messages/i)
 assert.match(sql, /create policy messages_client_insert_own[\s\S]*direction = 'outbound'/i)
 assert.match(sql, /private\.current_portal_client_id\(\)/i)
 assert.match(sql, /reply_to_id is null[\s\S]*or private\.can_reply_to_message\(reply_to_id\)/i)
 assert.match(sql, /create or replace function public\.mark_message_read\(p_message_id uuid\)/i)
 assert.match(sql, /where id = p_message_id[\s\S]*client_id = v_client_id[\s\S]*direction = 'inbound'/i)
 assert.match(sql, /revoke all on function public\.mark_message_read\(uuid\) from public, anon/i)
})

test('ownership columns are immutable and resource writes stay admin-only', async () => {
 const sql = await readFile(migrationPath, 'utf8')
 assert.match(sql, /create or replace function private\.prevent_ownership_change\(\)/i)
 assert.match(sql, /old\.client_id is distinct from new\.client_id/i)
 assert.match(sql, /create trigger messages_client_id_immutable/i)
 assert.match(sql, /create trigger client_resources_client_id_immutable/i)
 assert.match(sql, /drop policy if exists client_resources_own_write on public\.client_resources/i)
 assert.match(sql, /create policy client_resources_admin_all[\s\S]*private\.is_admin\(\)/i)
})

test('mark read action delegates the state change to the narrow RPC', async () => {
 const source = await readFile(new URL('../src/lib/actions/messages.ts', import.meta.url), 'utf8')
 assert.match(source, /\.rpc\(['"]mark_message_read['"]/i)
 assert.doesNotMatch(source, /from\(['"]messages['"]\)\.update/i)
})

test('message page read tracking also delegates to the narrow RPC', async () => {
 const source = await readFile(new URL('../src/lib/data/client.ts', import.meta.url), 'utf8')
 assert.match(source, /supabase\.rpc\(['"]mark_message_read['"]/i)
 assert.doesNotMatch(source, /from\(['"]messages['"]\)\.update/i)
})

test('resource downloads retain server-side owner and path checks', async () => {
 const source = await readFile(new URL('../src/app/api/client-resources/[id]/route.ts', import.meta.url), 'utf8')
 assert.match(source, /\.eq\(['"]client_id['"], clientId\)/i)
 assert.match(source, /isOwnedStoragePath\(data\.storage_path, storageOwnerId\)/i)
 assert.match(source, /storage\.from\(['"]client-resources['"]\)\.download/i)
})
