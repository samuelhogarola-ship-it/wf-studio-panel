import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildReconciliationReport,
  matchBusinessToCanonical,
  redactReconciliationRow,
} from "../src/lib/fichero/reconciliation.mjs";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/fichero-reconciliation.json", import.meta.url)),
);

test("respeta el orden canónico, CIF, dominio/contacto y slug del canal", () => {
  const expected = [
    ["canonical", "canonical_profile_id", "10000000-0000-4000-8000-000000000001"],
    ["cif", "cif", "10000000-0000-4000-8000-000000000002"],
    ["domain", "domain_or_contact", "10000000-0000-4000-8000-000000000002"],
    ["slug", "channel_slug", "10000000-0000-4000-8000-000000000002"],
  ];

  for (const [caseKey, reason, profileId] of expected) {
    assert.deepEqual(
      matchBusinessToCanonical(
        fixture.cases[caseKey],
        fixture.canonicalProfiles,
      ),
      { status: "matched", reason, profileId },
    );
  }
});

test("identificadores fuertes incompatibles producen conflicto", () => {
  const result = matchBusinessToCanonical(
    fixture.cases.conflict,
    fixture.canonicalProfiles,
  );
  assert.equal(result.status, "conflict");
  assert.deepEqual(result.profileIds.sort(), [
    "10000000-0000-4000-8000-000000000001",
    "10000000-0000-4000-8000-000000000002",
  ]);
});

test("una coincidencia uno-a-varios siempre queda ambigua", () => {
  const result = matchBusinessToCanonical(
    fixture.cases.ambiguousDomain,
    fixture.canonicalProfiles,
  );
  assert.equal(result.status, "ambiguous");
  assert.equal(result.reason, "domain_or_contact");
  assert.deepEqual(result.profileIds.sort(), [
    "10000000-0000-4000-8000-000000000001",
    "10000000-0000-4000-8000-000000000003",
  ]);
});

test("un CIF duplicado también queda ambiguo y nunca elige la primera fila", () => {
  const duplicate = {
    ...fixture.canonicalProfiles[1],
    id: "10000000-0000-4000-8000-000000000099",
  };
  const result = matchBusinessToCanonical(fixture.cases.cif, [
    ...fixture.canonicalProfiles,
    duplicate,
  ]);
  assert.equal(result.status, "ambiguous");
  assert.equal(result.reason, "cif");
  assert.equal(result.profileIds.length, 2);
});

test("sin coincidencia se deriva a revisión manual y el informe conserva IDs", () => {
  const report = buildReconciliationReport({
    canonicalProfiles: fixture.canonicalProfiles,
    vivirBusinesses: [fixture.cases.canonical, fixture.cases.conflict, fixture.cases.manual],
    conoceBusinesses: [fixture.cases.cif, fixture.cases.ambiguousDomain],
  });
  assert.deepEqual(report.counts, {
    matched: 2,
    vivir_only: 1,
    conoce_only: 0,
    ambiguous: 1,
    conflict: 1,
    invalid: 0,
  });
  assert.deepEqual(report.vivir_only.map(({ rowId }) => rowId), ["vivir-4"]);
  assert.deepEqual(report.ambiguous[0].rowId, "conoce-3");
});

test("los informes y logs nunca incluyen contactos completos", () => {
  const redacted = redactReconciliationRow({
    id: "row-1",
    name: "Academia Sol",
    cif: "B12345678",
    contactEmail: "persona@academiasol.es",
    phone: "+34 600 000 000",
    website: "https://academiasol.es/contacto",
  });
  const serialized = JSON.stringify(redacted);
  assert.doesNotMatch(serialized, /B12345678|persona@|600 000 000|\/contacto/);
  assert.match(serialized, /academiasol\.es/);
});

test("el CLI exige decisiones explícitas antes de aplicar", () => {
  const source = readFileSync(
    new URL("../scripts/reconcile-fuengirola-directory.mjs", import.meta.url),
    "utf8",
  );
  assert.match(source, /--apply/);
  assert.match(source, /--decisions/);
  assert.match(source, /apply_requires_decisions/);
  assert.doesNotMatch(source, /delete\(|\.delete\(/);
});
