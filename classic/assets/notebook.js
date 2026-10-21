/* Read Naroa's public WordPress: never execute the HTML contained in a post. */
(() => {
 'use strict';
 const section = document.querySelector('.notebook');
 if (!section) return;
 const upstream = 'https://public-api.wordpress.com/rest/v1.1/sites/naroagutierrez.wordpress.com/posts/?number=6&fields=ID,date,modified,title,URL,excerpt,featured_image,attachments';
 const ttl = 300000;
 let updated = 0, pending = false;
 const plain = value => new DOMParser().parseFromString(String(value || ''), 'text/html').body.textContent.trim();
 function safeURL(value, image = false) {
  try {
   const url = new URL(value);
   return url.protocol === 'https:' && url.hostname === 'naroagutierrez.wordpress.com' && (!image || url.pathname.startsWith('/wp-content/uploads/')) ? url.href : null;
  } catch (_) { return null; }
 }
 function node(tag, cls, value) {
  const element = document.createElement(tag); element.className = cls;
  if (value) element.textContent = value;
  return element;
 }
 function link(cls, href, label) {
  const a = node('a', cls, label); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
 }
 function render(data) {
  const posts = data.posts?.filter(p => safeURL(p.URL) && p.title && !Number.isNaN(Date.parse(p.date))).slice(0, 6);
  if (!posts?.length) throw new Error('No public posts');
  const level = Number(section.querySelector('[id="artist-notebook-title"]').tagName.slice(1)) + 1;
  const seenImages = new Set();
  const entries = posts.map((post, index) => {
   const title = plain(post.title), url = safeURL(post.URL);
   const article = node('article', `notebook-entry notebook-entry--${index ? 'note' : 'feature'}`);
   const src = safeURL(post.featured_image, true);
   if (index === 0 && src && !seenImages.has(src.split('?')[0])) {
    seenImages.add(src.split('?')[0]);
    const a = link('notebook-photo', url); a.tabIndex = -1; a.setAttribute('aria-hidden', 'true');
    const img = node('img', ''); img.src = src; img.alt = title; img.loading = 'lazy'; img.decoding = 'async';
    const attachment = Object.values(post.attachments || {}).find(item => item.URL === src);
    if (attachment?.width && attachment?.height) { img.width = attachment.width; img.height = attachment.height; }
    a.append(img); article.append(a);
   }
   const text = node('div', 'notebook-entry__text'), meta = node('p', 'notebook-meta');
   const time = node('time', '', new Intl.DateTimeFormat('es', {dateStyle:'long', timeZone:'UTC'}).format(new Date(post.date)));
   time.dateTime = post.date;
   meta.append(node('span', '', 'Del cuaderno de Naroa'), time);
   const heading = node(`h${level}`, 'notebook-post-title'); heading.append(link('', url, title));
   const excerpt = plain(post.excerpt).replace(/\s+/g, ' ');
   const summary = excerpt.length > 170 ? excerpt.slice(0, 170).replace(/\s+\S*$/, '') + '…' : excerpt;
   const read = link('notebook-read', url, 'Leer la historia ↗'); read.setAttribute('aria-label', `Leer la historia: ${title}`);
   text.append(meta, heading, node('p', 'notebook-summary', summary), read); article.append(text); return article;
  });
  const notes = node('div', 'notebook-notes'); notes.append(...entries.slice(1));
  section.querySelectorAll(':scope > .notebook-entry, :scope > .notebook-notes').forEach(el => el.remove());
  section.querySelector('.notebook-footer').before(entries[0], notes);
 }
 async function refresh() {
  if (pending || document.hidden || Date.now() - updated < ttl) return;
  pending = true;
  try {
   let data;
   const endpoints = ['localhost','127.0.0.1','::1'].includes(location.hostname) ? [upstream] : ['/api/blog', upstream];
   for (const endpoint of endpoints) {
    try {
     const response = await fetch(endpoint, {signal:AbortSignal.timeout(8000), credentials:'omit'});
     if (!response.ok) throw new Error('WordPress unavailable');
     data = await response.json(); if (!Array.isArray(data.posts)) throw new Error('Invalid posts'); break;
    } catch (_) { /* Static local preview uses the public WordPress endpoint. */ }
   }
   if (data) { render(data); updated = Date.now(); }
  } catch (_) { /* Keep the last published snapshot visible when offline. */ }
  finally { pending = false; }
 }
 const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) refresh(); }, {rootMargin:'400px'});
 observer.observe(section);
 document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
 setInterval(() => { if (section.getBoundingClientRect().top < innerHeight && section.getBoundingClientRect().bottom > 0) refresh(); }, ttl);
})();
