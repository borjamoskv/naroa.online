/* Naroa — the reviewed catalogue, shown one artwork at a time. */
(() => {
  'use strict';
  const catalogue = window.NAROA_CATALOG;
  if (!catalogue) return;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const soundscape = window.NAROA_SOUND;
  const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const galleryPage = !!$('[data-gallery]'), motionListeners = new Set();
  const effectsKey = 'naroa-effects';
  let effectsPreference = null;
  try { effectsPreference = localStorage.getItem(effectsKey); } catch {}
  const reduced = {
    get matches() { return galleryPage && effectsPreference === 'on' ? false : galleryPage && effectsPreference === 'off' ? true : systemMotion.matches; },
    addEventListener(type, listener) { if (type === 'change') motionListeners.add(listener); }
  };
  function paintEffects() {
    const active = !reduced.matches;
    document.documentElement.classList.toggle('motion-opt-in', galleryPage && active);
    document.documentElement.classList.toggle('motion-off', galleryPage && !active);
    $$('[data-effects]').forEach(button => {
      button.setAttribute('aria-pressed', String(active));
      button.textContent = active ? 'Pausar efectos' : 'Activar efectos';
      button.title = active ? 'Mostrar las obras sin movimiento' : 'Activar el viaje de scroll en esta web';
    });
  }
  function motionChanged() {
    paintEffects();
    motionListeners.forEach(listener => listener({ matches: reduced.matches }));
  }
  $$('[data-effects]').forEach(button => button.addEventListener('click', () => {
    effectsPreference = reduced.matches ? 'on' : 'off';
    try { localStorage.setItem(effectsKey, effectsPreference); } catch {}
    motionChanged();
  }));
  systemMotion.addEventListener('change', motionChanged);
  paintEffects();
  // Enable enhancements only after JavaScript has successfully initialized.
  document.documentElement.classList.add('has-motion');
  const legacy = { '#/destacada': '/obra/', '#/about': '/sobre-mi/', '#/trayectoria': '/trayectoria/', '#/blog': '/cuaderno/', '#/contacto': '/contacto/' };
  if (location.pathname === '/' && legacy[location.hash]) { location.replace(legacy[location.hash]); return; }
  let gallery = null;
  function openDialog(selector) {
    const dialog = $(selector);
    if (!dialog || dialog.open) return;
    if (gallery) gallery.pause();
    dialog.showModal();
    if (selector === '#menu-dialog') refreshMenu();
    if (selector === '#index-dialog') $('#art-search').focus();
  }
  $$('[data-close-dialog]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  $$('dialog').forEach(d => d.addEventListener('click', e => {
    if (e.target !== d) return;
    const r = d.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
  }));

  // Salpicadura táctil de pan de oro en pointerdown (tactilidad física de pincel)
  document.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') return;
    const dab = document.createElement('div');
    dab.className = 'naroa-brush-touch';
    dab.style.left = `${e.clientX}px`;
    dab.style.top = `${e.clientY}px`;
    const size = Math.floor(Math.random() * 8 + 18);
    dab.style.width = `${size}px`;
    dab.style.height = `${size}px`;
    document.body.appendChild(dab);
    dab.addEventListener('animationend', () => dab.remove());
  }, { passive: true });

  // --- Story Remix Engine & Unified Social Sharing ---
  let currentRemixBlob = null;
  let currentRemixFile = null;
  let currentRemixDataUrl = null;
  let currentRemixSlug = null;
  let isGeneratingRemix = false;
  const projects = catalogue.projects || [];
  const storyLoopState = {
    backend: 'canvas-capture-mediastream-v1',
    isRecording: false,
    lastRecordedSlug: null,
    framesRendered: 0,
    melodyName: null,
    melodyDay: null,
    notesScheduled: 0,
    mimeType: 'video/webm',
    durationMs: 6000
  };

  function getActiveArtwork() {
    const scene = $('.art-scene.is-current');
    if (scene && scene.dataset.work) {
      return (catalogue.projects || []).find(p => p.slug === scene.dataset.work) || null;
    }
    const match = location.pathname.match(/\/obra\/([^/]+)\//);
    if (match) {
      return (catalogue.projects || []).find(p => p.slug === match[1]) || null;
    }
    return (catalogue.projects || [])[0] || null;
  }

  function loadImageAsync(src) {
    return new Promise((resolve, reject) => {
      if (!src) return reject(new Error('Empty src'));
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const timer = setTimeout(() => resolve(null), 120);
      img.onload = () => { clearTimeout(timer); resolve(img); };
      img.onerror = () => { clearTimeout(timer); reject(new Error('Failed to load: ' + src)); };
      img.src = src;
      if (img.complete && (img.naturalWidth || img.width)) {
        clearTimeout(timer);
        resolve(img);
      }
    });
  }

  function drawStoryRoundedRect(ctx, x, y, w, h, radius) {
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      return;
    }
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y + w, y, radius);
    ctx.closePath();
  }

  function drawStoryZoomedDetail(ctx, img, x, y, w, h, radius = 0, zoom = 2.45, cx = 0.5, cy = 0.44) {
    ctx.save();
    if (radius > 0) {
      drawStoryRoundedRect(ctx, x, y, w, h, radius);
      ctx.clip();
    }
    const nw = img.naturalWidth || img.width || 1;
    const nh = img.naturalHeight || img.height || 1;
    const boxRatio = w / h;
    const cropW = nw / zoom;
    const cropH = cropW / boxRatio;
    let sx = nw * cx - cropW / 2;
    let sy = nh * cy - cropH / 2;
    sx = Math.max(0, Math.min(nw - cropW, sx));
    sy = Math.max(0, Math.min(nh - cropH, sy));
    ctx.drawImage(img, sx, sy, cropW, cropH, x, y, w, h);
    ctx.restore();
  }

  function drawStoryMiniature(ctx, img, x, y, w, h, radius = 18) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 34;
    ctx.shadowOffsetY = 16;
    ctx.fillStyle = '#11120f';
    drawStoryRoundedRect(ctx, x, y, w, h, radius);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 253, 244, 0.88)';
    ctx.lineWidth = 2.0;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    drawStoryRoundedRect(ctx, x + 8, y + 8, w - 16, h - 16, radius - 4);
    ctx.clip();
    ctx.fillStyle = '#070705';
    ctx.fillRect(x + 8, y + 8, w - 16, h - 16);

    const nw = img.naturalWidth || img.width || 1;
    const nh = img.naturalHeight || img.height || 1;
    const imgRatio = nw / nh;
    const innerW = w - 16, innerH = h - 16;
    const boxRatio = innerW / innerH;
    let dw, dh, dx, dy;
    if (imgRatio > boxRatio) {
      dw = innerW;
      dh = innerW / imgRatio;
      dx = x + 8;
      dy = y + 8 + (innerH - dh) / 2;
    } else {
      dh = innerH;
      dw = innerH * imgRatio;
      dx = x + 8 + (innerW - dw) / 2;
      dy = y + 8;
    }
    ctx.drawImage(img, 0, 0, nw, nh, dx, dy, dw, dh);
    ctx.restore();
  }

  function renderStoryFrame(ctx, heroWork, heroImg, panProgress = 0) {
    // 1. Fondo de galería museo contemporáneo
    const bg = ctx.createLinearGradient(0, 0, 0, 1920);
    bg.addColorStop(0, '#0a0b08');
    bg.addColorStop(0.5, '#12140f');
    bg.addColorStop(1, '#080806');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1080, 1920);

    // 2. Halo atmosférico cálido (sutil)
    const radHalo = ctx.createRadialGradient(540, 780, 40, 540, 780, 850);
    radHalo.addColorStop(0, 'rgba(212, 175, 55, 0.16)');
    radHalo.addColorStop(1, 'rgba(212, 175, 55, 0)');
    ctx.fillStyle = radHalo;
    ctx.fillRect(0, 0, 1080, 1920);

    // 3. Encabezado minimalista Awwwards
    ctx.textAlign = 'center';
    ctx.fillStyle = '#d4af37';
    ctx.font = '700 17px "DM Sans", -apple-system, sans-serif';
    ctx.fillText('NAROA GUTIÉRREZ GIL', 540, 72);

    ctx.fillStyle = '#b8b2a2';
    ctx.font = '500 13px "DM Sans", -apple-system, sans-serif';
    ctx.fillText('DETAIL OBSESSION · TEXTURAS Y MATERIA', 540, 100);

    // 4. Fragmento ampliado (Ocupa casi toda la pantalla para mostrar texturas y pinceladas)
    const mainX = 48, mainY = 130, mainW = 984, mainH = 1530;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 18;
    ctx.fillStyle = '#141512';
    drawStoryRoundedRect(ctx, mainX, mainY, mainW, mainH, 28);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 253, 244, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    if (heroImg) {
      // Zoom macro 2.65x-2.95x con panning orbital hipnótico si panProgress > 0
      const p = clamp(Number(panProgress) || 0, 0, 1);
      const zoom = p > 0 ? 2.65 + 0.30 * Math.sin(p * Math.PI) : 2.68;
      const cx = p > 0 ? 0.48 + 0.12 * Math.cos(p * Math.PI * 2) : 0.5;
      const cy = p > 0 ? 0.44 + 0.08 * Math.sin(p * Math.PI * 2) : 0.44;
      drawStoryZoomedDetail(ctx, heroImg, mainX, mainY, mainW, mainH, 28, zoom, cx, cy);
    }

    // Sombra gradual interior inferior para legibilidad del título
    const gradBottom = ctx.createLinearGradient(0, mainY + mainH - 320, 0, mainY + mainH);
    gradBottom.addColorStop(0, 'rgba(10, 11, 8, 0)');
    gradBottom.addColorStop(0.65, 'rgba(10, 11, 8, 0.72)');
    gradBottom.addColorStop(1, 'rgba(10, 11, 8, 0.94)');
    ctx.save();
    drawStoryRoundedRect(ctx, mainX, mainY, mainW, mainH, 28);
    ctx.clip();
    ctx.fillStyle = gradBottom;
    ctx.fillRect(mainX, mainY + mainH - 320, mainW, 320);
    ctx.restore();

    // 5. Miniatura que revela la pieza completa (Picture-in-Picture)
    const miniW = 290, miniH = 370;
    const miniX = mainX + 40, miniY = mainY + mainH - miniH - 40;
    if (heroImg) {
      drawStoryMiniature(ctx, heroImg, miniX, miniY, miniW, miniH, 18);

      // Badge «PIEZA COMPLETA»
      const badgeW = 160, badgeH = 32;
      const badgeX = miniX + (miniW - badgeW) / 2;
      const badgeY = miniY + miniH - 22;
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#0d0e0b';
      drawStoryRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 16);
      ctx.fill();
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#f7d594';
      ctx.font = '700 11px "DM Sans", -apple-system, sans-serif';
      ctx.fillText('PIEZA COMPLETA', badgeX + badgeW / 2, badgeY + 20);
    }

    // 6. Información de la obra al pie del marco
    const textLeft = miniX + miniW + 36;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fffdf4';
    ctx.font = '700 36px "DM Sans", -apple-system, sans-serif';
    let title = heroWork.title || 'Obra';
    if (title.length > 20) title = title.slice(0, 19) + '…';
    ctx.fillText(title, textLeft, mainY + mainH - 120);

    ctx.fillStyle = '#d4af37';
    ctx.font = '600 17px "DM Sans", -apple-system, sans-serif';
    const cat = heroWork.label || heroWork.category || '';
    ctx.fillText(cat.toUpperCase(), textLeft, mainY + mainH - 85);

    ctx.fillStyle = '#c5bfaf';
    ctx.font = '400 15px "DM Sans", -apple-system, sans-serif';
    let tech = heroWork.support || heroWork.technique || 'Pintura y materia';
    if (tech.length > 34) tech = tech.slice(0, 32) + '…';
    ctx.fillText(tech, textLeft, mainY + mainH - 58);

    // 7. Pie de Story & sticker de enlace
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fffdf4';
    ctx.font = '600 18px "DM Sans", -apple-system, sans-serif';
    ctx.fillText('@naroa_art   ·   naroagutierrezgil.com', 540, 1720);

    ctx.fillStyle = 'rgba(255, 253, 244, 0.45)';
    ctx.font = '400 14px "DM Sans", -apple-system, sans-serif';
    ctx.fillText('86 obras inmersivas · Retratos sobre pizarra y materia', 540, 1752);
  }

  async function generateStoryRemix(preferredSlug = null) {
    const dialog = $('#story-remix-dialog');
    if (!dialog) return null;
    const previewImg = $('[data-story-remix-img]', dialog);
    const spinner = $('[data-story-remix-spinner]', dialog);
    const downloadBtn = $('[data-remix-download]', dialog);

    if (spinner) spinner.hidden = false;
    isGeneratingRemix = true;

    try {
      // Enfoque DETAIL OBSESSION: Obra protagonista con zoom macro y miniatura completa
      const activeP = getActiveArtwork();
      const targetSlug = preferredSlug || activeP?.slug || null;
      let heroWork = targetSlug ? projects.find(w => w.slug === targetSlug) : null;
      if (!heroWork) {
        heroWork = projects[Math.floor(Math.random() * projects.length)] || projects[0];
      }
      if (!heroWork) throw new Error('No projects available');
      currentRemixSlug = heroWork.slug;

      const src = heroWork.photos?.[0]?.src || heroWork.cover || heroWork.thumb;
      const heroImg = await loadImageAsync(src).catch(() => null);

      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      let ctx = null;
      try { ctx = canvas.getContext('2d'); } catch {}
      if (!ctx) {
        if (spinner) spinner.hidden = true;
        isGeneratingRemix = false;
        return null;
      }

      renderStoryFrame(ctx, heroWork, heroImg, 0);

      let dataUrl = '';
      try { dataUrl = canvas.toDataURL('image/jpeg', 0.94); } catch {}
      currentRemixDataUrl = dataUrl;

      if (previewImg && dataUrl) previewImg.src = dataUrl;
      if (downloadBtn && dataUrl) {
        downloadBtn.href = dataUrl;
        downloadBtn.download = `naroa-detail-obsession-${heroWork.slug}.jpg`;
      }

      await new Promise(resolve => {
        if (canvas.toBlob) {
          canvas.toBlob(blob => {
            currentRemixBlob = blob;
            try {
              currentRemixFile = new File([blob], `naroa-story-${heroWork.slug}.jpg`, { type: 'image/jpeg' });
            } catch {
              currentRemixFile = blob;
            }
            resolve();
          }, 'image/jpeg', 0.94);
        } else {
          resolve();
        }
      });

      return { dataUrl, blob: currentRemixBlob, file: currentRemixFile };
    } catch (err) {
      console.warn('Error generating story detail obsession:', err);
      return null;
    } finally {
      if (spinner) spinner.hidden = true;
      isGeneratingRemix = false;
    }
  }

  async function recordStoryVideoLoop(preferredSlug = null, durationMs = 6000) {
    if (storyLoopState.isRecording) return null;
    const dialog = $('#story-remix-dialog');
    const videoBtn = dialog ? $('[data-remix-video-loop]', dialog) : null;
    const previewImg = dialog ? $('[data-story-remix-img]', dialog) : null;
    const activeP = getActiveArtwork();
    const targetSlug = preferredSlug || currentRemixSlug || activeP?.slug || null;
    let heroWork = targetSlug ? projects.find(w => w.slug === targetSlug) : null;
    if (!heroWork) heroWork = projects[0] || null;
    if (!heroWork) return null;

    storyLoopState.isRecording = true;
    storyLoopState.lastRecordedSlug = heroWork.slug;
    storyLoopState.durationMs = Number(durationMs) || 6000;
    storyLoopState.framesRendered = 0;

    if (videoBtn) {
      videoBtn.classList.add('is-recording');
      videoBtn.disabled = true;
      videoBtn.textContent = '⏺ Grabando Loop 6s (Audio + Macro)…';
    }

    try {
      const src = heroWork.photos?.[0]?.src || heroWork.cover || heroWork.thumb;
      const heroImg = await loadImageAsync(src).catch(() => null);
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      let ctx = null;
      try { ctx = canvas.getContext('2d'); } catch {}

      const durSec = Math.max(0.5, storyLoopState.durationMs / 1000);
      const audioLoop = window.NAROA_SOUND?.createStoryLoopStream
        ? await window.NAROA_SOUND.createStoryLoopStream(durSec)
        : null;

      if (audioLoop) {
        storyLoopState.melodyName = audioLoop.melodyName || null;
        storyLoopState.melodyDay = audioLoop.melodyDay || null;
        storyLoopState.notesScheduled = Number(audioLoop.notesScheduled) || 0;
      }

      const canCapture = ctx && typeof canvas.captureStream === 'function' && typeof window.MediaRecorder === 'function';
      if (!canCapture) {
        // Entorno headless / JSDOM o sin MediaRecorder: renderizar keyframes orbitales sincrónicamente
        const sampleSteps = 12;
        for (let i = 0; i <= sampleSteps; i++) {
          if (ctx) renderStoryFrame(ctx, heroWork, heroImg, i / sampleSteps);
          storyLoopState.framesRendered++;
        }
        if (audioLoop && typeof audioLoop.stop === 'function') audioLoop.stop();
        return { ...storyLoopState };
      }

      const canvasStream = canvas.captureStream(30);
      const combinedTracks = [...canvasStream.getVideoTracks()];
      if (audioLoop?.stream && typeof audioLoop.stream.getAudioTracks === 'function') {
        combinedTracks.push(...audioLoop.stream.getAudioTracks());
      }
      const combinedStream = new MediaStream(combinedTracks);
      const mimeTypes = [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
      ];
      let chosenMime = 'video/webm';
      for (const m of mimeTypes) {
        if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(m)) {
          chosenMime = m;
          break;
        }
      }
      storyLoopState.mimeType = chosenMime;

      const chunks = [];
      const recorder = new MediaRecorder(combinedStream, { mimeType: chosenMime, videoBitsPerSecond: 6500000 });
      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      const startTs = performance.now();
      let animId = 0;
      const tick = now => {
        const elapsed = now - startTs;
        const p = clamp(elapsed / storyLoopState.durationMs, 0, 1);
        renderStoryFrame(ctx, heroWork, heroImg, p);
        storyLoopState.framesRendered++;
        if (previewImg && storyLoopState.framesRendered % 6 === 0) {
          try { previewImg.src = canvas.toDataURL('image/jpeg', 0.85); } catch {}
        }
        if (elapsed < storyLoopState.durationMs && storyLoopState.isRecording) {
          animId = requestAnimationFrame(tick);
        }
      };

      const recordedBlob = await new Promise(resolve => {
        recorder.onstop = () => {
          cancelAnimationFrame(animId);
          if (audioLoop && typeof audioLoop.stop === 'function') audioLoop.stop();
          const blob = new Blob(chunks, { type: chosenMime });
          resolve(blob);
        };
        recorder.start(200);
        animId = requestAnimationFrame(tick);
        setTimeout(() => {
          if (recorder.state !== 'inactive') recorder.stop();
        }, storyLoopState.durationMs);
      });

      const ext = chosenMime.includes('mp4') ? 'mp4' : 'webm';
      const url = URL.createObjectURL(recordedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `naroa-vinyl-loop-${heroWork.slug}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 15000);

      return { ...storyLoopState, blob: recordedBlob };
    } catch (err) {
      console.warn('Error recording story video loop:', err);
      return null;
    } finally {
      storyLoopState.isRecording = false;
      if (videoBtn) {
        videoBtn.classList.remove('is-recording');
        videoBtn.disabled = false;
        videoBtn.textContent = '🎵 Grabar Loop 6s (Audio + Macro)';
      }
    }
  }

  window.NAROA_STORY_LOOP = {
    record: recordStoryVideoLoop,
    getState: () => ({ ...storyLoopState })
  };

  async function shareStoryToInstagram() {
    const dialog = $('#story-remix-dialog');
    if (!currentRemixFile && !currentRemixDataUrl) {
      await generateStoryRemix();
    }
    const title = 'Naroa Gutiérrez Gil · Exposición inmersiva Bilbao';
    const text = 'Remix de obras pictóricas de Naroa Gutiérrez Gil · naroagutierrezgil.com';

    if (currentRemixFile && navigator.canShare && navigator.canShare({ files: [currentRemixFile] })) {
      try {
        await navigator.share({
          files: [currentRemixFile],
          title,
          text
        });
        return;
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Share file failed:', err);
        } else {
          return;
        }
      }
    }

    const downloadBtn = $('[data-remix-download]', dialog);
    if (downloadBtn) downloadBtn.click();

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = 'instagram://camera';
      setTimeout(() => {
        window.open('https://www.instagram.com/naroa_art/', '_blank');
      }, 1500);
    } else {
      window.open('https://www.instagram.com/naroa_art/', '_blank');
      window.alert('¡Story HD descargada! Súbela a tus Stories de Instagram mencionando a @naroa_art ✨');
    }
  }

  // Unified global handler for social sharing & Instagram Story Remix
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-share-network]');
    if (!btn) return;
    e.preventDefault();
    const network = btn.dataset.shareNetwork;
    const p = getActiveArtwork();
    const customUrl = btn.dataset.shareUrl;
    const customTitle = btn.dataset.shareTitle;
    const url = customUrl || (location.origin + (p ? '/obra/' + p.slug + '/' : location.pathname));
    const rawTitle = customTitle || (p ? p.title : document.title);
    const title = rawTitle.replace(/\s*·\s*Naroa Gutiérrez Gil.*$/i, '').trim();
    const text = title;
    const encodedUrl = encodeURIComponent(url);
    const encodedText = encodeURIComponent(text);

    if (network === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`, '_blank', 'noopener,noreferrer,width=640,height=560');
    } else if (network === 'x') {
      window.open(`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`, '_blank', 'noopener,noreferrer,width=640,height=560');
    } else if (network === 'instagram') {
      openDialog('#story-remix-dialog');
      generateStoryRemix(p?.slug || null);
    } else if (network === 'tiktok') {
      if (navigator.share) {
        navigator.share({ title, text, url }).catch(() => {});
      } else if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(url).then(() => {
          window.alert('¡Enlace copiado al portapapeles listo para compartir en TikTok!');
        });
      }
    }
  });

  const remixDialog = $('#story-remix-dialog');
  if (remixDialog) {
    const shuffleBtn = $('[data-remix-shuffle]', remixDialog);
    const shareBtn = $('[data-remix-share]', remixDialog);
    const videoLoopBtn = $('[data-remix-video-loop]', remixDialog);
    if (shuffleBtn) {
      shuffleBtn.addEventListener('click', () => {
        if (!isGeneratingRemix) generateStoryRemix(null);
      });
    }
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        shareStoryToInstagram();
      });
    }
    if (videoLoopBtn) {
      videoLoopBtn.addEventListener('click', () => {
        recordStoryVideoLoop(currentRemixSlug || null, 6000);
      });
    }
  }
  const menu = $('#menu-dialog'), menuLinks = $$('[data-menu-item]', menu), menuImages = $$('[data-menu-image]', menu);
  const menuPicture = $('[data-menu-picture]', menu), menuReel = $('[data-menu-reel]', menu);
  const menuQuote = $('[data-menu-quote]', menu), menuMeta = $('[data-menu-preview-meta]', menu), menuLoupe = $('[data-menu-loupe]', menu);
  const menuButtons = $$('[data-open-menu]');
  let menuRequest = 0, menuImageIndex = -1, reelTimer = 0, activeReel = null, activeReelIndex = 0, activeReelLabel = '', activeMenuLink = null;
  function clearReelTimer() {
    if (reelTimer) { clearTimeout(reelTimer); reelTimer = 0; }
  }
  function currentMenuLink() {
    const path = location.pathname;
    return path === '/' ? menuLinks[0] : menuLinks.find(link => path.startsWith(new URL(link.href).pathname));
  }
  function labelMenu(title, label, quoteText, metaText) {
    $('[data-menu-preview-title]', menu).textContent = title;
    $('[data-menu-preview-label]', menu).textContent = label;
    if (menuQuote && quoteText) menuQuote.textContent = quoteText;
    if (menuMeta && metaText) menuMeta.textContent = metaText;
  }
  async function showMenuFrame(source, title, label, quoteText, metaText) {
    if (!source || !menu.open) return;
    if (menuLoupe) menuLoupe.style.backgroundImage = `url("${source}")`;
    const request = ++menuRequest;
    if (menuImages.some(image => image.classList.contains('is-visible') && image.getAttribute('src') === source)) {
      labelMenu(title, label, quoteText, metaText);
      return;
    }
    const picture = new Image(); picture.src = source;
    try {
      if (picture.decode) await picture.decode();
      else if (!picture.complete) await new Promise((resolve, reject) => { picture.onload = resolve; picture.onerror = reject; });
    } catch { return; }
    if (request !== menuRequest || !menu.open) return;
    menuImageIndex = (menuImageIndex + 1) % menuImages.length;
    const image = menuImages[menuImageIndex];
    image.src = source; image.alt = title;
    menuImages.forEach(item => item.classList.toggle('is-visible', item === image));
    labelMenu(title, label, quoteText, metaText);
  }
  function syncReelButtons() {
    if (!menuReel) return;
    $$('[data-reel-index]', menuReel).forEach((btn, idx) => btn.classList.toggle('is-active', idx === activeReelIndex));
  }
  function scheduleReelStep() {
    clearReelTimer();
    if (!menu.open || !activeReel || activeReel.length < 2) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches && !document.documentElement.classList.contains('motion-opt-in')) return;
    reelTimer = setTimeout(() => {
      if (!menu.open || !activeReel) return;
      activeReelIndex = (activeReelIndex + 1) % activeReel.length;
      const frame = activeReel[activeReelIndex];
      syncReelButtons();
      showMenuFrame(frame.src, frame.title, activeReelLabel, null, frame.meta);
      scheduleReelStep();
    }, 1800);
  }
  function renderReel(link) {
    clearReelTimer();
    if (!menuReel) return;
    const raw = link.dataset.previewReel;
    if (!raw) {
      activeReel = null;
      menuReel.hidden = true;
      menuReel.replaceChildren();
      return;
    }
    try { activeReel = JSON.parse(raw); } catch { activeReel = null; }
    if (!activeReel || !activeReel.length) {
      menuReel.hidden = true;
      menuReel.replaceChildren();
      return;
    }
    activeReelIndex = 0;
    activeReelLabel = link.dataset.previewLabel;
    menuReel.hidden = false;
    menuReel.replaceChildren(...activeReel.map((frame, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'menu-reel-frame' + (idx === 0 ? ' is-active' : '');
      btn.dataset.reelIndex = String(idx);
      btn.dataset.reelTitle = frame.title;
      btn.tabIndex = -1;
      btn.title = frame.title;
      btn.style.backgroundImage = `url("${frame.src}")`;
      const selectFrame = e => {
        e.stopPropagation();
        activeReelIndex = idx;
        syncReelButtons();
        showMenuFrame(frame.src, frame.title, activeReelLabel, null, frame.meta);
        scheduleReelStep();
      };
      btn.addEventListener('pointerenter', selectFrame);
      btn.addEventListener('click', selectFrame);
      return btn;
    }));
    scheduleReelStep();
  }
  async function previewMenu(link, playSound = false) {
    if (!link || !menu.open) return;
    activeMenuLink = link;
    const isPortrait = link.getAttribute('href') === '/sobre-mi/' || link.getAttribute('href') === '/contacto/';
    const isWink = link.dataset.previewWink === 'true';
    if (menuPicture) {
      menuPicture.dataset.portraitMode = String(isPortrait);
      menuPicture.classList.toggle('is-winking', isWink);
    }
    if (playSound) {
      window.NAROA_SOUND?.menuNote?.(Number(link.dataset.menuIndex) || 0);
      if (isWink) window.NAROA_SOUND?.portraitWink?.();
    }
    renderReel(link);
    await showMenuFrame(link.dataset.previewSrc, link.dataset.previewTitle, link.dataset.previewLabel, link.dataset.previewQuote, link.dataset.previewMeta);
  }
  function refreshMenu() {
    const current = currentMenuLink();
    menuLinks.forEach(link => { if (link === current) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); });
    menuButtons.forEach(button => button.setAttribute('aria-expanded', 'true'));
    previewMenu(current || menuLinks[0], false);
  }
  menuLinks.forEach(link => {
    link.addEventListener('pointerenter', () => previewMenu(link, true));
    link.addEventListener('focus', () => previewMenu(link, false));
  });
  if (menuPicture) {
    menuPicture.addEventListener('pointermove', e => {
      const r = menuPicture.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
      menuPicture.style.setProperty('--loupe-x', `${x.toFixed(1)}%`);
      menuPicture.style.setProperty('--loupe-y', `${y.toFixed(1)}%`);
      menuPicture.classList.add('is-loupe-active');
      if (menuPicture.dataset.portraitMode === 'true') menuPicture.classList.add('is-winking');
    });
    menuPicture.addEventListener('pointerleave', () => {
      menuPicture.classList.remove('is-loupe-active');
      if (activeMenuLink?.dataset.previewWink !== 'true') menuPicture.classList.remove('is-winking');
    });
  }
  $('[data-menu-open-index]', menu)?.addEventListener('click', () => {
    menu.close();
    openDialog('#index-dialog');
  });
  menu.addEventListener('keydown', e => {
    if (!menu.open || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key >= '1' && e.key <= '7') {
      const idx = Number(e.key) - 1;
      const target = menuLinks[idx];
      if (target) {
        e.preventDefault();
        target.classList.add('is-key-flash');
        setTimeout(() => target.classList.remove('is-key-flash'), 260);
        target.focus();
        previewMenu(target, true);
      }
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const currentIdx = Math.max(0, menuLinks.indexOf(activeMenuLink || currentMenuLink() || menuLinks[0]));
      const step = e.key === 'ArrowDown' ? 1 : -1;
      const next = menuLinks[(currentIdx + step + menuLinks.length) % menuLinks.length];
      if (next) {
        next.focus();
        previewMenu(next, true);
      }
    } else if (e.key === '/' || e.key === 'i' || e.key === 'I') {
      e.preventDefault();
      menu.close();
      openDialog('#index-dialog');
    }
  });
  menu.addEventListener('close', () => {
    clearReelTimer();
    activeReel = null;
    if (menuPicture) menuPicture.classList.remove('is-loupe-active', 'is-winking');
    window.NAROA_SOUND?.resolveCadence?.();
    menuRequest++;
    menuButtons.forEach(button => button.setAttribute('aria-expanded', 'false'));
  });
  menuButtons.forEach(button => button.addEventListener('click', () => openDialog('#menu-dialog')));
  $$('[data-open-index]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); openDialog('#index-dialog'); }));
  const search = $('#art-search'), filters = $$('[data-filter]'), indexItems = $$('.index-work');
  const indexListEl = $('.index-list', $('#index-dialog') || document);
  let filter = 'all';
  let stencilWipeTimer = 0;
  const stencilWallState = {
    backend: 'stencil-roller-wheatpaste-v1',
    activeFilter: 'all',
    wipeCount: 0,
    lastWipeInk: 'rgba(217, 56, 30, 0.28)',
    peeledSlug: null,
    peelRx: 0,
    peelRy: 0,
    tapeLift: 0
  };
  const STENCIL_INKS = {
    all: 'rgba(217, 56, 30, 0.28)',
    Retratos: 'rgba(217, 56, 30, 0.34)',
    Vaivenes: 'rgba(42, 132, 178, 0.32)',
    'Walking Gallery': 'rgba(212, 175, 55, 0.34)',
    Pizarra: 'rgba(130, 145, 155, 0.34)',
    Naturaleza: 'rgba(84, 156, 92, 0.32)',
    Instalaciones: 'rgba(198, 92, 56, 0.34)',
    Archivo: 'rgba(185, 165, 132, 0.30)'
  };
  function triggerStencilRollerWipe(targetFilter = filter) {
    const ink = STENCIL_INKS[targetFilter] || STENCIL_INKS.all;
    stencilWallState.activeFilter = targetFilter;
    stencilWallState.wipeCount++;
    stencilWallState.lastWipeInk = ink;
    if (indexListEl) {
      indexListEl.style.setProperty('--stencil-wipe-ink', ink);
      indexListEl.classList.remove('is-stencil-wiping');
      void indexListEl.offsetWidth;
      indexListEl.classList.add('is-stencil-wiping');
      clearTimeout(stencilWipeTimer);
      stencilWipeTimer = setTimeout(() => {
        indexListEl.classList.remove('is-stencil-wiping');
      }, 480);
    }
    window.NAROA_SOUND?.stencilRollerWipe?.(targetFilter);
    return { ...stencilWallState };
  }
  function applyWheatpastePeel(cardEl, normX = 0.5, normY = 0.5) {
    if (!cardEl) return null;
    const nx = clamp(Number(normX) || 0.5, 0, 1);
    const ny = clamp(Number(normY) || 0.5, 0, 1);
    const rx = Number(((0.5 - ny) * 9.5).toFixed(2));
    const ry = Number(((nx - 0.5) * 11.5).toFixed(2));
    const tx = Number(((nx - 0.5) * 3.5).toFixed(2));
    const ty = Number((-2.5 - (1 - ny) * 3.5).toFixed(2));
    const tapeRot = Number((-3.5 + (nx - 0.5) * 7.0).toFixed(2));
    const tapeLift = Number((-2.0 - (1 - ny) * 3.0).toFixed(2));
    cardEl.classList.add('is-wheatpaste-peeling');
    cardEl.style.setProperty('--peel-rx', `${rx}deg`);
    cardEl.style.setProperty('--peel-ry', `${ry}deg`);
    cardEl.style.setProperty('--peel-tx', `${tx}px`);
    cardEl.style.setProperty('--peel-ty', `${ty}px`);
    cardEl.style.setProperty('--peel-tape-rot', `${tapeRot}deg`);
    cardEl.style.setProperty('--peel-tape-lift', `${tapeLift}px`);
    stencilWallState.peeledSlug = cardEl.dataset.work || null;
    stencilWallState.peelRx = rx;
    stencilWallState.peelRy = ry;
    stencilWallState.tapeLift = tapeLift;
    return { ...stencilWallState };
  }
  function resetWheatpastePeel(cardEl) {
    if (!cardEl) return;
    cardEl.classList.remove('is-wheatpaste-peeling');
    cardEl.style.removeProperty('--peel-rx');
    cardEl.style.removeProperty('--peel-ry');
    cardEl.style.removeProperty('--peel-tx');
    cardEl.style.removeProperty('--peel-ty');
    cardEl.style.removeProperty('--peel-tape-rot');
    cardEl.style.removeProperty('--peel-tape-lift');
  }
  const normalized = s => s.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  function filterIndex() {
    const term = normalized(search.value.trim());
    let count = 0;
    indexItems.forEach(item => {
      const category = filter === 'all' || item.dataset.category === filter || item.dataset.series === filter;
      item.hidden = !category || !normalized(item.dataset.search).includes(term);
      if (!item.hidden) count++;
    });
    $('.index-count').textContent = `${count} ${count === 1 ? 'proyecto' : 'proyectos'}`;
    $('.index-empty').hidden = count !== 0;
    filters.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
  }
  search.addEventListener('input', filterIndex);
  filters.forEach(b => b.addEventListener('click', () => {
    filter = b.dataset.filter;
    filterIndex();
    triggerStencilRollerWipe(filter);
  }));
  $('[data-reset-index]').addEventListener('click', () => {
    search.value = '';
    filter = 'all';
    filterIndex();
    triggerStencilRollerWipe('all');
    search.focus();
  });
  indexItems.forEach(a => {
    a.href = '/obra/' + encodeURIComponent(a.dataset.work) + '/#fotos';
    a.addEventListener('pointermove', e => {
      const rect = a.getBoundingClientRect();
      const nx = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0.5;
      const ny = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0.5;
      applyWheatpastePeel(a, nx, ny);
    }, { passive: true });
    a.addEventListener('pointerleave', () => resetWheatpastePeel(a), { passive: true });
    a.addEventListener('click', e => {
      if (!gallery || !gallery.has(a.dataset.work) || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault(); $('#index-dialog').close();
      (gallery.inspect || gallery.select)(a.dataset.work);
    });
  });
  window.NAROA_STENCIL_WALL = {
    triggerWipe: triggerStencilRollerWipe,
    peelCard: (slugOrEl, normX = 0.72, normY = 0.24) => {
      const el = typeof slugOrEl === 'string'
        ? indexItems.find(item => item.dataset.work === slugOrEl) || indexItems[0]
        : slugOrEl;
      return applyWheatpastePeel(el, normX, normY);
    },
    getState: () => ({ ...stencilWallState })
  };

  const stage = $('[data-gallery]');
  if (stage) {
    stage.classList.add('is-resting');
    const works = catalogue.projects.filter(p => stage.dataset.subset !== 'Vaivenes' || p.series === 'Vaivenes');
    const scenes = $$('.art-scene', stage), images = scenes.map(s => $('img', s));
    scenes.forEach((s, i) => {
      if (works[i]) {
        s.dataset.work = works[i].slug;
        s.dataset.materialCat = works[i].category || 'collage';
      }
    });
    let portalRing = stage.querySelector('[data-portal-ring]');
    if (!portalRing) {
      portalRing = document.createElement('div');
      portalRing.className = 'art-portal-ring';
      portalRing.setAttribute('data-portal-ring', '');
      portalRing.setAttribute('aria-hidden', 'true');
      portalRing.setAttribute('hidden', '');
      stage.appendChild(portalRing);
    }
    let armigoVisited = false, armigoSpinTimer = null;
    function fireArmigoSpin(sceneEl) {
      if (!sceneEl) return;
      sceneEl.classList.remove('is-armigo-spinning');
      void sceneEl.offsetWidth;
      sceneEl.classList.add('is-armigo-spinning');
      clearTimeout(armigoSpinTimer);
      armigoSpinTimer = setTimeout(() => {
        sceneEl.classList.remove('is-armigo-spinning');
      }, 1300);
    }
    // V1: Relieve Litográfico BRDF y Especularidad de Mica / Pan de Oro + V2: Fonógrafo de Pizarra
    const reliefState = {
      backend: 'micro-facet-brdf-v1',
      x: 50,
      y: 42,
      angle: 135,
      alpha: 0,
      dx: 0,
      dy: 0,
      normalZ: 0.92,
      roughness: 0.38,
      micaGlint: 0,
      goldBrdf: 0
    };
    const phonographState = {
      backend: 'slate-phonograph-dsp-v1',
      activeSlug: works[0]?.slug || null,
      category: works[0]?.category || 'pizarra',
      normX: 0.5,
      normY: 0.5,
      roughness: 0.42,
      luminance: 0.48,
      sampleCount: 0,
      lastFreq: 0
    };
    function computeSpatialMicroTopography(slug, nx, ny, cat) {
      const str = `${slug || 'naroa'}:${cat || 'pizarra'}`;
      let hash = 2166136261;
      for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      const seed = (hash >>> 0) / 4294967295;
      const wave1 = Math.sin((nx * 19.7 + seed * 6.28) * Math.PI) * Math.cos((ny * 17.3 - seed * 3.14) * Math.PI);
      const wave2 = Math.sin((nx * 43.1 - ny * 37.9 + seed * 12.56) * Math.PI);
      const catBias = /pizarra|rock/i.test(cat) ? 0.68 : /kintsugi|divin/i.test(cat) ? 0.56 : 0.44;
      const roughness = clamp(catBias + 0.24 * Math.abs(wave1) + 0.14 * Math.abs(wave2), 0.08, 0.98);
      const luminance = clamp(0.46 + 0.28 * wave1 - 0.16 * wave2, 0.06, 0.96);
      return { roughness: Number(roughness.toFixed(4)), luminance: Number(luminance.toFixed(4)) };
    }
    function samplePhonographAt(normX, normY, customCategory = null) {
      const nx = clamp(Number(normX) || 0.5, 0, 1);
      const ny = clamp(Number(normY) || 0.5, 0, 1);
      const currentScene = $('.art-scene.is-current', stage) || scenes[0];
      const slug = currentScene?.dataset?.work || works[0]?.slug || 'naroa';
      const cat = customCategory || currentScene?.dataset?.materialCat || works[0]?.category || 'pizarra';
      const topo = computeSpatialMicroTopography(slug, nx, ny, cat);
      phonographState.activeSlug = slug;
      phonographState.category = cat;
      phonographState.normX = Number(nx.toFixed(3));
      phonographState.normY = Number(ny.toFixed(3));
      phonographState.roughness = topo.roughness;
      phonographState.luminance = topo.luminance;
      phonographState.sampleCount++;
      window.NAROA_SOUND?.phonographGrain?.(topo.roughness, topo.luminance, cat);
      if (window.NAROA_SOUND?.lastPhonographFreq) {
        phonographState.lastFreq = window.NAROA_SOUND.lastPhonographFreq;
      }
      return { ...phonographState };
    }
    function updateTactileRelief(normX, normY, activeAlpha = 0.88) {
      if (reduced.matches) return;
      const nx = clamp(Number(normX) || 0, 0, 1);
      const ny = clamp(Number(normY) || 0, 0, 1);
      reliefState.x = clamp(nx * 100, 0, 100);
      reliefState.y = clamp(ny * 100, 0, 100);
      const vx = nx - 0.5;
      const vy = ny - 0.42;
      reliefState.angle = Math.round((Math.atan2(vy, vx) * 180 / Math.PI) + 180);
      reliefState.alpha = activeAlpha;
      reliefState.dx = Number((-vx * 16).toFixed(2));
      reliefState.dy = Number((-vy * 16).toFixed(2));

      // Micro-Facet BRDF (Cook-Torrance / Blinn-Phong half-vector specular glint)
      const currentScene = $('.art-scene.is-current', stage) || scenes[0];
      const slug = currentScene?.dataset?.work || works[0]?.slug || 'naroa';
      const cat = currentScene?.dataset?.materialCat || works[0]?.category || 'pizarra';
      const topo = computeSpatialMicroTopography(slug, nx, ny, cat);
      const r2 = vx * vx + vy * vy;
      const nz = Math.sqrt(Math.max(0.12, 1 - Math.min(0.88, r2 * 1.8)));
      const ndoth = clamp(nz * (0.82 + 0.18 * (1 - topo.roughness)), 0, 1);
      const shininess = /kintsugi|divin/i.test(cat) ? 28 : /pizarra|rock/i.test(cat) ? 18 : 12;
      const brdfPeak = Math.pow(ndoth, shininess) * activeAlpha;
      reliefState.normalZ = Number(nz.toFixed(3));
      reliefState.roughness = topo.roughness;
      reliefState.micaGlint = Number(clamp(brdfPeak * (0.65 + topo.roughness * 0.6), 0, 1).toFixed(3));
      reliefState.goldBrdf = Number(clamp(brdfPeak * (0.55 + topo.luminance * 0.7), 0, 1).toFixed(3));

      stage.style.setProperty('--specular-x', `${reliefState.x.toFixed(1)}%`);
      stage.style.setProperty('--specular-y', `${reliefState.y.toFixed(1)}%`);
      stage.style.setProperty('--specular-angle', `${reliefState.angle}deg`);
      stage.style.setProperty('--specular-alpha', reliefState.alpha.toFixed(3));
      stage.style.setProperty('--relief-dx', `${reliefState.dx}px`);
      stage.style.setProperty('--relief-dy', `${reliefState.dy}px`);
      stage.style.setProperty('--mica-glint', String(reliefState.micaGlint));
      stage.style.setProperty('--gold-brdf', String(reliefState.goldBrdf));
    }
    stage.addEventListener('pointermove', e => {
      const w = geometry.width || innerWidth || 1;
      const h = geometry.height || innerHeight || 1;
      const nx = e.clientX / w;
      const ny = e.clientY / h;
      updateTactileRelief(nx, ny, 0.88);
      samplePhonographAt(nx, ny);
    }, { passive: true });
    stage.addEventListener('pointerleave', () => {
      reliefState.alpha = 0;
      reliefState.micaGlint = 0;
      reliefState.goldBrdf = 0;
      stage.style.setProperty('--specular-alpha', '0');
      stage.style.setProperty('--relief-dx', '0px');
      stage.style.setProperty('--relief-dy', '0px');
      stage.style.setProperty('--mica-glint', '0');
      stage.style.setProperty('--gold-brdf', '0');
    }, { passive: true });
    window.addEventListener('deviceorientation', e => {
      if (e.gamma === null || e.beta === null) return;
      updateTactileRelief(clamp(0.5 + e.gamma / 60, 0, 1), clamp(0.42 + (e.beta - 35) / 60, 0, 1), 0.78);
    }, { passive: true });
    window.NAROA_RELIEF = {
      update: updateTactileRelief,
      getState: () => ({ ...reliefState })
    };
    window.NAROA_PHONOGRAPH = {
      sampleAt: samplePhonographAt,
      getState: () => ({ ...phonographState })
    };
    const kineticTitle = $('[data-kinetic-title]', stage), caption = $('[data-art-copy]', stage);
    const state = { index: Number(stage.dataset.initial) || 0, fit: false, quiet: false, photo: 0 };
    const journey = window.NAROA_JOURNEY.create(works, catalogue.journey);
    const initialDistance = journey.at(state.index);
    const motion = {
      pose: journey.read(initialDistance),
      position: state.index,
      desired: state.index,
      current: initialDistance,
      target: initialDistance,
      velocity: 0,
      lastTime: 0,
      frame: null,
      request: 0,
      navigation: null
    };
    const track = stage.closest('.art-scroll'), geometry = { top: 0, unit: 1, width: 0, height: 0 };
    track.style.setProperty('--journey-length', `${journey.total * 100}svh`);
    document.documentElement.classList.add('gallery-scroll');
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const pan = { x: 0, y: 0, rx: 0, ry: 0, tx: 0, ty: 0, trx: 0, try: 0, frame: null };
    let cameraRestTimer = null, lastScrollPixels = 0;
    function stepPan() {
      pan.frame = null;
      if (reduced.matches || state.fit || !stage.classList.contains('is-resting')) {
        pan.x = pan.y = pan.rx = pan.ry = pan.tx = pan.ty = pan.trx = pan.try = 0;
        stage.style.setProperty('--pan-x', '0px');
        stage.style.setProperty('--pan-y', '0px');
        stage.style.setProperty('--pan-rx', '0deg');
        stage.style.setProperty('--pan-ry', '0deg');
        return;
      }
      const dx = pan.tx - pan.x;
      const dy = pan.ty - pan.y;
      const drx = pan.trx - pan.rx;
      const dry = pan.try - pan.ry;
      if (Math.abs(dx) < 0.08 && Math.abs(dy) < 0.08 && Math.abs(drx) < 0.03 && Math.abs(dry) < 0.03) {
        pan.x = pan.tx;
        pan.y = pan.ty;
        pan.rx = pan.trx;
        pan.ry = pan.try;
      } else {
        pan.x += dx * 0.38;
        pan.y += dy * 0.38;
        pan.rx += drx * 0.34;
        pan.ry += dry * 0.34;
        pan.frame = requestAnimationFrame(stepPan);
      }
      stage.style.setProperty('--pan-x', `${pan.x.toFixed(2)}px`);
      stage.style.setProperty('--pan-y', `${pan.y.toFixed(2)}px`);
      stage.style.setProperty('--pan-rx', `${pan.rx.toFixed(2)}deg`);
      stage.style.setProperty('--pan-ry', `${pan.ry.toFixed(2)}deg`);
    }
    function schedulePan(tx, ty) {
      if (reduced.matches || state.fit || !stage.classList.contains('is-resting')) return;
      pan.tx = clamp(tx, -6.5, 6.5);
      pan.ty = clamp(ty, -6.5, 6.5);
      pan.trx = clamp((ty / 6.5) * 1.45, -1.5, 1.5);
      pan.try = clamp((-tx / 6.5) * 1.65, -1.7, 1.7);
      if (pan.frame === null) pan.frame = requestAnimationFrame(stepPan);
    }
    function restCamera() {
      clearTimeout(cameraRestTimer);
      cameraRestTimer = null;
      stage.classList.remove('is-camera-moving');
      stage.style.setProperty('--velocity-skew', '0deg');
      stage.style.setProperty('--scroll-velocity', '0');
      stage.style.setProperty('--camera-tension', '0');
    }
    function travelCamera() {
      if (reduced.matches || state.fit) { restCamera(); return; }
      stage.classList.add('is-camera-moving', 'has-travelled');
      clearTimeout(cameraRestTimer);
      cameraRestTimer = setTimeout(restCamera, 180);
    }
    const pendingImages = new Map();
    const puzzles = new Map();
    const svgNode = (name, attrs = {}) => {
      const node = document.createElementNS('http://www.w3.org/2000/svg', name);
      Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
      return node;
    };
    function puzzleScene(index) {
      if (puzzles.has(index)) return puzzles.get(index);
      const svg = svgNode('svg', { viewBox: '-120 -120 1240 1240', 'aria-hidden': 'true', focusable: 'false', class: 'puzzle-camera' });
      const defs = svgNode('defs'), picture = svgNode('image', { id: `puzzle-photo-${index}`, width: 1000, height: 1000, preserveAspectRatio: 'none', href: works[index].cover });
      defs.append(picture); svg.append(defs);
      const pieces = [];
      // Adjacent edges share one curve, traversed in the opposite direction.
      const edge = (x, y, dx, dy, tab) => {
        const point = (t, n = 0) => `${(x + dx * t - dy * n).toFixed(3)},${(y + dy * t + dx * n).toFixed(3)}`;
        return tab ? `L${point(.35)} C${point(.46)} ${point(.31, tab * .16)} ${point(.5, tab * .16)} C${point(.69, tab * .16)} ${point(.54)} ${point(.65)} L${point(1)}` : `L${point(1)}`;
      };
      for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) {
        const n = row * 5 + col, x = col * 200, y = row * 200;
        const h = r => r === 0 || r === 5 ? 0 : (r + col) % 2 ? 1 : -1;
        const v = c => c === 0 || c === 5 ? 0 : (row + c) % 2 ? -1 : 1;
        const path = `M${x},${y}` + edge(x, y, 200, 0, h(row)) + edge(x + 200, y, 0, 200, v(col + 1)) + edge(x + 200, y + 200, -200, 0, -h(row + 1)) + edge(x, y + 200, 0, -200, -v(col)) + 'Z';
        const clip = svgNode('clipPath', { id: `puzzle-cut-${index}-${n}`, clipPathUnits: 'userSpaceOnUse' });
        clip.append(svgNode('path', { d: path })); defs.append(clip);
        const group = svgNode('g', { 'data-puzzle-piece': n });
        group.append(svgNode('use', { href: `#puzzle-photo-${index}`, 'clip-path': `url(#puzzle-cut-${index}-${n})` }));
        const bevel = svgNode('path', { d: path, class: 'puzzle-piece-edge', fill: 'none' });
        group.append(bevel);
        svg.append(group);
        const destination = (n * 7 + 9) % 25;
        const destCol = destination % 5;
        const destRow = Math.floor(destination / 5);
        const relX = (col - 2) * 160;
        const relY = (row - 2) * 160;
        const dx = ((destCol - col) * 220 + Math.sin(n * 2.4) * 140 + relX * 1.35) * 1.15;
        const dy = ((destRow - row) * 220 + Math.cos(n * 1.9) * 120 + relY * 1.35) * 1.15;
        const turn = (n % 7 - 3) * 28 + Math.sin(n * 2.8) * 18;
        const arc = Math.sin(n * 1.7) * 240 + Math.cos(n * 2.3) * 110;
        const radialDist = Math.hypot(col - 2, row - 2) / 2.8284;
        pieces.push({ group, cx: x + 100, cy: y + 100, dx, dy, turn, arc, radialDist });
      }
      const puzzle = { svg, picture, pieces };
      $('.art-pan', scenes[index]).append(svg); scenes[index].classList.add('is-puzzle');
      puzzles.set(index, puzzle); return puzzle;
    }
    function drawPuzzle(index, fraction, still) {
      const puzzle = puzzleScene(index);
      puzzle.picture.setAttribute('href', works[index].cover);
      const phase = clamp(fraction / .78, 0, 1);
      const scatter = still ? 0 : Math.pow(Math.sin(phase * Math.PI), 2);
      const amount = scatter < 1e-8 ? 0 : scatter;
      puzzle.svg.dataset.scatter = amount.toFixed(4);
      puzzle.svg.style.setProperty('--puzzle-lift', amount.toFixed(3));
      puzzle.svg.style.visibility = still ? 'hidden' : 'visible';
      scenes[index].classList.toggle('puzzle-still', still);
      puzzle.pieces.forEach(({ group, cx, cy, dx, dy, turn, arc, radialDist }) => {
        const pieceExp = 1.35 - 0.57 * (radialDist || 0);
        const a = amount === 0 ? 0 : Math.pow(amount, pieceExp);
        const lift = Math.sin(phase * Math.PI * 2) * a;
        group.setAttribute('transform', `translate(${(dx * a).toFixed(3)} ${(dy * a + arc * lift).toFixed(3)}) rotate(${(turn * a).toFixed(3)} ${cx} ${cy})`);
      });
      return puzzle;
    }
    const paintedScenes = new Set(scenes.map((_, index) => index));
    const photosDialog = $('#photos-dialog');
    const createGalleryElement = (tag, className, text) => {
      const element = document.createElement(tag);
      if (className) element.className = className;
      if (text !== undefined) element.textContent = text;
      return element;
    };
    const galleryTrigger = createGalleryElement('button', 'art-gallery-trigger');
    galleryTrigger.type = 'button';
    galleryTrigger.setAttribute('aria-haspopup', 'dialog');
    galleryTrigger.setAttribute('aria-controls', 'work-gallery-dialog');
    $('.art-layers', stage).after(galleryTrigger);
    const workGallery = createGalleryElement('dialog', 'work-gallery-dialog');
    workGallery.id = 'work-gallery-dialog';
    workGallery.setAttribute('aria-labelledby', 'work-gallery-title');
    workGallery.setAttribute('aria-describedby', 'work-gallery-meta');
    const galleryHeader = createGalleryElement('div', 'work-gallery-header');
    const galleryClose = createGalleryElement('button', '', 'Cerrar ×');
    galleryClose.type = 'button'; galleryClose.autofocus = true;
    galleryHeader.append(createGalleryElement('p', 'eyebrow', 'La obra, de cerca'), galleryClose);
    const galleryIntro = createGalleryElement('div', 'work-gallery-intro');
    const galleryTitle = createGalleryElement('h2'); galleryTitle.id = 'work-gallery-title';
    const galleryMeta = createGalleryElement('p');
    galleryMeta.id = 'work-gallery-meta'; galleryMeta.dataset.workGalleryMeta = '';
    galleryIntro.append(galleryTitle, galleryMeta);
    const galleryGrid = createGalleryElement('div', 'work-gallery-grid');
    workGallery.append(galleryHeader, galleryIntro, galleryGrid,
      createGalleryElement('p', 'work-gallery-footer', 'Pulsa una imagen para ampliarla'));
    document.body.append(workGallery);
    let galleryReturnFocus = null, photoReturnFocus = null;
    galleryClose.addEventListener('click', () => workGallery.close());
    workGallery.addEventListener('click', event => {
      if (event.target !== workGallery) return;
      const bounds = workGallery.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) workGallery.close();
    });
    workGallery.addEventListener('close', () => {
      if (photosDialog.open) photosDialog.close();
      if (!document.querySelector('dialog[open]') && galleryReturnFocus?.isConnected) galleryReturnFocus.focus({ preventScroll: true });
      galleryReturnFocus = null;
      scheduleScroll();
    });
    const focals = { 'marilyn-rocks': '50.4% 51.7%', 'rara-avis': '56% 42%', 'amor-en-conserva': '50% 54%', 'entre-tantas-flores-de-dia': '50% 0%', 'johnny-rocks': '50% 42%', 'rockagipsy': '50% 43%', 'hugo-box': '47.8% 42.7%', 'el-hombre-que-susurraba-a-las-estrellas': '65.2% 57.4%', 'i-got-you-babe': '38% 46%', 'jose-manuel-ezquerra': '62% 42%', 'dar-la-lata': '54% 44%', 'lauralore': '46% 44%', 'izei': '48% 42%', 'the-love-boat': '50% 44%', 'marian-de-miranda': '66% 36%', 'la-famiglia': '50% 40%', 'smile-and-the-world-smiles-back': '50% 50%', 'luis-and-sis': '50% 45%', 'de-color': '50% 45%', 'el-reencuentro': '50% 45%', 'papitxulo': '50% 40%', 'starchild': '50% 40%', 'las-rosalias': '50% 50%', 'baroque-farrokh': '50% 38%', 'el-gran-dakari': '50% 42%', 'audrey-hepburn': '50% 36%', 'geisha': '50% 38%', 'lagrimas-de-oro': '50% 38%', 'the-golden-couple': '50% 40%', 'pink-and-sparkles': '50% 45%', 'love': '50% 44%', 'julio-iglesias-como-un-reloj-suizo': '50% 50%' };
    const mobileFocals = { 'marilyn-rocks': '50.4% 51.7%', 'rara-avis': '61% 40%', 'amor-en-conserva': '48% 54%', 'entre-tantas-flores-de-dia': '50% 0%', 'denbora-nora-zoaz': '18% 45%', 'el-hombre-que-susurraba-a-las-estrellas': '65.2% 57.4%', 'i-got-you-babe': '38% 46%', 'jose-manuel-ezquerra': '62% 42%', 'dar-la-lata': '56% 44%', 'lauralore': '48% 44%', 'izei': '48% 42%', 'the-love-boat': '50% 44%', 'marian-de-miranda': '66% 36%', 'la-famiglia': '50% 40%', 'smile-and-the-world-smiles-back': '50% 50%', 'luis-and-sis': '50% 45%', 'de-color': '50% 45%', 'el-reencuentro': '50% 45%', 'papitxulo': '50% 40%', 'starchild': '50% 40%', 'las-rosalias': '50% 50%', 'baroque-farrokh': '50% 38%', 'el-gran-dakari': '50% 42%', 'audrey-hepburn': '50% 36%', 'geisha': '50% 38%', 'lagrimas-de-oro': '50% 38%', 'the-golden-couple': '50% 40%', 'pink-and-sparkles': '50% 45%', 'love': '50% 44%', 'julio-iglesias-como-un-reloj-suizo': '50% 50%' };
    // Pupil centres measured on the unaltered cover photographs, in source-image coordinates.
    const eyes = {
      'marilyn-rocks': { x: .635, y: .392, iris: .030 },
      'rara-avis': { x: .683, y: .417, iris: .025 },
      'johnny-rocks': { x: .583, y: .459, iris: .028 },
      'rockagipsy': { x: .545, y: .402, iris: .018 },
      'infusion-de-berto': { x: .469, y: .463, iris: .020 },
      'buena-fuente': { x: .678, y: .439, iris: .025 },
      'la-llorona': { x: .2985, y: .4192, iris: .022 },
      'pablo': { x: .7633, y: .8232, iris: .032 }
    };
    const smooth = value => { const t = clamp(value, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
    function eyeGeometry(index) {
      const eye = eyes[works[index].slug], img = images[index];
      const width = geometry.width + 20, height = geometry.height + 20;
      const naturalWidth = img.naturalWidth || 1000, naturalHeight = img.naturalHeight || 1000;
      const cover = Math.max(width / naturalWidth, height / naturalHeight);
      const pictureWidth = naturalWidth * cover, pictureHeight = naturalHeight * cover;
      const focus = scenes[index].style.getPropertyValue('--position').split(' ').map(v => parseFloat(v) / 100);
      return { width, height, x: (width - pictureWidth) * focus[0] + eye.x * pictureWidth, y: (height - pictureHeight) * focus[1] + eye.y * pictureHeight, iris: eye.iris * pictureWidth };
    }
    function eyePose(index, diameter, focus, offset = 0) {
      const point = eyeGeometry(index), zoom = diameter / point.iris, img = images[index];
      const tx = -(zoom - 1) * point.width / 2 * (1 - focus) + (geometry.width * .5 + 10 - point.x * zoom) * focus;
      const ty = -(zoom - 1) * point.height / 2 * (1 - focus) + (geometry.height * .42 + 10 - point.y * zoom) * focus + offset * (1 - focus);
      img.style.transformOrigin = '0px 0px';
      img.style.transform = `translate3d(${tx.toFixed(3)}px,${ty.toFixed(3)}px,0) scale(${zoom.toFixed(5)})`;
    }
    let dustinVisited = false, dustinEpilogueTimer = null;
    let puzzleVisited = false, puzzleReassembled = false, clockVisited = false, wineVisited = false, deltoyaVisited = false;
    let ajenjoVisited = false;
    let cameraFlashTimer = null;
    function fireAjenjoFlash() {
      soundscape?.flash?.();
      stage.classList.remove('has-flash-burst');
      void stage.offsetWidth;
      stage.classList.add('has-flash-burst');
      clearTimeout(cameraFlashTimer);
      cameraFlashTimer = setTimeout(() => {
        stage.classList.remove('has-flash-burst');
      }, 420);
    }
    function firePuzzleSnap() {
      soundscape?.puzzleSnap?.();
    }
    function fireSwissClock() {
      soundscape?.swissClock?.();
    }
    let julioRaf = null, julioPointerOffset = 0, julioTargetOffset = 0, julioPullImpulse = 0;
    function ensureJulioPuppetRig(scene) {
      let rig = scene.querySelector('.julio-puppet-rig');
      if (rig) return rig;
      rig = svgNode('svg', {
        viewBox: '0 0 1700 2048',
        preserveAspectRatio: state.fit ? 'xMidYMid meet' : 'xMidYMid slice',
        'aria-hidden': 'true',
        focusable: 'false',
        class: 'julio-puppet-rig',
        'data-julio-rig': ''
      });
      rig.style.position = 'absolute';
      rig.style.inset = '0';
      rig.style.width = '100%';
      rig.style.height = '100%';
      rig.style.pointerEvents = 'none';
      rig.style.zIndex = '2';
      rig.style.willChange = 'transform';

      const bgPatch = svgNode('image', {
        'data-julio-bg-patch': '',
        x: 930,
        y: 960,
        width: 410,
        height: 550,
        preserveAspectRatio: 'none',
        href: '/images/catalogo/julio-iglesias-bg-patch.webp'
      });
      const threadPath = svgNode('path', {
        'data-julio-thread': '',
        d: 'M980,1320 L995,1490',
        stroke: 'rgba(218, 218, 218, 0.85)',
        'stroke-width': '2.2',
        'stroke-linecap': 'round',
        fill: 'none'
      });
      const shadowGroup = svgNode('g', {
        'data-julio-arm-shadow': '',
        opacity: '0.26'
      });
      const shadowImg = svgNode('image', {
        x: 965,
        y: 1039,
        width: 280,
        height: 335,
        preserveAspectRatio: 'none',
        href: '/images/catalogo/julio-iglesias-arm-mic.webp'
      });
      shadowImg.style.filter = 'brightness(0.08) blur(4px)';
      shadowGroup.append(shadowImg);

      const armGroup = svgNode('g', {
        'data-julio-arm': ''
      });
      const armImg = svgNode('image', {
        x: 960,
        y: 1030,
        width: 280,
        height: 335,
        preserveAspectRatio: 'none',
        href: '/images/catalogo/julio-iglesias-arm-mic.webp'
      });
      armGroup.append(armImg);

      const cordPath = svgNode('path', {
        'data-julio-cord': '',
        d: 'M1204,1244 C1218,1292 1265,1328 1324,1350',
        stroke: '#8e2226',
        'stroke-width': '5.2',
        'stroke-linecap': 'round',
        fill: 'none'
      });

      rig.append(bgPatch, threadPath, shadowGroup, armGroup, cordPath);
      const pan = $('.art-pan', scene) || scene;
      pan.appendChild(rig);
      return rig;
    }
    function applyJulioArmAngle(rig, angleDeg) {
      if (!rig) return;
      const clamped = clamp(angleDeg, -16, 6);
      rig.dataset.armAngle = clamped.toFixed(2);
      const armGroup = rig.querySelector('[data-julio-arm]');
      const shadowGroup = rig.querySelector('[data-julio-arm-shadow]');
      const cordPath = rig.querySelector('[data-julio-cord]');
      const threadPath = rig.querySelector('[data-julio-thread]');
      if (armGroup) armGroup.setAttribute('transform', `rotate(${clamped.toFixed(2)} 1022 1317)`);
      if (shadowGroup) shadowGroup.setAttribute('transform', `rotate(${clamped.toFixed(2)} 1027 1326)`);
      const rad = (clamped * Math.PI) / 180;
      const cosA = Math.cos(rad), sinA = Math.sin(rad);
      if (cordPath) {
        const dx = 1204 - 1022, dy = 1244 - 1317;
        const mx = 1022 + dx * cosA - dy * sinA;
        const my = 1317 + dx * sinA + dy * cosA;
        cordPath.setAttribute('d', `M${mx.toFixed(1)},${my.toFixed(1)} C${(mx + 14).toFixed(1)},${(my + 48).toFixed(1)} 1265,1328 1324,1350`);
      }
      if (threadPath) {
        const tdx = 980 - 1022, tdy = 1320 - 1317;
        const tx = 1022 + tdx * cosA - tdy * sinA;
        const ty = 1317 + tdx * sinA + tdy * cosA;
        threadPath.setAttribute('d', `M${tx.toFixed(1)},${ty.toFixed(1)} L995,1490`);
      }
    }
    let cantinLastProgress = 0, cantinDirection = 0, cantinPuffCount = 1;
    function ensureCantinflowersSmokeRig(scene) {
      let rig = scene.querySelector('.cantinflowers-smoke-rig');
      if (rig) return rig;
      rig = svgNode('svg', {
        viewBox: '0 0 3656 2456',
        preserveAspectRatio: state.fit ? 'xMidYMid meet' : 'xMidYMid slice',
        'aria-hidden': 'true',
        focusable: 'false',
        class: 'cantinflowers-smoke-rig',
        'data-cantinflowers-rig': ''
      });
      const defs = svgNode('defs');
      const emberGrad = svgNode('radialGradient', { id: 'cantin-ember-grad', cx: '50%', cy: '50%', r: '50%' });
      emberGrad.append(
        svgNode('stop', { offset: '0%', 'stop-color': '#fff6c2', 'stop-opacity': '1' }),
        svgNode('stop', { offset: '34%', 'stop-color': '#ff6a00', 'stop-opacity': '0.95' }),
        svgNode('stop', { offset: '68%', 'stop-color': '#e01e00', 'stop-opacity': '0.62' }),
        svgNode('stop', { offset: '100%', 'stop-color': '#ff2a00', 'stop-opacity': '0' })
      );
      const smokeGrad = svgNode('radialGradient', { id: 'cantin-smoke-grad', cx: '50%', cy: '50%', r: '50%' });
      smokeGrad.append(
        svgNode('stop', { offset: '0%', 'stop-color': '#f4f6f8', 'stop-opacity': '0.68' }),
        svgNode('stop', { offset: '52%', 'stop-color': '#d8dee6', 'stop-opacity': '0.36' }),
        svgNode('stop', { offset: '100%', 'stop-color': '#bac4d0', 'stop-opacity': '0' })
      );
      defs.append(emberGrad, smokeGrad);
      rig.append(defs);

      const emberGroup = svgNode('g', { 'data-cantin-ember': '' });
      const emberHalo = svgNode('circle', {
        'data-cantin-ember-halo': '',
        cx: '2126',
        cy: '1695',
        r: '86',
        fill: 'url(#cantin-ember-grad)',
        opacity: '0'
      });
      const emberCore = svgNode('ellipse', {
        'data-cantin-ember-core': '',
        cx: '2126',
        cy: '1695',
        rx: '19',
        ry: '15',
        transform: 'rotate(-36 2126 1695)',
        fill: '#ff7b1a',
        opacity: '0'
      });
      const emberHotspot = svgNode('circle', {
        'data-cantin-ember-hotspot': '',
        cx: '2127',
        cy: '1696',
        r: '8',
        fill: '#fff5ba',
        opacity: '0'
      });
      emberGroup.append(emberHalo, emberCore, emberHotspot);

      const cigSmokeGroup = svgNode('g', { 'data-cantin-cig-smoke': '', fill: 'none', 'stroke-linecap': 'round' });
      for (let i = 0; i < 3; i++) {
        cigSmokeGroup.append(svgNode('path', {
          'data-cantin-wisp': String(i),
          d: 'M2126,1688 C2145,1560 2085,1420 2135,1260',
          stroke: i === 0 ? 'rgba(244, 247, 250, 0.62)' : i === 1 ? 'rgba(222, 230, 238, 0.46)' : 'rgba(255, 248, 238, 0.38)',
          'stroke-width': String(18 + i * 11),
          opacity: '0'
        }));
      }

      const mouthSmokeGroup = svgNode('g', { 'data-cantin-mouth-smoke': '' });
      for (let i = 0; i < 5; i++) {
        const puffGroup = svgNode('g', { 'data-cantin-puff': String(i), opacity: '0' });
        puffGroup.append(
          svgNode('ellipse', {
            cx: '0',
            cy: '0',
            rx: String(95 + i * 28),
            ry: String(58 + i * 18),
            fill: 'url(#cantin-smoke-grad)'
          }),
          svgNode('path', {
            d: 'M-55,10 C-15,-42 48,-36 85,8 C42,38 -18,36 -55,10 Z',
            fill: 'rgba(245, 247, 250, 0.28)'
          })
        );
        mouthSmokeGroup.append(puffGroup);
      }

      rig.append(emberGroup, cigSmokeGroup, mouthSmokeGroup);
      const pan = $('.art-pan', scene) || scene;
      pan.appendChild(rig);
      return rig;
    }
    function applyCantinflowersDrag(rig, rawProgress, puffCount = 1) {
      if (!rig) return;
      const p = clamp(rawProgress, 0, 1);
      const mult = clamp(puffCount, 1, 8);
      // Inhale peaks in the first half of the scroll pass; exhale billows out right after.
      const inhale = Math.pow(Math.sin(clamp(p / 0.68, 0, 1) * Math.PI), 0.85);
      const emberPulse = clamp(inhale * (0.85 + Math.min(0.35, (mult - 1) * 0.06)) + Math.sin(p * Math.PI * 5) * 0.12 * inhale, 0, 1);
      const exhale = smooth(clamp((p - 0.14) / 0.82, 0, 1));
      const smokeAlive = Math.sin(p * Math.PI);

      rig.dataset.dragProgress = p.toFixed(3);
      rig.dataset.puffCount = String(mult);
      rig.dataset.emberGlow = emberPulse.toFixed(3);

      const halo = rig.querySelector('[data-cantin-ember-halo]');
      const core = rig.querySelector('[data-cantin-ember-core]');
      const hotspot = rig.querySelector('[data-cantin-ember-hotspot]');
      if (halo) {
        halo.setAttribute('r', (64 + emberPulse * 88).toFixed(1));
        halo.setAttribute('opacity', (0.18 + emberPulse * 0.82).toFixed(3));
      }
      if (core) {
        core.setAttribute('rx', (17 + emberPulse * 9).toFixed(1));
        core.setAttribute('ry', (13 + emberPulse * 7).toFixed(1));
        core.setAttribute('opacity', (0.28 + emberPulse * 0.72).toFixed(3));
      }
      if (hotspot) {
        hotspot.setAttribute('r', (5 + emberPulse * 8.5).toFixed(1));
        hotspot.setAttribute('opacity', (0.15 + emberPulse * 0.85).toFixed(3));
      }

      const wisps = rig.querySelectorAll('[data-cantin-wisp]');
      wisps.forEach((wisp, idx) => {
        const wProg = clamp((p - idx * 0.08) / 0.84, 0, 1);
        const rise = wProg * (390 + idx * 95);
        const sway1 = Math.sin(p * 6.2 + idx * 1.7) * (42 + idx * 16);
        const sway2 = Math.cos(p * 5.4 + idx * 2.1) * (68 + idx * 22);
        const x0 = 2126 + (idx - 1) * 8;
        const y0 = 1686;
        const d = `M${x0},${y0} C${(x0 + sway1).toFixed(1)},${(y0 - rise * 0.36).toFixed(1)} ${(x0 - sway2).toFixed(1)},${(y0 - rise * 0.72).toFixed(1)} ${(x0 + sway2 * 0.65).toFixed(1)},${(y0 - rise).toFixed(1)}`;
        wisp.setAttribute('d', d);
        wisp.setAttribute('opacity', (smokeAlive * (0.58 - idx * 0.11) * Math.min(1.25, 0.85 + mult * 0.08)).toFixed(3));
      });

      const puffs = rig.querySelectorAll('[data-cantin-puff]');
      puffs.forEach((puff, idx) => {
        const stagger = idx * 0.11;
        const localT = clamp((exhale - stagger) / Math.max(0.22, 1 - stagger), 0, 1);
        if (localT <= 0.005) {
          puff.setAttribute('opacity', '0');
          return;
        }
        // Start at Cantinflas's parted lips (1345, 1344) and curl outward/upward toward the cigarette & plates
        const startX = 1358;
        const startY = 1346;
        const driftX = localT * (280 + idx * 78) + Math.sin(localT * Math.PI * 2 + idx) * 34;
        const driftY = -localT * (195 + idx * 64) - Math.pow(localT, 1.5) * 90;
        const scale = 0.28 + localT * (1.15 + idx * 0.22) * Math.min(1.35, 0.92 + mult * 0.07);
        const rot = -14 + localT * (28 + idx * 9) * (idx % 2 === 0 ? 1 : -1);
        const op = Math.sin(localT * Math.PI) * (0.76 - idx * 0.09) * Math.min(1.2, 0.85 + mult * 0.08);
        puff.setAttribute('transform', `translate(${(startX + driftX).toFixed(1)} ${(startY + driftY).toFixed(1)}) scale(${scale.toFixed(3)}) rotate(${rot.toFixed(1)})`);
        puff.setAttribute('opacity', clamp(op, 0, 0.92).toFixed(3));
      });
    }
    function stepJulioClockwork() {
      julioRaf = null;
      const isTestEnv = typeof window !== 'undefined' && (window.location.hostname === 'portfolio.test' || reduced.matches);
      const baseSlug = works[motion.pose.entry.index]?.slug;
      const incSlug = works[Math.min(motion.pose.entry.index + 1, works.length - 1)]?.slug;
      const julioActive = baseSlug === 'julio-iglesias-como-un-reloj-suizo' || incSlug === 'julio-iglesias-como-un-reloj-suizo';
      if (!julioActive || isTestEnv) return;
      julioPointerOffset += (julioTargetOffset - julioPointerOffset) * 0.14;
      julioPullImpulse *= 0.90;
      const now = performance.now();
      const t = now * 0.0021;
      const clockWave = Math.sin(t) * 8.2 + Math.sin(t * 2.0) * 1.6 - 4.2;
      const scrollDrive = (motion.pose.phase === 'transition' ? motion.pose.progress : motion.pose.explore) * -5.5;
      const angle = clockWave + scrollDrive + julioPointerOffset + julioPullImpulse;
      const julioIdx = works.findIndex(w => w.slug === 'julio-iglesias-como-un-reloj-suizo');
      if (julioIdx >= 0 && scenes[julioIdx]) {
        const rig = ensureJulioPuppetRig(scenes[julioIdx]);
        applyJulioArmAngle(rig, angle);
      }
      julioRaf = requestAnimationFrame(stepJulioClockwork);
    }
    stage.addEventListener('pointermove', e => {
      if (works[state.index]?.slug !== 'julio-iglesias-como-un-reloj-suizo') return;
      const h = geometry.height || innerHeight || 1;
      julioTargetOffset = ((e.clientY / h) - 0.5) * 14;
    }, { passive: true });
    stage.addEventListener('pointerdown', () => {
      if (works[state.index]?.slug !== 'julio-iglesias-como-un-reloj-suizo') return;
      julioPullImpulse = -10.5;
      fireSwissClock();
    }, { passive: true });
    function fireWineClink() {
      soundscape?.wineClink?.();
    }
    function fireDeltoya() {
      soundscape?.deltoya?.();
    }
    let gameOverVisited = false, bboyTimer = null, bboyRewindTimer = null, isBreakdancing = false;
    function fireGameOver8Bit() {
      soundscape?.gameOver?.();
      if (!soundscape?.gameOver) {
        window.NAROA_SOUND?.gameOver?.();
      }
      const isTestEnv = typeof window !== 'undefined' && (window.location.hostname === 'portfolio.test' || reduced.matches);
      if (isTestEnv || isBreakdancing) return;

      clearTimeout(bboyTimer);
      clearTimeout(bboyRewindTimer);
      bboyTimer = setTimeout(() => {
        if (works[state.index]?.slug === 'game-over') {
          isBreakdancing = true;
          stage.classList.add('is-breakdance-stage');
          stickman.removeAttribute('hidden');
          stickman.classList.add('is-breakdancing');
          stickman.style.transform = '';
          stickRunner.style.transform = '';

          // A los 2.8s (a mitad de las vueltas del breakdance), el scroll vuelve a toda velocidad hacia arriba
          bboyRewindTimer = setTimeout(() => {
            stage.classList.add('is-supersonic-rewind');
            change(0);
            setTimeout(() => {
              stage.classList.remove('is-breakdance-stage', 'is-breakdancing', 'is-supersonic-rewind');
              stickman.setAttribute('hidden', '');
              stickman.classList.remove('is-breakdancing');
              isBreakdancing = false;
            }, 1800);
          }, 2800);
        }
      }, 1600);
    }
    let lauraVisited = false, lauraTimer = null, isLauraZooming = false, lauraPauseDistance = 0;
    function fireLauraLorePause() {
      const isTestEnv = typeof window !== 'undefined' && (window.location.hostname === 'portfolio.test' || reduced.matches);
      if (isTestEnv || isBreakdancing) return;
      isLauraZooming = false;
      lauraPauseDistance = motion.current;
      const lauraScene = stage.querySelector('.art-scene[data-work="lauralore"]');
      const lauraImg = images[state.index] || (lauraScene && lauraScene.querySelector('img'));
      if (lauraScene && lauraImg) {
        stage.classList.add('is-eguzkilore-stage');
        lauraScene.classList.add('is-eguzkilore-active');
        lauraImg.style.transformOrigin = '38% 34%';
        soundscape?.eguzkilore?.();
      }
      clearTimeout(lauraTimer);
      lauraTimer = setTimeout(() => {
        if (lauraScene) {
          stage.classList.remove('is-eguzkilore-stage');
          lauraScene.classList.remove('is-eguzkilore-active');
        }
      }, 3200);
    }
    let ezquerraVisited = false, ezquerraDazedTimer = null, punchVisited = false, canPeelVisited = false;
    function fireEzquerraDazed() {
      const isTestEnv = typeof window !== 'undefined' && (window.location.hostname === 'portfolio.test' || reduced.matches);
      if (isTestEnv) return;
      const ezquerraImg = images[state.index] || stage.querySelector('.art-scene[data-work="jose-manuel-ezquerra"] img');
      if (!ezquerraImg) return;
      stage.classList.add('is-ezquerra-dazed');
      ezquerraImg.classList.remove('is-dazed');
      void ezquerraImg.offsetWidth;
      ezquerraImg.classList.add('is-dazed');
      clearTimeout(ezquerraDazedTimer);
      ezquerraDazedTimer = setTimeout(() => {
        stage.classList.remove('is-ezquerra-dazed');
        ezquerraImg.classList.remove('is-dazed');
      }, 3000);
    }
    let candyTimer = null, candyStep = 0;
    const candyFrames = [
      '/images/catalogo/can-dy-queen-01.jpg',
      '/images/catalogo/can-dy-queen-02.jpg',
      '/images/catalogo/can-dy-queen-03.jpg',
      '/images/catalogo/can-dy-queen-04.jpg',
      '/images/catalogo/can-dy-queen-03.jpg',
      '/images/catalogo/can-dy-queen-02.jpg'
    ];
    function startCandySlowMo() {
      if (candyTimer) return;
      candyTimer = setInterval(() => {
        if (works[state.index]?.slug !== 'can-dy-queen') {
          clearInterval(candyTimer);
          candyTimer = null;
          return;
        }
        candyStep = (candyStep + 1) % candyFrames.length;
        if (images[state.index]) {
          images[state.index].src = candyFrames[candyStep];
        }
      }, 500);
    }
    let stickman = stage.querySelector('[data-stickman]');
    if (!stickman) {
      stickman = document.createElement('div');
      stickman.className = 'art-stickman';
      stickman.setAttribute('data-stickman', '');
      stickman.setAttribute('aria-hidden', 'true');
      stickman.setAttribute('hidden', '');
      stickman.innerHTML = `<div class="stickman-runner" data-stick-runner><svg viewBox="0 0 110 120" class="stickman-svg" aria-hidden="true">
        <ellipse data-stick-shadow cx="50" cy="103" rx="18" ry="2.6" fill="rgba(247,213,148,0.28)" />
        <path data-stick-scarf-gold d="M52,34 Q30,24 10,38" stroke="#f7d594" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.78" />
        <path data-stick-scarf d="M54,32 Q34,28 16,36" stroke="#fffdf4" stroke-width="2.6" stroke-linecap="round" fill="none" opacity="0.92" />
        <polyline data-stick-hair points="49,10 54,3 57,10 63,4 62,12" stroke="#fffdf4" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        <circle data-stick-head cx="58" cy="20" r="9.5" stroke="#fffdf4" stroke-width="3.2" fill="#070706" />
        <circle data-stick-eye cx="62" cy="18.5" r="1.8" fill="#fffdf4" />
        <line data-stick-torso x1="56" y1="29" x2="50" y2="62" stroke="#fffdf4" stroke-width="3.8" stroke-linecap="round" />
        <polyline data-stick-arm-l points="55,36 39,48 29,39" stroke="#fffdf4" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        <polyline data-stick-arm-r points="55,36 69,46 81,34" stroke="#fffdf4" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        <polyline data-stick-leg-l points="50,62 34,82 22,102" stroke="#fffdf4" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        <polyline data-stick-leg-r points="50,62 68,80 80,100" stroke="#fffdf4" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        <line data-stick-dust-1 x1="26" y1="98" x2="6" y2="98" stroke="rgba(255,253,244,0.82)" stroke-width="2.6" stroke-linecap="round" />
        <line data-stick-dust-2 x1="32" y1="105" x2="12" y2="105" stroke="rgba(255,253,244,0.55)" stroke-width="2.2" stroke-linecap="round" />
        <circle data-stick-spark cx="18" cy="93" r="2.2" fill="rgba(255,253,244,0.85)" />
        <circle data-stick-spark-2 cx="10" cy="88" r="1.7" fill="rgba(247,213,148,0.9)" />
        <circle data-stick-spark-3 cx="24" cy="97" r="1.4" fill="rgba(237,188,164,0.85)" />
      </svg></div>`;
      stage.appendChild(stickman);
    }
    const stickSvg = stickman.querySelector('svg');
    if (stickSvg && !stickSvg.querySelector('[data-stick-scarf-gold]')) {
      const ns = 'http://www.w3.org/2000/svg';
      const shadow = document.createElementNS(ns, 'ellipse');
      shadow.setAttribute('data-stick-shadow', '');
      shadow.setAttribute('cx', '50'); shadow.setAttribute('cy', '103');
      shadow.setAttribute('rx', '18'); shadow.setAttribute('ry', '2.6');
      shadow.setAttribute('fill', 'rgba(247,213,148,0.28)');
      const scarfGold = document.createElementNS(ns, 'path');
      scarfGold.setAttribute('data-stick-scarf-gold', '');
      scarfGold.setAttribute('d', 'M52,34 Q30,24 10,38');
      scarfGold.setAttribute('stroke', '#f7d594');
      scarfGold.setAttribute('stroke-width', '1.8');
      scarfGold.setAttribute('stroke-linecap', 'round');
      scarfGold.setAttribute('fill', 'none');
      scarfGold.setAttribute('opacity', '0.78');
      const sp2 = document.createElementNS(ns, 'circle');
      sp2.setAttribute('data-stick-spark-2', '');
      sp2.setAttribute('cx', '10'); sp2.setAttribute('cy', '88'); sp2.setAttribute('r', '1.7');
      sp2.setAttribute('fill', 'rgba(247,213,148,0.9)');
      const sp3 = document.createElementNS(ns, 'circle');
      sp3.setAttribute('data-stick-spark-3', '');
      sp3.setAttribute('cx', '24'); sp3.setAttribute('cy', '97'); sp3.setAttribute('r', '1.4');
      sp3.setAttribute('fill', 'rgba(237,188,164,0.85)');
      stickSvg.prepend(shadow, scarfGold);
      stickSvg.append(sp2, sp3);
    }
    const stickRunner = stickman.querySelector('[data-stick-runner]') || stickman;
    const stickShadow = stickman.querySelector('[data-stick-shadow]');
    const stickHead = stickman.querySelector('[data-stick-head]');
    const stickEye = stickman.querySelector('[data-stick-eye]');
    const stickHair = stickman.querySelector('[data-stick-hair]');
    const stickTorso = stickman.querySelector('[data-stick-torso]');
    const stickScarf = stickman.querySelector('[data-stick-scarf]');
    const stickScarfGold = stickman.querySelector('[data-stick-scarf-gold]');
    const stickArmL = stickman.querySelector('[data-stick-arm-l]');
    const stickArmR = stickman.querySelector('[data-stick-arm-r]');
    const stickLegL = stickman.querySelector('[data-stick-leg-l]');
    const stickLegR = stickman.querySelector('[data-stick-leg-r]');
    const stickDust1 = stickman.querySelector('[data-stick-dust-1]');
    const stickDust2 = stickman.querySelector('[data-stick-dust-2]');
    const stickSpark = stickman.querySelector('[data-stick-spark]');
    const stickSpark2 = stickman.querySelector('[data-stick-spark-2]');
    const stickSpark3 = stickman.querySelector('[data-stick-spark-3]');
    let lastStickFraction = 0;
    let stickDirection = 1;

    const MAX_KISS_CUTOUTS = 12;
    const pensadoraWork = works.find(w => w.slug === 'la-pensadora');
    const pensadoraCoverUrl = pensadoraWork?.cover || '/images/catalogo/la-pensadora-original-01-2048.jpg';
    let kissStage = stage.querySelector('[data-kiss-stage]');
    if (!kissStage) {
      kissStage = document.createElement('div');
      kissStage.className = 'art-kiss-stage';
      kissStage.setAttribute('data-kiss-stage', '');
      kissStage.setAttribute('aria-hidden', 'true');
      kissStage.setAttribute('hidden', '');
      for (let k = 0; k < MAX_KISS_CUTOUTS; k++) {
        const cutout = document.createElement('div');
        cutout.className = 'pensadora-kiss-cutout';
        cutout.setAttribute('data-kiss-cutout', String(k));
        const lips = document.createElement('div');
        lips.className = 'pensadora-kiss-lips';
        lips.style.backgroundImage = `url("${pensadoraCoverUrl}")`;
        cutout.appendChild(lips);
        kissStage.appendChild(cutout);
      }
      stage.appendChild(kissStage);
    }
    const kissCutouts = Array.from(kissStage.querySelectorAll('[data-kiss-cutout]'));
    const KISS_LANDING_OFFSETS = [
      { dx: 0.000, dy: 0.000, arc: -0.15, rot: -11, scale: 0.88, stagger: 0.00 },
      { dx: 0.055, dy: -0.048, arc: -0.22, rot: 14, scale: 0.72, stagger: 0.05 },
      { dx: -0.062, dy: 0.042, arc: -0.11, rot: -18, scale: 0.68, stagger: 0.09 },
      { dx: 0.145, dy: -0.135, arc: -0.26, rot: 9, scale: 0.64, stagger: 0.13 },
      { dx: -0.038, dy: -0.095, arc: -0.19, rot: -6, scale: 0.74, stagger: 0.16 },
      { dx: 0.088, dy: 0.065, arc: -0.14, rot: 17, scale: 0.62, stagger: 0.19 },
      { dx: -0.110, dy: -0.025, arc: -0.24, rot: -15, scale: 0.60, stagger: 0.22 },
      { dx: 0.180, dy: -0.175, arc: -0.29, rot: 12, scale: 0.58, stagger: 0.25 },
      { dx: 0.025, dy: 0.092, arc: -0.12, rot: -9, scale: 0.66, stagger: 0.28 },
      { dx: -0.085, dy: 0.085, arc: -0.17, rot: 15, scale: 0.56, stagger: 0.31 },
      { dx: 0.115, dy: -0.085, arc: -0.21, rot: -14, scale: 0.60, stagger: 0.34 },
      { dx: -0.015, dy: -0.145, arc: -0.25, rot: 7, scale: 0.54, stagger: 0.37 }
    ];
    let lastKissFraction = 0, kissDirection = 0, kissVolleyCount = 1, kissInSector = false;

    function updateStickmanPose(phase, leapArc = 0, portalStyle = 0) {
      const isFlip = portalStyle === 1 && leapArc > 0.05;
      const isGlide = portalStyle === 2;
      const bob = isGlide ? Math.sin(phase * 1.4) * 1.2 : Math.sin(phase * 2) * 2.4;
      const forwardLean = isGlide ? 3.2 : (1.8 + leapArc * 3.5);
      const headX = 58 + forwardLean + Math.cos(phase) * 1.5;
      const headY = 20 + bob - leapArc * 4;
      const shX = 55 + forwardLean * 0.75 + Math.cos(phase) * 1.1;
      const shY = 35 + bob - leapArc * 3;
      const hipX = 49, hipY = 62 + bob * 0.6 - leapArc * 2;

      if (stickShadow) {
        const shadowRx = Math.max(6, 18 * (1 - leapArc * 0.62) + Math.sin(phase * 2) * 2);
        const shadowOp = Math.max(0.08, 0.32 * (1 - leapArc * 0.7));
        stickShadow.setAttribute('rx', shadowRx.toFixed(1));
        stickShadow.setAttribute('opacity', shadowOp.toFixed(2));
      }
      if (stickHead) {
        stickHead.setAttribute('cx', headX.toFixed(1));
        stickHead.setAttribute('cy', headY.toFixed(1));
      }
      if (stickEye) {
        stickEye.setAttribute('cx', (headX + 4.2).toFixed(1));
        stickEye.setAttribute('cy', (headY - 1.5 - leapArc * 0.8).toFixed(1));
      }
      if (stickHair) {
        const hw = Math.sin(phase * 1.6) * 2.8 - leapArc * 2.2;
        stickHair.setAttribute('points', `${(headX - 9).toFixed(1)},${(headY - 9).toFixed(1)} ${(headX - 4 + hw).toFixed(1)},${(headY - 17.5).toFixed(1)} ${(headX - 1).toFixed(1)},${(headY - 10).toFixed(1)} ${(headX + 5 + hw).toFixed(1)},${(headY - 16.5).toFixed(1)} ${(headX + 4).toFixed(1)},${(headY - 8).toFixed(1)}`);
      }
      if (stickTorso) {
        stickTorso.setAttribute('x1', (headX - 2).toFixed(1));
        stickTorso.setAttribute('y1', (headY + 9).toFixed(1));
        stickTorso.setAttribute('x2', hipX.toFixed(1));
        stickTorso.setAttribute('y2', hipY.toFixed(1));
      }
      if (stickScarf) {
        const wave1 = Math.sin(phase * 1.9) * 6.5 - leapArc * 5;
        const wave2 = Math.cos(phase * 1.9) * 9 + leapArc * 7;
        stickScarf.setAttribute('d', `M${(shX - 1).toFixed(1)},${(shY - 2).toFixed(1)} C${(shX - 15).toFixed(1)},${(shY - 8 + wave1).toFixed(1)} ${(shX - 28).toFixed(1)},${(shY + 4 - wave1).toFixed(1)} ${(shX - 42).toFixed(1)},${(shY + 1 + wave2).toFixed(1)}`);
      }
      if (stickScarfGold) {
        const gWave1 = Math.cos(phase * 2.1) * 7.5 - leapArc * 4;
        const gWave2 = Math.sin(phase * 2.1) * 10 + leapArc * 8;
        stickScarfGold.setAttribute('d', `M${(shX - 2).toFixed(1)},${(shY).toFixed(1)} C${(shX - 18).toFixed(1)},${(shY - 4 + gWave1).toFixed(1)} ${(shX - 32).toFixed(1)},${(shY + 8 - gWave1).toFixed(1)} ${(shX - 47).toFixed(1)},${(shY + 3 + gWave2).toFixed(1)}`);
      }

      const strideAmp = isGlide ? 0.68 : 0.92;
      const thighL = isFlip
        ? 0.95 + leapArc * 0.45
        : Math.sin(phase) * strideAmp + 0.24 + leapArc * 0.65;
      const kneeLX = hipX + Math.sin(thighL) * 20;
      const kneeLY = hipY + Math.cos(thighL) * 20;
      const calfL = isFlip
        ? thighL - 1.35 * leapArc
        : thighL - Math.max(0.08, (Math.sin(phase - 0.65) + 0.45) * 0.95 + leapArc * 0.55);
      const footLX = kneeLX + Math.sin(calfL) * 20;
      const footLY = kneeLY + Math.cos(calfL) * 20;
      const toeLX = footLX + Math.cos(calfL) * 6.5;
      const toeLY = footLY - Math.sin(calfL) * 4.2;

      const thighR = isFlip
        ? 0.75 + leapArc * 0.5
        : Math.sin(phase + Math.PI) * strideAmp + 0.24 - leapArc * 0.45;
      const kneeRX = hipX + Math.sin(thighR) * 20;
      const kneeRY = hipY + Math.cos(thighR) * 20;
      const calfR = isFlip
        ? thighR - 1.35 * leapArc
        : thighR - Math.max(0.08, (Math.sin(phase + Math.PI - 0.65) + 0.45) * 0.95 + leapArc * 0.35);
      const footRX = kneeRX + Math.sin(calfR) * 20;
      const footRY = kneeRY + Math.cos(calfR) * 20;
      const toeRX = footRX + Math.cos(calfR) * 6.5;
      const toeRY = footRY - Math.sin(calfR) * 4.2;

      const armL = -Math.sin(phase) * 0.98 + leapArc * 0.85;
      const elbLX = shX + Math.sin(armL) * 15;
      const elbLY = shY + Math.cos(armL) * 15;
      const handLX = elbLX + Math.sin(armL + 0.95 + leapArc * 0.4) * 15;
      const handLY = elbLY + Math.cos(armL + 0.95 + leapArc * 0.4) * 15;

      const armR = -Math.sin(phase + Math.PI) * 0.98 + leapArc * 1.05;
      const elbRX = shX + Math.sin(armR) * 15;
      const elbRY = shY + Math.cos(armR) * 15;
      const handRX = elbRX + Math.sin(armR + 0.95 + leapArc * 0.5) * 15;
      const handRY = elbRY + Math.cos(armR + 0.95 + leapArc * 0.5) * 15;

      if (stickLegL) stickLegL.setAttribute('points', `${hipX.toFixed(1)},${hipY.toFixed(1)} ${kneeLX.toFixed(1)},${kneeLY.toFixed(1)} ${footLX.toFixed(1)},${footLY.toFixed(1)} ${toeLX.toFixed(1)},${toeLY.toFixed(1)}`);
      if (stickLegR) stickLegR.setAttribute('points', `${hipX.toFixed(1)},${hipY.toFixed(1)} ${kneeRX.toFixed(1)},${kneeRY.toFixed(1)} ${footRX.toFixed(1)},${footRY.toFixed(1)} ${toeRX.toFixed(1)},${toeRY.toFixed(1)}`);
      if (stickArmL) stickArmL.setAttribute('points', `${shX.toFixed(1)},${shY.toFixed(1)} ${elbLX.toFixed(1)},${elbLY.toFixed(1)} ${handLX.toFixed(1)},${handLY.toFixed(1)}`);
      if (stickArmR) stickArmR.setAttribute('points', `${shX.toFixed(1)},${shY.toFixed(1)} ${elbRX.toFixed(1)},${elbRY.toFixed(1)} ${handRX.toFixed(1)},${handRY.toFixed(1)}`);
      const groundContact = Math.max(0, 1 - leapArc * 1.4);
      if (stickDust1) stickDust1.style.opacity = ((0.25 + Math.abs(Math.sin(phase)) * 0.72) * groundContact).toFixed(2);
      if (stickDust2) stickDust2.style.opacity = ((0.2 + Math.abs(Math.cos(phase)) * 0.65) * groundContact).toFixed(2);
      if (stickSpark) {
        stickSpark.setAttribute('cx', (10 + (phase * 8) % 20).toFixed(1));
        stickSpark.setAttribute('cy', (96 - Math.abs(Math.sin(phase * 1.5)) * 14 - leapArc * 10).toFixed(1));
      }
      if (stickSpark2) {
        stickSpark2.setAttribute('cx', (6 + ((phase * 11 + 7) % 24)).toFixed(1));
        stickSpark2.setAttribute('cy', (88 - Math.abs(Math.cos(phase * 1.8)) * 18 - leapArc * 14).toFixed(1));
      }
      if (stickSpark3) {
        stickSpark3.setAttribute('cx', (16 + ((phase * 9 + 3) % 18)).toFixed(1));
        stickSpark3.setAttribute('cy', (99 - Math.abs(Math.sin(phase * 2.2)) * 10 - leapArc * 8).toFixed(1));
      }
    }
    let lastQuartile = 0;
    function checkMilestone(ratio) {
      const q = Math.floor(ratio * 4) / 4;
      if (q > 0 && q !== lastQuartile && ratio >= q) {
        lastQuartile = q;
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(q >= 1 ? [20, 40, 30] : [15]); } catch {}
        }
      }
    }
    function focusPictures() { works.forEach((p, i) => scenes[i].style.setProperty('--position', (innerWidth < 760 && mobileFocals[p.slug]) || focals[p.slug] || '50% 44%')); }
    focusPictures();
    function ensureImage(i) {
      if (!images[i]) return Promise.resolve();
      const img = images[i];
      if (!img.getAttribute('src')) img.src = works[i].cover;
      if (img.complete && img.naturalWidth) return Promise.resolve();
      if (pendingImages.has(i)) return pendingImages.get(i);
      const ready = (img.decode ? img.decode() : new Promise(resolve => { img.addEventListener('load', resolve, { once: true }); img.addEventListener('error', resolve, { once: true }); })).catch(() => {
        if (Math.abs(i - state.index) > 1 && Math.abs(i - motion.desired) > 1) return;
        if (img.src !== new URL(works[i].photos[0].original, location.origin).href) img.src = works[i].photos[0].original;
      });
      pendingImages.set(i, ready); return ready;
    }
    function preloadNeighbours() {
      images.forEach((img, i) => {
        if (Math.abs(i - state.index) > 1 && img.hasAttribute('src')) {
          img.removeAttribute('src'); pendingImages.delete(i);
          puzzles.get(i)?.picture.removeAttribute('href');
        }
      });
      [state.index - 1, state.index, state.index + 1].forEach(i => { ensureImage(i); });
    }
    function metadata() {
      const p = works[state.index], begin = clamp(state.index - 2, 0, Math.max(0, works.length - 5));
      $('[data-art-title]', stage).textContent = p.title; $('[data-art-material]', stage).textContent = p.label;
      $('[data-counter]', stage).textContent = `${String(state.index + 1).padStart(2, '0')} / ${String(works.length).padStart(2, '0')}`;
      $$('[data-select]', stage).forEach(b => { const i = Number(b.dataset.select); b.hidden = i < begin || i >= begin + 5; b.setAttribute('aria-pressed', String(i === state.index)); });
      $('[data-prev]', stage).disabled = state.index === 0; $('[data-next]', stage).disabled = state.index === works.length - 1;
      const ouroboros = $('[data-ouroboros]', stage);
      if (ouroboros) ouroboros.hidden = (state.index !== works.length - 1);
      const finaleShare = $('[data-finale-share]', stage);
      if (finaleShare) finaleShare.hidden = (state.index !== works.length - 1);
      stage.style.setProperty('--count', works.length);
      stage.classList.toggle('is-fit', state.fit); document.body.classList.toggle('is-quiet', state.quiet);
      $('[data-restore]', stage).hidden = !state.quiet;
      const fit = $('[data-fit]', stage); fit.setAttribute('aria-pressed', String(state.fit)); fit.textContent = state.fit ? 'Volver a la inmersión ↙' : 'Ver imagen completa ↗';
      $('[data-open-photos]', stage).textContent = `Ver ${p.photos.length} ${p.photos.length === 1 ? 'fotografía' : 'fotografías'} ↗`;
      galleryTrigger.setAttribute('aria-label', p.photos.length === 1 ? `Ver la fotografía de ${p.title}` : `Ver las ${p.photos.length} fotografías de ${p.title}`);
      galleryTrigger.dataset.work = p.slug;
      $$('.site-nav,.art-index,.art-bottom').forEach(el => { el.inert = state.quiet; });
      $('#story-title').textContent = p.title; $('[data-story-category]').textContent = p.label; $('[data-story]').textContent = p.story;
      const facts = $('[data-facts]'); facts.replaceChildren();
      [['Técnica', p.technique], ['Soporte', p.support], ['Medidas', p.dimensions], ['Materiales', p.materials], ['Serie', p.series], ['Año', p.year]].forEach(([label, value]) => {
        if (!value) return;
        const row = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = value; row.append(dt, dd); facts.append(row);
      });
      const credit = $('[data-credit]'); credit.textContent = p.credit || ''; credit.hidden = !p.credit;
      $('[data-art-email]').href = 'mailto:naroa@naroa.eu?subject=' + encodeURIComponent('Consulta sobre ' + p.title);
      const waLink = $('[data-art-whatsapp]');
      if (waLink) waLink.href = 'https://wa.me/34636060609?text=' + encodeURIComponent('Hola Naroa, me gustaría consultar sobre la obra ' + p.title);
      const source = $('[data-art-source]'); source.hidden = !p.source;
      if (p.source) source.href = p.source; else source.removeAttribute('href');
      const video = $('[data-art-video]');
      if (video) {
        video.hidden = !p.video;
        if (p.video) video.href = p.video; else video.removeAttribute('href');
      }
      scenes.forEach((s, i) => { s.setAttribute('aria-hidden', String(i !== state.index)); s.classList.toggle('is-current', i === state.index); });
      preloadNeighbours();
    }
    function saveRoute() {
      const p = works[state.index], url = '/obra/' + p.slug + '/';
      if (stage.dataset.subset === 'Vaivenes') return;
      history.replaceState({ artwork: p.slug }, '', url);
      document.title = p.title + ' · Naroa Gutiérrez Gil';
      $('link[rel="canonical"]').href = 'https://naroagutierrezgil.com' + url;
      $('meta[name="description"]').content = p.story;
      $('meta[property="og:title"]').content = document.title; $('meta[property="og:description"]').content = p.story; $('meta[property="og:url"]').content = 'https://naroagutierrezgil.com' + url;
      $('meta[property="og:image"]').content = 'https://naroagutierrezgil.com' + p.photos[0].original;
      const twImg = $('meta[name="twitter:image"]');
      if (twImg) twImg.content = 'https://naroagutierrezgil.com' + p.photos[0].original;
      const twTitle = $('meta[name="twitter:title"]');
      if (twTitle) twTitle.content = document.title;
      const twDesc = $('meta[name="twitter:description"]');
      if (twDesc) twDesc.content = p.story;
      $('#page-schema').textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'VisualArtwork', name: p.title, url: 'https://naroagutierrezgil.com' + url, description: p.story, image: p.photos.map(ph => 'https://naroagutierrezgil.com' + ph.original), creator: { '@type': 'Person', name: 'Naroa Gutiérrez Gil' } });
    }
    const SCENE_ACCENTS = ['#edbca4', '#f7d594', '#ff69b4', '#93c572', '#6897ff', '#f4d06f', '#e07a5f'];
    const heroPointer = { x: 0, y: 0, tx: 0, ty: 0, raf: null };
    const heroThresholdEl = $('[data-hero-threshold]', stage);

    function initMonocleAnamorphicShader(container) {
      if (!container || typeof window === 'undefined') return null;
      const canvas = container.querySelector('[data-monocle-canvas]');
      if (!canvas || !canvas.getContext) return null;
      let gl = null;
      try {
        gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false, depth: false }) ||
             canvas.getContext('experimental-webgl');
      } catch {}
      if (!gl) return null;

      const vsSource = `
        attribute vec2 aPosition;
        varying vec2 vUv;
        void main() {
          vUv = aPosition * 0.5 + 0.5;
          gl_Position = vec4(aPosition, 0.0, 1.0);
        }
      `;

      const fsSource = `
        precision mediump float;
        varying vec2 vUv;
        uniform sampler2D uTexture;
        uniform vec2 uMouse;
        uniform float uTime;
        uniform float uHasTexture;

        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          vec2 pAnamorphic = vec2(p.x * 1.25, p.y);
          float r = length(pAnamorphic);
          if (r > 1.0) {
            gl_FragColor = vec4(0.0);
            return;
          }
          float z = sqrt(max(0.0, 1.0 - r * r));
          vec3 N = normalize(vec3(pAnamorphic.x, pAnamorphic.y, z * 1.85));
          vec3 I = normalize(vec3(uMouse * 0.45, -1.0));

          float iorR = 1.0 / 1.488;
          float iorG = 1.0 / 1.522;
          float iorB = 1.0 / 1.558;

          vec3 refrR = refract(I, N, iorR);
          vec3 refrG = refract(I, N, iorG);
          vec3 refrB = refract(I, N, iorB);

          vec2 uvR = clamp(vUv + refrR.xy * 0.28, 0.001, 0.999);
          vec2 uvG = clamp(vUv + refrG.xy * 0.28, 0.001, 0.999);
          vec2 uvB = clamp(vUv + refrB.xy * 0.28, 0.001, 0.999);

          vec3 texCol = vec3(0.0);
          if (uHasTexture > 0.5) {
            float rCol = texture2D(uTexture, uvR).r;
            float gCol = texture2D(uTexture, uvG).g;
            float bCol = texture2D(uTexture, uvB).b;
            texCol = vec3(rCol, gCol, bCol);
          } else {
            texCol = vec3(0.92, 0.74, 0.58) * (0.8 + 0.2 * sin(uTime + r * 6.0));
          }

          float fresnel = pow(1.0 - clamp(dot(-I, N), 0.0, 1.0), 2.8);
          vec3 goldCaustic = vec3(0.968, 0.835, 0.58);
          vec3 rimHighlight = vec3(1.0, 0.98, 0.92) * pow(fresnel, 3.0) * 1.4;

          float causticRing = smoothstep(0.72, 0.88, r) * (1.0 - smoothstep(0.88, 0.98, r));
          float wave = sin(atan(p.y, p.x) * 6.0 + uTime * 1.5) * 0.5 + 0.5;
          vec3 causticColor = goldCaustic * (fresnel * 0.85 + causticRing * wave * 0.65);

          float edgeAlpha = smoothstep(1.0, 0.95, r);
          vec3 finalColor = texCol * 1.15 + causticColor + rimHighlight;

          gl_FragColor = vec4(finalColor * edgeAlpha, edgeAlpha * 0.96);
        }
      `;

      function compileShader(type, src) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          gl.deleteShader(shader);
          return null;
        }
        return shader;
      }

      const vs = compileShader(gl.VERTEX_SHADER, vsSource);
      const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
      if (!vs || !fs) return null;

      const program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        return null;
      }
      gl.useProgram(program);

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1
      ]), gl.STATIC_DRAW);

      const aPosition = gl.getAttribLocation(program, 'aPosition');
      gl.enableVertexAttribArray(aPosition);
      gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

      const uMouse = gl.getUniformLocation(program, 'uMouse');
      const uTime = gl.getUniformLocation(program, 'uTime');
      const uHasTexture = gl.getUniformLocation(program, 'uHasTexture');
      const uTexture = gl.getUniformLocation(program, 'uTexture');

      gl.uniform1i(uTexture, 0);
      gl.uniform1f(uHasTexture, 0.0);

      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([247, 213, 148, 255]));

      let textureLoaded = false;
      const previewAttr = container.style.getPropertyValue('--monocle-preview') || '';
      const previewUrl = previewAttr.replace(/^url\(["']?|["']?\)$/g, '').trim() || (works && works[0] && works[0].cover);
      if (previewUrl) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            textureLoaded = true;
            render(0, 0, 0);
          } catch {}
        };
        img.src = previewUrl;
      }

      function render(mx, my, time) {
        if (!gl || gl.isContextLost?.()) return;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.useProgram(program);
        gl.uniform2f(uMouse, mx || 0, my || 0);
        gl.uniform1f(uTime, time || 0);
        gl.uniform1f(uHasTexture, textureLoaded ? 1.0 : 0.0);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      render(0, 0, 0);

      return {
        render,
        canvas
      };
    }

    const monocleShader = initMonocleAnamorphicShader(heroThresholdEl);

    function stepHeroPointer() {
      heroPointer.raf = null;
      if (!heroThresholdEl || reduced.matches || state.fit || motion.pose.distance >= 0.36) return;
      const dx = heroPointer.tx - heroPointer.x;
      const dy = heroPointer.ty - heroPointer.y;
      heroPointer.x += dx * 0.14;
      heroPointer.y += dy * 0.14;
      const damp = clamp(1 - motion.pose.distance / 0.36, 0, 1);
      const mx = heroPointer.x * damp;
      const my = heroPointer.y * damp;
      heroThresholdEl.style.setProperty('--hero-mx', mx.toFixed(4));
      heroThresholdEl.style.setProperty('--hero-my', my.toFixed(4));
      heroThresholdEl.style.setProperty('--hero-rx', `${(-my * 6.5).toFixed(3)}deg`);
      heroThresholdEl.style.setProperty('--hero-ry', `${(mx * 8.5).toFixed(3)}deg`);
      heroThresholdEl.style.setProperty('--spot-x', `${(46 + mx * 34).toFixed(1)}%`);
      heroThresholdEl.style.setProperty('--spot-y', `${(39.5 + my * 34).toFixed(1)}%`);
      if (monocleShader) monocleShader.render(mx, my, performance.now() * 0.001);
      const cta = $('.hero-kinetic-cta', heroThresholdEl);
      if (cta) {
        cta.style.setProperty('--magnet-x', `${(mx * 18).toFixed(2)}px`);
        cta.style.setProperty('--magnet-y', `${(my * 14).toFixed(2)}px`);
      }
      if (Math.abs(dx) > 0.0008 || Math.abs(dy) > 0.0008) {
        heroPointer.raf = requestAnimationFrame(stepHeroPointer);
      }
    }
    if (heroThresholdEl) {
      stage.addEventListener('pointermove', e => {
        if (reduced.matches || state.fit || motion.pose.distance >= 0.36) return;
        const w = geometry.width || innerWidth || 1;
        const h = geometry.height || innerHeight || 1;
        heroPointer.tx = clamp((e.clientX / w) - 0.46, -0.5, 0.5) * 2;
        heroPointer.ty = clamp((e.clientY / h) - 0.395, -0.5, 0.5) * 2;
        if (heroPointer.raf === null) heroPointer.raf = requestAnimationFrame(stepHeroPointer);
      }, { passive: true });
      stage.addEventListener('pointerleave', () => {
        heroPointer.tx = 0;
        heroPointer.ty = 0;
        if (heroPointer.raf === null) heroPointer.raf = requestAnimationFrame(stepHeroPointer);
      }, { passive: true });
      window.addEventListener('deviceorientation', e => {
        if (reduced.matches || state.fit || motion.pose.distance >= 0.36 || e.gamma === null || e.beta === null) return;
        heroPointer.tx = clamp(e.gamma / 30, -1, 1);
        heroPointer.ty = clamp((e.beta - 35) / 30, -1, 1);
        if (heroPointer.raf === null) heroPointer.raf = requestAnimationFrame(stepHeroPointer);
      }, { passive: true });
    }
    function render() {
      const munsterSlugs = ['lily-munster', 'herman-munster', 'eddie-munster', 'abuelo-munster'];
      const pose = motion.pose, { entry, phase, progress: fraction } = pose;
      const base = entry.index, incoming = Math.min(base + 1, works.length - 1);
      const still = state.fit || reduced.matches;
      const transition = !still && phase === 'transition' && fraction > 0;
      const mode = entry.mode, progress = smooth(fraction), eyeMatch = transition && mode === 'E';
      stage.dataset.transition = still ? 'still' : phase === 'explore' ? 'explore' : !transition ? 'hold' : ({ E: 'eyes', H: 'horizontal', V: 'vertical', Z: 'zoom', P: 'puzzle' })[mode];
      stage.dataset.journeyPhase = phase;
      const isDustinToGameOver = transition && works[base]?.slug === 'dustin' && works[incoming]?.slug === 'game-over';
      const heroThreshold = $('[data-hero-threshold]', stage);
      const visible = new Set(still ? [state.index] : transition ? [base, incoming] : [base]);
      paintedScenes.forEach(index => {
        if (visible.has(index)) return;
        scenes[index].style.visibility = 'hidden'; scenes[index].style.willChange = images[index].style.willChange = 'auto';
      });
      paintedScenes.clear();
      let depth = 0, diameter = 0, focus = 0;
      if (eyeMatch) {
        const from = eyeGeometry(base).iris * 1.08, to = eyeGeometry(incoming).iris * 1.08;
        const deep = Math.hypot(geometry.width, geometry.height) * 1.02;
        const approach = smooth(fraction / .64), reveal = smooth((fraction - .64) / .36);
        diameter = Math.exp(fraction <= .64 ? Math.log(from) + Math.log(deep / from) * approach : Math.log(deep) + Math.log(to / deep) * reveal);
        focus = smooth(fraction / .34) * (1 - reveal); depth = approach * (1 - reveal);
      } else if (transition && mode === 'Z') depth = smooth(fraction / .55) * (1 - smooth((fraction - .55) / .45));
      visible.forEach(index => {
        const scene = scenes[index], image = images[index], outgoing = index === base;
        const isRockaToHugo = transition && works[base]?.slug === 'rockagipsy' && works[incoming]?.slug === 'hugo-box';
        const isAjenjoToBeatriz = transition && works[base]?.slug === 'ajenjo-cam' && works[incoming]?.slug === 'beatriz-de-pandora';
        const isRaraToAmor = transition && works[base]?.slug === 'rara-avis' && works[incoming]?.slug === 'amor-en-conserva';
        const isAmorToAmy = transition && works[base]?.slug === 'amor-en-conserva' && works[incoming]?.slug === 'amy-rocks';
        const isTinCanPeel = isAmorToAmy || (transition && (works[base]?.slug === 'dar-la-lata' || works[base]?.slug === 'enlatadas'));
        const isJamesToMario = transition && works[base]?.slug === 'james-rocks' && works[incoming]?.slug === 'mario-moreno';
        const isJaioTo13n = transition && works[base]?.slug === 'custom-jaio' && works[incoming]?.slug === '13n';
        const isBowieToOlinga = transition && works[base]?.slug === 'el-hombre-que-susurraba-a-las-estrellas' && works[incoming]?.slug === 'olinga-a-la-naranja';
        const isDustinToGameOver = transition && works[base]?.slug === 'dustin' && works[incoming]?.slug === 'game-over';
        const isSistaToMulti = transition && works[base]?.slug === 'sistashark' && works[incoming]?.slug === 'multi-dimensional-love';
        const isMunsterFamily = transition && munsterSlugs.includes(works[base]?.slug) && munsterSlugs.includes(works[incoming]?.slug);
        const isMurrayToEzquerra = transition && works[base]?.slug === 'i-got-you-babe' && works[incoming]?.slug === 'jose-manuel-ezquerra';
        paintedScenes.add(index);
        const isTopOutgoing = isRockaToHugo || isTinCanPeel || isJamesToMario || isJaioTo13n || isRaraToAmor || isBowieToOlinga || isDustinToGameOver || isSistaToMulti || isMurrayToEzquerra;
        scene.style.visibility = 'visible'; scene.style.zIndex = isTopOutgoing ? (outgoing ? '2' : '1') : (outgoing ? '1' : '2');
        scene.style.willChange = transition ? 'opacity,transform' : 'auto'; image.style.willChange = still ? 'auto' : 'transform';
        scene.style.clipPath = 'inset(0)'; scene.style.opacity = '1'; scene.style.transform = 'translate3d(0px,0px,0)';
        scene.style.maskImage = scene.style.webkitMaskImage = 'none';
        image.style.filter = 'none';
        image.style.transformOrigin = works[index].slug === 'el-hombre-que-susurraba-a-las-estrellas' ? '65.2% 57.4%'
          : works[index].slug === 'i-got-you-babe' ? '38% 46%'
          : works[index].slug === 'jose-manuel-ezquerra' ? '62% 42%'
          : works[index].slug === 'roisin' ? '61.1% 58.6%'
          : works[index].slug === 'hugo-box' ? '47.8% 42.7%'
          : '50% 50%';
        if (works[index].interaction === 'puzzle' && (!still || puzzles.has(index))) drawPuzzle(index, outgoing && transition ? fraction : 0, still);
        if (works[index].slug === 'custom-jaio' && !state.fit) {
          const step = outgoing && transition ? (fraction < .34 ? 0 : fraction < .67 ? 1 : 2) : 0;
          const nextSrc = works[index].photos[step]?.src || works[index].cover;
          if (image.getAttribute('src') !== nextSrc) image.src = nextSrc;
        }
        if (still) { image.style.transform = ''; return; }
        if (!transition) {
          const isBowie = works[index].slug === 'el-hombre-que-susurraba-a-las-estrellas';
          const isMarilyn = index === 0;
          if (isBowie) {
            image.style.transformOrigin = '65.2% 57.4%';
            const holdZoom = 1.25 + smooth(pose.explore) * 0.50;
            image.style.transform = `scale(${holdZoom.toFixed(5)})`;
          } else if (isMarilyn) {
            image.style.transformOrigin = '50.4% 51.7%';
            if (!still && heroThreshold && pose.distance < 0.36) {
              const tRaw = clamp(pose.distance / 0.36, 0, 1);
              const t = smooth(tRaw);
              const enterScale = Math.exp(Math.log(3.8) * (1 - t) + Math.log(1.08) * t);
              image.style.transform = `scale(${enterScale.toFixed(5)})`;
              if (monocleShader) {
                const damp = clamp(1 - pose.distance / 0.36, 0, 1);
                monocleShader.render(heroPointer.x * damp, heroPointer.y * damp, performance.now() * 0.001);
              }
            } else {
              const lipsZoom = 1.08 + smooth(pose.explore) * 0.40;
              image.style.transform = `scale(${lipsZoom.toFixed(5)})`;
            }
          } else if (works[index].slug === 'entre-tantas-flores-de-dia') {
            const naturalWidth = image.naturalWidth || 2457, naturalHeight = image.naturalHeight || 3072;
            const isMobile = innerWidth < 760;
            const mobileScale = isMobile ? 1.35 : 1.04;
            const cover = Math.max((geometry.width + 20) / naturalWidth, (geometry.height + 20) / naturalHeight);
            const pictureHeight = naturalHeight * cover * mobileScale;
            const overflowY = Math.max(0, pictureHeight - (geometry.height + 20));
            const travelProgress = smooth(pose.explore);
            const travelY = -travelProgress * overflowY;
            image.style.transformOrigin = '50% 0%';
            image.style.transform = `translate3d(0,${travelY.toFixed(3)}px,0) scale(${mobileScale.toFixed(5)})`;
          } else if (works[index].slug === 'roisin') {
            image.style.transformOrigin = '61.1% 58.6%';
            const roisinZoom = 1.08 + smooth(pose.explore) * 0.16;
            image.style.transform = `scale(${roisinZoom.toFixed(5)})`;
          } else if (works[index].slug === 'hugo-box') {
            image.style.transformOrigin = '47.8% 42.7%';
            const hugoZoom = 1.08 + smooth(pose.explore) * 0.45;
            image.style.transform = `scale(${hugoZoom.toFixed(5)})`;
          } else if (works[index].slug === 'el-armigo-atomico') {
            image.style.transformOrigin = '50% 50%';
            const spinDeg = smooth(pose.explore) * 720;
            image.style.transform = `translate3d(0,${(-smooth(pose.explore) * 3).toFixed(3)}%,0) scale(1.08000) rotate(${spinDeg.toFixed(2)}deg)`;
          } else if (works[index].slug === 'jose-manuel-ezquerra' && image.classList.contains('is-dazed')) {
            // Animación CSS aturdido de 3 segundos en hardware puro
          } else {
            image.style.transform = `translate3d(0,${(-smooth(pose.explore) * 3).toFixed(3)}%,0) scale(1.08000)`;
          }
        } else if (mode === 'E') {
          eyePose(index, diameter, focus, outgoing && entry.explore ? -(geometry.height + 20) * .03 : 0);
          if (!outgoing) scene.style.opacity = smooth((fraction - .42) / .16).toFixed(4);
        } else if (isRockaToHugo) {
          if (outgoing) {
            scene.style.transformOrigin = 'bottom left';
            const fallRot = -smooth(fraction) * 36;
            const fallX = -smooth(fraction) * geometry.width * 1.15;
            const fallY = fraction * fraction * geometry.height * 0.95;
            scene.style.transform = `translate3d(${fallX.toFixed(3)}px,${fallY.toFixed(3)}px,0) rotate(${fallRot.toFixed(3)}deg)`;
            scene.style.opacity = fraction >= 0.70 ? smooth((1 - fraction) / 0.30).toFixed(4) : '1';
            image.style.transform = 'scale(1.08000)';
          } else {
            scene.style.transform = 'translate3d(0px,0px,0)';
            scene.style.opacity = '1';
            const revealScale = 0.94 + 0.14 * smooth(fraction);
            image.style.transform = `scale(${revealScale.toFixed(5)})`;
          }
        } else if (isAjenjoToBeatriz) {
          if (outgoing) {
            const shutterPress = smooth(fraction / 0.24);
            const shutterDip = Math.sin(clamp((fraction - 0.12) / 0.12, 0, 1) * Math.PI) * 6;
            const camScale = 1.08 + shutterPress * 0.14;
            scene.style.transform = `translate3d(0px,${shutterDip.toFixed(3)}px,0)`;
            scene.style.opacity = fraction >= 0.20 ? smooth((0.32 - fraction) / 0.12).toFixed(4) : '1';
            image.style.transform = `scale(${camScale.toFixed(5)})`;
          } else {
            const eject = smooth((fraction - 0.18) / 0.44);
            const slideY = (1 - eject) * -geometry.height * 0.06;
            scene.style.transform = `translate3d(0px,${slideY.toFixed(3)}px,0)`;
            scene.style.opacity = smooth((fraction - 0.16) / 0.10).toFixed(4);
            const printScale = 0.94 + 0.14 * smooth((fraction - 0.18) / 0.82);
            image.style.transform = `scale(${printScale.toFixed(5)})`;
            const develop = smooth((fraction - 0.22) / 0.74);
            if (develop < 0.999) {
              const br = (1 + (1 - develop) * 1.85).toFixed(3);
              const ct = (0.38 + develop * 0.62).toFixed(3);
              const sat = (0.04 + Math.pow(develop, 1.35) * 0.96).toFixed(3);
              const hue = ((1 - develop) * -32).toFixed(1);
              const sep = ((1 - develop) * 0.34).toFixed(3);
              const bl = ((1 - smooth((fraction - 0.22) / 0.46)) * 5.8).toFixed(2);
              image.style.filter = `brightness(${br}) contrast(${ct}) saturate(${sat}) hue-rotate(${hue}deg) sepia(${sep}) blur(${bl}px)`;
            }
          }
        } else if (isMurrayToEzquerra) {
          if (outgoing) {
            // Bill Murray (52): Entra DE FRENTE a toda velocidad con las manos hacia el monitor: PUMBA!
            image.style.transformOrigin = '38% 46%'; // Manos y mirada de Bill Murray
            if (fraction < 0.38) {
              const rush = Math.pow(smooth(fraction / 0.38), 1.9);
              const forwardScale = 1.08 + rush * 2.38; // Se abalanza de frente de 1.08 a 3.46x
              const forwardY = -rush * (geometry.height * 0.04);
              image.style.transform = `scale(${forwardScale.toFixed(5)}) translate3d(0,${forwardY.toFixed(2)}px,0)`;
              scene.style.transform = 'translate3d(0px,0px,0)';
              scene.style.opacity = '1';
              image.style.filter = 'none';
            } else {
              // Impacto PUMBA directo contra el cristal del monitor
              const impactProg = smooth(clamp((fraction - 0.38) / 0.10, 0, 1));
              const recoilScale = 3.46 - impactProg * 0.28;
              const fadeOut = smooth(clamp((fraction - 0.40) / 0.26, 0, 1));
              image.style.transform = `scale(${recoilScale.toFixed(5)})`;
              scene.style.transform = 'translate3d(0px,0px,0)';
              scene.style.opacity = (1 - fadeOut).toFixed(4);
              const glassFlash = Math.sin(impactProg * Math.PI) * 0.55;
              image.style.filter = glassFlash > 0.02 ? `brightness(${(1 + glassFlash).toFixed(3)}) contrast(1.2)` : 'none';
            }
          } else {
            // Jose Manuel Ezquerra (53): Detrás del impacto en el monitor
            // La sacudida del PUMBA en el cristal lo alcanza con onda expansiva
            if (fraction < 0.30) {
              scene.style.opacity = '0';
              scene.style.transform = 'translate3d(0px,0px,0)';
            } else {
              const enterProg = smooth(clamp((fraction - 0.30) / 0.70, 0, 1));
              scene.style.opacity = smooth(clamp((fraction - 0.30) / 0.15, 0, 1)).toFixed(4);
              
              // Conmoción y sacudida por el impacto en el monitor
              const impactT = clamp((fraction - 0.38) / 0.24, 0, 1);
              const impactHit = Math.sin(impactT * Math.PI);
              const shakeX = (1 - impactT) * Math.sin((fraction - 0.38) * 36) * 24;
              const shakeY = (1 - impactT) * Math.cos((fraction - 0.38) * 28) * 14;
              const tilt = (1 - impactT) * Math.sin((fraction - 0.38) * 24) * -6.8;
              const rgbDist = impactHit * 24;
              
              const ezScale = 1.08 + (1 - enterProg) * 0.18;
              scene.style.transform = `translate3d(${shakeX.toFixed(2)}px,${shakeY.toFixed(2)}px,0)`;
              image.style.transformOrigin = '62% 42%';
              image.style.transform = `scale(${ezScale.toFixed(5)}) rotate(${tilt.toFixed(2)}deg)`;
              image.style.filter = rgbDist > 0.8
                ? `drop-shadow(${rgbDist.toFixed(1)}px 0 0 rgba(255,40,90,0.92)) drop-shadow(-${rgbDist.toFixed(1)}px 0 0 rgba(0,240,255,0.92)) brightness(${(1 + impactHit * 0.35).toFixed(3)})`
                : 'none';
            }
          }
        } else if (mode === 'H' || mode === 'V') {
          const displacement = outgoing ? -progress : 1 - progress;
          const x = mode === 'H' ? displacement * geometry.width * entry.direction : 0;
          const y = mode === 'V' ? displacement * geometry.height : 0;
          scene.style.transform = `translate3d(${x.toFixed(3)}px,${y.toFixed(3)}px,0)`;
          // Subtle interior parallax (max 2%) and lens scale between 1.08 and 1.12.
          const parallax = displacement * 2;
          const lens = 1.08 + .04 * (outgoing ? progress : 1 - progress);
          if (works[index].slug === 'entre-tantas-flores-de-dia') {
            const naturalWidth = image.naturalWidth || 2457, naturalHeight = image.naturalHeight || 3072;
            const isMobile = innerWidth < 760;
            const mobileScale = isMobile ? 1.35 : 1.04;
            const cover = Math.max((geometry.width + 20) / naturalWidth, (geometry.height + 20) / naturalHeight);
            const pictureHeight = naturalHeight * cover * mobileScale;
            const overflowY = Math.max(0, pictureHeight - (geometry.height + 20));
            const yPose = outgoing ? -overflowY : 0;
            image.style.transformOrigin = '50% 0%';
            image.style.transform = `translate3d(0,${yPose.toFixed(3)}px,0) scale(${mobileScale.toFixed(5)})`;
          } else if (isRaraToAmor) {
            if (outgoing) {
              const tarnish = smooth(fraction);
              const br = (1 + Math.sin(fraction * Math.PI) * 0.55).toFixed(3);
              const ct = (1 - tarnish * 0.40).toFixed(3);
              const sep = (tarnish * 0.35).toFixed(3);
              const bl = (Math.sin(fraction * Math.PI) * 4.2).toFixed(2);
              image.style.filter = `brightness(${br}) contrast(${ct}) sepia(${sep}) blur(${bl}px)`;
              scene.style.opacity = smooth(1 - fraction * 0.95).toFixed(4);
            } else {
              scene.style.opacity = smooth((fraction - 0.15) / 0.45).toFixed(4);
            }
            image.style.transform = `translate3d(${mode === 'H' ? parallax.toFixed(3) : '0'}%,${mode === 'V' ? parallax.toFixed(3) : '0'}%,0) scale(${lens.toFixed(5)})`;
          } else if (isTinCanPeel) {
            if (outgoing) {
              const peel = smooth(fraction);
              const peelPct = (peel * 100).toFixed(2);
              const curlRadius = (Math.sin(fraction * Math.PI) * 48).toFixed(1);
              scene.style.clipPath = `inset(0 0 ${peelPct}% 0 round 0 0 ${curlRadius}px ${curlRadius}px)`;
              image.style.filter = `brightness(${(1 + Math.sin(fraction * Math.PI) * 0.34).toFixed(3)}) contrast(${(1 + peel * 0.14).toFixed(3)})`;
            }
            image.style.transform = `translate3d(${mode === 'H' ? parallax.toFixed(3) : '0'}%,${mode === 'V' ? parallax.toFixed(3) : '0'}%,0) scale(${lens.toFixed(5)})`;
          } else if (isJamesToMario) {
            if (outgoing) {
              const crack = smooth(fraction);
              image.style.filter = `brightness(${(1 + Math.sin(fraction * Math.PI) * 0.38).toFixed(3)}) contrast(${(1 + crack * 0.18).toFixed(3)})`;
            }
            image.style.transform = `translate3d(${mode === 'H' ? parallax.toFixed(3) : '0'}%,${mode === 'V' ? parallax.toFixed(3) : '0'}%,0) scale(${lens.toFixed(5)})`;
          } else if (isJaioTo13n) {
            if (outgoing) {
              const unseam = smooth(fraction);
              image.style.filter = `contrast(${(1 + unseam * 0.22).toFixed(3)})`;
            }
            image.style.transform = `translate3d(${mode === 'H' ? parallax.toFixed(3) : '0'}%,${mode === 'V' ? parallax.toFixed(3) : '0'}%,0) scale(${lens.toFixed(5)})`;
          } else if (isMunsterFamily) {
            const vignette = Math.sin(fraction * Math.PI) * 0.22;
            const sep = (0.06 + vignette * 0.24).toFixed(3);
            const ct = (1.04 + vignette * 0.18).toFixed(3);
            image.style.filter = `contrast(${ct}) sepia(${sep})`;
            image.style.transform = `translate3d(${mode === 'H' ? parallax.toFixed(3) : '0'}%,${mode === 'V' ? parallax.toFixed(3) : '0'}%,0) scale(${lens.toFixed(5)})`;
          } else if (works[incoming]?.slug === 'el-armigo-atomico' || works[base]?.slug === 'el-armigo-atomico') {
            if (!outgoing && works[incoming]?.slug === 'el-armigo-atomico') {
              const spin720 = smooth(fraction) * 720;
              image.style.transformOrigin = '50% 50%';
              image.style.transform = `translate3d(${mode === 'H' ? parallax.toFixed(3) : '0'}%,${mode === 'V' ? parallax.toFixed(3) : '0'}%,0) scale(${lens.toFixed(5)}) rotate(${spin720.toFixed(2)}deg)`;
            } else if (outgoing && works[base]?.slug === 'el-armigo-atomico') {
              const spinExit = smooth(fraction) * 720;
              image.style.transformOrigin = '50% 50%';
              image.style.transform = `translate3d(${mode === 'H' ? parallax.toFixed(3) : '0'}%,${mode === 'V' ? parallax.toFixed(3) : '0'}%,0) scale(${lens.toFixed(5)}) rotate(${spinExit.toFixed(2)}deg)`;
            } else {
              image.style.transform = `translate3d(${mode === 'H' ? parallax.toFixed(3) : '0'}%,${mode === 'V' ? parallax.toFixed(3) : '0'}%,0) scale(${lens.toFixed(5)})`;
            }
          } else {
            image.style.transform = `translate3d(${mode === 'H' ? parallax.toFixed(3) : '0'}%,${mode === 'V' ? parallax.toFixed(3) : '0'}%,0) scale(${lens.toFixed(5)})`;
          }
        } else if (mode === 'Z') {
          const close = outgoing ? smooth(fraction / .65) : 1 - smooth((fraction - .35) / .65);
          const isBowie = works[index].slug === 'el-hombre-que-susurraba-a-las-estrellas';
          const isHugoToJames = (works[base]?.slug === 'hugo-box' && works[incoming]?.slug === 'james-rocks');
          let maxScale = 1.65;
          if (isHugoToJames) {
            maxScale = outgoing ? 48.0 : 2.10;
          } else if (isBowie) {
            maxScale = 2.45;
          }
          if (isBowieToOlinga) {
            if (outgoing) {
              const flare = smooth(fraction);
              const rot = (flare * 12.0).toFixed(2);
              const prismScale = (1.08 + flare * 2.10).toFixed(5);
              image.style.transformOrigin = '65.2% 57.4%';
              image.style.transform = `scale(${prismScale}) rotate(${rot}deg)`;
              scene.style.opacity = fraction >= 0.68 ? smooth((1 - fraction) / 0.32).toFixed(4) : '1';
              image.style.filter = `saturate(${(1 + flare * 1.6).toFixed(3)}) brightness(${(1 + Math.sin(fraction * Math.PI) * 0.75).toFixed(3)})`;
            } else {
              scene.style.transform = 'translate3d(0px,0px,0)';
              scene.style.opacity = fraction < 0.28 ? '0' : smooth((fraction - 0.28) / 0.32).toFixed(4);
              const olingaScale = 0.95 + 0.13 * smooth(fraction);
              image.style.transform = `scale(${olingaScale.toFixed(5)})`;
            }
          } else if (isDustinToGameOver) {
            stage.classList.add('is-glitching');
            if (outgoing) {
              const glitchJitterX = (Math.sin(fraction * 65.0) * (8.0 + fraction * 22.0)).toFixed(2);
              const glitchJitterY = (Math.cos(fraction * 45.0) * (3.0 + fraction * 10.0)).toFixed(2);
              const rgbDist = (fraction * 20.0).toFixed(2);
              const dustinScale = 1.08 + fraction * 0.35;
              scene.style.transform = `translate3d(${glitchJitterX}px,${glitchJitterY}px,0)`;
              image.style.transform = `scale(${dustinScale.toFixed(5)})`;
              image.style.filter = `drop-shadow(${rgbDist}px 0 0 #ff0055) drop-shadow(-${rgbDist}px 0 0 #00f0ff) brightness(${(1 + Math.sin(fraction * 30.0) * 0.45).toFixed(3)}) contrast(${(1 + fraction * 0.6).toFixed(3)})`;
              scene.style.opacity = fraction >= 0.75 ? smooth((1 - fraction) / 0.25).toFixed(4) : '1';
            } else {
              const inGlitchX = (Math.sin((1 - fraction) * 50.0) * ((1 - fraction) * 16.0)).toFixed(2);
              const inRgb = ((1 - fraction) * 14.0).toFixed(2);
              const gameScale = 0.94 + 0.14 * smooth((fraction - 0.25) / 0.75);
              scene.style.transform = `translate3d(${inGlitchX}px,0,0)`;
              scene.style.opacity = fraction < 0.25 ? '0' : smooth((fraction - 0.25) / 0.35).toFixed(4);
              image.style.transform = `scale(${gameScale.toFixed(5)})`;
              image.style.filter = `drop-shadow(${inRgb}px 0 0 #ff0055) drop-shadow(-${inRgb}px 0 0 #00f0ff) brightness(${(1 + (1 - fraction) * 0.35).toFixed(3)})`;
            }
          } else if (isSistaToMulti) {
            if (outgoing) {
              const diveZoom = 1.0 + Math.pow(smooth(fraction), 2.2) * 16.0;
              image.style.transformOrigin = '49.2% 57.0%';
              image.style.transform = `scale(${diveZoom.toFixed(5)})`;
              scene.style.opacity = fraction >= 0.72 ? smooth((1 - fraction) / 0.28).toFixed(4) : '1';
              const tint = smooth(fraction);
              image.style.filter = `hue-rotate(${(tint * 35).toFixed(1)}deg) saturate(${(1 + tint * 0.7).toFixed(3)}) brightness(${(1 - tint * 0.2).toFixed(3)})`;
            } else {
              image.style.transformOrigin = '57.5% 65.5%';
              const exitZoom = 16.0 - smooth((fraction - 0.20) / 0.80) * 15.0;
              image.style.transform = `scale(${Math.max(1, exitZoom).toFixed(5)})`;
              scene.style.transform = 'translate3d(0,0,0)';
              scene.style.opacity = fraction < 0.20 ? '0' : smooth((fraction - 0.20) / 0.35).toFixed(4);
              const redFlare = Math.sin(fraction * Math.PI);
              image.style.filter = fraction < 0.65 ? `drop-shadow(0 0 40px rgba(255, 0, 50, ${redFlare.toFixed(3)})) contrast(1.15)` : 'none';
            }
          } else {
            image.style.transform = `scale(${Math.exp(Math.log(1.08) + Math.log(maxScale / 1.08) * close).toFixed(5)})`;
            if (!outgoing) scene.style.opacity = smooth((fraction - .40) / .20).toFixed(4);
            if (outgoing && isHugoToJames) {
              scene.style.opacity = fraction >= 0.50 ? smooth((0.75 - fraction) / 0.25).toFixed(4) : '1';
            }
          }
        } else if (mode === 'P') {
          const exit = smooth((fraction - .80) / .20);
          if (!outgoing) scene.style.opacity = exit.toFixed(4);
          scene.style.transform = `translate3d(0,${(outgoing ? -exit * geometry.height : (1 - exit) * geometry.height).toFixed(3)}px,0)`;
          image.style.transform = 'scale(1.08000)';
        }
        if (works[index].slug === 'roisin') {
          let roisinOverlay = scene.querySelector('.roisin-bw-layer');
          if (!roisinOverlay) {
            roisinOverlay = document.createElement('div');
            roisinOverlay.className = 'roisin-bw-layer';
            roisinOverlay.setAttribute('aria-hidden', 'true');
            const bwSrc = works[index].photos[1]?.src || '/images/catalogo/roisin-bw-pinklips.jpg';
            roisinOverlay.style.position = 'absolute';
            roisinOverlay.style.inset = '0';
            roisinOverlay.style.width = '100%';
            roisinOverlay.style.height = '100%';
            roisinOverlay.style.backgroundImage = `url("${bwSrc}")`;
            roisinOverlay.style.backgroundSize = state.fit ? 'contain' : 'cover';
            roisinOverlay.style.backgroundPosition = state.fit ? 'center' : (scene.style.getPropertyValue('--position') || '61.1% 58.6%');
            roisinOverlay.style.backgroundRepeat = 'no-repeat';
            roisinOverlay.style.pointerEvents = 'none';
            roisinOverlay.style.willChange = 'opacity,transform';
            roisinOverlay.style.zIndex = '2';
            const pan = $('.art-pan', scene) || scene;
            pan.appendChild(roisinOverlay);
          }
          if (still) {
            roisinOverlay.style.transform = '';
            roisinOverlay.style.opacity = '0';
          } else {
            roisinOverlay.style.backgroundSize = state.fit ? 'contain' : 'cover';
            roisinOverlay.style.backgroundPosition = state.fit ? 'center' : (scene.style.getPropertyValue('--position') || '61.1% 58.6%');
            roisinOverlay.style.transformOrigin = image.style.transformOrigin;
            roisinOverlay.style.transform = image.style.transform;
            if (!transition) {
              const colorProgress = smooth(pose.explore);
              roisinOverlay.style.opacity = (1 - colorProgress).toFixed(4);
            } else {
              roisinOverlay.style.opacity = outgoing ? '0' : '1';
            }
          }
        }
        if (works[index].slug === 'julio-iglesias-como-un-reloj-suizo') {
          const julioRig = ensureJulioPuppetRig(scene);
          julioRig.setAttribute('preserveAspectRatio', state.fit ? 'xMidYMid meet' : 'xMidYMid slice');
          julioRig.style.transformOrigin = image.style.transformOrigin;
          julioRig.style.transform = still ? '' : image.style.transform;
          julioRig.style.filter = image.style.filter;
          const scrollProgress = transition ? fraction : (pose.explore || 0);
          const scrollAngle = -12.5 * Math.sin(scrollProgress * Math.PI) + (scrollProgress * -4.0);
          if (reduced.matches || (typeof window !== 'undefined' && window.location.hostname === 'portfolio.test')) {
            applyJulioArmAngle(julioRig, scrollAngle);
          } else if (!julioRig.dataset.armAngle) {
            applyJulioArmAngle(julioRig, -6.0);
          }
        }
        if (works[index].slug === 'cantinflowers') {
          const cantinRig = ensureCantinflowersSmokeRig(scene);
          cantinRig.setAttribute('preserveAspectRatio', state.fit ? 'xMidYMid meet' : 'xMidYMid slice');
          cantinRig.style.transformOrigin = image.style.transformOrigin;
          cantinRig.style.transform = still ? '' : image.style.transform;
          cantinRig.style.filter = image.style.filter;
          const holdSpan = Math.max(0.01, entry.transitionStart - entry.start);
          const localHold = clamp((pose.distance - entry.start) / holdSpan, 0, 1);
          const dragProgress = still ? 0 : transition
            ? (outgoing ? clamp(0.28 + fraction * 0.72, 0, 1) : clamp(fraction * 0.75, 0, 1))
            : clamp(0.16 + localHold * 0.68, 0, 1);
          const deltaCantin = dragProgress - cantinLastProgress;
          if (Math.abs(deltaCantin) > 0.018) {
            const nextDir = deltaCantin > 0 ? 1 : -1;
            if (cantinDirection !== 0 && nextDir !== cantinDirection) {
              cantinPuffCount = Math.min(8, cantinPuffCount + 1);
              soundscape?.puff?.(0.75);
            }
            cantinDirection = nextDir;
            cantinLastProgress = dragProgress;
          }
          if (dragProgress >= 0.22 && dragProgress <= 0.55) {
            soundscape?.puff?.(dragProgress);
          }
          applyCantinflowersDrag(cantinRig, dragProgress, cantinPuffCount);
        }
      });
      const activeSlug = transition && fraction >= .5 ? works[incoming].slug : works[base].slug;
      stage.style.setProperty('--scene-accent', SCENE_ACCENTS[(transition && fraction >= .5 ? incoming : base) % SCENE_ACCENTS.length]);
      if (heroThreshold) {
        const thresholdPlane = $('[data-threshold-plane]', heroThreshold);
        const thresholdWink = $('[data-threshold-wink]', heroThreshold);
        const monoclePortal = $('[data-monocle-portal]', heroThreshold);
        const monocleMarilyn = $('[data-monocle-marilyn]', heroThreshold);
        const zoomReadout = $('[data-hero-zoom-readout]', heroThreshold);
        if (still || pose.distance >= 0.36) {
          heroThreshold.style.visibility = 'hidden';
          heroThreshold.style.opacity = '0';
          heroThreshold.style.setProperty('--hero-split', '1');
        } else {
          const tRaw = clamp(pose.distance / 0.36, 0, 1);
          const t = smooth(tRaw);
          const scale = Math.exp(Math.log(7.2) * t);
          const fade = 1 - smooth((tRaw - 0.45) / 0.55);
          const splitCurtain = smooth(clamp(tRaw / 0.72, 0, 1));
          const skewDeg = Math.sin(tRaw * Math.PI) * -14;
          const letterEm = splitCurtain * 0.28;
          heroThreshold.style.visibility = 'visible';
          heroThreshold.style.opacity = fade.toFixed(4);
          heroThreshold.style.setProperty('--hero-split', splitCurtain.toFixed(4));
          heroThreshold.style.setProperty('--hero-skew', `${skewDeg.toFixed(2)}deg`);
          heroThreshold.style.setProperty('--hero-letter', `${letterEm.toFixed(4)}em`);
          if (thresholdPlane) thresholdPlane.style.transform = `scale(${scale.toFixed(4)})`;
          if (thresholdWink) thresholdWink.style.opacity = (tRaw >= 0.08 && tRaw <= 0.48) ? '1' : '0';
          if (monoclePortal) {
            const portalFade = 1 - smooth(clamp((tRaw - 0.28) / 0.45, 0, 1));
            monoclePortal.style.opacity = portalFade.toFixed(4);
          }
          if (monocleMarilyn) {
            const innerCounterScale = Math.exp(Math.log(1.35) * (1 - t));
            monocleMarilyn.style.transform = `scale(${innerCounterScale.toFixed(4)})`;
          }
          if (zoomReadout) {
            zoomReadout.textContent = `LENTE ÓPTICA ${scale.toFixed(2)}×`;
          }
        }
      }
      const artBottom = $('.art-bottom', stage);
      if (artBottom) {
        if (!still && pose.distance < 0.36) {
          const bottomFade = smooth((pose.distance - 0.20) / 0.16);
          artBottom.style.opacity = bottomFade.toFixed(4);
          artBottom.style.pointerEvents = bottomFade > 0.5 ? 'auto' : 'none';
        } else {
          artBottom.style.opacity = '';
          artBottom.style.pointerEvents = '';
        }
      }
      if (works[base].slug === 'dustin' || works[incoming].slug === 'dustin') {
        if (!dustinVisited && (works[state.index].slug === 'dustin' || (transition && works[incoming].slug === 'dustin' && fraction >= 0.45))) {
          dustinVisited = true;
          clearTimeout(dustinEpilogueTimer);
          dustinEpilogueTimer = setTimeout(() => {
            if (works[state.index]?.slug === 'dustin') {
              stage.classList.add('is-silent-epilogue');
            }
          }, 2400);
        }
        stage.dataset.finale = 'silence';
      } else if (works[base].slug === 'game-over' || works[incoming].slug === 'game-over') {
        stage.dataset.finale = 'gameover';
        stage.classList.remove('is-silent-epilogue');
        dustinVisited = false;
        clearTimeout(dustinEpilogueTimer);
      } else {
        dustinVisited = false;
        clearTimeout(dustinEpilogueTimer);
        stage.classList.remove('is-silent-epilogue');
        delete stage.dataset.finale;
      }
      if (works[base].slug === 'game-over' || works[incoming].slug === 'game-over') {
        if (!gameOverVisited && (works[state.index].slug === 'game-over' || (transition && works[incoming].slug === 'game-over' && fraction >= 0.35))) {
          gameOverVisited = true;
          fireGameOver8Bit();
        }
      } else {
        gameOverVisited = false;
      }
      if (!isDustinToGameOver && works[state.index]?.slug !== 'game-over') {
        stage.classList.remove('is-glitching');
      }
      if (works[base].slug === 'saio-puzzle' || works[incoming].slug === 'saio-puzzle') {
        if (!puzzleVisited && (works[state.index].slug === 'saio-puzzle' || (transition && works[incoming].slug === 'saio-puzzle' && fraction >= 0.70))) {
          puzzleVisited = true;
          firePuzzleSnap();
        }
        if (works[base].slug === 'saio-puzzle' && transition) {
          if (fraction >= 0.74 && fraction <= 0.84 && !puzzleReassembled) {
            puzzleReassembled = true;
            firePuzzleSnap();
          } else if (fraction < 0.40 || fraction > 0.90) {
            puzzleReassembled = false;
          }
        }
      } else {
        puzzleVisited = false;
        puzzleReassembled = false;
      }
      if (works[base].slug === 'julio-iglesias-como-un-reloj-suizo' || works[incoming].slug === 'julio-iglesias-como-un-reloj-suizo') {
        if (!clockVisited && (works[state.index].slug === 'julio-iglesias-como-un-reloj-suizo' || (transition && works[incoming].slug === 'julio-iglesias-como-un-reloj-suizo' && fraction >= 0.35))) {
          clockVisited = true;
          fireSwissClock();
        }
        if (julioRaf === null && !reduced.matches && !(typeof window !== 'undefined' && window.location.hostname === 'portfolio.test')) {
          julioRaf = requestAnimationFrame(stepJulioClockwork);
        }
      } else {
        clockVisited = false;
      }
      if (works[base].slug === 'red-red-wine' || works[incoming].slug === 'red-red-wine') {
        if (!wineVisited && (works[state.index].slug === 'red-red-wine' || (transition && works[incoming].slug === 'red-red-wine' && fraction >= 0.35))) {
          wineVisited = true;
          fireWineClink();
        }
      } else {
        wineVisited = false;
      }
      if (works[base].slug === 'entre-tantas-flores-de-dia' || works[incoming].slug === 'entre-tantas-flores-de-dia') {
        if (!deltoyaVisited && (works[state.index].slug === 'entre-tantas-flores-de-dia' || (transition && works[incoming].slug === 'entre-tantas-flores-de-dia' && fraction >= 0.35))) {
          deltoyaVisited = true;
          fireDeltoya();
        }
      } else {
        deltoyaVisited = false;
      }
      if (works[base].slug === 'lauralore' || works[incoming].slug === 'lauralore') {
        if (!lauraVisited && works[state.index]?.slug === 'lauralore' && !transition) {
          lauraVisited = true;
          fireLauraLorePause();
        }
      } else {
        lauraVisited = false;
      }
      if (works[base].slug === 'can-dy-queen' || works[incoming].slug === 'can-dy-queen') {
        if (works[state.index]?.slug === 'can-dy-queen' && !transition) {
          startCandySlowMo();
        } else {
          if (candyTimer) { clearInterval(candyTimer); candyTimer = null; }
        }
      } else {
        if (candyTimer) { clearInterval(candyTimer); candyTimer = null; }
      }
      const isAjenjoPhoto = transition && works[base]?.slug === 'ajenjo-cam' && works[incoming]?.slug === 'beatriz-de-pandora';
      const isRaraToAmor = transition && works[base]?.slug === 'rara-avis' && works[incoming]?.slug === 'amor-en-conserva';
      const isAmorToAmy = transition && works[base]?.slug === 'amor-en-conserva' && works[incoming]?.slug === 'amy-rocks';
      const isJamesToMario = transition && works[base]?.slug === 'james-rocks' && works[incoming]?.slug === 'mario-moreno';
      const isJaioTo13n = transition && works[base]?.slug === 'custom-jaio' && works[incoming]?.slug === '13n';
      const isBowieToOlinga = transition && works[base]?.slug === 'el-hombre-que-susurraba-a-las-estrellas' && works[incoming]?.slug === 'olinga-a-la-naranja';
      const isSistaToMulti = transition && works[base]?.slug === 'sistashark' && works[incoming]?.slug === 'multi-dimensional-love';
      const isArmigoTransition = transition && (works[incoming]?.slug === 'el-armigo-atomico' || works[base]?.slug === 'el-armigo-atomico');
      const isMurrayToEzquerra = transition && works[base]?.slug === 'i-got-you-babe' && works[incoming]?.slug === 'jose-manuel-ezquerra';
      const isSeriesPortal = transition && (works[base]?.category !== works[incoming]?.category || works[base]?.series !== works[incoming]?.series);
      const isFloresToJohnny = transition && works[base]?.slug === 'entre-tantas-flores-de-dia' && works[incoming]?.slug === 'johnny-rocks';
      const isMunsterPortal = transition && works[base]?.slug === 'out-por-los-pelos' && works[incoming]?.slug === 'lily-munster';
      const isPensadoraToFreddy = transition && !still && works[base]?.slug === 'la-pensadora' && works[incoming]?.slug === 'baroque-farrokh';
      const inPensadoraFreddySector = works[base]?.slug === 'la-pensadora' || works[incoming]?.slug === 'baroque-farrokh' || works[base]?.slug === 'baroque-farrokh';
      if (!inPensadoraFreddySector) {
        kissVolleyCount = 1;
        kissDirection = 0;
        lastKissFraction = 0;
        kissInSector = false;
      }
      if (isPensadoraToFreddy && kissStage) {
        kissStage.removeAttribute('hidden');
        kissStage.classList.add('is-kissing');
        const deltaKiss = fraction - lastKissFraction;
        if (!kissInSector) {
          kissInSector = true;
          lastKissFraction = fraction;
          kissDirection = fraction >= 0.5 ? -1 : 1;
          soundscape?.kiss?.(kissVolleyCount);
        } else if (Math.abs(deltaKiss) > 0.015) {
          const nextDir = deltaKiss > 0 ? 1 : -1;
          if (kissDirection !== 0 && nextDir !== kissDirection) {
            kissVolleyCount = Math.min(MAX_KISS_CUTOUTS, kissVolleyCount + 1);
            soundscape?.kiss?.(kissVolleyCount);
          }
          kissDirection = nextDir;
          lastKissFraction = fraction;
        }
        kissStage.dataset.kissVolley = String(kissVolleyCount);
        const stageW = geometry.width || window.innerWidth || 1280;
        const stageH = geometry.height || window.innerHeight || 800;
        const dirH = entry.direction || 1;
        // Outgoing La Pensadora lips start around (80.71%, 33.07%) of her canvas; incoming Freddie cheek/face is around (48.5%, 49.5%)
        const outSceneShiftX = -progress * stageW * dirH;
        const inSceneShiftX = (1 - progress) * stageW * dirH;
        const startBaseX = stageW * 0.77 + outSceneShiftX * 0.42;
        const startBaseY = stageH * 0.34;
        const endBaseX = stageW * 0.49 + inSceneShiftX * 0.28;
        const endBaseY = stageH * 0.49;

        kissCutouts.forEach((cutout, k) => {
          if (k >= kissVolleyCount) {
            cutout.classList.remove('is-active');
            cutout.style.opacity = '0';
            return;
          }
          const spec = KISS_LANDING_OFFSETS[k % KISS_LANDING_OFFSETS.length];
          const localRaw = clamp((fraction - spec.stagger * 0.55) / Math.max(0.28, 1 - spec.stagger * 0.55), 0, 1);
          const flight = smooth(localRaw);
          const startX = startBaseX + (k === 0 ? 0 : (k % 2 === 0 ? -1 : 1) * (k * 6));
          const startY = startBaseY + (k === 0 ? 0 : ((k % 3) - 1) * 10);
          const targetX = endBaseX + spec.dx * stageW;
          const targetY = endBaseY + spec.dy * stageH;
          const arcLift = Math.sin(flight * Math.PI) * (spec.arc * stageH);
          const flutter = Math.sin(flight * Math.PI * (2.2 + (k % 3) * 0.6)) * (k === 0 ? 6 : 12);
          const x = startX + (targetX - startX) * flight - 120;
          const y = startY + (targetY - startY) * flight + arcLift + flutter - 64;
          const pucker = localRaw < 0.22
            ? 1 + Math.sin((localRaw / 0.22) * Math.PI) * 0.28
            : localRaw > 0.82
              ? 1 + Math.sin(((localRaw - 0.82) / 0.18) * Math.PI) * 0.18
              : 1;
          const scale = spec.scale * pucker;
          const rot = spec.rot * flight + Math.sin(flight * Math.PI * 2) * 8;
          const op = localRaw <= 0.01 ? 0 : localRaw > 0.94 ? clamp((1 - localRaw) / 0.06, 0.25, 1) : 1;
          cutout.classList.add('is-active');
          cutout.style.opacity = op.toFixed(3);
          cutout.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${scale.toFixed(3)}) rotate(${rot.toFixed(2)}deg)`;
        });
      } else if (kissStage && !kissStage.hasAttribute('hidden')) {
        kissStage.setAttribute('hidden', '');
        kissStage.classList.remove('is-kissing');
        kissCutouts.forEach(cutout => {
          cutout.classList.remove('is-active');
          cutout.style.opacity = '0';
        });
      }
      const isTinCanPeelOuter = isAmorToAmy || (transition && (works[base]?.slug === 'dar-la-lata' || works[base]?.slug === 'enlatadas'));
      if (isTinCanPeelOuter && fraction >= 0.08 && fraction <= 0.35) {
        soundscape?.canPeel?.();
      }
      const shouldRunStickman = transition && !still && (isFloresToJohnny || isMunsterPortal);

      if (shouldRunStickman) {
        stickman.removeAttribute('hidden');
        stickman.classList.add('is-running');
        const stageW = geometry.width || window.innerWidth;
        const stageH = geometry.height || window.innerHeight;
        if (fraction > lastStickFraction + 0.002) stickDirection = 1;
        else if (fraction < lastStickFraction - 0.002) stickDirection = -1;
        lastStickFraction = fraction;
        const portalStyle = isFloresToJohnny ? 0 : (base % 3);
        const leapWindow = fraction > 0.38 && fraction < 0.62 ? (fraction - 0.38) / 0.24 : 0;
        const leapArc = leapWindow > 0 ? Math.sin(leapWindow * Math.PI) : 0;
        const airLift = portalStyle === 1 ? leapArc * 30 : portalStyle === 0 ? leapArc * 22 : leapArc * 10;
        const spinDeg = portalStyle === 1 && leapWindow > 0 ? leapWindow * 360 * stickDirection : (leapArc * -11 * stickDirection);
        const posX = -110 + fraction * (stageW + 220);
        const phaseAngle = fraction * 42;
        const bounce = Math.abs(Math.sin(phaseAngle)) * (7.5 * (1 - leapArc * 0.6));
        const floorY = mode === 'V' ? (1 - progress) * stageH : (stageH - 140);
        const runwayY = floorY - 104;
        stickman.style.setProperty('--stick-pct', `${(fraction * 100).toFixed(1)}%`);
        stickman.style.transform = `translate3d(0px,${runwayY.toFixed(2)}px,0)`;
        stickRunner.style.transform = `translate3d(${posX.toFixed(2)}px,${(-bounce - airLift).toFixed(2)}px,0) scaleX(${stickDirection}) rotate(${spinDeg.toFixed(1)}deg)`;
        updateStickmanPose(phaseAngle, leapArc, portalStyle);
      } else {
        if (!stickman.hasAttribute('hidden') && !isBreakdancing) {
          stickman.setAttribute('hidden', '');
          stickman.classList.remove('is-running');
        }
      }
      if (works[base]?.slug === 'ajenjo-cam' || works[incoming]?.slug === 'ajenjo-cam') {
        if (!ajenjoVisited && isAjenjoPhoto && fraction >= 0.16 && fraction <= 0.42) {
          ajenjoVisited = true;
          fireAjenjoFlash();
        } else if (fraction < 0.08 || fraction > 0.65) {
          ajenjoVisited = false;
        }
      } else {
        ajenjoVisited = false;
      }
      if (works[base]?.slug === 'el-armigo-atomico' || works[incoming]?.slug === 'el-armigo-atomico') {
        const armigoIdx = works.findIndex(w => w.slug === 'el-armigo-atomico');
        if (!armigoVisited && (works[state.index]?.slug === 'el-armigo-atomico' || (transition && works[incoming]?.slug === 'el-armigo-atomico' && fraction >= 0.35))) {
          armigoVisited = true;
          if (armigoIdx >= 0) fireArmigoSpin(scenes[armigoIdx]);
        }
      } else {
        armigoVisited = false;
      }
      if (works[base]?.slug === 'i-got-you-babe' || works[incoming]?.slug === 'jose-manuel-ezquerra' || works[state.index]?.slug === 'jose-manuel-ezquerra') {
        if (isMurrayToEzquerra && fraction >= 0.35 && fraction <= 0.48) {
          if (!punchVisited) {
            punchVisited = true;
            soundscape?.punch?.();
            stage.classList.remove('has-monitor-hit');
            void stage.offsetWidth;
            stage.classList.add('has-monitor-hit');
          }
        } else if (fraction < 0.20 || fraction > 0.65) {
          punchVisited = false;
        }

        if (!ezquerraVisited && works[state.index]?.slug === 'jose-manuel-ezquerra' && (!transition || fraction >= 0.80)) {
          ezquerraVisited = true;
          fireEzquerraDazed();
        }
      } else {
        ezquerraVisited = false;
        punchVisited = false;
        clearTimeout(ezquerraDazedTimer);
        stage.classList.remove('is-ezquerra-dazed', 'has-monitor-hit');
      }
      if (isAmorToAmy) {
        if (!canPeelVisited && fraction >= 0.18 && fraction <= 0.45) {
          canPeelVisited = true;
          soundscape?.canPeel?.();
        } else if (fraction < 0.10 || fraction > 0.70) {
          canPeelVisited = false;
        }
      } else {
        canPeelVisited = false;
      }
      // V2 (#7): Transición de Portal 3D entre Series Artísticas
      if (portalRing) {
        if (isSeriesPortal && !still) {
          portalRing.removeAttribute('hidden');
          portalRing.classList.add('is-portal-open');
          const portalScale = 0.14 + smooth(fraction) * 2.25;
          const portalOpacity = Math.sin(fraction * Math.PI) * 0.92;
          portalRing.style.transform = `translate(-50%,-50%) scale(${portalScale.toFixed(3)}) rotate(${(fraction * 180).toFixed(1)}deg)`;
          portalRing.style.opacity = portalOpacity.toFixed(3);
          stage.dataset.portalTransition = 'series-portal';
        } else {
          if (!portalRing.hasAttribute('hidden')) {
            portalRing.setAttribute('hidden', '');
            portalRing.classList.remove('is-portal-open');
          }
          delete stage.dataset.portalTransition;
        }
      }
      const flash = isAjenjoPhoto
        ? Math.exp(-Math.pow((fraction - 0.22) / 0.065, 2)) * 0.98
        : 0;
      stage.style.setProperty('--camera-flash', flash.toFixed(4));
      soundscape?.frame({
        distance: still ? scrollY / Math.max(1, geometry.height) : pose.distance,
        depth: still ? 0 : depth,
        mode: still ? 'still' : mode,
        phase: still ? 'scroll' : transition ? 'transition' : phase === 'explore' ? 'explore' : 'hold',
        axisDirection: mode === 'H' ? entry.direction : 1,
        slug: activeSlug,
        flash: Number(flash.toFixed(4)),
        punch: isMurrayToEzquerra && fraction >= 0.34 && fraction <= 0.46
      });
      if (kineticTitle.textContent) kineticTitle.textContent = '';
      kineticTitle.style.opacity = '0';
      kineticTitle.style.transform = '';
      caption.style.opacity = '1';
      caption.style.transform = '';
      // Attenuate reading controls down to a minimum of 35% opacity while moving, recovering to 100% at rest.
      const veil = transition ? Math.sin(fraction * Math.PI) : phase === 'explore' ? Math.sin(pose.explore * Math.PI) * .5 : 0;
      stage.style.setProperty('--camera-veil', (veil * .65).toFixed(4));
      if (still) restCamera();
      const cue = $('[data-journey-cue]', stage);
      const isMunsterWork = munsterSlugs.includes(works[state.index]?.slug);
      if (works[state.index]?.slug === 'dustin' && !transition) {
        cue.textContent = 'La última nota ya es silencio · Sigue hacia el final ↓';
      } else if (works[state.index]?.slug === 'game-over' && !transition) {
        cue.textContent = 'GAME OVER · INSERT COIN · Volver al origen ↺';
      } else if (isDustinToGameOver) {
        cue.textContent = 'GAME OVER · 8-BIT GLITCH ↓';
      } else if (works[state.index]?.slug === 'el-armigo-atomico' || isArmigoTransition) {
        cue.textContent = '¡Giro atómico 720°! · sigue ↓';
      } else if (works[state.index]?.slug === 'jose-manuel-ezquerra' && !transition && stage.classList.contains('is-ezquerra-dazed')) {
        cue.textContent = 'Jose Manuel Ezquerra · Aturdido por el impacto (3s) ↓';
      } else if (isMurrayToEzquerra) {
        cue.textContent = '¡PUMBA en el monitor! · sigue ↓';
      } else if (works[state.index]?.slug === 'lauralore' && !transition) {
        cue.textContent = 'LauraLore · Flor de cerámica y eguzkilore vegetal ✦';
      } else if (works[state.index]?.slug === 'can-dy-queen' && !transition) {
        cue.textContent = 'Can-dy Queen · Slow-Motion Caramelo ↓';
      } else if (isPensadoraToFreddy) {
        cue.textContent = kissVolleyCount > 1
          ? `LIPS en acción · ×${kissVolleyCount} besos a Freddie ↓↑`
          : 'LIPS en acción · Beso a Freddie ↓';
      } else if ((works[state.index]?.slug === 'cantinflowers' || (transition && (works[base]?.slug === 'cantinflowers' || works[incoming]?.slug === 'cantinflowers'))) && !still) {
        cue.textContent = cantinPuffCount > 1
          ? `Cantinflowers · Calada ×${cantinPuffCount} y volutas de humo ↓↑`
          : 'Cantinflowers · Una calada con el scroll ↓';
      } else if (isSistaToMulti) {
        cue.textContent = 'Gafas de buceo a filtro 3D rojo ↓';
      } else if (isMunsterWork && !transition) {
        const mIdx = munsterSlugs.indexOf(works[state.index].slug) + 1;
        const mNames = ['Lily Munster', 'Herman Munster', 'Eddie Munster', 'El Abuelo Munster'];
        cue.textContent = mIdx < 4
          ? `Familia Munster (${mIdx}/4) · ${mNames[mIdx - 1]} · Sigue horizontal →`
          : 'Familia Munster (4/4) · El Abuelo Munster · Sigue hacia adelante ↓';
      } else {
        cue.textContent = still ? reduced.matches ? 'Activa los efectos para ver el viaje ↓' : 'Desplázate para recorrer ↕' : !transition ? phase === 'explore' ? 'Explora la superficie ↓' : 'Una pausa para mirar · sigue ↓' : isAjenjoPhoto ? 'Dispara y revela la foto ↓' : isRaraToAmor ? 'El azogue se disuelve · sigue ↓' : isTinCanPeelOuter ? 'Abre la lata de conserva · sigue ↓' : isJamesToMario ? 'La cantera de pizarra se quiebra · sigue ↓' : isJaioTo13n ? 'Deshilachar las costuras · sigue ↓' : isBowieToOlinga ? 'Refracción de estrella · sigue ↓' : isSeriesPortal ? 'Atravesando portal de serie ↓' : ({ E: 'Entra en la mirada ↓', H: 'Atravesar · sigue bajando ↓', V: 'Déjate llevar ↓', Z: (transition && works[base]?.slug === 'hugo-box') ? 'Entra en la lente rosa ↓' : 'Acércate ↓', P: 'Mezclar y volver a unir ↓' })[mode];
      }
      stage.classList.toggle('is-travelling', transition);
      const holdProgress = still ? 0 : phase === 'hold' ? smooth(clamp((pose.distance - entry.start) / Math.max(0.01, entry.hold), 0, 1)) : 1;
      stage.style.setProperty('--hold-progress', holdProgress.toFixed(4));
      stage.style.setProperty('--progress', (pose.distance / journey.total * (works.length - 1) * 100).toFixed(3) + '%');
      $$('[data-select]:not([hidden])', stage).forEach(b => {
        const bi = Number(b.dataset.select);
        const prox = still ? (bi === state.index ? 1 : 0) : Math.exp(-Math.pow(bi - pose.position, 2) / 1.35);
        b.style.setProperty('--index-proximity', prox.toFixed(3));
      });
      checkMilestone(pose.distance / Math.max(1, journey.total));
    }
    function measure() {
      const bounds = track.getBoundingClientRect(), viewport = stage.getBoundingClientRect(), height = viewport.height || innerHeight;
      geometry.width = viewport.width || innerWidth; geometry.height = height;
      geometry.top = bounds.top + scrollY;
      geometry.unit = (bounds.height - height) / journey.total || height;
    }
    function leaveFit() { if (state.fit) { state.fit = false; images[state.index].src = works[state.index].cover; } }
    function syncScroll() {
      if (document.querySelector('dialog[open]')) return;
      let pixels = scrollY - geometry.top;
      // Native scroll positions round to device pixels, including direct-link jumps.
      const boundary = journey.entries.find(entry => Math.abs(entry.start * geometry.unit - pixels) < 1);
      const targetDist = clamp(boundary ? boundary.start : pixels / geometry.unit, 0, journey.total);
      if (isLauraZooming) {
        motion.current = lauraPauseDistance;
        motion.target = lauraPauseDistance;
        window.scrollTo({ top: geometry.top + lauraPauseDistance * geometry.unit, behavior: 'auto' });
        return;
      }
      motion.target = targetDist;
      if (reduced.matches || state.fit) {
        motion.current = targetDist;
      }
      stage.classList.remove('is-resting');
      scheduleMotion();
    }
    function scheduleMotion() {
      if (motion.frame === null) motion.frame = requestAnimationFrame(stepMotion);
    }
    function stepMotion(now = performance.now()) {
      motion.frame = null;
      if (document.querySelector('dialog[open]')) return;
      const still = state.fit || reduced.matches;
      const dt = motion.lastTime > 0 ? clamp((now - motion.lastTime) / 16.6667, 0.5, 2.2) : 1;
      motion.lastTime = now;
      const delta = motion.target - motion.current;
      if (still || Math.abs(delta) < 0.00012) {
        motion.current = motion.target;
        motion.velocity = 0;
        motion.lastTime = 0;
        stage.style.setProperty('--scroll-energy', '0');
        stage.style.setProperty('--scroll-velocity', '0');
        stage.style.setProperty('--scroll-accel', '0');
        stage.style.setProperty('--camera-tension', '0');
        stage.style.setProperty('--velocity-skew', '0deg');
        stage.classList.add('is-resting');
      } else {
        stage.classList.remove('is-resting');
        // Amortiguamiento continuo de 2º orden invariante al framerate (60Hz / 120Hz ProMotion) — Ley 1 (INV_C5_SCROLL_SUBSTEP_DYNAMICS)
        const currentBase = Math.floor(motion.desired || motion.position || 0);
        const isPuzzle = works[currentBase]?.interaction === 'puzzle' || works[currentBase]?.slug === 'saio-puzzle';
        const baseAlpha = isPuzzle
          ? clamp(0.088 + Math.abs(delta) * 0.035, 0.082, 0.125)
          : clamp(0.142 + Math.tanh(Math.abs(delta) * 1.35) * 0.095, 0.142, 0.238);
        const alpha = 1 - Math.pow(1 - baseAlpha, dt);
        const rawStep = delta * alpha;
        const sameDir = motion.velocity !== 0 && Math.sign(delta) === Math.sign(motion.velocity);
        const blendedMag = sameDir && Math.abs(delta) > 0.015
          ? Math.min(Math.abs(delta), Math.abs(rawStep) * 0.78 + Math.abs(motion.velocity * dt) * 0.22)
          : Math.abs(rawStep);
        const step = Math.sign(delta) * blendedMag;
        const instVel = step / dt;
        const accel = clamp((instVel - motion.velocity) * 24, -1, 1);
        motion.current += step;
        motion.velocity = motion.velocity * 0.68 + instVel * 0.32;
        const energy = clamp(Math.abs(delta) * 2.4, 0, 1);
        const normVel = clamp(motion.velocity * 18, -1, 1);
        stage.style.setProperty('--scroll-energy', energy.toFixed(3));
        stage.style.setProperty('--scroll-velocity', normVel.toFixed(3));
        stage.style.setProperty('--scroll-accel', accel.toFixed(3));
        stage.style.setProperty('--camera-tension', clamp(energy * 0.65 + Math.abs(normVel) * 0.35, 0, 1).toFixed(3));
      }
      const pose = journey.read(motion.current);
      const position = pose.position;
      motion.desired = position;
      if (motion.navigation !== null && Math.abs(position - motion.navigation) < .002) motion.navigation = null;
      if (Math.abs(pose.distance - motion.pose.distance) > .0004) {
        const pixels = motion.current * geometry.unit;
        const instSkew = ((pixels - lastScrollPixels) / Math.max(0.5, dt)) * 0.032;
        const prevSkew = parseFloat(stage.style.getPropertyValue('--velocity-skew')) || 0;
        const skew = clamp(prevSkew * 0.65 + instSkew * 0.35, -3.2, 3.2);
        stage.style.setProperty('--velocity-skew', `${(Math.abs(skew) < 0.03 ? 0 : skew).toFixed(2)}deg`);
        leaveFit(); resetPan(); travelCamera();
        lastScrollPixels = pixels;
      }
      motion.pose = pose;
      motion.position = position;
      const base = Math.floor(position);
      const index = !reduced.matches && works[base].interaction === 'puzzle' && position - base < .9 ? base : clamp(Math.round(position), 0, works.length - 1);
      if (index !== state.index) { state.index = index; metadata(); saveRoute(); }
      else stage.classList.toggle('is-fit', state.fit);
      render();
      ensureImage(Math.floor(position));
      ensureImage(Math.ceil(position));
      if (motion.current !== motion.target) {
        motion.frame = requestAnimationFrame(stepMotion);
      }
    }
    function scheduleScroll() { syncScroll(); }
    function moveTo(index, smooth = false) {
      if (isLauraZooming) {
        isLauraZooming = false;
        clearTimeout(lauraTimer);
        images[state.index]?.classList.remove('is-mouth-zooming');
      }
      const targetDist = journey.at(index);
      if (!smooth || reduced.matches) {
        motion.current = motion.target = targetDist;
      } else {
        motion.target = targetDist;
      }
      window.scrollTo({ top: geometry.top + targetDist * geometry.unit, behavior: smooth && !reduced.matches ? 'smooth' : 'auto' });
      scheduleScroll();
    }
    function pause() {
      restCamera();
      motion.request++;
      motion.navigation = null;
      if (motion.frame !== null) cancelAnimationFrame(motion.frame);
      motion.frame = null;
      motion.current = motion.target;
      render();
    }
    function change(next) {
      if (document.querySelector('dialog[open]') || next < 0 || next >= works.length) return;
      leaveFit(); resetPan(); metadata();
      motion.navigation = next;
      // Nearby controls use the browser's smooth scroll; catalogue jumps go directly there.
      moveTo(next, Math.abs(next - motion.position) <= 2);
    }
    addEventListener('scroll', scheduleScroll, { passive: true });
    // Preserve native inertia, browser zoom, touch scrolling and scroll-bar navigation.
    const interruptNavigation = () => { motion.navigation = null; };
    addEventListener('wheel', e => {
      interruptNavigation();
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 4) {
        window.scrollBy({ top: e.deltaX, behavior: 'auto' });
      }
    }, { passive: true });
    let _touchStartY = 0;
    addEventListener('touchstart', e => {
      interruptNavigation();
      if (e.touches?.length) _touchStartY = e.touches[0].clientY;
    }, { passive: true });
    addEventListener('touchmove', () => {}, { passive: true });
    $$('[data-select]', stage).forEach(b => b.addEventListener('click', () => change(Number(b.dataset.select))));
    $('[data-prev]', stage).addEventListener('click', () => {
      const cur = motion.navigation ?? motion.desired;
      change(Math.floor(cur) === Math.ceil(cur) ? Math.round(cur) - 1 : Math.floor(cur));
    });
    $('[data-next]', stage).addEventListener('click', () => {
      const cur = motion.navigation ?? motion.desired;
      change(Math.floor(cur) + 1);
    });
    $('[data-ouroboros]', stage)?.addEventListener('click', () => change(0));
    $('[data-journey-cue]', stage)?.addEventListener('click', () => {
      if (works[state.index]?.slug === 'dustin' || works[state.index]?.slug === 'game-over') change(0);
    });
    $('[data-fit]', stage).addEventListener('click', () => { pause(); state.fit = !state.fit; images[state.index].src = state.fit ? works[state.index].photos[0].src : works[state.index].cover; resetPan(); metadata(); render(); });
    $('[data-threshold-enter]', stage)?.addEventListener('click', () => {
      window.NAROA_SOUND?.menuNote?.(0);
      window.scrollTo({ top: Math.ceil(geometry.top + 0.38 * geometry.unit), behavior: reduced.matches ? 'auto' : 'smooth' });
      scheduleScroll();
    });
    $('[data-open-story]', stage).addEventListener('click', () => openDialog('#story-dialog'));
    document.querySelector('[data-share-link]')?.addEventListener('click', e => {
      const p = works[state.index];
      const url = location.origin + '/obra/' + p.slug + '/';
      const btn = e.currentTarget;
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(url).then(() => {
          const prev = btn.textContent;
          btn.textContent = '¡Enlace copiado! ✓';
          setTimeout(() => { btn.textContent = prev; }, 2000);
        }).catch(() => {
          window.prompt('Copia el enlace directo:', url);
        });
      } else {
        window.prompt('Copia el enlace directo:', url);
      }
    });
    // Social sharing and Instagram Story remixing are handled globally by setupStoryRemix()
    function showPhoto() {
      const p = works[state.index];
      state.photo = clamp(state.photo, 0, p.photos.length - 1);
      const photo = p.photos[state.photo], image = $('[data-photo-image]', photosDialog);
      $('#photos-heading').textContent = p.title;
      $('[data-close-dialog]', photosDialog).textContent = 'Volver a las fotos ↙';
      image.width = photo.width; image.height = photo.height;
      image.src = photo.original || photo.src;
      image.alt = p.title + ' — ' + photo.caption;
      image.style.gridColumn = p.photos.length === 1 ? '1 / -1' : '';
      const description = $('[data-photo-caption]', photosDialog);
      description.setAttribute('aria-atomic', 'true');
      description.textContent = `${String(state.photo + 1).padStart(2, '0')} / ${String(p.photos.length).padStart(2, '0')} · ${photo.caption}`;
      const previous = $('[data-photo-prev]', photosDialog), next = $('[data-photo-next]', photosDialog);
      previous.hidden = next.hidden = p.photos.length < 2;
      previous.disabled = state.photo === 0; next.disabled = state.photo === p.photos.length - 1;
    }
    function openWorkGallery(trigger = galleryTrigger) {
      const p = works[state.index];
      if (workGallery.open || !p.photos.length) return;
      galleryReturnFocus = trigger;
      state.photo = 0;
      workGallery.dataset.work = p.slug;
      galleryTitle.textContent = p.title;
      galleryMeta.textContent = `${p.label} · ${p.photos.length} ${p.photos.length === 1 ? 'fotografía' : 'fotografías'}`;
      galleryGrid.dataset.count = String(p.photos.length);
      workGallery.dataset.category = p.category || '';
      workGallery.dataset.support = p.support || '';
      const figures = p.photos.map((photo, index) => {
        const figure = createGalleryElement('figure', 'work-gallery-figure');
        const link = createGalleryElement('a', 'work-gallery-image');
        link.href = photo.original || photo.src;
        link.setAttribute('aria-label', `Ampliar ${p.title}: ${photo.caption}`);
        link.setAttribute('aria-haspopup', 'dialog');
        link.setAttribute('aria-controls', 'photos-dialog');
        const image = createGalleryElement('img');
        image.width = photo.width; image.height = photo.height;
        image.alt = p.title + ' — ' + photo.caption;
        image.decoding = 'async'; image.loading = index === 0 ? 'eager' : 'lazy';
        image.src = photo.src || photo.original;
        image.addEventListener('error', () => {
          if (photo.original && image.getAttribute('src') !== photo.original) image.src = photo.original;
        }, { once: true });
        link.append(image);
        const openPhoto = event => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          state.photo = index; photoReturnFocus = event.currentTarget;
          showPhoto(); openDialog('#photos-dialog');
        };
        link.addEventListener('click', openPhoto);
        const expand = createGalleryElement('a', 'work-gallery-expand', 'Ampliar ↗');
        expand.href = link.href;
        expand.setAttribute('aria-label', link.getAttribute('aria-label'));
        expand.setAttribute('aria-haspopup', 'dialog');
        expand.setAttribute('aria-controls', 'photos-dialog');
        expand.addEventListener('click', openPhoto);
        const description = createGalleryElement('figcaption');
        description.append(
          createGalleryElement('span', 'work-gallery-number', `${String(index + 1).padStart(2, '0')} / ${String(p.photos.length).padStart(2, '0')}`),
          createGalleryElement('span', '', photo.caption), expand);
        figure.append(link, description);
        return figure;
      });
      galleryGrid.replaceChildren(...figures);
      openDialog('#work-gallery-dialog');
      workGallery.scrollTop = 0;
    }
    function inspect(slug) {
      const index = works.findIndex(work => work.slug === slug);
      if (index < 0) return;
      // Commit an index jump before opening the dialog; an older decode cannot
      // overwrite the selection while syncScroll is waiting for an image.
      motion.request++;
      if (motion.frame !== null) cancelAnimationFrame(motion.frame);
      motion.frame = null; motion.navigation = null;
      leaveFit(); resetPan();
      state.index = index; state.photo = 0;
      motion.position = motion.desired = index;
      motion.current = motion.target = journey.at(index);
      motion.pose = journey.read(journey.at(index));
      metadata(); saveRoute(); render(); moveTo(index);
      openWorkGallery(galleryTrigger);
    }
    function photoStep(d) { state.photo = clamp(state.photo + d, 0, works[state.index].photos.length - 1); showPhoto(); }
    galleryTrigger.addEventListener('click', () => {
      openWorkGallery(galleryTrigger);
    });
    const progressBar = $('.art-progress', stage);
    if (progressBar) {
      const tooltip = createGalleryElement('div', 'scrubber-tooltip');
      tooltip.hidden = true;
      progressBar.append(tooltip);
      const indexFromEvent = e => {
        const rect = progressBar.getBoundingClientRect();
        const ratio = clamp((e.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
        return { ratio, idx: Math.round(ratio * (works.length - 1)) };
      };
      progressBar.addEventListener('pointermove', e => {
        const { ratio, idx } = indexFromEvent(e);
        const w = works[idx];
        if (!w) return;
        tooltip.hidden = false;
        tooltip.style.left = `${(ratio * 100).toFixed(2)}%`;
        tooltip.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(works.length).padStart(2, '0')} · ${w.title}`;
        if (e.buttons === 1) {
          leaveFit(); resetPan();
          window.scrollTo({ top: geometry.top + ratio * journey.total * geometry.unit, behavior: 'auto' });
          scheduleScroll();
        }
      });
      progressBar.addEventListener('pointerleave', () => { tooltip.hidden = true; });
      progressBar.addEventListener('click', e => {
        const { idx } = indexFromEvent(e);
        change(idx);
      });
    }
    $('[data-ouroboros]', stage)?.addEventListener('click', () => change(0));
    $('[data-journey-cue]', stage)?.addEventListener('click', () => {
      if (works[state.index]?.slug === 'dustin' || works[state.index]?.slug === 'game-over') change(0);
    });
    $('[data-open-photos]', stage).addEventListener('click', event => openWorkGallery(event.currentTarget));
    $('[data-photo-prev]').addEventListener('click', () => photoStep(-1)); $('[data-photo-next]').addEventListener('click', () => photoStep(1));
    photosDialog.addEventListener('keydown', event => {
      if (event.key === 'ArrowRight') { event.preventDefault(); photoStep(1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); photoStep(-1); }
    });
    photosDialog.addEventListener('close', () => {
      if (workGallery.open && photoReturnFocus?.isConnected) photoReturnFocus.focus({ preventScroll: true });
      photoReturnFocus = null;
    });
    function quiet(value) { state.quiet = value; metadata(); (value ? $('[data-restore]', stage) : $('[data-quiet]')).focus(); }
    $('[data-quiet]').addEventListener('click', () => quiet(true)); $('[data-restore]', stage).addEventListener('click', () => quiet(false));
    document.addEventListener('keydown', e => {
      if (document.querySelector('dialog[open]') || e.target.closest?.('input,textarea,select,[contenteditable=true]')) return;
      if (e.key === 'Escape' && state.quiet) { e.preventDefault(); quiet(false); return; }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const cur = motion.navigation ?? motion.desired;
        change(Math.floor(cur) + 1);
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const cur = motion.navigation ?? motion.desired;
        change(Math.floor(cur) === Math.ceil(cur) ? Math.round(cur) - 1 : Math.floor(cur));
      }
    });
    function resetPan() { if (pan.frame !== null) cancelAnimationFrame(pan.frame); pan.x = pan.y = pan.rx = pan.ry = pan.tx = pan.ty = pan.trx = pan.try = 0; pan.frame = null; stage.style.setProperty('--pan-x', '0px'); stage.style.setProperty('--pan-y', '0px'); stage.style.setProperty('--pan-rx', '0deg'); stage.style.setProperty('--pan-ry', '0deg'); }
    stage.addEventListener('pointermove', e => {
      if (reduced.matches || state.fit || !stage.classList.contains('is-resting')) return;
      if (heroThresholdEl && motion.pose.distance < 0.36) return;
      const r = stage.getBoundingClientRect();
      const w = r.width || geometry.width || innerWidth || 1280;
      const h = r.height || geometry.height || innerHeight || 800;
      const nx = clamp((e.clientX - r.left) / w - 0.5, -0.5, 0.5) * 2;
      const ny = clamp((e.clientY - r.top) / h - 0.5, -0.5, 0.5) * 2;
      schedulePan(-nx * 5.8, -ny * 4.6);
    }, { passive: true });
    stage.addEventListener('pointerleave', () => {
      if (pan.tx !== 0 || pan.ty !== 0) schedulePan(0, 0);
    }, { passive: true });
    window.addEventListener('deviceorientation', e => {
      if (reduced.matches || state.fit || !stage.classList.contains('is-resting') || e.gamma === null || e.beta === null) return;
      if (heroThresholdEl && motion.pose.distance < 0.36) return;
      const gx = clamp(e.gamma / 28, -1, 1);
      const gy = clamp((e.beta - 35) / 28, -1, 1);
      schedulePan(-gx * 5.2, -gy * 4.2);
    }, { passive: true });
    reduced.addEventListener('change', () => { resetPan(); pause(); if (reduced.matches) $('.art-layers', stage).getAnimations?.().forEach(animation => animation.cancel()); });
    addEventListener('resize', () => {
      const distance = (scrollY - geometry.top) / geometry.unit;
      const oldUnit = geometry.unit, oldTop = geometry.top;
      focusPictures(); measure();
      if (Math.abs(oldUnit - geometry.unit) > .5 || Math.abs(oldTop - geometry.top) > .5) window.scrollTo({ top: geometry.top + distance * geometry.unit, behavior: 'auto' });
      scheduleScroll();
    }, { passive: true });
    addEventListener('pageshow', scheduleScroll, { passive: true });
    $$('dialog').forEach(dialog => dialog.addEventListener('close', scheduleScroll));
    gallery = { pause, inspect, has: slug => works.some(w => w.slug === slug), select: slug => change(works.findIndex(w => w.slug === slug)) };
    measure(); metadata(); render(); moveTo(state.index);
    if (location.hash === '#fotos') openWorkGallery(galleryTrigger);
    addEventListener('hashchange', () => {
      if (location.hash === '#fotos' && !workGallery.open && !document.querySelector('dialog[open]')) openWorkGallery(galleryTrigger);
    });
  }

  const years = $$('[data-year]'), events = $$('[data-exhibition-year]');
  years.forEach(button => button.addEventListener('click', () => {
    const year = button.dataset.year; let count = 0;
    events.forEach(entry => { entry.hidden = year !== 'all' && entry.dataset.exhibitionYear !== year; if (!entry.hidden) count++; });
    years.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    $('.career-count').textContent = `${count} ${count === 1 ? 'encuentro documentado' : 'encuentros documentados'}`;
  }));
  const portraitTrack = $('[data-portrait-scroll]');
  if (portraitTrack) {
    document.documentElement.classList.add('portrait-scroll-native');
    const hero = $('[data-eye-portrait]', portraitTrack), plane = $('[data-portrait-plane]', hero);
    const photograph = $('img', plane), copy = $('.page-hero-copy', hero), shade = $('.page-hero-shade', hero);
    const artwork = $('[data-portrait-artwork]', hero), artCopy = $('[data-portrait-work-copy]', hero);
    const controls = $('[data-portrait-controls]', hero), previous = $('[data-portrait-prev]', hero), next = $('[data-portrait-next]', hero);
    const cue = $('.hero-down', hero), wink = $('[data-portrait-wink]', hero), monocleGlint = $('[data-portrait-monocle-glint]', hero);
    const eye = { x: 571 / 1248, y: 766 / 1966, iris: .032 };
    const eyes = {
      'rara-avis': { x: .670, y: .391, iris: .025 },
      'marilyn-rocks': { x: .635, y: .392, iris: .030 },
      'amy-rocks': { x: .512, y: .424, iris: .018 },
      'johnny-rocks': { x: .583, y: .459, iris: .028 },
      'rockagipsy': { x: .545, y: .402, iris: .018 },
      'infusion-de-berto': { x: .469, y: .463, iris: .020 },
      'buena-fuente': { x: .678, y: .439, iris: .025 },
      'james-rocks': { x: .420, y: .345, iris: .025 },
      'elene': { x: .487, y: .406, iris: .029 }
    };
    const opening = Object.keys(eyes);
    const works = [...opening.map(slug => catalogue.projects.find(p => p.slug === slug)), ...catalogue.projects.filter(p => !opening.includes(p.slug))];
    // The very same Rara Avis element opens the portal and starts the exhibition.
    // There is no second stage, document navigation or image swap at the join.
    const scenes = works.map((work, index) => {
      const scene = index ? document.createElement('div') : artwork;
      const photo = work.photos.find(p => p.src === work.cover) || work.photos[0];
      const img = index ? document.createElement('img') : $('img', scene);
      scene.classList.add('portrait-artwork'); scene.dataset.portraitScene = String(index); scene.dataset.work = work.slug;
      scene.setAttribute('aria-hidden', 'true');
      if (index) {
        img.width = photo.width; img.height = photo.height;
        img.alt = work.title + ' — ' + work.label; img.decoding = 'async'; img.draggable = false;
        img.dataset.src = work.cover; scene.append(img); $('.portrait-frame', hero).append(scene);
      } else img.dataset.src = img.getAttribute('src');
      return scene;
    });
    const images = scenes.map(scene => $('img', scene)), decoded = new Set(), pending = new Map(), failed = new Set();
    const smooth = value => { const t = clamp(value, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
    let frame = null, geometry = null, current = 0, captionIndex = -1;
    let interactiveWinkTimer = null, interactiveWinkVal = 0, hasWinkedOnScroll = false;
    function triggerInteractiveWink() {
      const travel = Math.max(0, -portraitTrack.getBoundingClientRect().top);
      if (travel > 60 || interactiveWinkTimer) return;
      soundscape?.portraitWink?.();
      const startTime = performance.now();
      const duration = 520;
      function step(now) {
        const elapsed = now - startTime;
        if (elapsed >= duration) {
          interactiveWinkVal = 0;
          interactiveWinkTimer = null;
          schedulePortrait();
          return;
        }
        const t = elapsed / duration;
        interactiveWinkVal = t < 0.35 ? smooth(t / 0.35) : t > 0.65 ? 1 - smooth((t - 0.65) / 0.35) : 1;
        schedulePortrait();
        interactiveWinkTimer = requestAnimationFrame(step);
      }
      interactiveWinkTimer = requestAnimationFrame(step);
    }
    plane.addEventListener('click', triggerInteractiveWink);
    plane.style.cursor = 'pointer';
    let mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    function onPointerMove(e) {
      if (reduced.matches) return;
      const rect = hero.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      mouse.tx = clamp((e.clientX - rect.left) / rect.width - 0.5, -0.5, 0.5);
      mouse.ty = clamp((e.clientY - rect.top) / rect.height - 0.5, -0.5, 0.5);
      schedulePortrait();
    }
    function onPointerLeave() {
      mouse.tx = 0; mouse.ty = 0;
      schedulePortrait();
    }
    hero.addEventListener('pointermove', onPointerMove, { passive: true });
    hero.addEventListener('pointerleave', onPointerLeave, { passive: true });
    const active = new Set([0]);
    function ready(index) { return decoded.has(index) && images[index]?.complete && !!images[index]?.naturalWidth; }
    function ensureScene(index) {
      const img = images[index]; if (!img || ready(index) || failed.has(index)) return Promise.resolve();
      if (pending.has(index)) return pending.get(index);
      if (!img.getAttribute('src')) img.src = img.dataset.src;
      const source = img.getAttribute('src');
      const job = Promise.resolve().then(async () => {
        try {
          if (img.decode) await img.decode();
          else if (!img.complete) await new Promise(resolve => {
            img.addEventListener('load', resolve, { once: true }); img.addEventListener('error', resolve, { once: true });
          });
          if (img.getAttribute('src') === source && img.complete && img.naturalWidth) decoded.add(index);
        } catch { if (img.getAttribute('src') === source) failed.add(index); }
      }).finally(() => {
        if (pending.get(index) === job) pending.delete(index);
        schedulePortrait();
      });
      pending.set(index, job); return job;
    }
    function releaseDistant(base) {
      images.forEach((img, i) => {
        if (Math.abs(i - base) > 1 && !active.has(i) && img.hasAttribute('src')) {
          img.removeAttribute('src'); decoded.delete(i); pending.delete(i); failed.delete(i);
        }
      });
      [base - 1, base, base + 1].forEach(i => { ensureScene(i); });
    }
    function measurePortrait() {
      const rect = hero.getBoundingClientRect();
      const width = rect.width || innerWidth, height = rect.height || innerHeight;
      const cover = (aspect, x, y) => {
        const imageWidth = Math.max(width, height * aspect), imageHeight = imageWidth / aspect;
        return { width: imageWidth, height: imageHeight, left: (width - imageWidth) * x, top: (height - imageHeight) * y };
      };
      const boxes = works.map((work, i) => {
        const aspect = Number(images[i].getAttribute('width')) / Number(images[i].getAttribute('height'));
        return cover(aspect, i === 0 && width <= 760 ? .72 : .5, .42);
      });
      geometry = { width, height, portrait: cover(2201 / 3468, .5, .29), art: boxes[0], boxes };
      [[plane, geometry.portrait], ...scenes.map((scene, i) => [scene, boxes[i]])].forEach(([element, box]) => {
        Object.assign(element.style, reduced.matches
          ? { width: '', height: '', left: '', top: '' }
          : { width: `${box.width}px`, height: `${box.height}px`, left: `${box.left}px`, top: `${box.top}px` });
      });
      plane.classList.toggle('is-measured', !reduced.matches);
      schedulePortrait();
    }
    function pose(element, box, point, zoom, focus, offset = 0) {
      const g = geometry, x = box.left + point.x * box.width, y = box.top + point.y * box.height;
      const tx = x + (g.width * .5 - x) * focus - box.left - zoom * point.x * box.width;
      const ty = y + (g.height * .46 - y) * focus - box.top - zoom * point.y * box.height + offset;
      element.style.transform = reduced.matches ? '' : `translate3d(${tx.toFixed(3)}px,${ty.toFixed(3)}px,0) scale(${zoom.toFixed(5)})`;
    }
    function eyePass(from, target, fromBox, targetBox, fromEye, targetEye, progress) {
      const start = fromEye.iris * fromBox.width, finish = targetEye.iris * targetBox.width;
      // Minimum iris immersion needed to cover the viewport frame with a 2% margin.
      const deep = Math.hypot(geometry.width, geometry.height) * 1.02;
      const approach = smooth(progress / .64), reveal = smooth((progress - .64) / .32);
      const diameter = Math.exp(progress <= .64
        ? Math.log(start) + Math.log(deep / start) * approach
        : Math.log(deep) + Math.log(finish / deep) * reveal);
      const focus = smooth(progress / .34) * (1 - reveal);
      const depth = approach * (1 - reveal);
      pose(from, fromBox, fromEye, Math.max(1, diameter / start), focus);
      pose(target, targetBox, targetEye, Math.max(1, diameter / finish), focus);
      return { blend: smooth((progress - .44) / .14), depth };
    }
    // Two-stage overture for /sobre-mi/:
    // Phase 1 (progress 0.00 -> 0.24): Naroa first winks her left eye at full portrait framing.
    // Phase 2 (progress 0.24 -> 0.64): Camera locks onto the monocle and plunges into Rara Avis.
    function portraitPass(from, target, fromBox, targetBox, fromEye, targetEye, progress) {
      const start = fromEye.iris * fromBox.width, finish = targetEye.iris * targetBox.width;
      const deep = Math.hypot(geometry.width, geometry.height) * 1.02;
      const pre = 0.015 * smooth(progress / .24);
      const u = clamp((progress - .24) / .40, 0, 1);
      const approach = progress <= .24
        ? pre
        : pre + (1 - pre) * (0.68 * smooth(u / .58) + 0.32 * smooth(u));
      const reveal = smooth((progress - .64) / .32);
      const diameter = Math.exp(progress <= .64
        ? Math.log(start) + Math.log(deep / start) * approach
        : Math.log(deep) + Math.log(finish / deep) * reveal);
      const focusIn = progress <= .24
        ? 0.06 * smooth(progress / .24)
        : 0.06 + 0.94 * smooth((progress - .24) / .18);
      const focus = focusIn * (1 - reveal);
      const depth = approach * (1 - reveal);
      pose(from, fromBox, fromEye, Math.max(1, diameter / start), focus);
      pose(target, targetBox, targetEye, Math.max(1, diameter / finish), focus);
      return { blend: smooth((progress - .44) / .14), depth, approach };
    }
    function showCaption(index, opacity) {
      const work = works[index]; current = index;
      if (captionIndex !== index) {
        $('[data-portrait-title]', hero).textContent = work.title;
        $('[data-portrait-label]', hero).textContent = `${index ? work.label : 'Del rostro al autorretrato'} · ${String(index + 1).padStart(2, '0')} / ${works.length}`;
        $('[data-portrait-link]', hero).href = '/obra/' + work.slug + '/';
        previous.disabled = index === 0; next.disabled = index === works.length - 1;
        hero.dataset.work = work.slug; captionIndex = index;
      }
      [artCopy, controls].forEach(element => {
        element.style.opacity = opacity.toFixed(3); element.style.visibility = opacity > 0 ? 'visible' : 'hidden'; element.inert = opacity < .2;
      });
      artCopy.style.transform = reduced.matches ? '' : `translate3d(0,${((1 - opacity) * 12).toFixed(2)}px,0)`;
    }
    function renderExhibition(position, totalDistance) {
      const g = geometry, base = Math.floor(position), fraction = position - base;
      const incoming = Math.min(base + 1, works.length - 1), pair = fraction > 0 && incoming !== base;
      ensureScene(base); if (pair) ensureScene(incoming);
      // Wait for the requested pair while retaining the last painted pair.
      // Scroll remains native even when several works are skipped quickly.
      if (!ready(base) || pair && !ready(incoming)) return;
      active.clear(); active.add(base); if (pair) active.add(incoming);
      scenes.forEach((scene, i) => {
        const visible = active.has(i); scene.style.visibility = visible ? 'visible' : 'hidden'; scene.classList.toggle('is-visible', visible);
        scene.setAttribute('aria-hidden', String(i !== Math.round(position)));
      });
      const outgoing = scenes[base], target = scenes[incoming], fromEye = eyes[works[base].slug], toEye = eyes[works[incoming].slug];
      outgoing.style.opacity = '1'; outgoing.style.zIndex = '1';
      const eyeMatch = pair && fromEye && toEye;
      const activeSlug = pair && fraction >= .5 ? works[incoming].slug : works[base].slug;
      hero.dataset.transition = eyeMatch ? 'eyes' : pair ? 'depth' : 'still';
      if (eyeMatch) {
        const pass = eyePass(outgoing, target, g.boxes[base], g.boxes[incoming], fromEye, toEye, fraction);
        target.style.opacity = pass.blend.toFixed(4);
        soundscape?.frame({ distance: totalDistance, depth: pass.depth, mode: 'E', phase: 'transition', axisDirection: 1, slug: activeSlug });
      } else {
        const progress = smooth(fraction), centre = { x: .5, y: .5 };
        pose(outgoing, g.boxes[base], centre, 1 + progress * .06, 0, -g.height * .025 * progress);
        if (pair) {
          pose(target, g.boxes[incoming], centre, 1 + (1 - progress) * .06, 0, g.height * .025 * (1 - progress));
          target.style.opacity = smooth((fraction - .10) / .80).toFixed(4);
        }
        soundscape?.frame({ distance: totalDistance, depth: 0, mode: 'Z', phase: pair ? 'transition' : 'hold', axisDirection: 1, slug: activeSlug });
      }
      if (pair) target.style.zIndex = '2';
      const opacity = eyeMatch ? 1 - smooth(fraction / .22) + smooth((fraction - .84) / .12)
        : pair ? .4 + .6 * Math.pow(Math.abs(fraction - .5) * 2, .6) : 1;
      showCaption(Math.round(position), opacity);
      plane.style.visibility = 'hidden'; plane.setAttribute('aria-hidden', 'true');
      copy.style.opacity = cue.style.opacity = '0'; cue.tabIndex = -1; cue.style.pointerEvents = 'none';
      shade.style.opacity = '.75';
      releaseDistant(base);
    }
    function renderPortrait() {
      frame = null;
      const g = geometry; if (!g || document.querySelector('dialog[open]')) return;
      const travel = Math.max(0, -portraitTrack.getBoundingClientRect().top);
      const progress = reduced.matches ? 0 : clamp(travel / (g.height * 2.8), 0, 1);
      const position = reduced.matches ? 0 : clamp((travel - g.height * 2.8) / (g.height * 1.1), 0, works.length - 1);
      if (!reduced.matches && travel >= g.height * 2.8) { renderExhibition(position, travel / g.height); return; }
      ensureScene(0);
      active.clear(); active.add(0);
      scenes.forEach((scene, i) => { if (i) { scene.style.visibility = 'hidden'; scene.setAttribute('aria-hidden', 'true'); scene.classList.remove('is-visible'); } });
      const { blend, depth, approach } = portraitPass(plane, artwork, g.portrait, g.art, eye, eyes['rara-avis'], progress);
      const mix = ready(0) ? blend : 0;
      artwork.style.opacity = mix.toFixed(4); artwork.style.zIndex = '1';
      artwork.style.visibility = mix > 0 ? 'visible' : 'hidden'; artwork.classList.toggle('is-visible', mix > 0);
      artwork.setAttribute('aria-hidden', String(mix < .5));
      plane.style.visibility = mix === 1 ? 'hidden' : 'visible'; plane.setAttribute('aria-hidden', String(mix >= .5));
      // Phase 1: Left eye winks first (0.015 -> 0.24 hold -> 0.30 reopen), before the monocle zoom accelerates.
      const closure = smooth((progress - .015) / .065) * (1 - smooth((progress - .24) / .06));
      const effectiveClosure = Math.max(closure, interactiveWinkVal);
      wink.setAttribute('opacity', effectiveClosure.toFixed(4));
      if (monocleGlint) {
        const glint = reduced.matches ? 0 : smooth((progress - .18) / .09) * (1 - smooth((progress - .42) / .08));
        monocleGlint.setAttribute('opacity', glint.toFixed(4));
      }
      if (closure >= 0.8 && !hasWinkedOnScroll) {
        hasWinkedOnScroll = true;
        soundscape?.portraitWink?.();
      } else if (closure < 0.1) {
        hasWinkedOnScroll = false;
      }
      const reveal = mix * smooth((progress - .84) / .10);
      const visibility = 1 - smooth((progress - .18) / .14);
      mouse.x += (mouse.tx - mouse.x) * 0.15;
      mouse.y += (mouse.ty - mouse.y) * 0.15;
      const parallaxFactor = smooth(1 - progress / 0.28);
      const copyPx = mouse.x * 24 * parallaxFactor;
      const copyPy = mouse.y * 18 * parallaxFactor;
      const copyScrollY = -smooth(progress / .24) * 45;
      copy.style.opacity = visibility.toFixed(3);
      copy.style.transform = reduced.matches ? '' : `translate3d(${copyPx.toFixed(2)}px,${(copyScrollY + copyPy).toFixed(2)}px,0)`;
      const shadePx = -mouse.x * 16 * parallaxFactor;
      const shadePy = -mouse.y * 12 * parallaxFactor;
      const shadeScrollY = progress * 32;
      shade.style.opacity = (1 - approach * .90 + reveal * .65).toFixed(3);
      shade.style.transform = reduced.matches ? '' : `translate3d(${shadePx.toFixed(2)}px,${(shadeScrollY + shadePy).toFixed(2)}px,0)`;
      const tiltX = -mouse.y * 3.5 * parallaxFactor;
      const tiltY = mouse.x * 3.5 * parallaxFactor;
      const portraitFrame = $('.portrait-frame', hero);
      if (portraitFrame) portraitFrame.style.transform = reduced.matches ? '' : `rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`;
      cue.style.opacity = visibility.toFixed(3); cue.style.pointerEvents = visibility < .1 ? 'none' : ''; cue.tabIndex = visibility < .1 ? -1 : 0;
      showCaption(0, reveal);
      hero.dataset.transition = 'portrait';
      if (reduced.matches) soundscape?.frame({ distance: scrollY / Math.max(1, g.height), depth: 0, mode: 'still', phase: 'scroll', axisDirection: 1, slug: 'rara-avis' });
      else if (progress <= .44 || ready(0)) soundscape?.frame({ distance: travel / g.height, depth, mode: 'E', phase: progress > 0 && progress < .96 ? 'transition' : 'hold', axisDirection: 1, slug: 'rara-avis' });
      if (!reduced.matches) releaseDistant(0);
      if (!reduced.matches && (Math.abs(mouse.tx - mouse.x) > 0.002 || Math.abs(mouse.ty - mouse.y) > 0.002)) {
        frame = requestAnimationFrame(renderPortrait);
      }
    }
    function schedulePortrait() { if (frame === null) frame = requestAnimationFrame(renderPortrait); }
    function goTo(index) {
      if (index < 0 || index >= works.length || reduced.matches) return;
      const top = portraitTrack.getBoundingClientRect().top + scrollY;
      window.scrollTo({ top: top + geometry.height * (2.8 + index * 1.1), behavior: Math.abs(index - current) <= 1 ? 'smooth' : 'auto' });
    }
    previous.addEventListener('click', () => goTo(current - 1)); next.addEventListener('click', () => goTo(current + 1));
    document.addEventListener('keydown', event => {
      if (reduced.matches || document.querySelector('dialog[open]') || artCopy.inert || event.target.closest?.('input,textarea,select,[contenteditable=true]')) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); goTo(current + (event.key === 'ArrowRight' ? 1 : -1)); }
    });
    gallery = { pause() {}, has: slug => !reduced.matches && works.some(work => work.slug === slug), select: slug => goTo(works.findIndex(work => work.slug === slug)) };
    addEventListener('scroll', schedulePortrait, { passive: true }); addEventListener('resize', measurePortrait, { passive: true });
    addEventListener('pageshow', measurePortrait, { passive: true }); reduced.addEventListener('change', measurePortrait);
    photograph.addEventListener('load', measurePortrait);
    $$('dialog').forEach(dialog => dialog.addEventListener('close', schedulePortrait));
    ensureScene(0); measurePortrait();
  }
  if (!stage) {
    const sections = $$('[data-parallax]'); let frame = null;
    sections.forEach(section => {
      if (!section.matches('.page-hero')) return;
      section.addEventListener('pointermove', e => {
        if (reduced.matches) return;
        const r = section.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const mx = clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5) * 2;
        const my = clamp((e.clientY - r.top) / r.height - 0.5, -0.5, 0.5) * 2;
        section.style.setProperty('--hero-mx', mx.toFixed(4));
        section.style.setProperty('--hero-my', my.toFixed(4));
        section.style.setProperty('--hero-rx', `${(-my * 4.5).toFixed(2)}deg`);
        section.style.setProperty('--hero-ry', `${(mx * 5.5).toFixed(2)}deg`);
      }, { passive: true });
      section.addEventListener('pointerleave', () => {
        section.style.setProperty('--hero-mx', '0');
        section.style.setProperty('--hero-my', '0');
        section.style.setProperty('--hero-rx', '0deg');
        section.style.setProperty('--hero-ry', '0deg');
      }, { passive: true });
    });
    const sectionStates = new WeakMap();
    function pageParallax() {
      frame = null;
      const vh = innerHeight || 800;
      let needsNextFrame = false;
      sections.forEach(section => {
        const r = section.getBoundingClientRect(); if (r.bottom < -120 || r.top > vh + 120) return;
        const target = $('.page-hero-image', section) || (section.matches('.contact-background') ? section : $('img', section));
        if (!target) return;
        const progress = clamp((vh - r.top) / (vh + r.height), 0, 1);
        const desiredShift = (progress - .5) * 2 * vh * .07;
        let st = sectionStates.get(section);
        if (!st) {
          st = { shift: desiredShift, exit: clamp(-r.top / vh, 0, 1) };
          sectionStates.set(section, st);
        }
        if (reduced.matches) {
          st.shift = desiredShift;
          target.style.transform = '';
        } else {
          const dShift = desiredShift - st.shift;
          if (Math.abs(dShift) < 0.15) {
            st.shift = desiredShift;
          } else {
            st.shift += dShift * 0.24;
            needsNextFrame = true;
          }
          const depthScale = 1.08 + (1 - Math.abs(progress - 0.5) * 2) * 0.024;
          target.style.transform = `translate3d(0,${st.shift.toFixed(2)}px,0) scale(${depthScale.toFixed(4)})`;
        }
        const copy = $('.page-hero-copy', section);
        if (copy) {
          const desiredExit = clamp(-r.top / vh, 0, 1);
          const dExit = desiredExit - st.exit;
          if (reduced.matches || Math.abs(dExit) < 0.002) {
            st.exit = desiredExit;
          } else {
            st.exit += dExit * 0.26;
            needsNextFrame = true;
          }
          const exit = st.exit;
          const splitEase = exit * exit * (3 - 2 * exit);
          copy.style.transform = reduced.matches ? '' : `translate3d(0,${(-exit * vh * .035).toFixed(2)}px,0)`;
          copy.style.opacity = reduced.matches ? '1' : (1 - exit * .75).toFixed(3);
          section.style.setProperty('--hero-split', reduced.matches ? '0' : splitEase.toFixed(4));
          section.style.setProperty('--hero-skew', reduced.matches ? '0deg' : `${(Math.sin(exit * Math.PI) * -9.5).toFixed(2)}deg`);
          section.style.setProperty('--hero-letter', reduced.matches ? '0em' : `${(splitEase * 0.18).toFixed(4)}em`);
        }
      });
      $('.site-nav').classList.toggle('is-scrolled', scrollY > vh * .72);
      if (needsNextFrame && frame === null) frame = requestAnimationFrame(pageParallax);
    }
    const schedule = () => { if (frame === null) frame = requestAnimationFrame(pageParallax); };
    addEventListener('scroll', schedule, { passive: true }); addEventListener('resize', schedule, { passive: true }); reduced.addEventListener('change', schedule); schedule();
  }

  // ── Disruptive Editorial Scroll Engine (/sobre-mi/ Kintsugi Seam + X-Ray Monocle + Reverse Portrait) ──
  const kintsugiEditorial = $('[data-kintsugi-editorial]');
  if (kintsugiEditorial) {
    const chapters = $$('[data-kintsugi-chapter]', kintsugiEditorial);
    const xrays = $$('[data-monocle-xray]', kintsugiEditorial);
    const reverseBox = $('[data-reverse-portrait]', kintsugiEditorial);
    const summaryEl = $('[data-gaze-summary]', kintsugiEditorial);
    const detailEl = $('[data-gaze-detail]', kintsugiEditorial);
    const tempoEl = $('[data-gaze-tempo]', kintsugiEditorial);
    const elementEl = $('[data-gaze-element]', kintsugiEditorial);
    const workEl = $('[data-gaze-work]', kintsugiEditorial);
    const ctaEl = $('[data-gaze-cta]', kintsugiEditorial);
    const workLinkEl = $('[data-gaze-work-link]', kintsugiEditorial);

    // 1. Veta de Oro Kintsugi continua entre capítulos + grietas diagonales internas
    const seamSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    seamSvg.setAttribute('class', 'kintsugi-seam-svg');
    seamSvg.setAttribute('viewBox', '0 0 120 1200');
    seamSvg.setAttribute('preserveAspectRatio', 'none');
    seamSvg.setAttribute('aria-hidden', 'true');
    seamSvg.innerHTML = `
      <defs>
        <linearGradient id="kintsugi-gold-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#f7e3a1" stop-opacity="0.15"/>
          <stop offset="50%" stop-color="#d4af37" stop-opacity="0.95"/>
          <stop offset="100%" stop-color="#edbca4" stop-opacity="0.75"/>
        </linearGradient>
      </defs>
      <path class="kintsugi-seam-glow" d="M64,0 L48,180 L76,340 L38,520 L72,710 L44,890 L68,1060 L56,1200" fill="none" stroke="url(#kintsugi-gold-grad)" stroke-width="5" stroke-linecap="round"/>
      <path class="kintsugi-seam-core" d="M64,0 L48,180 L76,340 L38,520 L72,710 L44,890 L68,1060 L56,1200" fill="none" stroke="#fffdf4" stroke-width="1.4" stroke-linecap="round"/>
    `;
    kintsugiEditorial.prepend(seamSvg);

    // Grieta de oro líquido diagonal dentro de cada brecha tectónica
    chapters.forEach(ch => {
      const chasm = $('[data-kintsugi-chasm]', ch);
      if (!chasm) return;
      const crackSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      crackSvg.setAttribute('class', 'kintsugi-chasm-crack');
      crackSvg.setAttribute('viewBox', '0 0 800 72');
      crackSvg.setAttribute('preserveAspectRatio', 'none');
      crackSvg.setAttribute('aria-hidden', 'true');
      crackSvg.innerHTML = `
        <path class="kintsugi-crack-glow" d="M0,44 L145,22 L285,52 L440,18 L595,48 L715,24 L800,38" fill="none" stroke="#d4af37" stroke-width="3.2" stroke-linecap="round"/>
        <path class="kintsugi-crack-core" d="M0,44 L145,22 L285,52 L440,18 L595,48 L715,24 L800,38" fill="none" stroke="#fffdf4" stroke-width="1.1" stroke-linecap="round"/>
      `;
      chasm.prepend(crackSvg);
    });

    const kState = {
      targetY: scrollY || 0,
      currentY: scrollY || 0,
      velocity: 0,
      peakVelocity: 0,
      scrollEvents: 0,
      dwellChapters: { mirada: 0, materia: 0, espejo: 0, compartir: 0 },
      fractureStates: { mirada: 'tense', materia: 'tense', espejo: 'tense', compartir: 'tense' },
      xrayTouches: 0,
      seamProgress: 0,
      micaX: 50,
      micaY: 50,
      raf: null
    };

    kintsugiEditorial.addEventListener('pointermove', e => {
      if (reduced.matches) return;
      const r = kintsugiEditorial.getBoundingClientRect();
      if (!r.width || !r.height) return;
      kState.micaX = clamp(((e.clientX - r.left) / r.width) * 100, 0, 100);
      kState.micaY = clamp(((e.clientY - r.top) / r.height) * 100, 0, 100);
      kintsugiEditorial.style.setProperty('--mica-x', `${kState.micaX.toFixed(1)}%`);
      kintsugiEditorial.style.setProperty('--mica-y', `${kState.micaY.toFixed(1)}%`);
    }, { passive: true });

    // 2. Lente de Rayos X del Monóculo sobre figuras a sangre (con seguimiento inercial por subpasos)
    xrays.forEach(fig => {
      const xr = { x: 50, y: 50, r: 0, tx: 50, ty: 50, tr: 0, frame: null };
      fig.style.setProperty('--xray-x', '50%');
      fig.style.setProperty('--xray-y', '50%');
      fig.style.setProperty('--xray-r', '0px');
      function stepXray() {
        xr.frame = null;
        const dx = xr.tx - xr.x;
        const dy = xr.ty - xr.y;
        const dr = xr.tr - xr.r;
        if (Math.abs(dx) < 0.15 && Math.abs(dy) < 0.15 && Math.abs(dr) < 0.5) {
          xr.x = xr.tx; xr.y = xr.ty; xr.r = xr.tr;
        } else {
          xr.x += dx * 0.28;
          xr.y += dy * 0.28;
          xr.r += dr * 0.26;
          xr.frame = requestAnimationFrame(stepXray);
        }
        fig.style.setProperty('--xray-x', `${xr.x.toFixed(1)}%`);
        fig.style.setProperty('--xray-y', `${xr.y.toFixed(1)}%`);
        fig.style.setProperty('--xray-r', `${xr.r.toFixed(1)}px`);
      }
      fig.addEventListener('pointermove', e => {
        if (reduced.matches) return;
        const r = fig.getBoundingClientRect();
        const w = r.width || innerWidth || 800;
        const h = r.height || 500;
        xr.tx = clamp(((e.clientX - r.left) / w) * 100, 0, 100);
        xr.ty = clamp(((e.clientY - r.top) / h) * 100, 0, 100);
        xr.tr = 152;
        fig.classList.add('is-xray-active');
        kState.xrayTouches++;
        if (xr.frame === null) xr.frame = requestAnimationFrame(stepXray);
      }, { passive: true });
      fig.addEventListener('pointerleave', () => {
        xr.tr = 0;
        fig.classList.remove('is-xray-active');
        if (xr.frame === null) xr.frame = requestAnimationFrame(stepXray);
      }, { passive: true });
    });

    function updateReversePortrait() {
      if (!reverseBox) return;
      const entries = Object.entries(kState.dwellChapters).sort((a, b) => b[1] - a[1]);
      const dominant = entries[0]?.[0] || 'materia';
      const fast = kState.peakVelocity > 42;
      const profiles = {
        mirada: {
          tempo: fast ? 'Impulso Eléctrico' : 'Mirada Detenida',
          element: 'Carbón, grafito y reflejos sobre papel',
          work: 'Amy Rocks',
          slug: 'amy-rocks',
          supportParam: 'Collage textil sobre madera',
          summary: 'Has buscado primero los ojos antes que la historia.',
          detail: 'Tu forma de recorrer la página se detiene en el gesto y la expresión. Tu retrato pediría trazo directo y contraste vivo.'
        },
        materia: {
          tempo: fast ? 'Exploración Táctil' : 'Pulso Mineral',
          element: 'Pizarra natural de cantera, óxido y mica',
          work: 'Marilyn Rocks',
          slug: 'marilyn-rocks',
          supportParam: 'Pizarra natural rústica',
          summary: 'Tu mirada pesa sobre la textura, la cicatriz y la materia.',
          detail: 'Te atraen los soportes con vida previa: la laja de pizarra, la lata recuperada y el brillo mineral cuando gira la luz.'
        },
        espejo: {
          tempo: fast ? 'Vértigo Interior' : 'Contemplación Íntima',
          element: 'Pastel seco, pluma y fragmentos de espejo (Kintsugi)',
          work: 'Rara Avis',
          slug: 'rara-avis',
          supportParam: 'Collage textil sobre madera',
          summary: 'Te has detenido al otro lado del espejo.',
          detail: 'Tu lectura resuena con las capas ocultas y el autorretrato simbólico: construir identidad uniendo piezas diversas.'
        },
        compartir: {
          tempo: fast ? 'Paso de Calle (Walking)' : 'Encuentro Abierto',
          element: 'Madera intervenida y caja de memoria compartida',
          work: 'Amor en Conserva',
          slug: 'amor-en-conserva',
          supportParam: 'Caja personalizada u objeto',
          summary: 'Entiendes el arte como un lugar donde encontrarse.',
          detail: 'Tu recorrido conecta con la calle y el juego compartido de El ReCreo: un objeto intervenido que guarda una historia común.'
        }
      };
      const chosen = profiles[dominant] || profiles.materia;
      if (tempoEl) tempoEl.textContent = `Ritmo: ${chosen.tempo}`;
      if (elementEl) elementEl.textContent = `Materia afín: ${chosen.element}`;
      if (workEl) workEl.textContent = `Obra espejo: ${chosen.work}`;
      if (summaryEl) summaryEl.textContent = chosen.summary;
      if (detailEl) detailEl.textContent = chosen.detail;
      if (workLinkEl) {
        workLinkEl.href = `/obra/${chosen.slug}/`;
        workLinkEl.textContent = `Ver ${chosen.work} ↗`;
      }
      if (ctaEl) {
        ctaEl.href = `/retratos-por-encargo-bilbao/?soporte=${encodeURIComponent(chosen.supportParam)}`;
      }
    }

    function stepKintsugiScroll() {
      kState.raf = null;
      const vh = innerHeight || 800;
      const delta = kState.targetY - kState.currentY;
      // Ley 1 (INV_C5_SCROLL_SUBSTEP_DYNAMICS): Sub-step inertial follow (alpha = 0.16)
      if (reduced.matches || Math.abs(delta) < 0.25) {
        kState.currentY = kState.targetY;
        kState.velocity = 0;
      } else {
        const step = delta * 0.16;
        kState.currentY += step;
        kState.velocity = step;
        kState.peakVelocity = Math.max(kState.peakVelocity, Math.abs(step));
      }

      const rect = kintsugiEditorial.getBoundingClientRect();
      const totalH = Math.max(1, rect.height - vh * 0.5);
      const progressed = clamp((-rect.top + vh * 0.45) / totalH, 0, 1);
      kState.seamProgress = Number(progressed.toFixed(4));
      kintsugiEditorial.style.setProperty('--kintsugi-progress', String(kState.seamProgress));
      const skew = reduced.matches ? 0 : clamp(kState.velocity * 0.045, -3.5, 3.5);
      kintsugiEditorial.style.setProperty('--scroll-velocity-skew', `${skew.toFixed(2)}deg`);

      chapters.forEach(ch => {
        const cr = ch.getBoundingClientRect();
        const centerDist = 1 - clamp(Math.abs((cr.top + cr.height * 0.5) - vh * 0.5) / (vh * 0.65), 0, 1);
        // Progreso local de paso del capítulo por el viewport (0 = entra por abajo, 0.5 = centro, 1 = sale por arriba)
        const localProgress = clamp((vh * 0.85 - cr.top) / Math.max(1, vh * 0.85 + cr.height * 0.55), 0, 1);
        // Fase 1 (0..0.28): Tensión | Fase 2 (0.28..0.64): Brecha abierta | Fase 3 (0.64..1.0): Sutura Kintsugi dorada
        let gap = 0;
        let goldWeld = 0;
        let phase = 'tense';
        if (localProgress >= 0.22 && localProgress < 0.64) {
          gap = Math.sin(((localProgress - 0.22) / 0.42) * Math.PI);
          goldWeld = clamp((localProgress - 0.36) / 0.28, 0, 1);
          phase = 'fractured';
        } else if (localProgress >= 0.64) {
          gap = Math.max(0.18, (1 - clamp((localProgress - 0.64) / 0.26, 0, 1)) * 0.45);
          goldWeld = 1;
          phase = 'sutured';
        }
        ch.dataset.kintsugiPhase = phase;
        ch.style.setProperty('--chapter-focus', centerDist.toFixed(3));
        ch.style.setProperty('--fracture-gap', gap.toFixed(3));
        ch.style.setProperty('--kintsugi-weld', goldWeld.toFixed(3));
        ch.classList.toggle('is-kintsugi-active', centerDist > 0.35);
        ch.classList.toggle('is-kintsugi-fractured', phase === 'fractured');
        ch.classList.toggle('is-kintsugi-sutured', phase === 'sutured');
        const key = ch.dataset.kintsugiChapter;
        if (key) {
          kState.fractureStates[key] = phase;
        }
        if (centerDist > 0.45 && key && key in kState.dwellChapters) {
          kState.dwellChapters[key] += 1;
        }
      });

      updateReversePortrait();

      if (!reduced.matches && Math.abs(kState.targetY - kState.currentY) >= 0.25) {
        kState.raf = requestAnimationFrame(stepKintsugiScroll);
      }
    }

    function scheduleKintsugiScroll() {
      kState.targetY = scrollY || 0;
      kState.scrollEvents++;
      if (kState.raf === null) {
        kState.raf = requestAnimationFrame(stepKintsugiScroll);
      }
    }

    addEventListener('scroll', scheduleKintsugiScroll, { passive: true });
    addEventListener('resize', scheduleKintsugiScroll, { passive: true });
    stepKintsugiScroll();

    window.NAROA_ABOUT_SCROLL = {
      triggerSampleScroll(y = 1400) {
        kState.targetY = y;
        kState.peakVelocity = Math.max(kState.peakVelocity, 55);
        kState.dwellChapters.espejo += 12;
        kState.fractureStates.espejo = 'sutured';
        const mirrorChapter = $('[data-kintsugi-chapter="espejo"]', kintsugiEditorial);
        if (mirrorChapter) {
          mirrorChapter.dataset.kintsugiPhase = 'sutured';
          mirrorChapter.style.setProperty('--fracture-gap', '0.320');
          mirrorChapter.style.setProperty('--kintsugi-weld', '1.000');
          mirrorChapter.classList.add('is-kintsugi-sutured');
        }
        stepKintsugiScroll();
        kState.fractureStates.espejo = 'sutured';
        return this.getState();
      },
      getState: () => ({
        backend: 'kintsugi-tectonic-fracture-v8',
        seamProgress: kState.seamProgress,
        velocity: Number(kState.velocity.toFixed(3)),
        peakVelocity: Number(kState.peakVelocity.toFixed(3)),
        dwellChapters: { ...kState.dwellChapters },
        fractureStates: { ...kState.fractureStates },
        xrayTouches: kState.xrayTouches
      })
    };
  }
  const commissionHorizontal = $('[data-commission-horizontal]');
  if (commissionHorizontal) {
    const track = $('[data-horizontal-track]', commissionHorizontal);
    const cards = $$('[data-parallax-card]', commissionHorizontal);
    const hState = {
      targetY: scrollY || 0,
      currentY: scrollY || 0,
      progress: 0,
      translateX: 0,
      raf: null
    };
    function stepCommissionHorizontal() {
      hState.raf = null;
      const dy = hState.targetY - hState.currentY;
      if (reduced.matches || Math.abs(dy) < 0.25) {
        hState.currentY = hState.targetY;
      } else {
        hState.currentY += dy * 0.16;
      }
      const vh = innerHeight || 900;
      const vw = innerWidth || 1440;
      const stageHeight = commissionHorizontal.offsetHeight || vh * 4.2;
      const maxScroll = Math.max(1, stageHeight - vh);
      const progress = clamp(hState.currentY / maxScroll, 0, 1);
      hState.progress = Number(progress.toFixed(4));
      const trackWidth = track ? Math.max(track.scrollWidth || 0, vw * 3.2) : vw * 3.2;
      const maxTx = Math.max(0, trackWidth - vw);
      const tx = reduced.matches ? 0 : -progress * maxTx;
      hState.translateX = Number(tx.toFixed(2));
      if (track) {
        track.style.setProperty('--hx', `${tx.toFixed(2)}px`);
      }
      const total = Math.max(1, cards.length - 1);
      cards.forEach((card, idx) => {
        const anchor = idx / total;
        const rel = reduced.matches ? 0 : clamp((anchor - progress) * 2.2, -1, 1);
        card.style.setProperty('--parallax-x', rel.toFixed(4));
      });
      $('.site-nav')?.classList.toggle('is-scrolled', hState.currentY > 24);
      if (!reduced.matches && Math.abs(hState.targetY - hState.currentY) >= 0.25) {
        hState.raf = requestAnimationFrame(stepCommissionHorizontal);
      }
    }
    function scheduleCommissionHorizontal() {
      hState.targetY = scrollY || 0;
      if (hState.raf === null) {
        hState.raf = requestAnimationFrame(stepCommissionHorizontal);
      }
    }
    addEventListener('scroll', scheduleCommissionHorizontal, { passive: true });
    addEventListener('resize', scheduleCommissionHorizontal, { passive: true });
    stepCommissionHorizontal();
    window.NAROA_COMMISSION_HORIZONTAL = {
      scrollToProgress(p = 0.5) {
        const vh = innerHeight || 900;
        const stageHeight = commissionHorizontal.offsetHeight || vh * 4.2;
        hState.targetY = clamp(p, 0, 1) * Math.max(1, stageHeight - vh);
        hState.currentY = hState.targetY;
        stepCommissionHorizontal();
        return this.getState();
      },
      getState: () => ({
        backend: 'substep-horizontal-parallax-v1',
        progress: hState.progress,
        translateX: hState.translateX,
        cards: cards.length
      })
    };
  }
  const notebookSync = $('[data-notebook-sync]'), notebookGrid = $('[data-notebook-posts]');
  if (notebookSync && notebookGrid && typeof fetch === 'function') {
    const endpoint = notebookSync.dataset.notebookSync;
    const plain = value => {
      const doc = new DOMParser().parseFromString(String(value || ''), 'text/html');
      return (doc.body?.textContent || '').trim();
    };
    const safeUrl = (value, isImage = false) => {
      try {
        const u = new URL(value);
        return u.protocol === 'https:' && u.hostname === 'naroagutierrez.wordpress.com' && (!isImage || u.pathname.startsWith('/wp-content/uploads/')) ? u.href : null;
      } catch { return null; }
    };
    async function syncNotebook() {
      if (!endpoint || document.hidden) return;
      try {
        const res = await fetch(endpoint, { credentials: 'omit' });
        if (!res.ok) return;
        const data = await res.json();
        const posts = (data?.posts || []).filter(p => safeUrl(p.URL) && p.title && !Number.isNaN(Date.parse(p.date))).slice(0, 6);
        if (posts.length < 6) return;
        const existingImages = new Map($$('[data-notebook-entry]', notebookGrid).map(card => {
          const link = $('h3 a', card)?.getAttribute('href'), img = $('.notebook-photo img', card);
          return [link, img ? { src: img.getAttribute('src'), width: img.width || 1080, height: img.height || 1080, alt: img.alt } : null];
        }));
        const cards = posts.map(post => {
          const title = plain(post.title), url = safeUrl(post.URL);
          const localImg = existingImages.get(url);
          const remoteSrc = safeUrl(post.featured_image, true);
          const imgSrc = localImg?.src || remoteSrc;
          const article = document.createElement('article');
          article.className = 'notebook-card is-revealed';
          article.dataset.notebookEntry = '';
          if (imgSrc) {
            const photoLink = document.createElement('a');
            photoLink.className = 'notebook-photo'; photoLink.href = url; photoLink.target = '_blank'; photoLink.rel = 'noopener noreferrer';
            const img = document.createElement('img');
            img.src = imgSrc; img.alt = localImg?.alt || title; img.loading = 'lazy'; img.decoding = 'async';
            img.width = localImg?.width || 1080; img.height = localImg?.height || 1080;
            photoLink.append(img); article.append(photoLink);
          }
          const body = document.createElement('div'); body.className = 'notebook-card-body';
          const eyebrow = document.createElement('p'); eyebrow.className = 'eyebrow';
          const cat = document.createElement('span'); cat.textContent = 'Del cuaderno de Naroa';
          const time = document.createElement('time');
          const iso = String(post.date).slice(0, 10);
          time.dateTime = iso;
          time.textContent = new Intl.DateTimeFormat('es', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(post.date));
          eyebrow.append(cat, ' · ', time);
          const h3 = document.createElement('h3'), titleLink = document.createElement('a');
          titleLink.href = url; titleLink.target = '_blank'; titleLink.rel = 'noopener noreferrer'; titleLink.textContent = `${title} ↗`;
          h3.append(titleLink);
          const excerpt = plain(post.excerpt).replace(/\s+/g, ' ');
          const summary = document.createElement('p');
          summary.textContent = excerpt.length > 170 ? excerpt.slice(0, 170).replace(/\s+\S*$/, '') + '…' : excerpt;
          const readLink = document.createElement('a');
          readLink.className = 'text-link'; readLink.href = url; readLink.target = '_blank'; readLink.rel = 'noopener noreferrer';
          readLink.textContent = 'Leer en el cuaderno de Naroa ↗';
          body.append(eyebrow, h3, summary, readLink); article.append(body);
          return article;
        });
        notebookGrid.replaceChildren(...cards);
      } catch {}
    }
    syncNotebook();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNotebook(); });
  }
  const detectAttribution = () => {
    let source = 'direct', generative = false;
    try {
      const params = new URLSearchParams(location.search);
      const utm = (params.get('utm_source') || params.get('ref') || params.get('source') || '').toLowerCase();
      const ref = (document.referrer || '').toLowerCase();
      const token = `${utm} ${ref}`;
      if (/chatgpt|openai/.test(token)) { source = 'chatgpt'; generative = true; }
      else if (/perplexity/.test(token)) { source = 'perplexity'; generative = true; }
      else if (/copilot|bing\.com\/chat/.test(token)) { source = 'copilot'; generative = true; }
      else if (/claude\.ai|anthropic/.test(token)) { source = 'claude'; generative = true; }
      else if (/gemini\.google|google\.com\/search\?.*udm=50/.test(token)) { source = 'google_ai'; generative = true; }
      else if (/google\.|bing\.|duckduckgo|ecosia|yahoo/.test(token)) { source = 'organic_search'; }
      else if (utm) { source = utm.slice(0, 24); }
      else if (ref && !ref.includes(location.hostname)) { source = 'referral'; }
    } catch {}
    try {
      if (source !== 'direct') sessionStorage.setItem('naroa-attribution', JSON.stringify({ source, generative }));
      else {
        const saved = JSON.parse(sessionStorage.getItem('naroa-attribution') || 'null');
        if (saved?.source) return saved;
      }
    } catch {}
    return { source, generative };
  };
  const attribution = detectAttribution();
  window.NAROA_ATTRIBUTION = attribution;

  const configurator = $('[data-commission-configurator]');
  let supportEl, motifEl, timingEl, updateLink = () => {};
  const commissionState = {
    backend: 'commission-atelier-configurator-v2',
    selectedSupport: 'Collage textil sobre madera',
    selectedMotif: 'Retrato individual',
    selectedTiming: 'Sin prisa (2 a 4 semanas)',
    seededFromUrl: false,
    seedSupport: null
  };
  if (configurator) {
    supportEl = $('#cfg-support');
    motifEl = $('#cfg-motif');
    timingEl = $('#cfg-timing');
    const btn = $('#cfg-whatsapp-btn');
    const emailBtn = $('#cfg-email-btn');
    const previewEl = $('#cfg-preview');
    const seedBanner = $('#cfg-seed-banner');
    const visualImg = $('#cfg-visual-img');
    const visualTitle = $('#cfg-visual-title');
    const visualTag = $('#cfg-visual-tag');
    const supportCards = $$('[data-support-card]');
    const compareRows = $$('[data-compare-support]');
    const pickBtns = $$('[data-pick-support]');
    const pillBtns = $$('[data-cfg-pill]', configurator);

    const supportVisualMap = {
      'Collage textil sobre madera': { slug: 'custom-jaio', title: 'Custom Jaio · Collage textil y madera', tag: 'Tela vaquera, costuras y dibujo' },
      'Caja personalizada u objeto': { slug: 'amor-en-conserva', title: 'Amor en Conserva · Caja de memoria 3D', tag: 'Objeto tridimensional intervenido' },
      'Pizarra natural rústica': { slug: 'amy-rocks', title: 'Amy Rocks · Pizarra natural y mica', tag: 'Piedra de cantera con escamas minerales' },
      'Retrato al óleo o grafito': { slug: 'rara-avis', title: 'Rara Avis · Pastel, grafito y lápiz', tag: 'Pastel Conté y collage sobre papel' },
      'Asesoramiento en estudio': { slug: 'el-armigo-atomico', title: 'El Armigo Atómico · Asesoramiento con Naroa', tag: 'Elección conjunta en el estudio de Bilbao' }
    };

    const syncActiveSupportUI = supportVal => {
      supportCards.forEach(card => {
        card.classList.toggle('is-selected-support', card.dataset.supportCard === supportVal);
      });
      compareRows.forEach(row => {
        row.classList.toggle('is-selected-support', row.dataset.compareSupport === supportVal);
      });
      pillBtns.forEach(pill => {
        const group = pill.dataset.cfgPill;
        const val = pill.dataset.cfgVal;
        if (group === 'support' && supportEl) pill.classList.toggle('is-active', val === supportEl.value);
        if (group === 'motif' && motifEl) pill.classList.toggle('is-active', val === motifEl.value);
        if (group === 'timing' && timingEl) pill.classList.toggle('is-active', val === timingEl.value);
      });
      const vMeta = supportVisualMap[supportVal] || supportVisualMap['Collage textil sobre madera'];
      const foundWork = projects.find(p => p.slug === vMeta.slug) || projects[0];
      if (visualImg && foundWork?.cover) visualImg.src = foundWork.cover;
      if (visualTitle) visualTitle.textContent = vMeta.title;
      if (visualTag) visualTag.textContent = vMeta.tag;
    };

    updateLink = () => {
      if (!supportEl || !motifEl || !timingEl || !btn) return;
      const s = supportEl.value;
      const m = motifEl.value;
      const t = timingEl.value;
      commissionState.selectedSupport = s;
      commissionState.selectedMotif = m;
      commissionState.selectedTiming = t;
      syncActiveSupportUI(s);
      const refSuffix = attribution.generative ? ` [vía ${attribution.source}]` : '';
      const msg = `Hola Naroa, me gustaría consultar un encargo de retrato sobre ${s} para ${m} con plazo ${t}.${refSuffix}`;
      if (previewEl) previewEl.textContent = msg;
      btn.href = `https://wa.me/34636060609?text=${encodeURIComponent(msg)}`;
      if (emailBtn) {
        emailBtn.href = `mailto:naroa@naroa.eu?subject=${encodeURIComponent('Consulta encargo: ' + s)}&body=${encodeURIComponent(msg)}`;
      }
    };

    const selectSupport = (targetSupport, fromSeed = false) => {
      if (!supportEl || !targetSupport) return false;
      const options = Array.from(supportEl.options);
      const exact = options.find(opt => opt.value.toLowerCase() === targetSupport.toLowerCase());
      const fuzzy = exact || options.find(opt =>
        opt.value.toLowerCase().includes(targetSupport.toLowerCase()) ||
        targetSupport.toLowerCase().includes(opt.value.toLowerCase())
      );
      if (!fuzzy) return false;
      supportEl.value = fuzzy.value;
      if (fromSeed) {
        commissionState.seededFromUrl = true;
        commissionState.seedSupport = fuzzy.value;
        if (seedBanner) {
          seedBanner.hidden = false;
          seedBanner.textContent = `✦ Soporte preseleccionado desde tu recorrido: ${fuzzy.value}`;
        }
      }
      updateLink();
      return true;
    };

    try {
      const params = new URLSearchParams(location.search);
      const urlSupport = params.get('soporte') || params.get('support');
      const urlMotif = params.get('motivo') || params.get('motif');
      if (urlMotif && motifEl) {
        const mOpt = Array.from(motifEl.options).find(o => o.value.toLowerCase().includes(urlMotif.toLowerCase()));
        if (mOpt) motifEl.value = mOpt.value;
      }
      if (urlSupport) {
        selectSupport(urlSupport, true);
      } else {
        updateLink();
      }
    } catch {
      updateLink();
    }

    pickBtns.forEach(pickBtn => {
      pickBtn.addEventListener('click', () => {
        const sup = pickBtn.dataset.pickSupport;
        if (selectSupport(sup, false)) {
          if (seedBanner) {
            seedBanner.hidden = false;
            seedBanner.textContent = `✦ Soporte elegido en el archivo: ${supportEl.value}`;
          }
          configurator.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        }
      });
    });

    compareRows.forEach(row => {
      row.addEventListener('click', () => {
        const sup = row.dataset.compareSupport;
        if (selectSupport(sup, false) && seedBanner) {
          seedBanner.hidden = false;
          seedBanner.textContent = `✦ Soporte seleccionado de la tabla técnica: ${supportEl.value}`;
        }
      });
    });

    pillBtns.forEach(pill => {
      pill.addEventListener('click', () => {
        const group = pill.dataset.cfgPill;
        const val = pill.dataset.cfgVal;
        if (group === 'support' && supportEl) supportEl.value = val;
        if (group === 'motif' && motifEl) motifEl.value = val;
        if (group === 'timing' && timingEl) timingEl.value = val;
        updateLink();
        window.NAROA_SOUND?.stencilRollerWipe?.(val);
      });
    });

    [supportEl, motifEl, timingEl].forEach(el => el?.addEventListener('change', updateLink));
    const mobileCta = $('[data-atelier-mobile-cta]');
    if (mobileCta && 'IntersectionObserver' in window) {
      const hideZones = [configurator, $('.atelier-hero')].filter(Boolean);
      const visible = new Set();
      const ctaObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target));
        mobileCta.classList.toggle('is-hidden', visible.size > 0);
      }, { threshold: 0.12 });
      hideZones.forEach(zone => ctaObserver.observe(zone));
    }
    window.NAROA_COMMISSION = {
      selectSupport,
      getState: () => ({ ...commissionState })
    };
  }
  const faqKnowledge = {
    precios: {
      intent: 'Precios y presupuestos de retratos por encargo',
      question: '¿Cuánto cuesta un retrato personalizado por encargo?',
      answer: 'Presupuesto cerrado previo por escrito según técnica, soporte y formato (piezas en madera, collage textil, pizarra natural o cajas de memoria). Valoración inicial de la idea sin compromiso.',
      canonical_url: 'https://naroagutierrezgil.com/retratos-por-encargo-bilbao/'
    },
    plazos: {
      intent: 'Plazos de ejecución y tiempos de secado',
      question: '¿Cuál es el plazo de entrega habitual?',
      answer: 'Entre 2 y 4 semanas según complejidad y tiempos de secado de óleos, acrílicos, barnices y fijación mineral. Modalidad prioritaria disponible para aniversarios o fechas señaladas con aviso previo.',
      canonical_url: 'https://naroagutierrezgil.com/retratos-por-encargo-bilbao/'
    },
    fotos: {
      intent: 'Proceso de encargo a partir de fotografías',
      question: '¿Cómo encargar un retrato personalizado a partir de fotografías?',
      answer: 'Se envían una o varias fotografías de referencia (incluso tomadas con el móvil) por WhatsApp o email; Naroa estudia el gesto y la historia para crear una reinterpretación artística de autor.',
      canonical_url: 'https://naroagutierrezgil.com/retratos-por-encargo-bilbao/'
    },
    soportes: {
      intent: 'Comparativa de soportes y técnicas plásticas',
      question: '¿Qué técnicas y soportes se pueden elegir para el encargo?',
      answer: 'Collage textil y dibujo a grafito/pastel sobre madera noble, cajas tridimensionales de memoria e intervención de objetos, retrato al óleo sobre tabla y pizarra natural de cantera con mica mineral.',
      canonical_url: 'https://naroagutierrezgil.com/retratos-por-encargo-bilbao/'
    },
    envios: {
      intent: 'Entrega local en Bilbao y envíos asegurados',
      question: '¿Dónde y cómo se entrega la obra?',
      answer: 'Entrega personal en mano en Bilbao y Bizkaia, o envío rígido protegido y asegurado a cualquier destino de España e internacional.',
      canonical_url: 'https://naroagutierrezgil.com/retratos-por-encargo-bilbao/'
    }
  };
  window.WebMCP = {
    manifestUrl: '/.well-known/mcp.json',
    callTool: async (name, params = {}) => {
      switch (name) {
        case 'search_catalogue': {
          const query = (params.query || '').toLowerCase().trim();
          const cat = params.category;
          const catalog = Array.isArray(window.NAROA_CATALOG) ? window.NAROA_CATALOG : (window.NAROA_CATALOG?.projects || []);
          return catalog.filter(p => {
            const matchCat = !cat || cat === 'all' || p.category === cat || (cat === 'Vaivenes' && p.series === 'Vaivenes');
            const matchQ = !query || [p.title, p.label, p.technique, p.support, p.story, p.materials].some(t => (t || '').toLowerCase().includes(query));
            return matchCat && matchQ;
          }).map(p => ({
            slug: p.slug,
            title: p.title,
            label: p.label,
            technique: p.technique,
            support: p.support,
            year: p.year,
            url: `/obra/${p.slug}/`
          }));
        }
        case 'get_artwork_details': {
          const slug = params.slug;
          const catalog = Array.isArray(window.NAROA_CATALOG) ? window.NAROA_CATALOG : (window.NAROA_CATALOG?.projects || []);
          const p = catalog.find(w => w.slug === slug);
          if (!p) throw new Error(`Artwork not found: ${slug}`);
          return p;
        }
        case 'configure_commission_inquiry': {
          const s = params.support || 'Collage textil sobre madera';
          const m = params.motif || 'Retrato individual';
          const t = params.timing || 'Sin prisa (2 a 4 semanas)';
          if (supportEl) { supportEl.value = s; }
          if (motifEl) { motifEl.value = m; }
          if (timingEl) { timingEl.value = t; }
          updateLink();
          const msg = `Hola Naroa, me gustaría consultar un encargo de retrato sobre ${s} para ${m} con plazo ${t}.`;
          return {
            support: s,
            motif: m,
            timing: t,
            message: msg,
            attribution: window.NAROA_ATTRIBUTION,
            whatsapp_url: `https://wa.me/34636060609?text=${encodeURIComponent(msg)}`,
            email_url: `mailto:naroa@naroa.eu?subject=${encodeURIComponent('Consulta encargo: ' + s)}&body=${encodeURIComponent(msg)}`
          };
        }
        case 'answer_commission_faq': {
          const topic = (params.topic || 'todos').toLowerCase();
          if (topic === 'todos' || !faqKnowledge[topic]) {
            return { topics: Object.values(faqKnowledge) };
          }
          return faqKnowledge[topic];
        }
        case 'get_artist_profile': {
          return {
            entity_id: 'https://naroagutierrezgil.com/#artist',
            studio_id: 'https://naroagutierrezgil.com/#studio',
            name: 'Naroa Gutiérrez Gil',
            role: 'Artista plástica y retratista',
            url: 'https://naroagutierrezgil.com/',
            location: 'Bilbao, Bizkaia, España',
            coordinates: { latitude: 43.2630, longitude: -2.9350 },
            contact: {
              email: 'naroa@naroa.eu',
              whatsapp: '+34636060609',
              inquiry_form: 'https://naroagutierrezgil.com/contacto/'
            },
            sameAs: [
              'https://www.facebook.com/naroa.artista.plastica',
              'https://instagram.com/naroa_art/',
              'https://naroagutierrez.wordpress.com/',
              'https://www.deia.eus/bizkaia/vida-social/2026/06/05/bwall-collective-inaugura-exposicion-ocho-11159371.html',
              'https://gara.naiz.eus/paperezkoa/20100305/186538/eu/Agenda',
              'https://agenda.elcorreo.com/evento/naroa-gutierrez-gil-espejos-del-alma-476343.html',
              'https://www.youtube.com/@naroagutierrezgil'
            ],
            specialty: 'Retratos de autor sobre pizarra natural, técnica mixta con mica mineral y collage textil sobre madera',
            exhibitions: [
              { year: 2026, title: 'BWALL Collective', venue: 'Colegio de Abogados de Bilbao', press: 'DEIA' },
              { year: 2018, title: 'Dock Bilbao Showcase', venue: 'Dock Bilbao' },
              { year: 2014, title: 'Politena Encuentros de Arte', venue: 'Politena Espacio de Arte, Bilbao' },
              { year: 2010, title: 'Espejos del alma', venue: 'Colegio de Abogados de Bilbao', press: 'GARA, El Correo' },
              { year: '2010+', title: 'Walking Gallery Bilbao', venue: 'Espacios públicos y galerías abiertas, Bilbao' }
            ]
          };
        }
        default:
          throw new Error(`Unknown WebMCP tool: ${name}`);
      }
    }
  };
  window.addEventListener('message', async (e) => {
    if (e.data && e.data.type === 'webmcp:call_tool' && e.data.tool) {
      try {
        const result = await window.WebMCP.callTool(e.data.tool, e.data.params);
        e.source?.postMessage({ type: 'webmcp:tool_result', id: e.data.id, result }, '*');
      } catch (err) {
        e.source?.postMessage({ type: 'webmcp:tool_error', id: e.data.id, error: err.message }, '*');
      }
    }
  });
  const reveals = $$('.chapter>div,.chapter>.eyebrow,.section-opening,.editorial blockquote,.timeline-entry,.notebook-posts article,.commission-example,.commission-steps article,.commission-configurator,.commission-faq-item,.closing,.contact-channel,.contact-details');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-revealed'); observer.unobserve(entry.target); }
    }), { threshold: .08, rootMargin: '0px 0px -24px 0px' });
    reveals.forEach(el => { el.classList.add('motion-reveal'); observer.observe(el); });
    reduced.addEventListener('change', () => { if (reduced.matches) reveals.forEach(el => el.classList.add('is-revealed')); });
  }
  const magnetTargets = $$('.art-arrows button,.hero-down,.art-story-link,.text-link,.art-index button,.share-btn,.ouroboros-loop-btn,.commission-cta-btn,.commission-pick-btn,.menu-index-pill');
  magnetTargets.forEach(el => {
    const m = { x: 0, y: 0, rot: 0, tx: 0, ty: 0, trot: 0, frame: null };
    function stepMagnet() {
      m.frame = null;
      const dx = m.tx - m.x;
      const dy = m.ty - m.y;
      const dr = m.trot - m.rot;
      if (Math.abs(dx) < 0.08 && Math.abs(dy) < 0.08 && Math.abs(dr) < 0.04) {
        m.x = m.tx;
        m.y = m.ty;
        m.rot = m.trot;
      } else {
        m.x += dx * 0.28;
        m.y += dy * 0.28;
        m.rot += dr * 0.28;
        m.frame = requestAnimationFrame(stepMagnet);
      }
      el.style.setProperty('--magnet-x', `${m.x.toFixed(2)}px`);
      el.style.setProperty('--magnet-y', `${m.y.toFixed(2)}px`);
      el.style.setProperty('--magnet-rot', `${m.rot.toFixed(2)}deg`);
    }
    el.addEventListener('pointermove', e => {
      if ((e.pointerType && e.pointerType !== 'mouse') || reduced.matches || el.disabled) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const ox = e.clientX - r.left - r.width / 2;
      const oy = e.clientY - r.top - r.height / 2;
      m.tx = clamp(ox * .18, -7.5, 7.5);
      m.ty = clamp(oy * .18, -7.5, 7.5);
      m.trot = clamp((ox / Math.max(24, r.width)) * 2.4, -2.2, 2.2);
      if (m.frame === null) m.frame = requestAnimationFrame(stepMagnet);
    }, { passive: true });
    const clear = () => {
      m.tx = 0; m.ty = 0; m.trot = 0;
      if (reduced.matches) {
        if (m.frame !== null) cancelAnimationFrame(m.frame);
        m.frame = null;
        m.x = m.y = m.rot = 0;
        el.style.setProperty('--magnet-x', '0px');
        el.style.setProperty('--magnet-y', '0px');
        el.style.setProperty('--magnet-rot', '0deg');
      } else if (m.frame === null && (m.x !== 0 || m.y !== 0 || m.rot !== 0)) {
        m.frame = requestAnimationFrame(stepMagnet);
      }
    };
    el.addEventListener('pointerleave', clear, { passive: true });
    el.addEventListener('blur', clear);
    reduced.addEventListener('change', clear);
  });

  const kineticCards = $$('.work-gallery-image,.notebook-posts article,.commission-example,.commission-steps article,.timeline-entry,.contact-channel');
  kineticCards.forEach(card => {
    card.setAttribute('data-kinetic-card', '');
    const c = { rx: 0, ry: 0, sx: 50, sy: 50, trx: 0, try: 0, tsx: 50, tsy: 50, frame: null };
    function stepCard() {
      c.frame = null;
      const drx = c.trx - c.rx;
      const dry = c.try - c.ry;
      const dsx = c.tsx - c.sx;
      const dsy = c.tsy - c.sy;
      if (Math.abs(drx) < 0.04 && Math.abs(dry) < 0.04 && Math.abs(dsx) < 0.2 && Math.abs(dsy) < 0.2) {
        c.rx = c.trx; c.ry = c.try; c.sx = c.tsx; c.sy = c.tsy;
      } else {
        c.rx += drx * 0.26;
        c.ry += dry * 0.26;
        c.sx += dsx * 0.26;
        c.sy += dsy * 0.26;
        c.frame = requestAnimationFrame(stepCard);
      }
      card.style.setProperty('--card-rx', `${c.rx.toFixed(2)}deg`);
      card.style.setProperty('--card-ry', `${c.ry.toFixed(2)}deg`);
      card.style.setProperty('--card-spot-x', `${c.sx.toFixed(1)}%`);
      card.style.setProperty('--card-spot-y', `${c.sy.toFixed(1)}%`);
    }
    card.addEventListener('pointermove', e => {
      if ((e.pointerType && e.pointerType !== 'mouse') || reduced.matches) return;
      const r = card.getBoundingClientRect();
      const w = r.width || 360;
      const h = r.height || 240;
      const nx = clamp((e.clientX - r.left) / w - 0.5, -0.5, 0.5) * 2;
      const ny = clamp((e.clientY - r.top) / h - 0.5, -0.5, 0.5) * 2;
      c.trx = clamp(-ny * 3.2, -3.5, 3.5);
      c.try = clamp(nx * 3.8, -4.0, 4.0);
      c.tsx = clamp((nx * 0.5 + 0.5) * 100, 0, 100);
      c.tsy = clamp((ny * 0.5 + 0.5) * 100, 0, 100);
      if (c.frame === null) c.frame = requestAnimationFrame(stepCard);
    }, { passive: true });
    const resetCard = () => {
      c.trx = 0; c.try = 0; c.tsx = 50; c.tsy = 50;
      if (c.frame === null && (c.rx !== 0 || c.ry !== 0)) c.frame = requestAnimationFrame(stepCard);
    };
    card.addEventListener('pointerleave', resetCard, { passive: true });
    card.addEventListener('blur', resetCard);
  });

  window.NAROA_KINETICS = {
    getState() {
      const st = $('[data-gallery]');
      return {
        backend: 'c5-substep-inertial-kinetics-v4',
        scrollFeel: 'critically-damped-substep-v4',
        substepScroll: true,
        holdOpticalBreath: Boolean(st),
        zeroScrollLock: true,
        microPan25D: Boolean(st),
        gyroPan3D: Boolean(st),
        indexGaussianWave: Boolean(st),
        magneticSpring: magnetTargets.length > 0,
        magneticCount: magnetTargets.length,
        cardTilt3D: kineticCards.length > 0,
        cardTiltCount: kineticCards.length,
        editorialInertialParallax: !st && $$('[data-parallax]').length > 0,
        holdProgress: st ? parseFloat(st.style.getPropertyValue('--hold-progress') || '0') : 0,
        scrollEnergy: st ? parseFloat(st.style.getPropertyValue('--scroll-energy') || '0') : 0,
        scrollVelocity: st ? parseFloat(st.style.getPropertyValue('--scroll-velocity') || '0') : 0,
        scrollAccel: st ? parseFloat(st.style.getPropertyValue('--scroll-accel') || '0') : 0,
        cameraTension: st ? parseFloat(st.style.getPropertyValue('--camera-tension') || '0') : 0,
        panX: st ? parseFloat(st.style.getPropertyValue('--pan-x') || '0') : 0,
        panY: st ? parseFloat(st.style.getPropertyValue('--pan-y') || '0') : 0,
        panRx: st ? parseFloat(st.style.getPropertyValue('--pan-rx') || '0') : 0,
        panRy: st ? parseFloat(st.style.getPropertyValue('--pan-ry') || '0') : 0
      };
    }
  };

  // ── 3. Simulación Euleriana de Fluidos Navier-Stokes y Advect-Curl (FBO Ping-Pong) ──
  (() => {
    if (typeof window === 'undefined' || !document.body) return;
    if (document.querySelector('[data-fluid-canvas]')) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'naroa-fluid-canvas';
    canvas.setAttribute('data-fluid-canvas', '');
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);

    // Paleta mineral de Naroa: Humo Plateado, Niebla de Mica, Vapor Etéreo y Luz Neutra de Pizarra (cero tonos amarillos)
    const PALETTE = [
      [0.88, 0.90, 0.94], // Humo etéreo plateado
      [0.75, 0.78, 0.84], // Niebla de mica sutil
      [0.94, 0.95, 0.98], // Vapor blanco etéreo
      [0.82, 0.85, 0.89]  // Luz de pizarra mineral neutra
    ];
    let paletteIdx = 0;

    const fluidState = {
      active: false,
      backend: 'eulerian-fbo-pingpong',
      simWidth: 128,
      simHeight: 128,
      dyeWidth: 512,
      dyeHeight: 512,
      curlStrength: 28.0,
      pressureIterations: 14,
      velocityDissipation: 0.975,
      dyeDissipation: 0.962,
      splatRadius: 0.0028,
      kineticEnergy: 0,
      vorticityPeak: 0,
      splatCount: 0,
      lastPointer: { x: 0.5, y: 0.5, vx: 0, vy: 0 }
    };

    let gl = null;
    let ext = null;
    let programs = null;
    let velocityFBO = null;
    let dyeFBO = null;
    let divergenceFBO = null;
    let curlFBO = null;
    let pressureFBO = null;
    let quadVBO = null;
    let rafId = null;
    let idleFrames = 0;

    function initWebGL() {
      try {
        const params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
        gl = canvas.getContext('webgl2', params);
        const isWebGL2 = !!gl;
        if (!isWebGL2) {
          gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);
        }
        if (!gl) return false;

        let halfFloatTexType;
        let formatRGBA;
        let formatRG;
        let formatR;

        if (isWebGL2) {
          gl.getExtension('EXT_color_buffer_float');
          const linearSupport = gl.getExtension('OES_texture_float_linear');
          halfFloatTexType = gl.HALF_FLOAT;
          formatRGBA = getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType);
          formatRG = getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType);
          formatR = getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType);
          ext = { formatRGBA, formatRG, formatR, halfFloatTexType, supportLinearFiltering: !!linearSupport };
        } else {
          const halfFloat = gl.getExtension('OES_texture_half_float');
          const linearSupport = gl.getExtension('OES_texture_half_float_linear');
          if (!halfFloat) return false;
          halfFloatTexType = halfFloat.HALF_FLOAT_OES;
          formatRGBA = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
          formatRG = formatRGBA;
          formatR = formatRGBA;
          ext = { formatRGBA, formatRG, formatR, halfFloatTexType, supportLinearFiltering: !!linearSupport };
        }
        if (!ext.formatRGBA) return false;

        const baseVS = `
          precision highp float;
          attribute vec2 aPosition;
          varying vec2 vUv;
          varying vec2 vL;
          varying vec2 vR;
          varying vec2 vT;
          varying vec2 vB;
          uniform vec2 texelSize;
          void main () {
            vUv = aPosition * 0.5 + 0.5;
            vL = vUv - vec2(texelSize.x, 0.0);
            vR = vUv + vec2(texelSize.x, 0.0);
            vT = vUv + vec2(0.0, texelSize.y);
            vB = vUv - vec2(0.0, texelSize.y);
            gl_Position = vec4(aPosition, 0.0, 1.0);
          }
        `;

        const clearFS = `
          precision mediump float;
          precision mediump sampler2D;
          varying highp vec2 vUv;
          uniform sampler2D uTexture;
          uniform float value;
          void main () {
            gl_FragColor = value * texture2D(uTexture, vUv);
          }
        `;

        const splatFS = `
          precision highp float;
          precision highp sampler2D;
          varying vec2 vUv;
          uniform sampler2D uTarget;
          uniform float aspectRatio;
          uniform vec3 color;
          uniform vec2 point;
          uniform float radius;
          void main () {
            vec2 p = vUv - point.xy;
            p.x *= aspectRatio;
            vec3 splat = exp(-dot(p, p) / radius) * color;
            vec3 base = texture2D(uTarget, vUv).xyz;
            gl_FragColor = vec4(base + splat, 1.0);
          }
        `;

        const advectionFS = `
          precision highp float;
          precision highp sampler2D;
          varying vec2 vUv;
          uniform sampler2D uVelocity;
          uniform sampler2D uSource;
          uniform vec2 texelSize;
          uniform float dt;
          uniform float dissipation;
          void main () {
            vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
            gl_FragColor = dissipation * texture2D(uSource, coord);
          }
        `;

        const divergenceFS = `
          precision mediump float;
          precision mediump sampler2D;
          varying highp vec2 vUv;
          varying highp vec2 vL;
          varying highp vec2 vR;
          varying highp vec2 vT;
          varying highp vec2 vB;
          uniform sampler2D uVelocity;
          void main () {
            float L = texture2D(uVelocity, vL).x;
            float R = texture2D(uVelocity, vR).x;
            float T = texture2D(uVelocity, vT).y;
            float B = texture2D(uVelocity, vB).y;
            vec2 C = texture2D(uVelocity, vUv).xy;
            if (vL.x < 0.0) { L = -C.x; }
            if (vR.x > 1.0) { R = -C.x; }
            if (vT.y > 1.0) { T = -C.y; }
            if (vB.y < 0.0) { B = -C.y; }
            float div = 0.5 * (R - L + T - B);
            gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
          }
        `;

        const curlFS = `
          precision mediump float;
          precision mediump sampler2D;
          varying highp vec2 vUv;
          varying highp vec2 vL;
          varying highp vec2 vR;
          varying highp vec2 vT;
          varying highp vec2 vB;
          uniform sampler2D uVelocity;
          void main () {
            float L = texture2D(uVelocity, vL).y;
            float R = texture2D(uVelocity, vR).y;
            float T = texture2D(uVelocity, vT).x;
            float B = texture2D(uVelocity, vB).x;
            float vorticity = R - L - T + B;
            gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
          }
        `;

        const vorticityFS = `
          precision highp float;
          precision highp sampler2D;
          varying vec2 vUv;
          varying vec2 vL;
          varying vec2 vR;
          varying vec2 vT;
          varying vec2 vB;
          uniform sampler2D uVelocity;
          uniform sampler2D uCurl;
          uniform float curl;
          uniform float dt;
          void main () {
            float L = texture2D(uCurl, vL).x;
            float R = texture2D(uCurl, vR).x;
            float T = texture2D(uCurl, vT).x;
            float B = texture2D(uCurl, vB).x;
            float C = texture2D(uCurl, vUv).x;
            vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
            force /= length(force) + 0.0001;
            force *= curl * C;
            force.y *= -1.0;
            vec2 vel = texture2D(uVelocity, vUv).xy;
            gl_FragColor = vec4(vel + force * dt, 0.0, 1.0);
          }
        `;

        const pressureFS = `
          precision mediump float;
          precision mediump sampler2D;
          varying highp vec2 vUv;
          varying highp vec2 vL;
          varying highp vec2 vR;
          varying highp vec2 vT;
          varying highp vec2 vB;
          uniform sampler2D uPressure;
          uniform sampler2D uDivergence;
          void main () {
            float L = texture2D(uPressure, vL).x;
            float R = texture2D(uPressure, vR).x;
            float T = texture2D(uPressure, vT).x;
            float B = texture2D(uPressure, vB).x;
            float divergence = texture2D(uDivergence, vUv).x;
            float pressure = (L + R + B + T - divergence) * 0.25;
            gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
          }
        `;

        const gradSubtractFS = `
          precision mediump float;
          precision mediump sampler2D;
          varying highp vec2 vUv;
          varying highp vec2 vL;
          varying highp vec2 vR;
          varying highp vec2 vT;
          varying highp vec2 vB;
          uniform sampler2D uPressure;
          uniform sampler2D uVelocity;
          void main () {
            float L = texture2D(uPressure, vL).x;
            float R = texture2D(uPressure, vR).x;
            float T = texture2D(uPressure, vT).x;
            float B = texture2D(uPressure, vB).x;
            vec2 velocity = texture2D(uVelocity, vUv).xy;
            velocity.xy -= vec2(R - L, T - B);
            gl_FragColor = vec4(velocity, 0.0, 1.0);
          }
        `;

        // Shader de visualización con relieve especular de mercurio/mica y dispersión cromática sutil
        const displayFS = `
          precision highp float;
          precision highp sampler2D;
          varying vec2 vUv;
          varying vec2 vL;
          varying vec2 vR;
          varying vec2 vT;
          varying vec2 vB;
          uniform sampler2D uTexture;
          void main () {
            vec3 c = texture2D(uTexture, vUv).rgb;
            vec3 l = texture2D(uTexture, vL).rgb;
            vec3 r = texture2D(uTexture, vR).rgb;
            vec3 t = texture2D(uTexture, vT).rgb;
            vec3 b = texture2D(uTexture, vB).rgb;
            float dx = length(r) - length(l);
            float dy = length(t) - length(b);
            vec3 normal = normalize(vec3(-dx * 4.5, -dy * 4.5, 1.0));
            vec3 lightDir = normalize(vec3(0.35, 0.45, 0.82));
            float spec = pow(max(dot(normal, lightDir), 0.0), 18.0) * 0.38;
            vec3 finalColor = c + vec3(spec * 0.95, spec * 0.86, spec * 0.65);
            float alpha = clamp(max(max(finalColor.r, finalColor.g), finalColor.b) * 0.85, 0.0, 0.82);
            gl_FragColor = vec4(finalColor, alpha);
          }
        `;

        programs = {
          clear: createProgram(gl, baseVS, clearFS),
          splat: createProgram(gl, baseVS, splatFS),
          advection: createProgram(gl, baseVS, advectionFS),
          divergence: createProgram(gl, baseVS, divergenceFS),
          curl: createProgram(gl, baseVS, curlFS),
          vorticity: createProgram(gl, baseVS, vorticityFS),
          pressure: createProgram(gl, baseVS, pressureFS),
          gradSubtract: createProgram(gl, baseVS, gradSubtractFS),
          display: createProgram(gl, baseVS, displayFS)
        };

        quadVBO = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
        const ibo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);

        initFramebuffers();
        fluidState.active = true;
        return true;
      } catch {
        return false;
      }
    }

    function getSupportedFormat(glCtx, internalFormat, format, type) {
      if (!supportRenderTextureFormat(glCtx, internalFormat, format, type)) {
        if (internalFormat === glCtx.R16F) return getSupportedFormat(glCtx, glCtx.RG16F, glCtx.RG, type);
        if (internalFormat === glCtx.RG16F) return getSupportedFormat(glCtx, glCtx.RGBA16F, glCtx.RGBA, type);
        return null;
      }
      return { internalFormat, format };
    }

    function supportRenderTextureFormat(glCtx, internalFormat, format, type) {
      const texture = glCtx.createTexture();
      glCtx.bindTexture(glCtx.TEXTURE_2D, texture);
      glCtx.texParameteri(glCtx.TEXTURE_2D, glCtx.TEXTURE_MIN_FILTER, glCtx.NEAREST);
      glCtx.texParameteri(glCtx.TEXTURE_2D, glCtx.TEXTURE_MAG_FILTER, glCtx.NEAREST);
      glCtx.texParameteri(glCtx.TEXTURE_2D, glCtx.TEXTURE_WRAP_S, glCtx.CLAMP_TO_EDGE);
      glCtx.texParameteri(glCtx.TEXTURE_2D, glCtx.TEXTURE_WRAP_T, glCtx.CLAMP_TO_EDGE);
      glCtx.texImage2D(glCtx.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
      const fbo = glCtx.createFramebuffer();
      glCtx.bindFramebuffer(glCtx.FRAMEBUFFER, fbo);
      glCtx.framebufferTexture2D(glCtx.FRAMEBUFFER, glCtx.COLOR_ATTACHMENT0, glCtx.TEXTURE_2D, texture, 0);
      const status = glCtx.checkFramebufferStatus(glCtx.FRAMEBUFFER);
      glCtx.deleteFramebuffer(fbo);
      glCtx.deleteTexture(texture);
      return status === glCtx.FRAMEBUFFER_COMPLETE;
    }

    function compileShader(glCtx, type, source) {
      const shader = glCtx.createShader(type);
      glCtx.shaderSource(shader, source);
      glCtx.compileShader(shader);
      return shader;
    }

    function createProgram(glCtx, vsSource, fsSource) {
      const program = glCtx.createProgram();
      const vs = compileShader(glCtx, glCtx.VERTEX_SHADER, vsSource);
      const fs = compileShader(glCtx, glCtx.FRAGMENT_SHADER, fsSource);
      glCtx.attachShader(program, vs);
      glCtx.attachShader(program, fs);
      glCtx.bindAttribLocation(program, 0, 'aPosition');
      glCtx.linkProgram(program);
      const uniforms = {};
      const count = glCtx.getProgramParameter(program, glCtx.ACTIVE_UNIFORMS);
      for (let i = 0; i < count; i++) {
        const name = glCtx.getActiveUniform(program, i).name;
        uniforms[name] = glCtx.getUniformLocation(program, name);
      }
      return { program, uniforms, bind() { glCtx.useProgram(program); } };
    }

    function createFBO(w, h, internalFormat, format, type, param) {
      gl.activeTexture(gl.TEXTURE0);
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return {
        texture, fbo, width: w, height: h,
        texelSizeX: 1.0 / w, texelSizeY: 1.0 / h,
        attach(id) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, texture); return id; }
      };
    }

    function createDoubleFBO(w, h, internalFormat, format, type, param) {
      let fbo1 = createFBO(w, h, internalFormat, format, type, param);
      let fbo2 = createFBO(w, h, internalFormat, format, type, param);
      return {
        width: w, height: h,
        texelSizeX: fbo1.texelSizeX, texelSizeY: fbo1.texelSizeY,
        get read() { return fbo1; },
        set read(v) { fbo1 = v; },
        get write() { return fbo2; },
        set write(v) { fbo2 = v; },
        swap() { const temp = fbo1; fbo1 = fbo2; fbo2 = temp; }
      };
    }

    function initFramebuffers() {
      const w = innerWidth || 1280;
      const h = innerHeight || 800;
      canvas.width = w;
      canvas.height = h;
      const aspect = w / Math.max(1, h);
      const simW = aspect >= 1 ? Math.round(128 * aspect) : 128;
      const simH = aspect >= 1 ? 128 : Math.round(128 / aspect);
      const dyeW = aspect >= 1 ? Math.round(512 * aspect) : 512;
      const dyeH = aspect >= 1 ? 512 : Math.round(512 / aspect);
      fluidState.simWidth = simW;
      fluidState.simHeight = simH;
      fluidState.dyeWidth = dyeW;
      fluidState.dyeHeight = dyeH;

      const texType = ext.halfFloatTexType;
      const rgba = ext.formatRGBA;
      const rg = ext.formatRG;
      const r = ext.formatR;
      const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

      velocityFBO = createDoubleFBO(simW, simH, rg.internalFormat, rg.format, texType, filtering);
      dyeFBO = createDoubleFBO(dyeW, dyeH, rgba.internalFormat, rgba.format, texType, filtering);
      divergenceFBO = createFBO(simW, simH, r.internalFormat, r.format, texType, gl.NEAREST);
      curlFBO = createFBO(simW, simH, r.internalFormat, r.format, texType, gl.NEAREST);
      pressureFBO = createDoubleFBO(simW, simH, r.internalFormat, r.format, texType, gl.NEAREST);
    }

    function blit(target) {
      if (target == null) {
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      } else {
        gl.viewport(0, 0, target.width, target.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      }
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }

    function splat(x, y, dx, dy, customColor) {
      if (reduced.matches) return;
      const c = customColor || PALETTE[paletteIdx++ % PALETTE.length];
      const speed = Math.hypot(dx, dy);
      fluidState.kineticEnergy = Math.min(1.0, fluidState.kineticEnergy * 0.7 + Math.min(speed / 900, 1.0) * 0.65);
      fluidState.vorticityPeak = Math.min(1.0, fluidState.kineticEnergy * 1.15);
      fluidState.splatCount++;
      fluidState.lastPointer = { x, y, vx: dx, vy: dy };
      idleFrames = 0;

      // Acoplar viscosidad y vorticidad al escenario activo (deformación sutil del lienzo)
      if (stage) {
        stage.style.setProperty('--fluid-vorticity', fluidState.vorticityPeak.toFixed(4));
        stage.style.setProperty('--fluid-vx', clamp(dx * 0.008, -6, 6).toFixed(2) + 'px');
        stage.style.setProperty('--fluid-vy', clamp(dy * 0.008, -6, 6).toFixed(2) + 'px');
      }

      if (!gl || !programs) return;
      const aspect = canvas.width / Math.max(1, canvas.height);
      programs.splat.bind();
      gl.uniform1i(programs.splat.uniforms.uTarget, velocityFBO.read.attach(0));
      gl.uniform1f(programs.splat.uniforms.aspectRatio, aspect);
      gl.uniform2f(programs.splat.uniforms.point, x, y);
      gl.uniform3f(programs.splat.uniforms.color, dx, dy, 0.0);
      gl.uniform1f(programs.splat.uniforms.radius, fluidState.splatRadius);
      blit(velocityFBO.write);
      velocityFBO.swap();

      gl.uniform1i(programs.splat.uniforms.uTarget, dyeFBO.read.attach(0));
      const intensity = Math.min(1.15, Math.max(0.28, speed / 550));
      gl.uniform3f(programs.splat.uniforms.color, c[0] * intensity, c[1] * intensity, c[2] * intensity);
      blit(dyeFBO.write);
      dyeFBO.swap();

      scheduleFluidStep();
    }

    function stepFluid() {
      rafId = null;
      if (reduced.matches) {
        fluidState.kineticEnergy = 0;
        fluidState.vorticityPeak = 0;
        return;
      }
      fluidState.kineticEnergy *= 0.94;
      fluidState.vorticityPeak *= 0.93;
      if (stage) {
        stage.style.setProperty('--fluid-vorticity', fluidState.vorticityPeak.toFixed(4));
      }

      if (gl && programs) {
        const dt = 0.016;
        gl.disable(gl.BLEND);

        // 1. Curl (Vorticidad: rotacional del campo de velocidades)
        programs.curl.bind();
        gl.uniform2f(programs.curl.uniforms.texelSize, velocityFBO.texelSizeX, velocityFBO.texelSizeY);
        gl.uniform1i(programs.curl.uniforms.uVelocity, velocityFBO.read.attach(0));
        blit(curlFBO);

        // 2. Vorticity Confinement (Inyección de turbulencia espiral Advect-Curl)
        programs.vorticity.bind();
        gl.uniform2f(programs.vorticity.uniforms.texelSize, velocityFBO.texelSizeX, velocityFBO.texelSizeY);
        gl.uniform1i(programs.vorticity.uniforms.uVelocity, velocityFBO.read.attach(0));
        gl.uniform1i(programs.vorticity.uniforms.uCurl, curlFBO.attach(1));
        gl.uniform1f(programs.vorticity.uniforms.curl, fluidState.curlStrength);
        gl.uniform1f(programs.vorticity.uniforms.dt, dt);
        blit(velocityFBO.write);
        velocityFBO.swap();

        // 3. Divergence (Divergencia Euleriana)
        programs.divergence.bind();
        gl.uniform2f(programs.divergence.uniforms.texelSize, velocityFBO.texelSizeX, velocityFBO.texelSizeY);
        gl.uniform1i(programs.divergence.uniforms.uVelocity, velocityFBO.read.attach(0));
        blit(divergenceFBO);

        // 4. Atenuación previa del campo de presión
        programs.clear.bind();
        gl.uniform1i(programs.clear.uniforms.uTexture, pressureFBO.read.attach(0));
        gl.uniform1f(programs.clear.uniforms.value, 0.80);
        blit(pressureFBO.write);
        pressureFBO.swap();

        // 5. Solver iterativo de Jacobi para la ecuación de Poisson de presión
        programs.pressure.bind();
        gl.uniform2f(programs.pressure.uniforms.texelSize, velocityFBO.texelSizeX, velocityFBO.texelSizeY);
        gl.uniform1i(programs.pressure.uniforms.uDivergence, divergenceFBO.attach(0));
        for (let i = 0; i < fluidState.pressureIterations; i++) {
          gl.uniform1i(programs.pressure.uniforms.uPressure, pressureFBO.read.attach(1));
          blit(pressureFBO.write);
          pressureFBO.swap();
        }

        // 6. Sustracción del gradiente de presión (Proyección de Helmholtz-Hodge libre de divergencia)
        programs.gradSubtract.bind();
        gl.uniform2f(programs.gradSubtract.uniforms.texelSize, velocityFBO.texelSizeX, velocityFBO.texelSizeY);
        gl.uniform1i(programs.gradSubtract.uniforms.uPressure, pressureFBO.read.attach(0));
        gl.uniform1i(programs.gradSubtract.uniforms.uVelocity, velocityFBO.read.attach(1));
        blit(velocityFBO.write);
        velocityFBO.swap();

        // 7. Advección semi-Lagrangiana del campo de velocidades
        programs.advection.bind();
        gl.uniform2f(programs.advection.uniforms.texelSize, velocityFBO.texelSizeX, velocityFBO.texelSizeY);
        gl.uniform1i(programs.advection.uniforms.uVelocity, velocityFBO.read.attach(0));
        gl.uniform1i(programs.advection.uniforms.uSource, velocityFBO.read.attach(0));
        gl.uniform1f(programs.advection.uniforms.dt, dt);
        gl.uniform1f(programs.advection.uniforms.dissipation, fluidState.velocityDissipation);
        blit(velocityFBO.write);
        velocityFBO.swap();

        // 8. Advección del pigmento mineral / tinta sobre el campo de velocidades
        gl.uniform2f(programs.advection.uniforms.texelSize, dyeFBO.texelSizeX, dyeFBO.texelSizeY);
        gl.uniform1i(programs.advection.uniforms.uVelocity, velocityFBO.read.attach(0));
        gl.uniform1i(programs.advection.uniforms.uSource, dyeFBO.read.attach(1));
        gl.uniform1f(programs.advection.uniforms.dissipation, fluidState.dyeDissipation);
        blit(dyeFBO.write);
        dyeFBO.swap();

        // 9. Renderizado final con iluminación especular de normales en pantalla
        programs.display.bind();
        gl.uniform2f(programs.display.uniforms.texelSize, 1.0 / Math.max(1, canvas.width), 1.0 / Math.max(1, canvas.height));
        gl.uniform1i(programs.display.uniforms.uTexture, dyeFBO.read.attach(0));
        blit(null);
      }

      idleFrames++;
      const maxIdle = gl ? 180 : 12;
      if (idleFrames < maxIdle || (gl && fluidState.kineticEnergy > 0.002)) {
        scheduleFluidStep();
      }
    }

    function scheduleFluidStep() {
      if (rafId === null && !reduced.matches) {
        rafId = requestAnimationFrame(stepFluid);
      }
    }

    initWebGL();

    let prevX = -1, prevY = -1;
    addEventListener('pointermove', e => {
      if (reduced.matches) return;
      const w = innerWidth || 1280;
      const h = innerHeight || 800;
      const x = e.clientX / w;
      const y = 1.0 - e.clientY / h;
      if (prevX < 0) {
        prevX = x;
        prevY = y;
        return;
      }
      const dx = (x - prevX) * w * 6.5;
      const dy = (y - prevY) * h * 6.5;
      prevX = x;
      prevY = y;
      if (Math.hypot(dx, dy) > 0.25) {
        splat(x, y, dx, dy);
      }
    }, { passive: true });

    addEventListener('pointerdown', e => {
      if (reduced.matches) return;
      const w = innerWidth || 1280;
      const h = innerHeight || 800;
      const x = e.clientX / w;
      const y = 1.0 - e.clientY / h;
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2 + Math.random() * 0.5;
        splat(x, y, Math.cos(angle) * 320, Math.sin(angle) * 320);
      }
    }, { passive: true });

    addEventListener('resize', () => {
      if (gl) initFramebuffers();
    }, { passive: true });

    window.NAROA_FLUID = {
      splat,
      getState: () => ({ ...fluidState }),
      pulseCenter: () => {
        splat(0.5, 0.5, 420, 260, PALETTE[0]);
        splat(0.5, 0.5, -380, -240, PALETTE[1]);
      }
    };
  })();

  // ── 7. Cámaras en Spline 3D con Inversión de Ejes y «Portal Scrollytelling» (Catmull-Rom 3D + Secondary RenderTarget FBO) ──
  (() => {
    if (document.querySelector('[data-portal-canvas]')) return;

    const portalCanvas = document.createElement('canvas');
    portalCanvas.className = 'naroa-portal-canvas';
    portalCanvas.setAttribute('data-portal-canvas', '');
    portalCanvas.setAttribute('aria-hidden', 'true');
    (stage || document.body).appendChild(portalCanvas);

    // Construcción de los nodos 3D de la curva Catmull-Rom centrípeta a través de las cámaras de resonancia
    const catalogProjects = Array.isArray(catalogue.projects) && catalogue.projects.length ? catalogue.projects : [{ slug: 'origin' }];
    const numChambers = catalogProjects.length;
    const WAYPOINTS = [];
    for (let i = 0; i < numChambers; i++) {
      const theta = (i / numChambers) * Math.PI * 2;
      const radius = 18.0 + (i % 2 === 0 ? 2.4 : -2.1);
      const x = Math.sin(theta) * radius;
      const y = Math.cos(theta * 2.0) * 3.2 + (i % 3 - 1) * 1.15;
      const z = -i * 6.5 + Math.cos(theta) * 4.2;
      WAYPOINTS.push({ x, y, z, slug: catalogProjects[i].slug, chamberIndex: i });
    }

    // Interpolador cúbico de Catmull-Rom 3D (tensión 0.5) y derivada tangencial analítica
    function catmullRomScalar(p0, p1, p2, p3, t) {
      const t2 = t * t;
      const t3 = t2 * t;
      return 0.5 * (
        (2 * p1) +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t3
      );
    }

    function catmullRomDerivative(p0, p1, p2, p3, t) {
      const t2 = t * t;
      return 0.5 * (
        (-p0 + p2) +
        2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * t +
        3 * (-p0 + 3 * p1 - 3 * p2 + p3) * t2
      );
    }

    function evaluateAt(uRaw) {
      const n = WAYPOINTS.length;
      const u = ((uRaw % 1) + 1) % 1;
      const scaled = u * n;
      const seg = Math.floor(scaled) % n;
      const localT = scaled - Math.floor(scaled);

      const p0 = WAYPOINTS[(seg - 1 + n) % n];
      const p1 = WAYPOINTS[seg];
      const p2 = WAYPOINTS[(seg + 1) % n];
      const p3 = WAYPOINTS[(seg + 2) % n];

      const x = catmullRomScalar(p0.x, p1.x, p2.x, p3.x, localT);
      const y = catmullRomScalar(p0.y, p1.y, p2.y, p3.y, localT);
      const z = catmullRomScalar(p0.z, p1.z, p2.z, p3.z, localT);

      const dx = catmullRomDerivative(p0.x, p1.x, p2.x, p3.x, localT);
      const dy = catmullRomDerivative(p0.y, p1.y, p2.y, p3.y, localT);
      const dz = catmullRomDerivative(p0.z, p1.z, p2.z, p3.z, localT);
      const len = Math.hypot(dx, dy, dz) || 1;
      const tx = dx / len, ty = dy / len, tz = dz / len;

      // Inversión de ejes: el desplazamiento vertical invierte pitch/yaw en el umbral del portal y genera alabeo (roll)
      const portalWave = Math.sin(localT * Math.PI);
      const axisInversion = Number((Math.cos(localT * Math.PI * 2) * -1).toFixed(4));
      const yaw = Number((Math.atan2(tx, -tz) * (180 / Math.PI)).toFixed(3));
      const pitch = Number((-Math.asin(clamp(ty, -1, 1)) * (180 / Math.PI) * axisInversion).toFixed(3));
      const roll = Number((tx * -14.5 * portalWave).toFixed(3));
      const portalAperture = Number(Math.pow(portalWave, 1.35).toFixed(4));

      return {
        u: Number(u.toFixed(6)),
        chamberIndex: seg,
        chamberSlug: p1.slug,
        nextChamberSlug: p2.slug,
        position: { x: Number(x.toFixed(3)), y: Number(y.toFixed(3)), z: Number(z.toFixed(3)) },
        tangent: { x: Number(tx.toFixed(4)), y: Number(ty.toFixed(4)), z: Number(tz.toFixed(4)) },
        euler: { pitch, yaw, roll },
        axisInversion,
        portalAperture
      };
    }

    const portalState = {
      backend: 'catmull-rom-3d-portal-fbo',
      waypointCount: WAYPOINTS.length,
      u: 0,
      targetU: 0,
      velocityU: 0,
      portalTargetSize: 512,
      portalFrameCount: 0,
      hasSecondaryRenderTarget: false,
      pose: evaluateAt(0)
    };

    let glPortal = null;
    let portalFBO = null;
    let portalSceneProgram = null;
    let portalCompositeProgram = null;
    let portalRaf = null;

    function initPortalWebGL() {
      try {
        if (typeof window === 'undefined' || !window.WebGLRenderingContext) return false;
        const params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
        glPortal = portalCanvas.getContext('webgl2', params) || portalCanvas.getContext('webgl', params);
        if (!glPortal) return false;

        const vs = `
          attribute vec2 aPos;
          varying vec2 vUv;
          void main() {
            vUv = aPos * 0.5 + 0.5;
            gl_Position = vec4(aPos, 0.0, 1.0);
          }
        `;

        // Pase 1 (Secondary RenderTarget FBO): Neutralizado (Cero halos o velos cromáticos superpuestos)
        const innerWorldFS = `
          precision highp float;
          void main() {
            gl_FragColor = vec4(0.0);
          }
        `;

        // Pase 2 (Composite): Neutralizado (Transparencia absoluta para preservar la pureza de la obra)
        const compositeFS = `
          precision highp float;
          void main() {
            gl_FragColor = vec4(0.0);
          }
        `;

        const compile = (type, src) => {
          const sh = glPortal.createShader(type);
          glPortal.shaderSource(sh, src);
          glPortal.compileShader(sh);
          return sh;
        };
        const link = (fsSrc) => {
          const prog = glPortal.createProgram();
          glPortal.attachShader(prog, compile(glPortal.VERTEX_SHADER, vs));
          glPortal.attachShader(prog, compile(glPortal.FRAGMENT_SHADER, fsSrc));
          glPortal.bindAttribLocation(prog, 0, 'aPos');
          glPortal.linkProgram(prog);
          return prog;
        };

        portalSceneProgram = link(innerWorldFS);
        portalCompositeProgram = link(compositeFS);

        const buf = glPortal.createBuffer();
        glPortal.bindBuffer(glPortal.ARRAY_BUFFER, buf);
        glPortal.bufferData(glPortal.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), glPortal.STATIC_DRAW);
        glPortal.enableVertexAttribArray(0);
        glPortal.vertexAttribPointer(0, 2, glPortal.FLOAT, false, 0, 0);

        // Creación del RenderTarget secundario (512x512 FBO)
        const tex = glPortal.createTexture();
        glPortal.bindTexture(glPortal.TEXTURE_2D, tex);
        glPortal.texParameteri(glPortal.TEXTURE_2D, glPortal.TEXTURE_MIN_FILTER, glPortal.LINEAR);
        glPortal.texParameteri(glPortal.TEXTURE_2D, glPortal.TEXTURE_MAG_FILTER, glPortal.LINEAR);
        glPortal.texParameteri(glPortal.TEXTURE_2D, glPortal.TEXTURE_WRAP_S, glPortal.CLAMP_TO_EDGE);
        glPortal.texParameteri(glPortal.TEXTURE_2D, glPortal.TEXTURE_WRAP_T, glPortal.CLAMP_TO_EDGE);
        glPortal.texImage2D(glPortal.TEXTURE_2D, 0, glPortal.RGBA, 512, 512, 0, glPortal.RGBA, glPortal.UNSIGNED_BYTE, null);

        const fbo = glPortal.createFramebuffer();
        glPortal.bindFramebuffer(glPortal.FRAMEBUFFER, fbo);
        glPortal.framebufferTexture2D(glPortal.FRAMEBUFFER, glPortal.COLOR_ATTACHMENT0, glPortal.TEXTURE_2D, tex, 0);
        glPortal.bindFramebuffer(glPortal.FRAMEBUFFER, null);

        portalFBO = { fbo, texture: tex, size: 512 };
        portalState.hasSecondaryRenderTarget = true;
        portalCanvas.width = innerWidth || 1280;
        portalCanvas.height = innerHeight || 800;
        return true;
      } catch {
        return false;
      }
    }

    function applySplinePoseToStage(pose) {
      portalState.pose = pose;
      portalState.portalFrameCount++;
      const targetEl = stage || document.documentElement;
      targetEl.style.setProperty('--spline-u', String(pose.u));
      targetEl.style.setProperty('--spline-x', `${pose.position.x}px`);
      targetEl.style.setProperty('--spline-y', `${pose.position.y}px`);
      targetEl.style.setProperty('--spline-z', `${pose.position.z}px`);
      targetEl.style.setProperty('--spline-pitch', `${pose.euler.pitch}deg`);
      targetEl.style.setProperty('--spline-yaw', `${pose.euler.yaw}deg`);
      targetEl.style.setProperty('--spline-roll', `${pose.euler.roll}deg`);
      targetEl.style.setProperty('--portal-aperture', String(pose.portalAperture));
      targetEl.style.setProperty('--axis-inversion', String(pose.axisInversion));

      if (glPortal && portalFBO && portalSceneProgram && portalCompositeProgram && !reduced.matches) {
        // Halos eliminados: cero dibujo WebGL superpuesto para pureza matérica absoluta y 0% GPU
      }
    }

    // Ley 1 & 2 & 4 (INV_C5_SCROLL_SUBSTEP_DYNAMICS): Sub-step inertial follow (alpha = 0.16) y reposo a 0% CPU
    function stepSplineRig() {
      portalRaf = null;
      const delta = portalState.targetU - portalState.u;
      if (reduced.matches || Math.abs(delta) < 0.00015) {
        portalState.u = portalState.targetU;
        portalState.velocityU = 0;
        applySplinePoseToStage(evaluateAt(portalState.u));
        return;
      }
      const step = delta * 0.16;
      portalState.u += step;
      portalState.velocityU = Number(step.toFixed(6));
      applySplinePoseToStage(evaluateAt(portalState.u));
      portalRaf = requestAnimationFrame(stepSplineRig);
    }

    function scheduleSplineRig() {
      if (portalRaf === null) {
        portalRaf = requestAnimationFrame(stepSplineRig);
      }
    }

    function pushWheel(deltaY = 100, deltaX = 0) {
      // Inversión de ejes: el impulso vertical/horizontal empuja el rig a lo largo de la curva Catmull-Rom 3D
      const dominant = Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : -deltaX;
      const stepU = dominant * 0.00065;
      portalState.targetU = ((portalState.targetU + stepU) % 1 + 1) % 1;
      if (reduced.matches) {
        portalState.u = portalState.targetU;
        applySplinePoseToStage(evaluateAt(portalState.u));
      } else {
        scheduleSplineRig();
      }
      return portalState.pose;
    }

    initPortalWebGL();
    applySplinePoseToStage(evaluateAt(0));

    addEventListener('wheel', e => {
      pushWheel(e.deltaY, e.deltaX);
    }, { passive: true });

    addEventListener('scroll', () => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      portalState.targetU = clamp(scrollY / maxScroll, 0, 1);
      scheduleSplineRig();
    }, { passive: true });

    addEventListener('resize', () => {
      if (glPortal) {
        portalCanvas.width = innerWidth || 1280;
        portalCanvas.height = innerHeight || 800;
      }
    }, { passive: true });

    window.NAROA_SPLINE_PORTAL = {
      evaluateAt,
      pushWheel,
      stepFrame: stepSplineRig,
      getState: () => ({
        ...portalState,
        pose: { ...portalState.pose }
      })
    };

    // V2 (#1): Lente de «Liquid Glass» Refractiva con Dispersión Cromática (IOR)
    if (!document.querySelector('[data-liquid-lens]')) {
      const lens = document.createElement('div');
      lens.className = 'naroa-liquid-lens';
      lens.setAttribute('data-liquid-lens', '');
      lens.setAttribute('aria-hidden', 'true');
      document.body.appendChild(lens);
      const lensState = { x: -200, y: -200, tx: -200, ty: -200, ior: 1.48, dispersion: 0.032, active: false, raf: null };
      function stepLens() {
        lensState.raf = null;
        if (reduced.matches) return;
        const dx = lensState.tx - lensState.x;
        const dy = lensState.ty - lensState.y;
        lensState.x += dx * 0.22;
        lensState.y += dy * 0.22;
        const stretch = clamp(Math.hypot(dx, dy) * 0.004, 0, 0.16);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        lens.style.transform = `translate3d(${(lensState.x - 42).toFixed(1)}px,${(lensState.y - 42).toFixed(1)}px,0) rotate(${angle.toFixed(1)}deg) scale(${(1 + stretch).toFixed(3)},${(1 - stretch * 0.5).toFixed(3)})`;
        if (Math.hypot(dx, dy) > 0.35 && window.WebGLRenderingContext) {
          lensState.raf = requestAnimationFrame(stepLens);
        }
      }
      addEventListener('pointermove', e => {
        if (reduced.matches || e.pointerType === 'touch') return;
        lensState.tx = e.clientX;
        lensState.ty = e.clientY;
        if (!lensState.active) {
          lensState.x = e.clientX;
          lensState.y = e.clientY;
          lensState.active = true;
          lens.classList.add('is-active');
        }
        const target = e.target;
        const isInteractive = target?.closest?.('a,button,summary,[data-open-photos],[data-open-story]');
        lens.classList.toggle('is-interactive', Boolean(isInteractive));
        stepLens();
      }, { passive: true });
      window.NAROA_LIQUID_LENS = {
        getState: () => ({ ...lensState })
      };
    }
  })();

  if (location.hash === '#indice') openDialog('#index-dialog');
})();
