import assert from 'node:assert/strict';
import test from 'node:test';
import { loadProjectModule } from './helpers/project-harness.mjs';

const path = 'src/app/api/posts/[slug]/images/[file]/route.ts';
const url = 'https://admin.webfuengirola.com/api/posts/recovery/images/photo.png';
const context = () => ({ params: Promise.resolve({ slug: 'recovery', file: 'photo.png' }) });

function routes({ authorized = true, publisher = {} } = {}) {
  return loadProjectModule(path, {
    '@/lib/blogger/legacy-authorize': { async authorizeSportBlogger() { if (!authorized) throw Object.assign(new Error('unauthorized'), { status: 401 }); } },
    '@/lib/blogger/publisher.mjs': publisher,
  });
}

test('private image previews return exact bytes with no caching and sandbox active content', async () => {
  const data = Buffer.from([137, 80, 78, 71]);
  const route = routes({ publisher: { async readBloggerPostImage(slug, file) {
    assert.equal(slug, 'recovery'); assert.equal(file, 'photo.png');
    return { data, contentType: 'image/png' };
  } } });
  const response = await route.GET(new Request(url), context());
  assert.equal(response.status, 200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), data);
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('content-security-policy'), /sandbox; default-src 'none'/);
});

test('private image previews require Sport Blogger authorization before accessing GitHub', async () => {
  let accessed = false;
  const route = routes({ authorized: false, publisher: { async readBloggerPostImage() { accessed = true; } } });
  const response = await route.GET(new Request(url), context());
  assert.equal(response.status, 401); assert.equal(accessed, false);
});

test('image detail updates persist metadata through the publisher', async () => {
  const metadata = { alt: 'Massage photograph', description: 'Treatment room', isFeatured: true };
  const route = routes({ publisher: { async updateBloggerPostImage(slug, file, payload) {
    assert.equal(slug, 'recovery'); assert.equal(file, 'photo.png'); assert.deepEqual(payload, metadata);
    return { file, ...payload };
  } } });
  const response = await route.PUT(new Request(url, { method: 'PUT', headers: { origin: new URL(url).origin, 'content-type': 'application/json' }, body: JSON.stringify(metadata) }), context());
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { file: 'photo.png', ...metadata });
});

test('image detail updates reject foreign origins and unauthorized sessions without writes', async () => {
  for (const [authorized, origin, expected] of [[true, 'https://foreign.example', 403], [false, new URL(url).origin, 401]]) {
    let written = false;
    const route = routes({ authorized, publisher: { async updateBloggerPostImage() { written = true; } } });
    const response = await route.PUT(new Request(url, { method: 'PUT', headers: { origin, 'content-type': 'application/json' }, body: '{}' }), context());
    assert.equal(response.status, expected); assert.equal(written, false);
  }
});
