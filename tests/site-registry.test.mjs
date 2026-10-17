import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getLegacyAnalyticsProjects,
  getSiteByKey,
  getSites,
} from "../src/lib/sites/registry.mjs";

test("canonical website registry covers every current site and configures Samuel Blogger", () => {
  const sites = getSites();
  assert.equal(sites.length, 17);
  assert.equal(new Set(sites.map(({ key }) => key)).size, 17);

  const samuel = getSiteByKey("samuelcoachdealeman");
  assert.equal(samuel.blogger.enabled, true);
  assert.equal(
    samuel.blogger.url,
    "https://www.samuelcoachdealeman.com/admin/blogger/",
  );
  assert.equal(samuel.panel.key, "samuel-coach");
});

test("legacy analytics facade is derived from canonical sites without changing keys", () => {
  const projects = getLegacyAnalyticsProjects();
  assert.deepEqual(
    projects.map(({ key }) => key),
    [
      "webfuengirola",
      "vivirenfuengirola",
      "conocef",
      "samuelcoachdealeman",
      "vokabelworld",
      "superentrenador",
      "agama",
    ],
  );
  assert.equal(
    projects.find(({ key }) => key === "vokabelworld").label,
    "Vokabel-World",
  );
});

test("existing site views retain registry-backed protected Blogger and project navigation", async () => {
  // Project inventory is database-backed now; its rendered behavior is covered
  // in project-admin-ui.test.mjs. Site launchers still consume the registry.
  const [samuelPage, appShell] = await Promise.all([
    readFile(
      new URL(
        "../src/app/paneladmin/(protected)/samuel-coach/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../src/components/layout/app-shell.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(samuelPage, /getSiteByKey/);
  assert.doesNotMatch(samuelPage, /127\.0\.0\.1|Blog Creator · local/);
  assert.match(appShell, /href: ['"]\/paneladmin\/proyectos['"]/);
});
