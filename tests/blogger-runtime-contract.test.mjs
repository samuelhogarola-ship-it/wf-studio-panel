import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildHookRequest, executeBuildHook } from '../src/lib/blogger/build-hook.mjs';
import { canAccessBloggerSite } from '../src/lib/blogger/access.mjs';
import { resolvePublicPostBase } from '../src/lib/blogger/sites.mjs';
import * as projectTools from '../src/lib/projects/tools.mjs';
import {
  deletePostImage,
  listPostImages,
  listPosts,
  readPost,
  readPostImage,
  saveImageMetadata,
  savePost,
  savePostImage,
  validateExistingImageName,
} from '../src/lib/blogger/content-store.mjs';

test('generated public Blogger entry redirects only to the site-specific direct route', () => {
  assert.equal(typeof projectTools.generatePublicBloggerEntry, 'function');

  const entry = projectTools.generatePublicBloggerEntry('future-site');
  const expected = 'https://admin.webfuengirola.com/acceso/blogger/future-site';

  assert.equal(entry.target, expected);
  assert.match(entry.html, new RegExp(`<meta[^>]+url=${expected}`));
  assert.match(entry.html, new RegExp(`href="${expected}"`));
  assert.doesNotMatch(entry.html, /\/cliente\/(?:dashboard|proyectos)(?:\/|["'?#<])/);
});

test('public Blogger entry generation rejects malformed site keys before rendering HTML', () => {
  for (const siteKey of ['', 'Future-Site', '../admin', 'site/key', 'site?<script>']) {
    assert.throws(
      () => projectTools.generatePublicBloggerEntry(siteKey),
      /site key/i,
      siteKey,
    );
  }
});

test('existing image validation preserves the stored filename', () => {
  assert.equal(validateExistingImageName('Foto-Legacy.JPG'), 'Foto-Legacy.JPG');
  assert.throws(() => validateExistingImageName('../Foto-Legacy.JPG'), /Imagen invalida/);
});

test('Personal Trainer build hook carries its tenant secret', () => {
  const request = buildHookRequest('personaltrainerfuengirola', {
    BLOGGER_BUILD_HOOK_PERSONALTRAINERFUENGIROLA: 'https://personaltrainerfuengirola.com/api/blogger/build',
    BLOGGER_BUILD_SECRET_PERSONALTRAINERFUENGIROLA: 'shared-secret',
  });
  assert.equal(request.url, 'https://personaltrainerfuengirola.com/api/blogger/build');
  assert.equal(request.headers.Authorization, 'Bearer shared-secret');
  assert.equal(request.body, JSON.stringify({ siteKey: 'personaltrainerfuengirola' }));
});

test('tenant hook configuration fails closed when its secret is missing', () => {
  assert.throws(
    () => buildHookRequest('personaltrainerfuengirola', {
      BLOGGER_BUILD_HOOK_PERSONALTRAINERFUENGIROLA: 'https://personaltrainerfuengirola.com/api/blogger/build',
    }),
    /Falta el secreto/,
  );
});

for (const siteKey of ['samuelcoachdealeman', 'personaltrainerfuengirola']) {
  test(`${siteKey} build hook fails closed when its secret is missing`, () => {
    const suffix = siteKey.toUpperCase();
    assert.throws(
      () => buildHookRequest(siteKey, {
        [`BLOGGER_BUILD_HOOK_${suffix}`]: `https://${siteKey}.example/api/build`,
      }),
      /Falta el secreto/,
    );
  });
}

test('hook configuration rejects malformed secrets without echoing them', () => {
  const secret = 'dummy\nsecret';
  assert.throws(
    () => buildHookRequest('personaltrainerfuengirola', {
      BLOGGER_BUILD_HOOK_PERSONALTRAINERFUENGIROLA: 'https://personaltrainerfuengirola.com/api/blogger/build',
      BLOGGER_BUILD_SECRET_PERSONALTRAINERFUENGIROLA: secret,
    }),
    (error) => error.message === 'El secreto de publicación configurado no es válido.' && !error.message.includes(secret),
  );
});

test('build execution returns a controlled response without leaking exception secrets', async () => {
  const secret = 'line-one\nline-two';
  const result = await executeBuildHook('samuelcoachdealeman', {
    env: {
      BLOGGER_BUILD_HOOK_SAMUELCOACHDEALEMAN: 'https://www.samuelcoachdealeman.com/api/blogger/build',
      BLOGGER_BUILD_SECRET_SAMUELCOACHDEALEMAN: secret,
    },
    fetchImpl: async () => { throw Object.assign(new Error(`upstream exposed ${secret}`), { status: 503 }); },
  });
  assert.deepEqual(result, {
    status: 503,
    body: { error: 'La publicación de samuelcoachdealeman no está configurada.' },
  });
  assert.doesNotMatch(JSON.stringify(result), /line-one|line-two|upstream exposed/);
});

test('build execution does not leak runtime errors and refuses webhook redirects', async () => {
  const secret = 'valid-runtime-secret';
  let requestOptions;
  const redirected = await executeBuildHook('personaltrainerfuengirola', {
    env: {
      BLOGGER_BUILD_HOOK_PERSONALTRAINERFUENGIROLA: 'https://personaltrainerfuengirola.com/api/blogger/build',
      BLOGGER_BUILD_SECRET_PERSONALTRAINERFUENGIROLA: secret,
    },
    fetchImpl: async (_url, options) => {
      requestOptions = options;
      return { ok: false, status: 302 };
    },
  });
  assert.equal(requestOptions.redirect, 'manual');
  assert.deepEqual(redirected, {
    status: 502,
    body: { error: 'El publicador de personaltrainerfuengirola respondió 302.' },
  });

  const failed = await executeBuildHook('personaltrainerfuengirola', {
    env: {
      BLOGGER_BUILD_HOOK_PERSONALTRAINERFUENGIROLA: 'https://personaltrainerfuengirola.com/api/blogger/build',
      BLOGGER_BUILD_SECRET_PERSONALTRAINERFUENGIROLA: secret,
    },
    fetchImpl: async () => { throw new Error(`socket failed with ${secret}`); },
  });
  assert.deepEqual(failed, {
    status: 502,
    body: { error: 'No se pudo contactar con el publicador de personaltrainerfuengirola.' },
  });
  assert.doesNotMatch(JSON.stringify(failed), new RegExp(secret));
});

test('environment contract documents authenticated hooks for Samuel and Personal', async () => {
  const env = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
  assert.match(env, /^BLOGGER_BUILD_SECRET_SAMUELCOACHDEALEMAN=$/m);
  assert.match(env, /^BLOGGER_BUILD_SECRET_PERSONALTRAINERFUENGIROLA=$/m);
});

test('content store reads and writes the site-specific public blog directory', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'studio-personal-blogger-'));
  const publicDir = path.join(root, 'blog');
  await mkdir(path.join(publicDir, 'legacy-post'), { recursive: true });
  await writeFile(
    path.join(publicDir, 'legacy-post', 'index.html'),
    '<html lang="es"><head><meta name="description" content="Legacy"></head><body><main class="article-shell"><h1>Legacy post</h1><div class="article-body"><h2>Bloque editable</h2><p>Contenido</p></div></main></body></html>',
  );

  const options = {
    publicDir: 'blog',
    publicPostBase: '/blog/',
    productionUrl: 'https://personaltrainerfuengirola.com',
    previewBase: '/api/blogger/personaltrainerfuengirola/posts',
  };
  const posts = await listPosts(root, options);
  assert.equal(posts[0].slug, 'legacy-post');
  assert.equal(posts[0].source, 'generated-html');
  const legacy = await readPost(root, 'legacy-post', {}, options);
  assert.match(legacy.body, /Bloque editable/);
  assert.match(legacy.body, /Contenido/);

  await savePost(root, null, {
    title: 'Nuevo post',
    slug: 'nuevo-post',
    description: 'Descripción del nuevo post.',
    body: 'Contenido',
  }, {}, options);
  assert.match(await readFile(path.join(root, 'blog-posts', 'nuevo-post.md'), 'utf8'), /title: Nuevo post/);
  assert.equal((await stat(path.join(root, 'blog', 'nuevo-post', 'img'))).isDirectory(), true);
  const uploaded = await savePostImage(root, 'nuevo-post', 'foto.webp', 'aW1hZ2U=', options);
  assert.equal(uploaded.url, 'https://personaltrainerfuengirola.com/blog/nuevo-post/img/foto.webp');
  assert.equal(uploaded.previewUrl, '/api/blogger/personaltrainerfuengirola/posts/nuevo-post/images/foto.webp/preview');
  const preview = await readPostImage(root, 'nuevo-post', 'foto.webp', options);
  assert.equal(preview.data.toString('utf8'), 'image');
  assert.equal(preview.contentType, 'image/webp');
  await writeFile(path.join(root, 'blog', 'nuevo-post', 'img', 'Foto-Legacy.JPG'), 'legacy-image');
  const legacyPreview = await readPostImage(root, 'nuevo-post', 'Foto-Legacy.JPG', options);
  assert.equal(legacyPreview.data.toString('utf8'), 'legacy-image');
  assert.equal(legacyPreview.contentType, 'image/jpeg');
  await saveImageMetadata(root, 'nuevo-post', 'Foto-Legacy.JPG', { alt: 'Imagen antigua' }, options);
  assert.equal((await listPostImages(root, 'nuevo-post', options)).find((image) => image.file === 'Foto-Legacy.JPG')?.alt, 'Imagen antigua');
  await deletePostImage(root, 'nuevo-post', 'Foto-Legacy.JPG', options);
  await assert.rejects(() => readPostImage(root, 'nuevo-post', 'Foto-Legacy.JPG', options), /ENOENT/);
  await assert.rejects(() => readPostImage(root, 'nuevo-post', '../foto.webp', options), /Imagen invalida/);
});

