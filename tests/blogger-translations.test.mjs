import assert from 'node:assert/strict';
import test from 'node:test';
import { sourceFingerprint, normalizeTranslationDrafts, approveTranslationDraft, publicationTranslations } from '../src/lib/blogger/translations.mjs';
import { buildPostHtml } from '../src/lib/blogger/publisher.mjs';

const meta = { slug: 'hieronta', lang: 'fi', title: 'Hieronta', description: 'Palautuminen', content_format: 'html', publish_languages: ['fi', 'en', 'es'] };
const original = '<p>Alkuperäinen teksti.</p>';
const drafts = { en: { title: 'Massage', description: 'Recovery', body: '<p>Original text.</p>', format: 'html' }, es: { title: 'Masaje', description: 'Recuperación', body: '<p>Texto original.</p>', format: 'html' } };

test('localized drafts preserve edits and approvals only for the exact saved source and content', () => {
  const fingerprint = sourceFingerprint(meta, original);
  let translations = normalizeTranslationDrafts(drafts, fingerprint);
  assert.equal(translations.en.reviewed, false);
  translations = approveTranslationDraft(translations, 'en', fingerprint, fingerprint, translations.en.contentFingerprint);
  assert.equal(translations.en.reviewed, true);
  const unchanged = normalizeTranslationDrafts(drafts, fingerprint, translations);
  assert.equal(unchanged.en.reviewed, true);
  const edited = normalizeTranslationDrafts({ ...drafts, en: { ...drafts.en, body: '<p>Her revised wording.</p>', reviewed: true } }, fingerprint, translations);
  assert.equal(edited.en.body, '<p>Her revised wording.</p>');
  assert.equal(edited.en.reviewed, false);
  assert.equal(edited.es.body, drafts.es.body);
  const sourceChanged = normalizeTranslationDrafts(translations, sourceFingerprint(meta, original + '<p>Lisää.</p>'), translations);
  assert.equal(sourceChanged.en.body, drafts.en.body);
  assert.equal(sourceChanged.en.reviewed, false);
});

test('approval rejects stale source or stale localized content and requires complete translated fields', () => {
  const fingerprint = sourceFingerprint(meta, original);
  const translations = normalizeTranslationDrafts(drafts, fingerprint);
  assert.throws(() => approveTranslationDraft(translations, 'en', fingerprint, 'old-source', translations.en.contentFingerprint), /changed/i);
  assert.throws(() => approveTranslationDraft(translations, 'en', fingerprint, fingerprint, 'old-content'), /changed/i);
  const empty = normalizeTranslationDrafts({ en: { ...drafts.en, body: '' } }, fingerprint);
  assert.throws(() => approveTranslationDraft(empty, 'en', fingerprint, fingerprint, empty.en.contentFingerprint), /complete/i);
});

test('publication uses exact approved manual texts and rejects missing or unapproved languages', () => {
  const fingerprint = sourceFingerprint(meta, original);
  let translations = normalizeTranslationDrafts(drafts, fingerprint);
  assert.throws(() => publicationTranslations(meta, original, translations), /approve/i);
  for (const lang of ['en', 'es']) translations = approveTranslationDraft(translations, lang, fingerprint, fingerprint, translations[lang].contentFingerprint);
  const variants = publicationTranslations(meta, original, translations);
  assert.equal(variants.find(variant => variant.language === 'en').body, drafts.en.body);
  assert.equal(variants.find(variant => variant.language === 'fi').body, original);
  assert.throws(() => publicationTranslations(meta, original + '<p>Updated</p>', translations), /approve/i);
  assert.equal(publicationTranslations({ ...meta, publish_languages: ['fi'] }, original, {}).length, 1);
});

test('manual translation drafts are sanitized and cannot claim approval through save payloads', () => {
  const fingerprint = sourceFingerprint(meta, original);
  const translations = normalizeTranslationDrafts({ en: { ...drafts.en, body: '<p>Safe</p><script>alert(1)</script>', reviewed: true, reviewedSourceFingerprint: fingerprint } }, fingerprint, {});
  assert.equal(translations.en.body, '<p>Safe</p>');
  assert.equal(translations.en.reviewed, false);
});

test('published language versions link to the original and both translated articles',()=>{
  const html=buildPostHtml({...meta,slug:'hieronta/en',lang:'en',publication_base_slug:'hieronta',original_language:'fi'},'<p>Reviewed text</p>');
  for(const path of ['/blog/hieronta/','/blog/hieronta/en/','/blog/hieronta/es/']) assert.ok(html.includes(`href="${path}"`));
});

test('manually reviewed translated images resolve against the original article assets',()=>{
  const html=buildPostHtml({...meta,slug:'hieronta/en',lang:'en',publication_base_slug:'hieronta',original_language:'fi'},'<img src="img/photo.png" alt="Reviewed photo">');
  assert.ok(html.includes('src="https://sportmassagefuengirola.com/blog/hieronta/img/photo.png"'));
});
