/* ════════════════════════════════════════════════════════════════════════════
   CARTOGRAFÍA SONORA WALKING GALLERY — classic/assets/walking-map.js
   Estándar C5-REAL · Síntesis Acústica Cálida de Ría y Ciudad
   ════════════════════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  const STOPS = [
    {
      id: 'guggenheim',
      year: '2022',
      title: 'Geisha sobre Pizarra',
      location: 'Abandoibarra · Junto al Guggenheim',
      story: 'Caminando con la pizarra a pulso frente a la ría. El titanio del museo como telón de fondo para el arte directo.',
      image: '/images/artworks/geisha-MfRtKWdu.webp',
      x: 180,
      y: 110,
      soundFreq: 220.0, // La3 cálido
      soundDesc: 'Murmullo de marea y ría (220 Hz)'
    },
    {
      id: 'granvia',
      year: '2021',
      title: 'Celia Cruz Cantinflowers',
      location: 'Gran Vía & Moyúa · Fair Saturday',
      story: 'La fiesta del color irrumpiendo en el asfalto comercial de Bilbao. Detener el paso para mirar un rostro.',
      image: '/images/artworks/celia-cruz-cantinflowers-DO-SRKMB.webp',
      x: 320,
      y: 195,
      soundFreq: 293.66, // Re4
      soundDesc: 'Campanilla templada urbana (294 Hz)'
    },
    {
      id: 'plazanueva',
      year: '2017',
      title: 'Paul Newmum',
      location: 'Plaza Nueva · Casco Viejo',
      story: 'VI Aniversario de la Walking Gallery. Entre los soportales de piedra de sillería y el murmullo de los cafés.',
      image: '/images/artworks/paul_newmum_1783824262669.webp',
      x: 480,
      y: 150,
      soundFreq: 196.00, // Sol3
      soundDesc: 'Eco de piedra y campana lejana (196 Hz)'
    },
    {
      id: 'ribera',
      year: '2013',
      title: 'Summer Monroe',
      location: 'Muelle de la Ribera · San Antón',
      story: 'Edición inaugural. El arte saliendo del taller para bajar a la ribera donde Bilbao fundó su historia.',
      image: '/images/artworks/summer_monroe_1783824308258.webp',
      x: 580,
      y: 220,
      soundFreq: 146.83, // Re3
      soundDesc: 'Resonancia profunda fluvial (147 Hz)'
    }
  ];

  let activeIndex = 0;
  let audioCtx = null;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function initAudio() {
    if (audioCtx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    } catch (_) {}
  }

  function playStopSound(freq) {
    if (reducedMotion.matches) return;
    initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, t);
    filter.Q.setValueAtTime(0.4, t);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.linearRampToValueAtTime(freq * 0.98, t + 0.35);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.08, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(t);
    osc.stop(t + 0.48);
  }

  function renderStop(index, container) {
    activeIndex = index;
    const stop = STOPS[index];
    if (!stop) return;

    // Actualizar nodos SVG
    container.querySelectorAll('.map-node').forEach((node, i) => {
      node.classList.toggle('is-active', i === index);
      node.setAttribute('aria-pressed', String(i === index));
    });

    // Actualizar botones de navegación
    container.querySelectorAll('.walking-nav-btn').forEach((btn, i) => {
      btn.classList.toggle('is-active', i === index);
    });

    // Actualizar panel de detalle
    const badge = container.querySelector('.walking-detail-badge');
    const soundStatus = container.querySelector('.walking-detail-sound-status');
    const thumbImg = container.querySelector('.walking-detail-thumb img');
    const title = container.querySelector('.walking-detail-texts h4');
    const location = container.querySelector('.walking-detail-location');
    const story = container.querySelector('.walking-detail-story');

    if (badge) badge.textContent = `Edición ${stop.year}`;
    if (soundStatus) soundStatus.innerHTML = `<span>♪</span> ${stop.soundDesc}`;
    if (thumbImg) {
      thumbImg.src = stop.image;
      thumbImg.alt = stop.title;
    }
    if (title) title.textContent = stop.title;
    if (location) location.textContent = stop.location;
    if (story) story.textContent = stop.story;

    playStopSound(stop.soundFreq);
    if (navigator.vibrate) navigator.vibrate(6);
  }

  function initWalkingMap() {
    const section = document.querySelector('.walking-map-section');
    if (!section) return;

    // Conectar eventos en los nodos SVG
    section.querySelectorAll('.map-node').forEach((node, idx) => {
      node.addEventListener('click', () => renderStop(idx, section));
      node.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          renderStop(idx, section);
        }
      });
    });

    // Conectar botones de navegación inferior
    section.querySelectorAll('.walking-nav-btn').forEach((btn, idx) => {
      btn.addEventListener('click', () => renderStop(idx, section));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWalkingMap);
  } else {
    initWalkingMap();
  }
})();
