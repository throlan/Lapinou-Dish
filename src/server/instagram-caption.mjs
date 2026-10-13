// Public post metadata only. Never follow a redirect to an arbitrary host or login page.
export function instagramPostUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !['instagram.com', 'www.instagram.com'].includes(url.hostname)) return null;
    if (!/^\/(?:p|reel|tv)\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) return null;
    return `https://www.instagram.com${url.pathname.replace(/\/?$/, '/')}`;
  } catch { return null; }
}

export function captionFromHtml(html) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)].map((m) => [m[1].toLowerCase(), decodeEntities(m[3])]));
    if (attrs.property !== 'og:description') continue;
    // Instagram commonly wraps the caption in quotes after author/date/like metadata.
    const match = attrs.content?.match(/:\s*["“]([\s\S]+)["”]\s*\.?$/);
    const caption = match?.[1]?.trim();
    if (caption && caption.length >= 40 && caption.length <= 30_000 && !/(?:…|\.{3})\s*$/.test(caption)) return caption;
  }
  return null;
}

function decodeEntities(value) {
  return value.replace(/&(?:quot|apos|amp|lt|gt|#\d+|#x[\da-f]+);/gi, (entity) => {
    const named = { '&quot;': '"', '&apos;': "'", '&amp;': '&', '&lt;': '<', '&gt;': '>' };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
    const code = entity.slice(2, -1);
    const number = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code);
    return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : '';
  });
}

export async function retrieveInstagramCaption(value, { fetchImpl = fetch } = {}) {
  let url = instagramPostUrl(value);
  if (!url) return { error: 'invalid-instagram-post-url' };
  const sourceUrl = url;
  const signal = AbortSignal.timeout(12_000);
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetchImpl(url, { redirect: 'manual', signal, headers: { Accept: 'text/html' } });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        url = location ? instagramPostUrl(new URL(location, url).href) : null;
        await response.body?.cancel();
        if (!url || url !== sourceUrl) return { error: 'instagram-caption-unavailable' };
        continue;
      }
      if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
        await response.body?.cancel();
        return { error: 'instagram-caption-unavailable' };
      }
      const reader = response.body.getReader();
      const chunks = []; let size = 0;
      try {
        for (;;) {
          const { done, value: bytes } = await reader.read();
          if (done) break;
          size += bytes.length;
          if (size > 2_000_000) { await reader.cancel(); return { error: 'instagram-caption-unavailable' }; }
          chunks.push(bytes);
        }
      } finally { reader.releaseLock(); }
      const text = captionFromHtml(Buffer.concat(chunks).toString('utf8'));
      return text ? { text, sourceUrl } : { error: 'instagram-caption-unavailable' };
    }
  } catch { /* Network and login failures are recoverable by pasting the caption. */ }
  return { error: 'instagram-caption-unavailable' };
}