const tenantCases = [
  {
    siteKey: 'samuelcoachdealeman',
    name: 'Samuel Coach de Alemán',
    publicDir: 'f',
    publicPostBase: '/f/',
    productionUrl: 'https://www.samuelcoachdealeman.com',
  },
  {
    siteKey: 'personaltrainerfuengirola',
    name: 'Personal Trainer Fuengirola',
    publicDir: 'blog',
    publicPostBase: '/blog/',
    productionUrl: 'https://personaltrainerfuengirola.com',
  },
];

for (const tenant of tenantCases) {
  test(`${tenant.siteKey} resolves its public post base against productionUrl`, () => {
    assert.equal(
      resolvePublicPostBase({ productionUrl: tenant.productionUrl, blogger: { publicPostBase: tenant.publicPostBase } }),
      `${tenant.productionUrl}${tenant.publicPostBase}`,
    );
  });

  test(`${tenant.siteKey} preserves defaults, rename and complete image lifecycle`, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), `studio-${tenant.siteKey}-`));
    const options = {
      publicDir: tenant.publicDir,
      publicPostBase: tenant.publicPostBase,
      productionUrl: tenant.productionUrl,
      previewBase: `/api/blogger/${tenant.siteKey}/posts`,
    };
    const created = await savePost(root, null, {
      title: 'Artículo inicial',
      slug: 'articulo-inicial',
      description: 'Descripción suficiente para guardar.',
      body: '<p>Contenido</p>',
      content_format: 'html',
    }, { defaultAuthor: tenant.name, defaultLanguage: 'es' }, options);
    assert.equal(created.meta.author, tenant.name);
    assert.equal(created.meta.lang, 'es');

    const uploaded = await savePostImage(root, created.slug, 'Foto Principal.WEBP', 'aW1hZ2U=', options);
    assert.equal(uploaded.url, `${tenant.productionUrl}${tenant.publicPostBase}articulo-inicial/img/foto-principal.webp`);
    assert.equal(uploaded.previewUrl, `/api/blogger/${tenant.siteKey}/posts/articulo-inicial/images/foto-principal.webp/preview`);
    await saveImageMetadata(root, created.slug, uploaded.file, {
      alt: '  Texto alternativo  ',
      description: '  Pie de foto  ',
      isFeatured: true,
    }, options);
    assert.deepEqual((await listPostImages(root, created.slug, options))[0], {
      file: 'foto-principal.webp',
      url: uploaded.url,
      previewUrl: uploaded.previewUrl,
      bytes: 5,
      alt: 'Texto alternativo',
      description: 'Pie de foto',
      isFeatured: true,
      canDelete: true,
      source: 'local',
    });

    const renamed = await savePost(root, created.slug, {
      ...created.meta,
      title: 'Artículo renombrado',
      slug: 'articulo-renombrado',
      description: 'Descripción suficiente para renombrar.',
      body: created.body,
      content_format: 'html',
    }, { defaultAuthor: tenant.name, defaultLanguage: 'es' }, options);
    assert.equal(renamed.slug, 'articulo-renombrado');
    assert.equal((await readPostImage(root, renamed.slug, uploaded.file, options)).data.toString(), 'image');
    await assert.rejects(() => readPost(root, created.slug, {}, options), /ENOENT/);

    assert.deepEqual(await deletePostImage(root, renamed.slug, uploaded.file, options), { deleted: uploaded.file });
    assert.deepEqual(await listPostImages(root, renamed.slug, options), []);
  });

  test(`${tenant.siteKey} rejects slug and image traversal`, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), `studio-${tenant.siteKey}-traversal-`));
    const options = {
      publicDir: tenant.publicDir,
      publicPostBase: tenant.publicPostBase,
      productionUrl: tenant.productionUrl,
      previewBase: `/api/blogger/${tenant.siteKey}/posts`,
    };
    await assert.rejects(() => readPost(root, '../secrets', {}, options), /Slug invalido/);
    await assert.rejects(() => savePostImage(root, 'safe-post', '../secret.webp', 'aW1hZ2U=', options), /Imagen invalida/);
    await assert.rejects(() => readPostImage(root, 'safe-post', '%2e%2e%2fsecret.webp', options), /Imagen invalida/);
  });
}

