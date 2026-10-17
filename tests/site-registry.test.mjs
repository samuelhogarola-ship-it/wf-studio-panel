import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getBloggerHandoff,
  getLegacyAnalyticsProjects,
  getSiteByKey,
  getSites,
  validateSite,
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
  assert.equal(samuel.blogger.adapter, "supabase-api");
  assert.deepEqual(samuel.blogger.capabilities, ["posts", "media", "publish"]);
  assert.equal(getBloggerHandoff(samuel), null);
});

test("Blogger handoff registry accepts only complete same-site HTTPS destinations", () => {
  const base = structuredClone(getSiteByKey("samuelcoachdealeman"));
  const configured = {
    ...base,
    blogger: {
      ...base.blogger,
      launchUrl: "https://www.samuelcoachdealeman.com/admin/blogger/launch",
      healthUrl: "https://www.samuelcoachdealeman.com/api/blogger/health",
      adapter: "supabase-api",
      capabilities: ["posts", "media", "publish"],
    },
  };

  assert.equal(getBloggerHandoff(validateSite(configured)).adapter, "supabase-api");

  for (const blogger of [
    { ...configured.blogger, launchUrl: "http://www.samuelcoachdealeman.com/launch" },
    { ...configured.blogger, healthUrl: "https://user:pass@www.samuelcoachdealeman.com/health" },
    { ...configured.blogger, launchUrl: "https://evil.example/launch" },
    { ...configured.blogger, healthUrl: "https:///health" },
    { ...configured.blogger, adapter: "" },
    { ...configured.blogger, capabilities: [] },
    { enabled: true, url: configured.blogger.url, launchUrl: configured.blogger.launchUrl },
  ]) {
    assert.throws(() => validateSite({ ...base, blogger }), /Blogger|HTTPS|registro/i);
  }
});

test("site domains must be canonical public registrable hostnames before URL validation", () => {
  const base = structuredClone(getSiteByKey("samuelcoachdealeman"));
  const invalidDomains = [
    ["com", "https://com"],
    ["co.uk", "https://co.uk"],
    ["localhost", "https://localhost"],
    ["studio.local", "https://studio.local"],
    ["127.0.0.1", "https://127.0.0.1"],
    ["[::1]", "https://[::1]"],
    ["example..com", "https://example..com"],
    ["-example.com", "https://-example.com"],
    ["user@example.com", "https://example.com"],
  ];

  for (const [domain, origin] of invalidDomains) {
    const site = {
      ...base,
      domain,
      productionUrl: origin,
      blogger: { enabled: true, url: `${origin}/admin/blogger/` },
    };
    assert.throws(() => validateSite(site), /dominio|hostname|registro|públic/i, domain);
  }
});

test("Blogger destinations reject credentials, non-default ports and unapproved origins", () => {
  const base = structuredClone(getSiteByKey("samuelcoachdealeman"));
  const configured = {
    ...base,
    blogger: {
      ...base.blogger,
      launchUrl: "https://www.samuelcoachdealeman.com/admin/blogger/launch",
      healthUrl: "https://www.samuelcoachdealeman.com/api/blogger/health",
    },
  };
  const attacks = [
    "not a URL",
    "https://user:pass@samuelcoachdealeman.com/admin/blogger/launch",
    "https://samuelcoachdealeman.com:8443/admin/blogger/launch",
    "https://admin.samuelcoachdealeman.com/admin/blogger/launch",
    "https://evil.samuelcoachdealeman.com/admin/blogger/launch",
    "https://evilsamuelcoachdealeman.com/admin/blogger/launch",
    "https://samuelcoachdealeman.com.evil.example/admin/blogger/launch",
    "https://www.samuelcoachdealeman.com.evil.example/admin/blogger/launch",
    "https://127.0.0.1/admin/blogger/launch",
    "https://[::1]/admin/blogger/launch",
  ];

  for (const launchUrl of attacks) {
    assert.throws(
      () => validateSite({ ...configured, blogger: { ...configured.blogger, launchUrl } }),
      /Blogger|HTTPS|origen|registro|públic/i,
      launchUrl,
    );
  }
});

test("explicit allowedOrigins permits only the exact approved Blogger subdomain origin", () => {
  const base = structuredClone(getSiteByKey("samuelcoachdealeman"));
  const approved = {
    ...base,
    allowedOrigins: ["https://tools.samuelcoachdealeman.com"],
    blogger: {
      ...base.blogger,
      launchUrl: "https://tools.samuelcoachdealeman.com/admin/blogger/launch",
      healthUrl: "https://tools.samuelcoachdealeman.com/api/blogger/health",
    },
  };
  assert.equal(getBloggerHandoff(validateSite(approved)).launchUrl, approved.blogger.launchUrl);

  for (const allowedOrigins of [
    ["https://tools.samuelcoachdealeman.com:8443"],
    ["https://user@tools.samuelcoachdealeman.com"],
    ["https://samuelcoachdealeman.com.evil.example"],
    ["https://evilsamuelcoachdealeman.com"],
    ["https://tools.samuelcoachdealeman.com/path"],
    ["http://tools.samuelcoachdealeman.com"],
  ]) {
    assert.throws(
      () => validateSite({ ...approved, allowedOrigins }),
      /origen|HTTPS|registro|públic/i,
      allowedOrigins[0],
    );
  }
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
