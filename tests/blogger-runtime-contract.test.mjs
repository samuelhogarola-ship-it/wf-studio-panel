import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildHookRequest } from '../src/lib/blogger/build-hook.mjs';
import { listPosts, readPost, readPostImage, savePost, savePostImage } from '../src/lib/blogger/content-store.mjs';

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
  await assert.rejects(() => readPostImage(root, 'nuevo-post', '../foto.webp', options), /Imagen invalida/);
});