for (const tenant of tenantCases) {
  const otherSiteKey = tenantCases.find((candidate) => candidate.siteKey !== tenant.siteKey).siteKey;
  test(`${tenant.siteKey} client authorization cannot cross into ${otherSiteKey}`, () => {
    const identity = { userId: 'client-1', role: 'client' };
    const memberships = [{ userId: 'client-1', siteKey: tenant.siteKey }];
    assert.equal(canAccessBloggerSite(identity, tenant.siteKey, memberships), true);
    assert.equal(canAccessBloggerSite(identity, otherSiteKey, memberships), false);
  });

  test(`${tenant.siteKey} extracts exactly article-body with nested divs`, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), `studio-${tenant.siteKey}-exact-`));
    await mkdir(path.join(root, tenant.publicDir, 'exact-post'), { recursive: true });
    await writeFile(
      path.join(root, tenant.publicDir, 'exact-post', 'index.html'),
      '<main><h1>Exact post</h1><div class="article-body"><div class="inner"><p>Editable</p></div><p>Final</p></div><aside><div>NO EXTRAER</div></aside></main>',
    );
    const post = await readPost(root, 'exact-post', {}, {
      publicDir: tenant.publicDir,
      publicPostBase: tenant.publicPostBase,
      productionUrl: tenant.productionUrl,
    });
    assert.equal(post.body, '<div class="inner"><p>Editable</p></div><p>Final</p>');
    assert.doesNotMatch(post.body, /NO EXTRAER|aside/);
  });
}
