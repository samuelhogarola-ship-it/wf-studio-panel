import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

test("Samuel Coach has a protected informes page embedding the professor reports tool", async () => {
  const pagePath = path.join(
    repoRoot,
    "src/app/paneladmin/(protected)/samuel-coach/informes/page.tsx",
  );

  await access(pagePath);
  const source = await readFile(pagePath, "utf8");

  assert.match(source, /https:\/\/www\.samuelcoachdealeman\.com\/informes-profesor\//);
  assert.match(source, /<iframe/);
  assert.match(source, /currentPath="\/paneladmin\/samuel-coach\/informes"/);
});

test("Samuel Coach overview links to the embedded informes section", async () => {
  const source = await readFile(
    path.join(repoRoot, "src/app/paneladmin/(protected)/samuel-coach/page.tsx"),
    "utf8",
  );

  assert.match(source, /href="\/paneladmin\/samuel-coach\/informes"/);
  assert.match(source, /Abrir en el panel/);
});
