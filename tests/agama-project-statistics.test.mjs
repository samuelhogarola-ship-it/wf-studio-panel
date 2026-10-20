import assert from "node:assert/strict";
import test from "node:test";

import {
  boundary,
  client,
  clientId,
  database,
  form,
  loadProjectModule,
  project,
  projectId,
} from "./helpers/project-harness.mjs";

const timestamp = "2026-10-01T00:00:00Z";
const packId = "55555555-5555-4555-8555-555555555555";

const agamaClient = {
  ...client,
  name: "aGama",
  company: "aGama",
  phone: "+34 600 000 000",
  portal_mode: "dynamic",
  created_at: timestamp,
  updated_at: timestamp,
};
const agamaProject = {
  ...project,
  name: "aGama",
  slug: "agama",
  domain: "agama.com.mx",
  analytics_registry_key: "agama",
};
const capability = (capabilityKey, state, metadata) => ({
  id: `capability-${capabilityKey}`,
  project_id: projectId,
  capability_key: capabilityKey,
  state,
  launch_url: null,
  metadata,
  validated_at: state === "active" ? timestamp : null,
  created_at: timestamp,
  updated_at: timestamp,
});
const agamaCapabilities = [
  capability("products", "active", { label: "Productos" }),
  capability("domains", "active", { renewal: "managed" }),
  capability("hosting", "active", { plan: "managed" }),
  capability("invoices", "active", { currency: "EUR" }),
  capability("bonuses_reports", "active", { delivery: "monthly" }),
  capability("blogger", "available", { content_dir: "entrada-de-blog" }),
  capability("analytics", "available", {}),
];
const accountTables = {
  clients: [agamaClient],
  client_projects: [agamaProject],
  project_capabilities: agamaCapabilities,
  client_resources: [{
    id: "report-september",
    client_id: clientId,
    kind: "report",
    title: "Informe septiembre",
    body: "Actividad mensual",
    report_path: "/reports/2026-09.pdf",
    storage_path: null,
    content_type: "application/pdf",
    created_by: "admin-id",
    created_at: timestamp,
  }],
  packs: [{
    id: packId,
    client_id: clientId,
    name: "Bono soporte",
    minutes_total: 600,
    pack_type: "hours",
    billing_cycle: "one_time",
    invoice_number: "AG-2026-09",
    notes: "Cuenta aGama",
    paid: true,
    price: 600,
    purchase_date: "2026-09-01",
    renewal_date: null,
    status: "active",
    created_at: timestamp,
    updated_at: timestamp,
  }],
  activities: [{
    id: "activity-support",
    client_id: clientId,
    pack_id: packId,
    activity_type: "support",
    title: "Soporte mensual",
    description: "Mantenimiento",
    minutes_used: 135,
    notify_client: true,
    work_date: "2026-09-30",
    created_at: timestamp,
    updated_at: timestamp,
  }],
  invoices: [{
    id: "invoice-september",
    client_id: clientId,
    number: "AG-2026-09",
    concept: "Servicios web",
    amount: 600,
    status: "paid",
    issued_at: "2026-09-01",
    paid_at: "2026-09-03",
    payment_method: "transfer",
    notes: null,
    created_at: timestamp,
    updated_at: timestamp,
  }],
  services: [{
    id: "service-hosting",
    client_id: clientId,
    pack_id: packId,
    name: "Hosting gestionado",
    service_type: "hosting",
    service_date: "2026-09-01",
    status: "active",
    price: 120,
    notes: "Servicio vigente",
    created_at: timestamp,
    updated_at: timestamp,
  }],
};

function byteSnapshot(tables, names) {
  return Object.fromEntries(names.map((name) => [name, {
    rowCount: tables[name].length,
    rowKeys: tables[name].map((row) => Object.keys(row)),
    bytes: JSON.stringify(tables[name]),
  }]));
}

test("real aGama analytics and Blogger activation preserves every non-target row", async () => {
  const db = database(accountTables);
  const { mocks } = boundary(db, {
    "@/lib/analytics/umami-core.mjs": {
      getConfiguredUmamiSites: () => [{ key: "agama", domain: "agama.com.mx", source: "agama", websiteId: true }],
      getUmamiConnections: () => ({ agama: { baseUrl: true, password: true } }),
    },
  });
  const { upsertProjectCapabilityAction } = loadProjectModule("src/lib/actions/projects.ts", mocks);
  const nonEntitlementTables = Object.keys(db.tables).filter((name) => name !== "project_capabilities").sort();
  const nonTargetCapabilityKeys = agamaCapabilities
    .map((row) => row.capability_key)
    .filter((key) => key !== "analytics" && key !== "blogger");
  const beforeTables = byteSnapshot(db.tables, nonEntitlementTables);
  const beforeNonTarget = byteSnapshot({
    rows: db.tables.project_capabilities.filter((row) => nonTargetCapabilityKeys.includes(row.capability_key)),
  }, ["rows"]);
  const beforeCapabilityIds = db.tables.project_capabilities.map((row) => row.id);

  const analyticsResult = await upsertProjectCapabilityAction({}, form({
    project_id: projectId,
    capability_key: "analytics",
    state: "active",
    launch_url: "",
  }));
  const bloggerResult = await upsertProjectCapabilityAction({}, form({
    project_id: projectId,
    capability_key: "blogger",
    state: "active",
    launch_url: "https://admin.webfuengirola.com/paneladmin/blogger/agama",
    provisioning_confirmed: "true",
  }));

  assert.equal(analyticsResult.error, undefined);
  assert.equal(bloggerResult.error, undefined);
  assert.deepEqual(byteSnapshot(db.tables, nonEntitlementTables), beforeTables);
  assert.deepEqual(byteSnapshot({
    rows: db.tables.project_capabilities.filter((row) => nonTargetCapabilityKeys.includes(row.capability_key)),
  }, ["rows"]), beforeNonTarget);
  assert.deepEqual(db.tables.project_capabilities.map((row) => row.id), beforeCapabilityIds);
  assert.equal(db.tables.project_capabilities.length, agamaCapabilities.length);
  assert.equal(db.tables.project_capabilities.find((row) => row.capability_key === "analytics").state, "active");
  assert.equal(db.tables.project_capabilities.find((row) => row.capability_key === "blogger").state, "active");
  assert.equal(db.tables.project_capabilities.find((row) => row.capability_key === "bonuses_reports").state, "active");
});
