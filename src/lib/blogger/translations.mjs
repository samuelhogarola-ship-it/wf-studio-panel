import { createHash } from 'node:crypto';
import { sanitizeHtml } from './sanitize.mjs';

const languages = new Set(['fi', 'en', 'es']);
const names = { fi: 'Finnish', en: 'English', es: 'Spanish' };
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const text = value => String(value || '').trim();

export function sourceFingerprint(meta, body) {
  return hash([text(meta.lang || 'fi'), text(meta.title).replace(/[\r\n]+/g, ' '), text(meta.description).replace(/[\r\n]+/g, ' '), meta.content_format || 'html', text(body)]);
}

export function normalizeTranslationDrafts(input = {}, source, previous = input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid translation drafts');
  const result = {};
  for (const [language, value] of Object.entries(input)) {
    if (!languages.has(language) || !value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid translation language or content');
    const format = value.format === 'markdown' ? 'markdown' : 'html';
    const draft = { title: text(value.title), description: text(value.description), body: format === 'html' ? sanitizeHtml(text(value.body)) : text(value.body), format };
    draft.contentFingerprint = hash([draft.title, draft.description, draft.body, draft.format]);
    const old = previous?.[language];
    draft.sourceFingerprint = old?.sourceFingerprint || source;
    draft.reviewedSourceFingerprint = old?.reviewedSourceFingerprint || '';
    draft.reviewedContentFingerprint = old?.reviewedContentFingerprint || '';
    draft.reviewed = old?.reviewed === true && draft.reviewedSourceFingerprint === source && draft.reviewedContentFingerprint === draft.contentFingerprint;
    result[language] = draft;
  }
  return result;
}

export function approveTranslationDraft(drafts, language, source, expectedSource, expectedContent) {
  const draft = drafts[language];
  if (!draft || expectedSource !== source || expectedContent !== draft.contentFingerprint) throw new Error('The original or translation changed. Save and review the current version again.');
  if (!draft.title || !draft.description || !draft.body) throw new Error('Complete the translated title, SEO description and content before approval.');
  return { ...drafts, [language]: { ...draft, sourceFingerprint: source, reviewedSourceFingerprint: source, reviewedContentFingerprint: draft.contentFingerprint, reviewed: true } };
}

export function publicationTranslations(meta, body, drafts = {}) {
  const original = text(meta.lang || 'fi');
  if (!languages.has(original)) throw new Error('Invalid original language');
  const selected = Array.isArray(meta.publish_languages) ? meta.publish_languages : String(meta.publish_languages || original).split(',').map(text);
  const source = sourceFingerprint(meta, body);
  return [...new Set([original, ...selected])].map(language => {
    if (!languages.has(language)) throw new Error('Invalid publication language');
    if (language === original) return { language, title: meta.title, description: meta.description, body, format: meta.content_format || 'html' };
    const draft = drafts[language];
    if (!draft?.reviewed || draft.reviewedSourceFingerprint !== source || draft.reviewedContentFingerprint !== hash([draft.title, draft.description, draft.body, draft.format])) throw new Error(`Review and approve the ${names[language]} translation before publishing.`);
    return { language, title: draft.title, description: draft.description, body: draft.body, format: draft.format };
  });
}
