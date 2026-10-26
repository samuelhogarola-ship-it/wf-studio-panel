import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { sourceFingerprint, normalizeTranslationDrafts, approveTranslationDraft, publicationTranslations } from '../src/lib/blogger/translations.mjs';

const html = await readFile(new URL('../public/blogger/index.html',import.meta.url),'utf8');
const script = await readFile(new URL('../public/blogger/app.js',import.meta.url),'utf8');

async function editor(t, {available = false, initialPost, delaySave = false} = {}) {
  const dom = new JSDOM(html,{url:'https://editor.test/blogger/index.html',runScripts:'outside-only'});
  t.after(()=>dom.window.close());
  const {window}=dom;
  window.structuredClone=structuredClone;
  window.HTMLElement.prototype.scrollTo=()=>{};
  Object.defineProperty(window.HTMLElement.prototype,'innerText',{get(){return this.textContent;},set(value){this.textContent=value;}});
  window.confirm=()=>true;
  let saved = initialPost ? {...initialPost.meta,body:initialPost.body,translations:initialPost.translations || {}} : undefined;
  let generated = 0;
  let published;
  let releaseSave;
  function post() { return {slug:saved.slug,meta:saved,body:saved.body,format:saved.content_format,translations:saved.translations,sourceFingerprint:sourceFingerprint(saved,saved.body),images:initialPost?.images||[],isPublished:!!published}; }
  window.fetch=async(url,options={})=>{
    if(url==='/api/posts' && (!options.method || options.method==='GET')) return Response.json({posts:initialPost?[{slug:saved.slug,title:saved.title,tags:[],images:[],words:2}]:[],translationAvailable:available});
    if((url==='/api/posts' && options.method==='POST') || (url===`/api/posts/${saved?.slug}` && options.method==='PUT')) {
      if (delaySave) await new Promise(resolve=>{releaseSave=resolve;});
      const payload=JSON.parse(options.body);
      payload.translations=normalizeTranslationDrafts(payload.translations,sourceFingerprint(payload,payload.body),saved?.translations||{});
      saved=payload;return Response.json(post());
    }
    if(url===`/api/posts/${saved?.slug}`) return Response.json(post());
    if(url===`/api/posts/${saved?.slug}/translations`) {
      const payload=JSON.parse(options.body);
      if(payload.action==='generate') {
        generated++;
        for(const language of payload.languages) saved.translations[language]=normalizeTranslationDrafts({[language]:{title:`Generated ${language}`,description:`SEO ${language}`,body:`<p>Generated ${language} content.</p>`,format:'html'}},sourceFingerprint(saved,saved.body),{})[language];
      } else saved.translations=approveTranslationDraft(saved.translations,payload.language,sourceFingerprint(saved,saved.body),payload.sourceFingerprint,payload.contentFingerprint);
      return Response.json(post());
    }
    if(url==='/api/build') {
      try {published=publicationTranslations(saved,saved.body,saved.translations);saved.status='published';return Response.json({url:'/blog/'+saved.slug+'/'});}
      catch(error) {return Response.json({error:error.message},{status:400});}
    }
    if(String(url).includes('/images/')) return Response.json({file:'photo.png',url:'https://sportmassagefuengirola.com/blog/hieronta/img/photo.png',alt:'updated'});
    throw new Error(`Unexpected request ${url}`);
  };
  window.eval(script);
  await new Promise(resolve=>setImmediate(resolve));
  return {window,document:window.document,saved:()=>saved,generated:()=>generated,published:()=>published,releaseSave:()=>releaseSave?.()};
}
function input(window,selector,value) {const field=window.document.querySelector(selector);field.value=value;field.dispatchEvent(new window.Event('input',{bubbles:true}));}
function body(window,value) {window.document.querySelector('#visualEditor').innerHTML=value;window.document.querySelector('#visualEditor').dispatchEvent(new window.Event('input',{bubbles:true}));}

