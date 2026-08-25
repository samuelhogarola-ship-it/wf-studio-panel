import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("launcher keeps marketplace visible before the lower panel row", async () => {
  const source = await readSource("src/app/paneladmin/(protected)/inicio/page.tsx");

  const wfIndex = source.indexOf("title: 'WF-Studio'");
  const marketplaceIndex = source.indexOf("href: '/paneladmin/todoplastico'");
  const superentrenadorIndex = source.indexOf("title: 'Superentrenador'");

  assert.notEqual(wfIndex, -1);
  assert.notEqual(marketplaceIndex, -1);
  assert.notEqual(superentrenadorIndex, -1);
  assert.ok(
    marketplaceIndex > wfIndex && marketplaceIndex < superentrenadorIndex,
    "marketplace should be promoted above the lower launcher row",
  );
});

test("launcher keeps company and admin marketplace links on Agama, not Superentrenador", async () => {
  const source = await readSource("src/app/paneladmin/(protected)/inicio/page.tsx");

  const agamaSection = source.slice(
    source.indexOf("title: 'Agama Marketplace'"),
    source.indexOf("title: 'Superentrenador'"),
  );
  const superentrenadorSection = source.slice(source.indexOf("title: 'Superentrenador'"));

  assert.match(agamaSection, /Panel empresa/);
  assert.match(agamaSection, /Panel admin/);
  assert.doesNotMatch(superentrenadorSection, /Admin marketplace|Mi panel de entrenador|Mis anuncios|Coach Studio/);
});

test("admin shell allows page content and navigation to scroll", async () => {
  const source = await readSource("src/components/layout/app-shell.tsx");

  assert.match(source, /className="min-h-screen h-screen overflow-hidden bg-background flex"/);
  assert.match(source, /className="hidden lg:flex h-screen w-56/);
  assert.match(source, /className="flex-1 overflow-y-auto px-6 py-8"/);
  assert.match(source, /label: 'Agama Marketplace'/);
});
