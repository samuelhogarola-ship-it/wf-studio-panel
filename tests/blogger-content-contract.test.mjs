import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const store = await import('../src/lib/blogger/content-store.mjs');

test('Blogger content barrel preserves repository, validation and image exports', async () => {
  const domains = {
    repository: ['listPosts', 'readPost', 'savePost'],
    validation: ['slugify', 'assertSafeSlug', 'normalizePostInput', 'parsePostMarkdown', 'serializePostMarkdown'],
    images: ['listPostImages', 'savePostImage', 'readPostImage', 'deletePostImage', 'saveImageMetadata'],
  };
  for (const [domain, names] of Object.entries(domains)) {
    const source = readFileSync(new URL(`../src/lib/blogger/content/${domain}.ts`, import.meta.url), 'utf8');
    for (const name of names) assert.match(source, new RegExp(`\\b${name}\\b`), `${domain}.${name}`);
  }
});

test('content validation still sanitizes HTML at the existing input boundary', () => {
  const result = store.normalizePostInput({ title: 'Post', description: 'Desc', content_format: 'html', body: '<p>ok</p><script>alert(1)</script>' });
  assert.match(result.body, /<p>ok<\/p>/);
  assert.doesNotMatch(result.body, /script|alert/);
});
