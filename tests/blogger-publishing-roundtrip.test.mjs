import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {saveBloggerPost,readBloggerPost,listBloggerPosts,saveBloggerPostImage,publishBloggerPost,deleteBloggerPostImage,updateBloggerPostImage,readBloggerPostImage} from '../src/lib/blogger/publisher.mjs';

import test from 'node:test';

test('Sport Blogger preserves articles, images, tags and publication state through a complete isolated round trip', async (t) => {
  const previousFetch = globalThis.fetch;
  const previousEnv = { token: process.env.BLOGGER_GITHUB_TOKEN, branch: process.env.BLOGGER_GITHUB_BRANCH, deepl: process.env.DEEPL_AUTH_KEY };
  t.after(() => { globalThis.fetch = previousFetch; for (const [key, value] of [['BLOGGER_GITHUB_TOKEN', previousEnv.token], ['BLOGGER_GITHUB_BRANCH', previousEnv.branch], ['DEEPL_AUTH_KEY', previousEnv.deepl]]) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  process.env.BLOGGER_GITHUB_TOKEN='offline-fixture-only';
  process.env.BLOGGER_GITHUB_BRANCH='main';
  delete process.env.DEEPL_AUTH_KEY;
  const files=new Map([['blog/index.html',Buffer.from('<html><body><main><h1>Existing blog</h1></main></body></html>')]]);
  const calls=[];
  const translations=[];
  const trees = new Map();
  const commits = new Map();
  let revision = 0;
  let head = 'fixture-head-0';
  let rejectNextPublication = false;
  const sha=buffer=>createHash('sha1').update(buffer).digest('hex');
  globalThis.fetch=async (input,options={})=>{
    const url=new URL(input);
    if (url.hostname === 'api.deepl.com') {
      const payload = JSON.parse(options.body);
      translations.push(payload);
      return Response.json({ translations: [{ text: payload.text[0].replaceAll('A test article', 'Un artículo de prueba').replaceAll('Offline Blogger publishing test', 'Artículo de prueba').replaceAll('Test text.', 'Texto de prueba.') }] });
    }
    if(url.hostname!=='api.github.com')throw Error('External provider blocked in offline test');
    const repository = '/repos/samuelhogarola-ship-it/sportmassage';
    const method=options.method||'GET';
    if (url.pathname.startsWith(`${repository}/git/`)) {
      calls.push({ method, path: url.pathname });
      if (url.pathname.endsWith('/git/ref/heads/main')) return Response.json({ object: { sha: head } });
      if (method === 'GET' && url.pathname.includes('/git/commits/')) {
        assert.equal(url.pathname.split('/').pop(), head);
        trees.set(`base-${head}`, new Map(files));
        return Response.json({ tree: { sha: `base-${head}` } });
      }
      const payload = JSON.parse(options.body);
      if (url.pathname.endsWith('/git/trees')) {
        assert.ok(trees.has(payload.base_tree), 'publication must preserve the base repository tree');
        const staged = new Map(trees.get(payload.base_tree));
        for (const entry of payload.tree) staged.set(entry.path, Buffer.from(entry.content));
        const sha = `tree-${++revision}`;
        trees.set(sha, staged);
        return Response.json({ sha });
      }
      if (url.pathname.endsWith('/git/commits')) {
        const sha = `commit-${++revision}`;
        commits.set(sha, payload);
        return Response.json({ sha });
      }
      if (method === 'PATCH' && url.pathname.endsWith('/git/refs/heads/main')) {
        assert.equal(payload.force, false);
        const commit = commits.get(payload.sha);
        if (rejectNextPublication || commit.parents[0] !== head) {
          rejectNextPublication = false;
          return Response.json({ message: 'Reference update rejected' }, { status: 422 });
        }
        files.clear();
        for (const [path, data] of trees.get(commit.tree)) files.set(path, data);
        head = payload.sha;
        return Response.json({ object: { sha: head } });
      }
      throw new Error('Unexpected Git database operation');
    }
    const prefix=`${repository}/contents`;
    if(!url.pathname.startsWith(prefix))throw Error('Unexpected repository endpoint');
    const path=decodeURIComponent(url.pathname.slice(prefix.length).replace(/^\//,''));
    calls.push({method,path});
    if(method==='PUT'){
      const payload=JSON.parse(options.body);
      const existing=files.get(path);
      if(existing&&payload.sha!==sha(existing))return Response.json({message:'sha mismatch'},{status:409});
      const content=Buffer.from(payload.content,'base64');
      files.set(path,content);
      head = `contents-${++revision}`;
      return Response.json({content:{sha:sha(content)}});
    }
    if(method==='DELETE'){
      const payload=JSON.parse(options.body);
      if(!files.has(path)||payload.sha!==sha(files.get(path)))return new Response('',{status:409});
      files.delete(path);head = `contents-${++revision}`;return Response.json({content:null});
    }
    if(files.has(path)) {
      const content = files.get(path);
      if (options.headers?.Accept === 'application/vnd.github.raw+json') return new Response(content);
      return Response.json({sha:sha(content),content:content.length > 1024 * 1024 ? '' : content.toString('base64'),encoding:content.length > 1024 * 1024 ? 'none' : 'base64'});
    }
    const children=[...files.keys()].filter(key=>key.startsWith(path?path+'/':'')&&key!==path);
    if(!children.length&&path)return new Response('',{status:404});
    const entries=[...new Set(children.map(key=>key.slice(path?path.length+1:0).split('/')[0]))];
    return Response.json(entries.map(name=>({name,path:path?`${path}/${name}`:name,type:files.has(path?`${path}/${name}`:name)?'file':'dir'})));
  };
  
  const results=[];
  function check(name,actual,expected=true){try{assert.deepEqual(actual,expected);results.push({name,passed:true});}catch{results.push({name,passed:false,actual,expected});}}
  const slug='offline-blogger-publishing-test';
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1cAAAAASUVORK5CYII=','base64');
  const post={title:'Offline Blogger publishing test',slug,description:'Local test, never published online',lang:'en',publish_languages:['en'],tags:['massage','recovery'],category:'Wellbeing',level:'General',image:'img/test.png',content_format:'markdown',body:`## A test article\n\n![Test photo](/blog/${slug}/img/test.png)`,status:'draft'};
  await saveBloggerPost(null,post);
  let reopened=await readBloggerPost(slug);
  check('Draft title and body survive reopening',reopened.meta.title===post.title&&reopened.body.trim()===post.body);
  check('Tags survive reopening',reopened.meta.tags,'massage, recovery');
  check('Category survives reopening',reopened.meta.category,post.category);
  check('Featured image survives reopening',reopened.meta.image,post.image);
  const uploaded=await saveBloggerPostImage(slug,'test.png',png.toString('base64'),{alt:'Test photograph',description:'Offline image metadata'});
  check('Uploaded PNG bytes remain intact',files.get(`blog/${slug}/img/test.png`).equals(png));
  reopened=await readBloggerPost(slug);
  check('Uploaded image appears after reopening',reopened.images.some(image=>image.file==='test.png'));
  check('Image alt text survives reopening',reopened.images[0]?.alt,'Test photograph');
  check('Image description survives reopening',reopened.images[0]?.description,'Offline image metadata');
  await publishBloggerPost(reopened.meta,reopened.body);
  let html=files.get(`blog/${slug}/index.html`).toString();
  check('Generated article contains the title',html.includes(post.title));
  check('Generated article contains tags',html.includes('<span>massage</span>')&&html.includes('<span>recovery</span>'));
  check('Markdown photograph becomes an image element',html.includes(`<img src="/blog/${slug}/img/test.png"`));
  reopened=await readBloggerPost(slug);
  check('Individual post reports published status',reopened.isPublished);
  const listing=await listBloggerPosts();
  check('Post list reports published status',listing.find(item=>item.slug===slug)?.isPublished);
  check('Post list exposes tags required by search',Array.isArray(listing[0]?.tags));
  check('Chosen publication languages survive publishing',reopened.meta.publish_languages,'en');
  const htmlBody=`<h2>A test article</h2><p>Test text.</p><img src="${uploaded.url}" alt="Test photograph"><a href="https://example.com/?a=1&amp;b=2">Link</a><img src="https://example.com/photo.jpg?a=1&amp;b=2" alt="Recovery &amp; sports">`;
  await saveBloggerPost(slug,{...post,content_format:'html',body:htmlBody});
  await publishBloggerPost({...post,content_format:'html'},htmlBody);
  html=files.get(`blog/${slug}/index.html`).toString();
  check('HTML photograph renders with alt text',html.includes(`<img src="${uploaded.url}" alt="Test photograph">`));
  check('Repeated saving and publication preserve encoded URL attributes', html.includes('href="https://example.com/?a=1&amp;b=2"') && html.includes('alt="Recovery &amp; sports"'));
  const index=files.get('blog/index.html').toString();
  check('Updating an article does not duplicate its index entry',(index.match(new RegExp(`href="/blog/${slug}/"`,'g'))||[]).length,1);
  let translationError;
  const writesBeforeFailure = calls.filter(call => call.method !== 'GET').length;
  try{await publishBloggerPost({...post,publish_languages:['en','es'],content_format:'html'},htmlBody);}catch(error){translationError=error.message;}
  check('Missing translation credential produces an explicit failure',translationError,'Missing DEEPL_AUTH_KEY');
  check('Missing translation credential never writes partial articles', calls.filter(call => call.method !== 'GET').length, writesBeforeFailure);
  process.env.DEEPL_AUTH_KEY = 'offline-fixture-only';
  await publishBloggerPost({...post,publish_languages:['en','es'],content_format:'html'},htmlBody);
  const spanish = files.get(`blog/${slug}/es/index.html`).toString();
  check('Translated article contains translated title and body', spanish.includes('<h1>Artículo de prueba</h1>') && spanish.includes('<h2>Un artículo de prueba</h2>'));
  check('Translated canonical URL points to the language directory', spanish.includes(`href="https://sportmassagefuengirola.com/blog/${slug}/es/"`));
  check('Translated photograph keeps the original public asset URL', spanish.includes(`src="${uploaded.url}"`));
  check('Automatic translation receives HTML with language selection', translations.length === 3 && translations.every(request => request.tag_handling === 'html' && request.target_lang === 'ES'));
  check('Publication preserves selected languages after translation', (await readBloggerPost(slug)).meta.publish_languages, 'en,es');
  await updateBloggerPostImage(slug, 'test.png', { alt: 'Updated photograph', description: 'Updated caption', isFeatured: true });
  reopened = await readBloggerPost(slug);
  check('Editing image details persists across reopening', reopened.images[0].alt === 'Updated photograph' && reopened.images[0].description === 'Updated caption');
  check('Featured image selection persists', reopened.images[0].isFeatured && reopened.meta.image === 'img/test.png');
  const preview = await readBloggerPostImage(slug, 'test.png');
  check('Private image preview returns exact bytes and MIME type', preview.data.equals(png) && preview.contentType === 'image/png');
  check('Image preview is served through the authenticated API', reopened.images[0].previewUrl, `/api/posts/${slug}/images/test.png`);
  const largeImage = Buffer.alloc(2 * 1024 * 1024, 71);
  await saveBloggerPostImage(slug, 'camera.jpg', largeImage.toString('base64'));
  const largePreview = await readBloggerPostImage(slug, 'camera.jpg');
  check('Camera photographs larger than 1 MB return full raw preview bytes', largePreview.data.equals(largeImage));
  const failedSlug = 'failed-publication';
  await saveBloggerPost(null, { ...post, slug: failedSlug, image: '', publish_languages: ['en'] });
  rejectNextPublication = true;
  await assert.rejects(publishBloggerPost({ ...post, slug: failedSlug, image: '', publish_languages: ['en'] }, post.body), /GitHub request failed: 422/);
  check('A rejected publication never exposes partial article HTML', !files.has(`blog/${failedSlug}/index.html`));
  check('A rejected publication leaves its source in draft state', (await readBloggerPost(failedSlug)).meta.status, 'draft');
  check('A rejected publication is not listed as published', (await listBloggerPosts()).find(post => post.slug === failedSlug).isPublished, false);
  check('Atomic publication preserves unrelated repository files', files.has(`blog/${slug}/img/camera.jpg`));
  await deleteBloggerPostImage(slug,'test.png');
  check('Image deletion removes the file from the isolated repository',!files.has(`blog/${slug}/img/test.png`));
  reopened = await readBloggerPost(slug);
  check('Deleting the featured image clears its selection', reopened.meta.image || '', '');
  check('Deleting an image removes its metadata while preserving other images', !Object.hasOwn(JSON.parse(files.get(`blog-posts/${slug}.images.json`).toString()), 'test.png') && Object.hasOwn(JSON.parse(files.get(`blog-posts/${slug}.images.json`).toString()), 'camera.jpg'));
  assert.equal(results.filter(result => !result.passed).length, 0, JSON.stringify(results.filter(result => !result.passed), null, 2));
  
});
