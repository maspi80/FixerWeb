const HTML_CONTENT_PATTERN = /<\/?[a-z][\s\S]*>/i;

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function isNoteHtmlContent(content) {
  return HTML_CONTENT_PATTERN.test(String(content ?? ''));
}

export function noteContentToEditorHtml(content) {
  const raw = String(content ?? '');
  if (!raw.trim()) return '';
  if (isNoteHtmlContent(raw)) return raw;
  return escapeHtml(raw)
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function normalizeNoteEditorHtml(html) {
  const value = String(html ?? '').trim();
  if (!value || value === '<p></p>' || value === '<p><br></p>' || value === '<p><br class="ProseMirror-trailingBreak"></p>') {
    return '';
  }
  return value;
}

export function noteContentPreviewText(content) {
  const raw = String(content ?? '').trim();
  if (!raw) return '';
  if (typeof document !== 'undefined') {
    const host = document.createElement('div');
    host.innerHTML = isNoteHtmlContent(raw) ? raw : noteContentToEditorHtml(raw);
    return host.textContent.replace(/\s+/g, ' ').trim();
  }
  return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function noteMatchesSearch(note, query) {
  const q = String(query ?? '').toLowerCase().trim();
  if (!q) return true;
  const haystack = `${note?.title ?? ''} ${noteContentPreviewText(note?.content)} ${note?.status ?? ''}`.toLowerCase();
  return haystack.includes(q);
}
