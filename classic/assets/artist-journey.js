/* Native vertical scrolling carries the gaze into the monocle, then across two works. */
(() => {
  'use strict';
  const profile = document.querySelector('.artist-profile');
  if (!profile) return;
  const portrait = profile.querySelector('.artist-hero');
  const photo = portrait.querySelector('img');
  const quote = profile.querySelector('.artist-quote');
  const works = [...profile.querySelectorAll('.artist-wide')];
  if (!quote || works.length < 2) return;
  const originals = [portrait, quote, ...works];
  const markers = originals.map(element => {
    const marker = document.createComment('artist journey original position');
    element.before(marker);
    return marker;
  });
  const journey = document.createElement('div');
  journey.className = 'artist-journey';
  const stage = document.createElement('div');
  stage.className = 'artist-journey__stage';
  const track = document.createElement('div');
  track.className = 'artist-journey__track';
  const panes = [quote, ...works];
  const controls = document.createElement('div');
  controls.className = 'artist-journey__controls';
  const status = document.createElement('span');
  status.textContent = 'Sigue bajando →';
  const previous = document.createElement('button');
  previous.type = 'button';
  previous.textContent = '← Anterior';
  const next = document.createElement('button');
  next.type = 'button';
  next.textContent = 'Siguiente →';
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.textContent = 'Continuar ↓';
  controls.append(status, previous, next, skip);
  stage.append(track, controls);
  journey.append(stage);
  let enabled = false, scheduled = 0, width = 0, height = 0, zoomDistance = 0, leadHold = 0, travel = 0, imagesStarted = false;
  let zoom = 0, horizontal = 0, lastTick = 0, horizontalVelocity = 0;
  const clamp = value => Math.max(0, Math.min(1, value));
  const ease = value => { value = clamp(value); return value * value * (3 - 2 * value); };

  function measure() {
    width = stage.clientWidth;
    height = window.innerHeight;
    zoomDistance = height * .95;
    leadHold = height * .35;
    travel = width * (panes.length - 1);
    journey.style.height = `${height + zoomDistance + leadHold + travel}px`;
    // Account for object-fit:cover and the portrait's existing object-position.
    const sourceWidth = photo.naturalWidth || 2201, sourceHeight = photo.naturalHeight || 3468;
    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    const renderedWidth = sourceWidth * scale, renderedHeight = sourceHeight * scale;
    const x = (width - renderedWidth) * .5 + renderedWidth * .459;
    const position = getComputedStyle(photo).objectPosition.split(' ').map(parseFloat);
    const y = (height - renderedHeight) * ((position[1] || 34) / 100) + renderedHeight * .391;
    photo.style.transformOrigin = `${x}px ${y}px`;
    stage.style.setProperty('--eye-x', `${width * .5 - x}px`);
    stage.style.setProperty('--eye-y', `${height * .5 - y}px`);
  }

  function render(time) {
    scheduled = 0;
    if (!enabled || document.hidden) return;
    const rect = journey.getBoundingClientRect();
    document.body.classList.toggle('artist-journey-active', rect.top <= 0 && rect.bottom >= height);
    if (rect.bottom < 0 || rect.top > height) return;
    const distance = Math.max(0, -rect.top);
    const wantedZoom=clamp(distance / zoomDistance);
    const wantedHorizontal=Math.max(0, Math.min(travel, distance - zoomDistance - leadHold));
    const dt=Math.min(40,Math.max(8,time-lastTick||16));lastTick=time;
    const blend=1-Math.exp(-dt/85);
    if(distance===0||Math.abs(wantedHorizontal-horizontal)>width*1.6){
      zoom=wantedZoom;horizontal=wantedHorizontal;horizontalVelocity=0;
    } else {
      zoom+=(wantedZoom-zoom)*blend;
      // Critically damped movement settles gently without bouncing past the artwork.
      const omega=1/(width<=760?68:90),offset=horizontal-wantedHorizontal;
      const impulse=horizontalVelocity+omega*offset,decay=Math.exp(-omega*dt);
      horizontal=Math.max(0,Math.min(travel,wantedHorizontal+(offset+impulse*dt)*decay));
      horizontalVelocity=(horizontalVelocity-omega*impulse*dt)*decay;
    }
    if(Math.abs(wantedZoom-zoom)<.0004)zoom=wantedZoom;
    if(Math.abs(wantedHorizontal-horizontal)<.15&&Math.abs(horizontalVelocity)<.03){horizontal=wantedHorizontal;horizontalVelocity=0;}
    if (zoom > .15 && !imagesStarted) {
      works.forEach(work => { work.querySelector('img').loading = 'eager'; });
      imagesStarted = true;
    }
    const amount = ease(zoom);
    const magnification = Math.exp(Math.log(8.5) * amount);
    photo.style.transform = `translate(${(parseFloat(stage.style.getPropertyValue('--eye-x')) * amount).toFixed(2)}px,${(parseFloat(stage.style.getPropertyValue('--eye-y')) * amount).toFixed(2)}px) scale(${magnification.toFixed(4)})`;
    portrait.style.opacity = String(1 - ease((zoom - .78) / .22));
    portrait.style.pointerEvents = zoom < .98 ? '' : 'none';
    portrait.querySelector('.artist-hero__text').style.opacity = String(1 - ease(zoom * 3));
    portrait.querySelector('.artist-hero__shade').style.opacity = String(1 - ease(zoom * 2));
    track.style.transform = `translate3d(${-horizontal}px,0,0)`;
    track.style.opacity = String(ease((zoom - .78) / .22));
    track.style.visibility = zoom > .78 ? 'visible' : 'hidden';
    controls.style.opacity = zoom > .97 ? '1' : '0';
    controls.style.visibility = zoom > .97 ? 'visible' : 'hidden';
    const index = Math.min(panes.length - 1, Math.round(horizontal / width));
    status.textContent = `${index + 1} / ${panes.length} · Sigue bajando →`;
    previous.disabled = index === 0;
    stage.style.setProperty('--journey-progress', String(horizontal / Math.max(1, travel)));
    panes.forEach((pane, i) => {
      const depth = Math.max(-1, Math.min(1, (i * width - horizontal) / Math.max(1, width)));
      pane.style.setProperty('--pane-drift', `${(depth * Math.min(32, width * .035)).toFixed(2)}px`);
      window.NaroaColourScroll?.reveal(pane.querySelector('img'), clamp(1 - depth / .55));
    });
    if(Math.abs(wantedZoom-zoom)>.0004||Math.abs(wantedHorizontal-horizontal)>.15||Math.abs(horizontalVelocity)>.03)schedule();
  }

  function schedule() { if (!scheduled && enabled) scheduled = requestAnimationFrame(render); }
  function goTo(index) {
    const top = window.scrollY + journey.getBoundingClientRect().top;
    window.scrollTo({top: top + zoomDistance + leadHold + Math.min(panes.length - 1, index) * width, behavior: 'smooth'});
  }
  previous.addEventListener('click', () => goTo(Math.max(0, Math.round(horizontal / width) - 1)));
  next.addEventListener('click', () => {
    const index = Math.round(horizontal / width);
    if (index < panes.length - 1) goTo(index + 1);
    else skip.click();
  });
  skip.addEventListener('click', () => {
    window.scrollTo({top: window.scrollY + journey.getBoundingClientRect().bottom, behavior: 'smooth'});
  });
  stage.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (event.target.closest('input,textarea,select')) return;
    event.preventDefault();
    goTo(Math.max(0, Math.round(horizontal / width) + (event.key === 'ArrowRight' ? 1 : -1)));
  });
  track.addEventListener('focusin', event => {
    const index = panes.findIndex(pane => pane.contains(event.target));
    if (index >= 0 && Math.abs(horizontal - index * width) > width * .2) goTo(index);
  });

  function update() {
    const desired = document.documentElement.dataset.brushEnabled === 'true';
    if (desired === enabled) return;
    enabled = desired;
    if (enabled) {
      markers[0].after(journey);
      stage.prepend(portrait);
      panes.forEach(pane => { pane.classList.add('artist-journey__pane'); track.append(pane); });
      profile.classList.add('artist-profile--journey');
      measure();
      window.addEventListener('scroll', schedule, {passive: true});
      schedule();
    } else {
      cancelAnimationFrame(scheduled); scheduled = 0;
      window.removeEventListener('scroll', schedule);
      originals.forEach((element, index) => {
        markers[index].after(element);
        element.classList.remove('artist-journey__pane');
        element.style.removeProperty('--pane-drift');
      });
      journey.remove();
      profile.classList.remove('artist-profile--journey');
      document.body.classList.remove('artist-journey-active');
      portrait.style.opacity = portrait.style.pointerEvents = '';
      portrait.querySelector('.artist-hero__text').style.opacity = '';
      portrait.querySelector('.artist-hero__shade').style.opacity = '';
      photo.style.transform = photo.style.transformOrigin = '';
    }
  }
  photo.addEventListener('load', () => { if (enabled) { measure(); schedule(); } });
  window.addEventListener('resize', () => { if (enabled) { measure(); schedule(); } }, {passive: true});
  document.addEventListener('visibilitychange', schedule);
  document.addEventListener('naroa:motionchange', update);
  document.addEventListener('naroa:colour-ready', schedule);
  update();
})();
