import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProjectDestination } from '../src/lib/projects/model.mjs';

test('accepts HTTPS canonical and www destinations without rewriting direct URLs', () => {
  for (const domain of ['example.com', 'www.example.com', 'EXAMPLE.COM']) {
    for (const url of ['https://example.com/admin/blog/?next=%2Fposts#edit', 'https://www.example.com/admin/', 'https://EXAMPLE.com:443/a%2fb']) {
      assert.equal(validateProjectDestination(url, domain, true), true);
    }
  }
});

test('rejects production HTTP and accepts development HTTP only on the project domain', () => {
  assert.equal(validateProjectDestination('http://example.com/editor', 'example.com', true), false);
  assert.equal(validateProjectDestination('http://example.com/editor', 'example.com', false), true);
  assert.equal(validateProjectDestination('http://foreign.com/editor', 'example.com', false), false);
  assert.equal(validateProjectDestination('http://example.com/editor', 'example.com'), false);
});

test('rejects malformed, credential-bearing, non-web and foreign destinations', () => {
  for (const url of [null, undefined, 42, '', '/admin', '//example.com/admin', 'not a URL',
    'https://user:pass@example.com/admin', 'https://user@example.com', 'ftp://example.com/admin',
    'javascript:alert(1)', 'https://evil.com', 'https://example.com.evil.com',
    'https://sub.example.com', 'https://example.com@evil.com', 'https://example.com:8443/admin',
    ' https://example.com', 'https://example.com\n/admin', 'https:\\example.com\\admin']) {
    assert.equal(validateProjectDestination(url, 'example.com', true), false, String(url));
  }
});

test('rejects empty raw authorities repaired by WHATWG parsing', () => {
  for (const url of ['https:///example.com/admin', 'https:////example.com', 'http:///example.com', 'https://?example.com', 'https://#example.com']) {
    assert.equal(validateProjectDestination(url, 'example.com', false), false, url);
  }
});

test('rejects IPs, localhost and invalid canonical domains even when hosts match', () => {
  for (const domain of ['localhost', 'foo.localhost', '127.0.0.1', '127.1', '2130706433',
    '0x7f000001', '[::1]', '192.168.1.1', '', null, 'https://example.com',
    'example.com/path', 'example.com:443', 'user@example.com', '*.example.com', '-bad.com', 'bad_.com']) {
    for (const production of [true, false]) {
      assert.equal(validateProjectDestination(`https://${domain}/admin`, domain, production), false, String(domain));
    }
  }
});