test('language tabs retain Finnish original and manual English/Spanish edits through saving without a provider', async t=>{
  const {window,document,saved}=await editor(t);
  assert.equal(document.querySelector('#lang').value,'fi');
  assert.equal(document.querySelector('#generateTranslations').disabled,true);
  input(window,'#title','Hieronta');input(window,'#description','Palautuminen');body(window,'<p>Suomenkielinen teksti.</p>');
  document.querySelector('[data-language="en"]').click();
  input(window,'#title','Massage');input(window,'#description','Recovery');body(window,'<p>Her edited English wording.</p>');
  document.querySelector('[data-language="es"]').click();
  input(window,'#title','Masaje');input(window,'#description','Recuperación');body(window,'<p>Su texto revisado.</p>');
  document.querySelector('[data-language="fi"]').click();
  assert.equal(document.querySelector('#title').value,'Hieronta');
  assert.match(document.querySelector('#visualEditor').textContent,/Suomenkielinen/);
  document.querySelector('[data-language="en"]').click();
  assert.match(document.querySelector('#visualEditor').textContent,/Her edited English/);
  document.querySelector('#savePost').click();
  for(let i=0;i<5;i++) await new Promise(resolve=>setImmediate(resolve));
  assert.equal(saved().lang,'fi');assert.equal(saved().title,'Hieronta');
  assert.match(saved().translations.en.body,/Her edited English/);
  assert.match(saved().translations.es.body,/Su texto revisado/);
  assert.equal(document.querySelector('#title').value,'Massage');
  assert.equal(document.querySelector('#generateTranslations').disabled,true);
});

test('generate, edit, approve and publish uses saved review texts and regenerates only on explicit request',async t=>{
  const {window,document,generated,published,saved}=await editor(t,{available:true});
  const settle=async()=>{for(let i=0;i<12;i++) await new Promise(resolve=>setImmediate(resolve));};
  input(window,'#title','Hieronta');input(window,'#description','Palautuminen');body(window,'<p>Alkuperäinen teksti.</p>');
  for(const option of document.querySelector('#publishLanguages').options) option.selected=true;
  document.querySelector('#generateTranslations').click();await settle();
  assert.equal(generated(),1);
  document.querySelector('[data-language="en"]').click();
  body(window,'<p>Her final revised English.</p>');
  document.querySelector('#approveTranslation').click();await settle();
  assert.equal(saved().translations.en.reviewed,true);
  document.querySelector('#publishPost').click();await settle();
  assert.equal(published(),undefined);
  assert.match(document.querySelector('#statusText').textContent,/approve.*Spanish/i);
  document.querySelector('[data-language="es"]').click();document.querySelector('#approveTranslation').click();await settle();
  document.querySelector('#publishPost').click();await settle();
  assert.equal(published().find(variant=>variant.language==='en').body,'<p>Her final revised English.</p>');
  assert.equal(generated(),1);
  document.querySelector('#generateTranslations').click();await settle();
  assert.equal(generated(),2);
  assert.equal(saved().translations.en.reviewed,false);
  assert.doesNotMatch(saved().translations.en.body,/Her final revised/);
});

test('image detail refresh preserves unsaved translated wording',async t=>{
  const {window,document}=await editor(t,{initialPost:{meta:{slug:'hieronta',title:'Hieronta',description:'Palautuminen',lang:'fi',content_format:'html',publish_languages:['fi']},body:'<p>Original</p>',images:[{file:'photo.png',url:'https://sportmassagefuengirola.com/blog/hieronta/img/photo.png'}]}});
  assert.equal(document.querySelector('.delete-image').disabled,false);
  document.querySelector('[data-language="en"]').click();
  input(window,'#title','Unsaved English title');body(window,'<p>Keep my unsaved wording.</p>');
  document.querySelector('#saveImageMeta').click();
  for(let i=0;i<5;i++) await new Promise(resolve=>setImmediate(resolve));
  assert.equal(document.querySelector('#title').value,'Unsaved English title');
  assert.match(document.querySelector('#visualEditor').textContent,/Keep my unsaved wording/);
});

test('pending save locks new-post navigation until its exact response is applied',async t=>{
  const {window,document,releaseSave}=await editor(t,{delaySave:true});
  input(window,'#title','Hieronta');input(window,'#description','Palautuminen');body(window,'<p>Original text.</p>');
  document.querySelector('#savePost').click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(document.querySelector('#newPost').disabled,true);
  document.querySelector('#newPost').click();
  assert.equal(document.querySelector('#title').value,'Hieronta');
  releaseSave();
  for(let i=0;i<8;i++) await new Promise(resolve=>setImmediate(resolve));
  assert.equal(document.querySelector('#newPost').disabled,false);
  assert.equal(document.querySelector('#title').value,'Hieronta');
});
