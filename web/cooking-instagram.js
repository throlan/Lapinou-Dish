export function cookingInstagramSource(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !['instagram.com', 'www.instagram.com'].includes(url.hostname)) return null;
    const match = url.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)\/?$/);
    if (!match) return null;
    const postUrl = `https://www.instagram.com/${match[1]}/${match[2]}/`;
    return {postUrl, embedUrl: `${postUrl}embed/`};
  } catch { return null; }
}

// No metadata scraping or video downloads. Instagram renders its own publication.
export function mountCookingInstagram(container, sourceUrl, doc) {
  container.replaceChildren();
  const source = cookingInstagramSource(sourceUrl);
  container.hidden = !source;
  if (!source) return () => {};
  const heading = doc.createElement('h3'); heading.textContent = 'Publication et vidéo Instagram';
  const button = doc.createElement('button'); button.type = 'button'; button.className = 'secondary';
  const host = doc.createElement('div'); host.className = 'cooking-instagram-player';
  const help = doc.createElement('p'); help.className = 'hint';
  help.textContent = 'Le lecteur est chargé depuis Instagram. Si la publication est indisponible ou si la lecture est bloquée, ouvre le lien d’origine.';
  const link = doc.createElement('a'); link.href = source.postUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Ouvrir sur Instagram';
  let frame = null;
  function stop() {
    if (frame) frame.src = 'about:blank';
    host.replaceChildren(); frame = null;
    button.textContent = 'Afficher la publication Instagram'; button.setAttribute('aria-expanded', 'false');
  }
  button.addEventListener('click', () => {
    if (frame) { stop(); return; }
    frame = doc.createElement('iframe'); frame.src = source.embedUrl;
    frame.title = 'Publication Instagram à l’origine de la recette';
    frame.referrerPolicy = 'no-referrer'; frame.allowFullscreen = true;
    frame.allow = 'encrypted-media; fullscreen; picture-in-picture';
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-presentation');
    host.replaceChildren(frame);
    button.textContent = 'Masquer la publication Instagram'; button.setAttribute('aria-expanded', 'true');
  });
  stop(); container.append(heading, button, help, link, host);
  return stop;
}
