import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

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

test("latest migration scopes client email uniqueness by project", async () => {
  const scopedUniqueSql = await readMigration(
    "202607100001_clients_unique_per_project.sql",
  );

  assert.match(
    scopedUniqueSql,
    /drop index if exists public\.clients_email_lower_unique_idx;/,
  );
  assert.match(
    scopedUniqueSql,
    /create unique index if not exists clients_project_email_lower_unique_idx\s+on public\.clients \(project, lower\(email\)\);/s,
  );
});

test("monthly reports migration creates durable storage and idempotent delivery RPCs", async () => {
  const reportSql = await readMigration(
    "202608260001_monthly_stat_reports.sql",
  );

  assert.match(reportSql, /create table if not exists public\.monthly_stat_reports/);
  assert.match(reportSql, /create or replace function public\.set_monthly_stat_reports_updated_at\(\)/);
  assert.match(reportSql, /execute function public\.set_monthly_stat_reports_updated_at\(\)/);
  assert.match(reportSql, /create or replace function public\.claim_monthly_stat_report_delivery/);
  assert.match(reportSql, /create or replace function public\.complete_monthly_stat_report_delivery/);
  assert.match(reportSql, /create or replace function public\.release_monthly_stat_report_delivery/);
  assert.match(reportSql, /enable row level security/);
});

test("monthly report snapshot writes are atomic while claimed or already sent", async () => {
  const integritySql = await readMigration(
    "202608300001_monthly_stat_report_snapshot_integrity.sql",
  );

  assert.match(integritySql, /save_monthly_stat_report_snapshot/);
  assert.match(integritySql, /claim_monthly_stat_report_delivery_snapshot/);
  assert.match(integritySql, /is_complete = true/);
  assert.match(integritySql, /delivery_claimed_at < timezone\('utc', now\(\)\) - interval '15 minutes'/);
  assert.match(integritySql, /email_sent_at is null/);
  assert.match(integritySql, /delivery_claim_token is null/);
  assert.match(integritySql, /grant execute .* to service_role/is);
});
