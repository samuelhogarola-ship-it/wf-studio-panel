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
    "https://admin.webfuengirola.com/paneladmin/blogger/samuelcoachdealeman",
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

test("project views consume the registry and no longer point Blogger to localhost", async () => {
  const [projectsPage, samuelPage, appShell] = await Promise.all([
    readFile(
      new URL(
        "../src/app/paneladmin/(protected)/proyectos/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/paneladmin/(protected)/samuel-coach/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../src/components/layout/app-shell.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(projectsPage, /getSites/);
  assert.doesNotMatch(projectsPage, /Esta sección está en desarrollo/);
  assert.match(samuelPage, /getSiteByKey/);
  assert.doesNotMatch(samuelPage, /127\.0\.0\.1|Blog Creator · local/);
  assert.match(appShell, /href: ['"]\/paneladmin\/proyectos['"]/);
});
