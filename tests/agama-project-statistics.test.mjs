import assert from "node:assert/strict";
import test from "node:test";

const agamaServiceModel = {
  project: {
    id: "project-agama",
    client_id: "client-agama",
    slug: "agama",
    domain: "agama.com.mx",
    analytics_registry_key: "agama",
    client_access_enabled: true,
  },
  account: {
    client_id: "client-agama",
    portal_mode: "dynamic",
    status: "active",
  },
  capabilities: [
    { capability_key: "products", state: "active", metadata: { label: "Productos" } },
    { capability_key: "domains", state: "active", metadata: { renewal: "managed" } },
    { capability_key: "hosting", state: "active", metadata: { plan: "managed" } },
    { capability_key: "invoices", state: "active", metadata: { currency: "EUR" } },
    { capability_key: "bonuses_reports", state: "active", metadata: { delivery: "monthly" } },
    { capability_key: "blogger", state: "available", metadata: { content_dir: "entrada-de-blog" } },
    { capability_key: "analytics", state: "available", metadata: {} },
  ],
  reports: [
    { id: "report-september", period: "2026-09", status: "published" },
  ],
  bonuses: [
    { id: "bonus-support", minutes_total: 600, minutes_used: 135, status: "active" },
  ],
  services: [
    { id: "service-hosting", category: "hosting", status: "active" },
    { id: "service-content", category: "content", status: "active" },
  ],
};

function activateProjectTools(model, keys) {
  const activated = structuredClone(model);
  activated.capabilities = activated.capabilities.map((capability) =>
    keys.includes(capability.capability_key)
      ? { ...capability, state: "active" }
      : capability,
  );
  return activated;
}

test("activating aGama analytics and Blogger preserves reports, bonuses, and account data", () => {
  const before = structuredClone(agamaServiceModel);
  const after = activateProjectTools(before, ["analytics", "blogger"]);

  assert.deepEqual(after.project, before.project);
  assert.deepEqual(after.account, before.account);
  assert.deepEqual(after.reports, before.reports);
  assert.deepEqual(after.bonuses, before.bonuses);
  assert.deepEqual(after.services, before.services);

  const beforeCapabilities = new Map(before.capabilities.map((row) => [row.capability_key, row]));
  for (const capability of after.capabilities) {
    if (capability.capability_key === "analytics" || capability.capability_key === "blogger") {
      assert.equal(capability.state, "active");
      assert.deepEqual(capability.metadata, beforeCapabilities.get(capability.capability_key).metadata);
      continue;
    }
    assert.deepEqual(capability, beforeCapabilities.get(capability.capability_key));
  }
  assert.equal(after.capabilities.find((row) => row.capability_key === "bonuses_reports").state, "active");
});
