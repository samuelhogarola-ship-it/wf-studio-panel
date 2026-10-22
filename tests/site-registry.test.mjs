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

test("canonical website registry covers every current site and configures Samuel and Agama Blogger", () => {
  const sites = getSites();
  assert.equal(sites.length, 18);
  assert.equal(new Set(sites.map(({ key }) => key)).size, 18);

  const samuel = getSiteByKey("samuelcoachdealeman");
  assert.equal(samuel.blogger.enabled, true);
  assert.equal(
    samuel.blogger.url,
    "https://admin.webfuengirola.com/paneladmin/blogger/samuelcoachdealeman",
  );
  assert.equal(samuel.panel.key, "samuel-coach");
  assert.equal(samuel.blogger.adapter, "supabase-api");
  assert.deepEqual(samuel.blogger.capabilities, ["posts", "media", "publish"]);
  assert.equal(getBloggerHandoff(samuel), null);

  const agama = getSiteByKey("agama");
  assert.equal(agama.domain, "agama.com.mx");
  assert.equal(agama.blogger.enabled, true);
  assert.equal(agama.blogger.runtime, "central-multisite");
  assert.equal(
    agama.blogger.url,
    "https://admin.webfuengirola.com/paneladmin/blogger/agama",
  );
  assert.equal(agama.blogger.contentDir, "entrada-de-blog");
  assert.equal(agama.blogger.publicPostBase, "/entrada-de-blog/");

  const todoPlastico = getSiteByKey("todoplastico");
  assert.equal(todoPlastico.domain, "todo-plastico.com");
  assert.deepEqual(todoPlastico.blogger, { enabled: false });
  assert.equal(getBloggerHandoff(todoPlastico), null);

  const sportMassage = getSiteByKey("sportmassagefuengirola");
  assert.equal(sportMassage.blogger.enabled, true);
  assert.equal(
    sportMassage.blogger.url,
    "https://sportmassagefuengirola.com/admin/blogger/",
  );
  assert.equal(sportMassage.blogger.publicPostBase, "/blog/");
});

test("aGama analytics exposes only its canonical runtime lookup schema", () => {
  const agama = getSiteByKey("agama");

  assert.equal(agama.key, "agama");
  assert.equal(agama.domain, "agama.com.mx");
  assert.deepEqual(agama.analytics, {
    source: "agama",
    envSuffix: "AGAMA",
    legacyDashboard: false,
  });
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

test("closed site identities reject public suffixes, local hosts and malformed domains for every key", () => {
  const base = structuredClone(getSiteByKey("samuelcoachdealeman"));
  const candidateKeys = [...getSites().map(({ key }) => key), "unregistered-site"];
  const invalidDomains = [
    ["com", "https://com"],
    ["co.uk", "https://co.uk"],
    ["github.io", "https://github.io"],
    ["appspot.com", "https://appspot.com"],
    ["pages.dev", "https://pages.dev"],
    ["vercel.app", "https://vercel.app"],
    ["co.za", "https://co.za"],
    ["com.ar", "https://com.ar"],
    ["localhost", "https://localhost"],
    ["studio.local", "https://studio.local"],
    ["127.0.0.1", "https://127.0.0.1"],
    ["[::1]", "https://[::1]"],
    ["example..com", "https://example..com"],
    ["-example.com", "https://-example.com"],
    ["user@example.com", "https://example.com"],
  ];

  for (const [domain, origin] of invalidDomains) {
    for (const key of candidateKeys) {
      const site = {
        ...base,
        key,
        domain,
        productionUrl: origin,
        blogger: { enabled: true, url: `${origin}/admin/blogger/` },
      };
      assert.throws(
        () => validateSite(site),
        /dominio|hostname|identidad|registro|públic/i,
        `${key}: ${domain}`,
      );
    }
  }
});

test("a registered domain cannot be re-keyed as another site identity", () => {
  const sites = getSites();
  for (const site of sites) {
    const otherKey = sites.find(({ key }) => key !== site.key)?.key;
    assert.ok(otherKey);
    assert.throws(
      () => validateSite({ ...structuredClone(site), key: otherKey }),
      /identidad|registro/i,
      `${site.key} as ${otherKey}`,
    );
  }
});

test("registered sites accept only their exact closed production identity", () => {
  const bareProduction = structuredClone(getSiteByKey("webfuengirola"));
  const wwwProduction = structuredClone(getSiteByKey("samuelcoachdealeman"));

  assert.equal(validateSite(bareProduction).productionUrl, "https://webfuengirola.com");
  assert.equal(validateSite(wwwProduction).productionUrl, "https://www.samuelcoachdealeman.com");

  for (const site of [
    { ...bareProduction, productionUrl: "https://www.webfuengirola.com" },
    { ...wwwProduction, productionUrl: "https://samuelcoachdealeman.com" },
    { ...bareProduction, productionUrl: "https://webfuengirola.com/path" },
    { ...bareProduction, productionUrl: "https://webfuengirola.com?preview=1" },
    { ...bareProduction, productionUrl: "https://webfuengirola.com#preview" },
    {
      ...bareProduction,
      domain: "webfuengirola.example.com",
      productionUrl: "https://webfuengirola.example.com",
    },
  ]) {
    assert.throws(() => validateSite(site), /producción|identidad|origen|registro/i, site.productionUrl);
  }
});

test("Blogger destinations do not inherit undeclared bare or www origins", () => {
  const bareProduction = structuredClone(getSiteByKey("webfuengirola"));
  const wwwProduction = structuredClone(getSiteByKey("samuelcoachdealeman"));

  assert.throws(
    () => validateSite({
      ...bareProduction,
      blogger: { enabled: true, url: "https://www.webfuengirola.com/admin/blogger/" },
    }),
    /Blogger|origen|registro/i,
  );
  assert.throws(
    () => validateSite({
      ...wwwProduction,
      blogger: {
        ...wwwProduction.blogger,
        launchUrl: "https://samuelcoachdealeman.com/admin/blogger/launch",
        healthUrl: "https://www.samuelcoachdealeman.com/api/blogger/health",
      },
    }),
    /Blogger|origen|registro/i,
  );
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

test("the Blogger console accepts only the exact trusted Studio origin", () => {
  const base = structuredClone(getSiteByKey("samuelcoachdealeman"));
  assert.equal(
    validateSite({
      ...base,
      blogger: {
        ...base.blogger,
        url: "https://admin.webfuengirola.com/paneladmin/blogger/samuelcoachdealeman",
      },
    }).blogger.url,
    "https://admin.webfuengirola.com/paneladmin/blogger/samuelcoachdealeman",
  );

  for (const url of [
    "https://admin.webfuengirola.com.evil.example/paneladmin/blogger/samuelcoachdealeman",
    "https://user@admin.webfuengirola.com/paneladmin/blogger/samuelcoachdealeman",
    "https://admin.webfuengirola.com:8443/paneladmin/blogger/samuelcoachdealeman",
  ]) {
    assert.throws(
      () => validateSite({ ...base, blogger: { ...base.blogger, url } }),
      /Blogger|HTTPS|origen|registro/i,
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
    ["https://tools.samuelcoachdealeman.com?preview=1"],
    ["https://tools.samuelcoachdealeman.com#preview"],
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
