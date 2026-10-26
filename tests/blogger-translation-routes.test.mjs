import assert from 'node:assert/strict';
import test from 'node:test';
import { loadProjectModule } from './helpers/project-harness.mjs';

const url = 'https://admin.webfuengirola.com/api/posts/hieronta/translations';
function route(authorized, calls) {
  return loadProjectModule('src/app/api/posts/[slug]/translations/route.ts', {
    '@/lib/blogger/legacy-authorize': { async authorizeSportBlogger() { if (!authorized) throw Object.assign(new Error('unauthorized'), {status:401}); } },
    '@/lib/blogger/publisher.mjs': {
      async generateBloggerTranslations(...args) { calls.push(['generate', ...args]); return {translations:{}}; },
      async approveBloggerTranslation(...args) { calls.push(['approve', ...args]); return {translations:{}}; },
    },
  });
}
const request = (payload, origin = new URL(url).origin) => new Request(url, {method:'POST', headers:{origin,'content-type':'application/json'},body:JSON.stringify(payload)});
const context = () => ({params:Promise.resolve({slug:'hieronta'})});

test('translation generation and approval use separate explicit authenticated actions', async () => {
  const calls=[]; const module=route(true,calls);
  assert.equal((await module.POST(request({action:'generate',languages:['en','es']}),context())).status,200);
  assert.equal((await module.POST(request({action:'approve',language:'en',sourceFingerprint:'source',contentFingerprint:'content'}),context())).status,200);
  assert.deepEqual(calls,[['generate','hieronta',['en','es']],['approve','hieronta','en','source','content']]);
});
test('translation actions reject foreign origins, unauthorized sessions and unknown actions', async () => {
  const calls=[];
  assert.equal((await route(true,calls).POST(request({action:'generate'},'https://evil.example'),context())).status,403);
  assert.equal((await route(false,calls).POST(request({action:'generate'}),context())).status,401);
  assert.equal((await route(true,calls).POST(request({action:'publish'}),context())).status,400);
  assert.deepEqual(calls,[]);
});
