import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..");

async function readMigration(name) {
  return readFile(path.join(repoRoot, "supabase", "migrations", name), "utf8");
}

test("minutes compatibility migration exists before pack_type migration needs it", async () => {
  const compatSql = await readMigration(
    "202606220001_minutes_columns_compat.sql",
  );
  const packTypeSql = await readMigration(
    "202606230001_add_pack_type_to_packs.sql",
  );

  assert.match(compatSql, /add column if not exists minutes_total integer;/);
  assert.match(compatSql, /add column if not exists minutes_used integer;/);
  assert.match(packTypeSql, /p\.minutes_total/);
  assert.match(packTypeSql, /a\.minutes_used/);
});

test("client_summary aggregates packs and activities in separate subqueries", async () => {
  const hardeningSql = await readMigration(
    "202606300001_studio_panel_hardening.sql",
  );

  assert.match(
    hardeningSql,
    /left join \(\s*select\s+client_id,\s+coalesce\(sum\(case when status = 'active' then minutes_total else 0 end\), 0\) as total_minutes/s,
  );
  assert.match(
    hardeningSql,
    /left join \(\s*select\s+client_id,\s+coalesce\(sum\(minutes_used\), 0\) as used_minutes/s,
  );
  assert.doesNotMatch(
    hardeningSql,
    /left join public\.packs p on p\.client_id = c\.id\s+left join public\.activities a on a\.client_id = c\.id/s,
  );
});
