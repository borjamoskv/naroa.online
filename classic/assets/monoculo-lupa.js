/* ════════════════════════════════════════════════════════════════════════════
   MONÓCULO LUPA MACRO 4K — classic/assets/monoculo-lupa.js (v2 Hyper-Realistic)
   Estándar C5-REAL · Cero Dependencias · Pure Vanilla JS
   ════════════════════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  // ── 1. CONFIGURACIÓN Y CONSTANTES FÍSICAS ──
  const NATURAL_HERO_W = 2201;
  const NATURAL_HERO_H = 3468;
  const MONOCLE_HERO_U = 0.6180; // Coordenada horizontal en retrato (61.80%)
  const MONOCLE_HERO_V = 0.3915; // Coordenada vertical en retrato (39.15%)

  const state = {
    active: false,
    docked: true,
    zoom: 3.0,
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    targetX: 0,
    targetY: 0,
    vx: 0,
    vy: 0,
    isDragging: false,
    activeTarget: null,
    currentMaterialZone: null,
    heroPos: { x: 0, y: 0, size: 92 },
    rafId: null,
    lastFrictionTime: 0,
    lastDialTime: 0
  };

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // ── 2. MOTOR ACÚSTICO ANALÓGICO CÁLIDO (INV_WARMTH_ACOUSTIC_GATE) ──
  class MonocleAcousticEngine {
    constructor() {
      this.ctx = null;
    }

    init() {
      if (this.ctx) return;
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.ctx = new AudioContext();
        }
      } catch (_) {}
    }

    playPickup() {
      if (!this.ctx || reducedMotion.matches) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(520, t);
      filter.Q.setValueAtTime(0.5, t);

      // Descenso cálido: Mi4 (329.63Hz) a La3 (220Hz)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(329.63, t);
      osc.frequency.exponentialRampToValueAtTime(220.0, t + 0.28);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.09, t + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.34);
    }

    playTextureFriction(material = 'general', speed = 1.0) {
      if (!this.ctx || reducedMotion.matches) return;
      const now = performance.now();
      if (now - state.lastFrictionTime < 90) return;
      state.lastFrictionTime = now;

      if (this.ctx.state === 'suspended') this.ctx.resume();
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      let freq = 146.83; // Re3 por defecto
      let cutoff = 360;
      let amp = Math.min(0.045, 0.015 + speed * 0.02);

      if (material === 'metal') {
        freq = 196.00; // Sol3 cálido de campana sorda
        cutoff = 460;
        amp *= 1.1;
      } else if (material === 'feather') {
        freq = 130.81; // Do3 ultra-grave de seda
        cutoff = 260;
        amp *= 0.85;
      } else if (material === 'mica') {
        freq = 246.94; // Si3 mineral sutil
        cutoff = 520;
        amp *= 0.95;
      }

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(cutoff, t);
      filter.Q.setValueAtTime(0.35, t);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.linearRampToValueAtTime(freq * 1.08, t + 0.08);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(amp, t + 0.022);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.12);
    }

    playDialClick() {
      if (!this.ctx || reducedMotion.matches) return;
      const now = performance.now();
      if (now - state.lastDialTime < 75) return;
      state.lastDialTime = now;

      if (this.ctx.state === 'suspended') this.ctx.resume();
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(640, t);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(349.23, t); // Fa4 relojero

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.04, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.07);
    }

    playZoom(level) {
      if (!this.ctx || reducedMotion.matches) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(680, t);

      osc.type = 'sine';
      const f = level > 3.8 ? 440.0 : level > 2.5 ? 369.99 : 293.66;
      osc.frequency.setValueAtTime(f, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.06, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.24);
    }

    playDock() {
      if (!this.ctx || reducedMotion.matches) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(420, t);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(220.0, t);
      osc.frequency.exponentialRampToValueAtTime(146.83, t + 0.35);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.45);
    }
  }

  const acoustics = new MonocleAcousticEngine();

  // ── 3. CONSTRUCCIÓN DE LA ARQUITECTURA DOM ──
  function setupDOM() {
    const hero = document.querySelector('.artist-hero');
    const heroImg = hero?.querySelector('img');
    if (!hero || !heroImg) return null;

    // A) Hotspot en el Hero
    const hotspot = document.createElement('div');
    hotspot.className = 'monocle-hero-hotspot';
    hotspot.setAttribute('role', 'button');
    hotspot.setAttribute('tabindex', '0');
    hotspot.setAttribute('aria-label', 'Desacoplar Monóculo Lupa Macro 4K para examinar texturas');
    hotspot.innerHTML = `
      <div class="monocle-hero-ring"></div>
      <div class="monocle-hero-glare"></div>
      <span class="monocle-hero-badge">Monóculo Macro 4K · Arrastra o pulsa</span>
    `;
    hero.appendChild(hotspot);

    // B) Lienzo SVG de la Cadena de Oro y Latón
    const chainSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chainSvg.setAttribute('class', 'monocle-chain-canvas');
    chainSvg.setAttribute('aria-hidden', 'true');
    chainSvg.innerHTML = `
      <defs>
        <linearGradient id="monocle-chain-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#8c7850" />
          <stop offset="40%" stop-color="#d4af37" />
          <stop offset="70%" stop-color="#f7d594" />
          <stop offset="100%" stop-color="#6b5530" />
        </linearGradient>
      </defs>
      <path class="monocle-chain-glow" d="" />
      <path class="monocle-chain-path" d="" />
    `;
    document.body.appendChild(chainSvg);

    // C) Monóculo Flotante Desacoplado
    const loupe = document.createElement('div');
    loupe.className = 'monocle-loupe';
    loupe.id = 'monocle-loupe';
    loupe.setAttribute('role', 'region');
    loupe.setAttribute('aria-label', 'Lupa Monóculo Macro 4K');
    loupe.innerHTML = `
      <div class="monocle-frame">
        <div class="monocle-rim"></div>
        <div class="monocle-glass">
          <div class="monocle-lens-surface"></div>
          <div class="monocle-vignette"></div>
          <div class="monocle-glare"></div>
          <div class="monocle-reticle"></div>
        </div>
        <div class="monocle-stem">
          <div class="monocle-stem-grip"></div>
          <div class="monocle-stem-ring"></div>
        </div>
      </div>
      <div class="monocle-hud">
        <div class="monocle-hud-header">
          <span class="monocle-hud-tag">4K MACRO</span>
          <span class="monocle-hud-zoom">3.0×</span>
        </div>
        <div class="monocle-hud-title">Examinando detalle matérico</div>
        <div class="monocle-hud-detail">Arrastra sobre cualquier obra · Rueda ratón para zoom</div>
        <div class="monocle-hud-actions">
          <button type="button" class="monocle-btn-zoom" data-zoom="2.0">2.0×</button>
          <button type="button" class="monocle-btn-zoom is-active" data-zoom="3.0">3.0×</button>
          <button type="button" class="monocle-btn-zoom" data-zoom="4.5">4.5×</button>
          <button type="button" class="monocle-btn-dock" aria-label="Acoplar monóculo de vuelta al retrato">✕ Acoplar</button>
        </div>
      </div>
    `;
    document.body.appendChild(loupe);

    // D) Barra Dock Inferior
    const dockBar = document.createElement('div');
    dockBar.className = 'monocle-dock-bar';
    dockBar.innerHTML = `
      <div class="monocle-dock-info">
        <span>◎</span>
        <span>Monóculo <strong>Activo</strong> · Arrastra sobre las obras</span>
        <span class="monocle-dock-hint">(Rueda: zoom · Esc: acoplar)</span>
      </div>
      <button type="button" class="monocle-dock-dock-btn" aria-label="Volver a acoplar al retrato">Volver al retrato ✕</button>
    `;
    document.body.appendChild(dockBar);

    return { hero, heroImg, hotspot, loupe, dockBar, chainSvg };
  }

  // ── 4. MAPEO MICRO-MATÉRICO CONTEXTUAL ──
  function getMaterialProbe(slug, u, v) {
    if (slug === 'amor-en-conserva') {
      if (u <= 0.36 || u >= 0.88 || v <= 0.16 || v >= 0.84) {
        return {
          title: 'Amor en Conserva',
          detail: 'Filo de hojalata y remaches · Chapa de conserva plegada',
          material: 'metal'
        };
      }
      if (v >= 0.58) {
        return {
          title: 'Amor en Conserva',
          detail: 'Barniz y óxido mineral · Pátina de protección dammar',
          material: 'metal'
        };
      }
      return {
        title: 'Amor en Conserva',
        detail: 'Retratos en miniatura · Fotografía emulsionada al óleo',
        material: 'paper'
      };
    }

    if (slug === 'rara-avis') {
      if (u <= 0.42 && v <= 0.48) {
        return {
          title: 'Rara Avis',
          detail: 'Pluma de pavo real · Bárbula y refracción iridiscente',
          material: 'feather'
        };
      }
      if (v >= 0.72 || u >= 0.82) {
        return {
          title: 'Rara Avis',
          detail: 'Láminas de mica y marco · Textura cristalina estratificada',
          material: 'mica'
        };
      }
      return {
        title: 'Rara Avis',
        detail: 'Autorretrato en espejo · Pastel graso y carboncillo difuminado',
        material: 'pastel'
      };
    }

    if (slug === 'naroa-hero') {
      if (u >= 0.54 && u <= 0.72 && v >= 0.33 && v <= 0.46) {
        return {
          title: 'Naroa Gutiérrez Gil',
          detail: 'El Monóculo Original · Cristal de aumento y montura de latón (2015)',
          material: 'mica'
        };
      }
      if (v <= 0.32) {
        return {
          title: 'Naroa Gutiérrez Gil',
          detail: 'Chistera de taller · Fieltro oscuro de época y costuras',
          material: 'feather'
        };
      }
      return {
        title: 'Naroa Gutiérrez Gil',
        detail: 'Retrato inaugural · Luz natural de taller bilbaíno',
        material: 'general'
      };
    }

    return null;
  }

  // ── 5. REGISTRO Y RECOPILACIÓN DE OBJETIVOS MATÉRICOS ──
  function getInspectableTargets() {
    const targets = [];

    // 1. Retrato inaugural Hero
    const heroImg = document.querySelector('.artist-hero img');
    if (heroImg) {
      targets.push({
        element: heroImg,
        slug: 'naroa-hero',
        title: 'Naroa Gutiérrez Gil',
        detail: 'Chistera, monóculo de latón y mirada de taller (2015)',
        src4k: '/images/sobre-mi/naroa-monoculo.jpg',
        naturalWidth: 2201,
        naturalHeight: 3468
      });
    }

    // 2. Obras en .artist-wide
    const wideFigures = document.querySelectorAll('.artist-wide');
    wideFigures.forEach(fig => {
      const img = fig.querySelector('img');
      if (!img) return;

      const isAmor = img.src.includes('amor-en-conserva') || fig.getAttribute('data-macro-target') === 'amor-en-conserva';
      const isRaraAvis = img.src.includes('rara-avis') || fig.getAttribute('data-macro-target') === 'rara-avis';

      if (isAmor) {
        targets.push({
          element: img,
          slug: 'amor-en-conserva',
          title: 'Amor en Conserva',
          detail: 'Hojalata de conserva, fotografía intervenida y barniz mineral',
          src4k: '/images/catalogo/amor-en-conserva-4k.webp',
          naturalWidth: 3840,
          naturalHeight: 2160
        });
      } else if (isRaraAvis) {
        targets.push({
          element: img,
          slug: 'rara-avis',
          title: 'Rara Avis',
          detail: 'Pluma de pavo real, pastel graso, collage y mica natural',
          src4k: '/images/catalogo/rara-avis-original-4080.jpg',
          naturalWidth: 4080,
          naturalHeight: 3072
        });
      } else {
        targets.push({
          element: img,
          slug: img.alt || 'obra-materica',
          title: fig.querySelector('figcaption span')?.textContent || 'Obra matérica',
          detail: 'Superficie artística y textura original',
          src4k: img.src,
          naturalWidth: img.naturalWidth || 2048,
          naturalHeight: img.naturalHeight || 1536
        });
      }
    });

    // 3. Fotos y Polaroids del Cuaderno Facsímil
    const notebookPhotos = document.querySelectorAll('.notebook-photo img');
    notebookPhotos.forEach(img => {
      targets.push({
        element: img,
        slug: img.alt || 'bitacora-taller',
        title: img.alt || 'Bitácora de Taller',
        detail: 'Polaroid de taller · Registro de proceso y prueba de color',
        src4k: img.src,
        naturalWidth: img.naturalWidth || 1080,
        naturalHeight: img.naturalHeight || 1080
      });
    });

    return targets;
  }

  // ── 6. CÁLCULO DE POSICIÓN DEL HOTSPOT EN EL HERO ──
  function updateHeroHotspot(hero, heroImg, hotspot) {
    if (!hero || !heroImg || !hotspot) return;

    const rect = hero.getBoundingClientRect();
    const heroW = rect.width;
    const heroH = rect.height;
    if (!heroW || !heroH) return;

    const isMobile = window.innerWidth <= 760;
    const objPosX = isMobile ? 0.49 : 0.50;
    const objPosY = isMobile ? 0.30 : 0.34;

    const scale = Math.max(heroW / NATURAL_HERO_W, heroH / NATURAL_HERO_H);
    const renderedW = NATURAL_HERO_W * scale;
    const renderedH = NATURAL_HERO_H * scale;

    const imgLeft = (heroW - renderedW) * objPosX;
    const imgTop = (heroH - renderedH) * objPosY;

    const monocleX = imgLeft + renderedW * MONOCLE_HERO_U;
    const monocleY = imgTop + renderedH * MONOCLE_HERO_V;
    const size = Math.round(Math.max(76, Math.min(108, 92 * (renderedW / NATURAL_HERO_W))));

    hotspot.style.left = `${monocleX}px`;
    hotspot.style.top = `${monocleY}px`;
    hotspot.style.width = `${size}px`;
    hotspot.style.height = `${size}px`;

    state.heroPos = {
      x: rect.left + monocleX,
      y: rect.top + monocleY,
      size
    };
  }

  // ── 7. ACTUALIZACIÓN DE LA CADENA FÍSICA (CATENARIA SVG) ──
  function updateChain(chainSvg, anchorX, anchorY, loupeX, loupeY) {
    if (!chainSvg || reducedMotion.matches) return;
    const path = chainSvg.querySelector('.monocle-chain-path');
    const glow = chainSvg.querySelector('.monocle-chain-glow');
    if (!path || !glow) return;

    // Conectar el anclaje del hero con el asa inferior del monóculo
    const p1x = anchorX;
    const p1y = anchorY;
    const p2x = loupeX + 24;
    const p2y = loupeY + 70;

    const dx = p2x - p1x;
    const dy = p2y - p1y;
    const dist = Math.hypot(dx, dy);

    // Caída / catenaria por gravedad
    const sag = Math.min(220, Math.max(45, dist * 0.28 + 35));
    const cx = (p1x + p2x) * 0.5;
    const cy = Math.max(p1y, p2y) + sag;

    const d = `M ${p1x.toFixed(1)},${p1y.toFixed(1)} Q ${cx.toFixed(1)},${cy.toFixed(1)} ${p2x.toFixed(1)},${p2y.toFixed(1)}`;
    path.setAttribute('d', d);
    glow.setAttribute('d', d);
  }

  // ── 8. CONTROLADOR PRINCIPAL DEL MONÓCULO ──
  function initMonocle() {
    const dom = setupDOM();
    if (!dom) return;

    const { hero, heroImg, hotspot, loupe, dockBar, chainSvg } = dom;
    const lensSurface = loupe.querySelector('.monocle-lens-surface');
    const glare = loupe.querySelector('.monocle-glare');
    const hudTitle = loupe.querySelector('.monocle-hud-title');
    const hudDetail = loupe.querySelector('.monocle-hud-detail');
    const hudZoom = loupe.querySelector('.monocle-hud-zoom');
    const zoomButtons = loupe.querySelectorAll('.monocle-btn-zoom');
    const dockButtons = [
      loupe.querySelector('.monocle-btn-dock'),
      dockBar.querySelector('.monocle-dock-dock-btn')
    ];

    let targets = getInspectableTargets();

    // Precarga de activos 4K
    targets.forEach(t => {
      const preload = new Image();
      preload.src = t.src4k;
    });

    function refreshGeometry() {
      updateHeroHotspot(hero, heroImg, hotspot);
      targets = getInspectableTargets();
    }

    const resizeObserver = new ResizeObserver(refreshGeometry);
    resizeObserver.observe(hero);
    window.addEventListener('resize', refreshGeometry, { passive: true });
    window.addEventListener('scroll', refreshGeometry, { passive: true });
    heroImg.addEventListener('load', refreshGeometry);
    refreshGeometry();

    // ── GESTIÓN DE ESTADO (ACTIVAR / DESACOPLAR / ACOPLAR) ──
    function activateMonocle(startX, startY) {
      acoustics.init();
      acoustics.playPickup();
      if (navigator.vibrate) navigator.vibrate(8);

      state.active = true;
      state.docked = false;
      document.body.classList.add('monocle-active');

      state.targetX = startX || window.innerWidth / 2;
      state.targetY = startY || window.innerHeight / 2;
      state.x = state.targetX;
      state.y = state.targetY;
      state.prevX = state.x;
      state.prevY = state.y;

      loupe.style.left = `${state.x}px`;
      loupe.style.top = `${state.y}px`;

      startRenderLoop();
    }

    function dockMonocle() {
      if (!state.active) return;
      acoustics.playDock();

      state.active = false;
      state.docked = true;
      state.isDragging = false;
      document.body.classList.remove('monocle-active');

      refreshGeometry();
      state.targetX = state.heroPos.x;
      state.targetY = state.heroPos.y;

      loupe.style.left = `${state.targetX}px`;
      loupe.style.top = `${state.targetY}px`;

      if (state.rafId) {
        cancelAnimationFrame(state.rafId);
        state.rafId = null;
      }
    }

    function setZoom(newZoom, fromWheel = false) {
      const clamped = Math.max(1.5, Math.min(5.5, parseFloat(newZoom)));
      state.zoom = clamped;
      if (fromWheel) acoustics.playDialClick();
      else acoustics.playZoom(state.zoom);

      hudZoom.textContent = `${state.zoom.toFixed(1)}×`;

      zoomButtons.forEach(btn => {
        const val = parseFloat(btn.dataset.zoom);
        btn.classList.toggle('is-active', Math.abs(val - state.zoom) < 0.25);
      });
    }

    // ── BUCLE DE RENDERIZADO CINEMÁTICO EN SILICIO ──
    function renderLoop() {
      if (!state.active) return;

      const lerp = reducedMotion.matches ? 1.0 : 0.24;
      const dx = state.targetX - state.x;
      const dy = state.targetY - state.y;
      state.vx = dx * lerp;
      state.vy = dy * lerp;
      state.x += state.vx;
      state.y += state.vy;

      loupe.style.left = `${state.x.toFixed(2)}px`;
      loupe.style.top = `${state.y.toFixed(2)}px`;

      // Reflejo especular dinámico que se desplaza ante la aceleración
      if (glare && !reducedMotion.matches) {
        const glareDx = Math.max(-12, Math.min(12, -state.vx * 0.4));
        const glareDy = Math.max(-12, Math.min(12, -state.vy * 0.4));
        glare.style.transform = `rotate(-25deg) translate(${glareDx.toFixed(1)}px, ${glareDy.toFixed(1)}px)`;
      }

      // Cadena de oro y latón
      refreshGeometry();
      updateChain(chainSvg, state.heroPos.x, state.heroPos.y, state.x, state.y);

      const speed = Math.hypot(dx, dy);

      // Detección de colisión óptica
      let matchingTarget = null;
      for (const t of targets) {
        const r = t.element.getBoundingClientRect();
        const margin = 20;
        if (
          state.x >= r.left - margin &&
          state.x <= r.right + margin &&
          state.y >= r.top - margin &&
          state.y <= r.bottom + margin
        ) {
          matchingTarget = { target: t, rect: r };
          break;
        }
      }

      if (matchingTarget) {
        const { target, rect } = matchingTarget;
        const normX = Math.max(0, Math.min(1, (state.x - rect.left) / Math.max(1, rect.width)));
        const normY = Math.max(0, Math.min(1, (state.y - rect.top) / Math.max(1, rect.height)));

        const loupeSize = loupe.offsetWidth || 226;
        const bgW = rect.width * state.zoom;
        const bgH = rect.height * state.zoom;

        const bgPosX = loupeSize * 0.5 - normX * bgW;
        const bgPosY = loupeSize * 0.5 - normY * bgH;

        lensSurface.style.backgroundImage = `url("${target.src4k}")`;
        lensSurface.style.backgroundSize = `${bgW.toFixed(1)}px ${bgH.toFixed(1)}px`;
        lensSurface.style.backgroundPosition = `${bgPosX.toFixed(1)}px ${bgPosY.toFixed(1)}px`;

        // Sondeo micro-matérico contextual
        const probe = getMaterialProbe(target.slug, normX, normY);
        const titleText = probe?.title || target.title;
        const detailText = probe?.detail || target.detail;
        const material = probe?.material || 'general';

        if (state.currentMaterialZone !== detailText) {
          state.currentMaterialZone = detailText;
          hudTitle.textContent = titleText;
          hudDetail.textContent = detailText;
          if (navigator.vibrate) navigator.vibrate(6);
        }

        if (speed > 1.2) {
          acoustics.playTextureFriction(material, speed);
        }
      } else {
        if (state.activeTarget !== 'vacio') {
          state.activeTarget = 'vacio';
          state.currentMaterialZone = 'vacio';
          hudTitle.textContent = 'Monóculo 4K Móvil';
          hudDetail.textContent = 'Acércalo a una obra para examinar su relieve matérico';
        }
      }

      state.rafId = requestAnimationFrame(renderLoop);
    }

    function startRenderLoop() {
      if (!state.rafId) {
        state.rafId = requestAnimationFrame(renderLoop);
      }
    }

    // ── GESTIÓN DE EVENTOS DE PUNTERO (POINTER & TOUCH) ──
    hotspot.addEventListener('pointerdown', e => {
      e.preventDefault();
      activateMonocle(e.clientX, e.clientY);
      state.isDragging = true;
      loupe.setPointerCapture?.(e.pointerId);
    });

    hotspot.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activateMonocle(state.heroPos.x, state.heroPos.y);
      }
    });

    const frame = loupe.querySelector('.monocle-frame');
    frame.addEventListener('pointerdown', e => {
      e.preventDefault();
      state.isDragging = true;
      loupe.setPointerCapture?.(e.pointerId);
    });

    window.addEventListener('pointermove', e => {
      if (!state.active) return;
      state.targetX = e.clientX;
      state.targetY = e.clientY;
    }, { passive: true });

    window.addEventListener('pointerup', () => {
      state.isDragging = false;
    }, { passive: true });

    window.addEventListener('pointercancel', () => {
      state.isDragging = false;
    }, { passive: true });

    // ── ZOOM CONTINUO CON RUEDA DEL RATÓN (WHEEL ZOOM) ──
    window.addEventListener('wheel', e => {
      if (!state.active) return;
      const isOverLoupe = e.target.closest('#monocle-loupe');
      if (isOverLoupe || state.isDragging) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.25 : -0.25;
        setZoom(state.zoom + delta, true);
      }
    }, { passive: false });

    // ── BOTONES DE ZOOM Y CIERRE ──
    zoomButtons.forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        setZoom(btn.dataset.zoom);
      });
    });

    dockButtons.forEach(btn => {
      btn?.addEventListener('click', e => {
        e.stopPropagation();
        dockMonocle();
      });
    });

    // ── BOTONES DISPARADORES EN LAS OBRAS (INSPECCIÓN 4K) ──
    document.querySelectorAll('.monocle-trigger-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        const targetSlug = btn.getAttribute('data-macro-target');
        const target = targets.find(t => t.slug === targetSlug) || targets[1];
        if (target) {
          const rect = target.element.getBoundingClientRect();
          activateMonocle(rect.left + rect.width * 0.5, rect.top + rect.height * 0.5);
          target.element.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        } else {
          activateMonocle(window.innerWidth / 2, window.innerHeight / 2);
        }
      });
    });

    // ── ACCESIBILIDAD POR TECLADO ──
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && state.active) {
        dockMonocle();
      } else if ((e.key === 'm' || e.key === 'M') && !e.target.closest('input, textarea')) {
        if (state.active) dockMonocle();
        else activateMonocle(state.heroPos.x, state.heroPos.y);
      } else if (state.active && (e.key === '1' || e.key === '2' || e.key === '3')) {
        const zooms = { '1': 2.0, '2': 3.0, '3': 4.5 };
        setZoom(zooms[e.key]);
      } else if (state.active && (e.key === '+' || e.key === '=')) {
        setZoom(state.zoom + 0.5);
      } else if (state.active && e.key === '-') {
        setZoom(state.zoom - 0.5);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMonocle);
  } else {
    initMonocle();
  }
})();
