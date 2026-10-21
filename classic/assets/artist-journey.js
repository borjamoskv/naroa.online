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
  const next = document.createElement('button');
  next.type = 'button';
  next.textContent = 'Siguiente →';
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.textContent = 'Continuar ↓';
  controls.append(status, next, skip);
  stage.append(track, controls);
  journey.append(stage);
  let enabled = false, scheduled = 0, width = 0, height = 0, zoomDistance = 0, leadHold = 0, travel = 0, imagesStarted = false;
  let zoom = 0, horizontal = 0, lastTick = 0;
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
    const scale = Math.max(width / 2201, height / 3468);
    const renderedWidth = 2201 * scale, renderedHeight = 3468 * scale;
    const x = (width - renderedWidth) * .5 + renderedWidth * .459;
    const y = (height - renderedHeight) * (width <= 760 ? .30 : .34) + renderedHeight * .391;
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
    const blend=1-Math.exp(-dt/75);
    if(distance===0||Math.abs(wantedHorizontal-horizontal)>width*1.6){zoom=wantedZoom;horizontal=wantedHorizontal;}
    else {zoom+=(wantedZoom-zoom)*blend;horizontal+=(wantedHorizontal-horizontal)*blend;}
    if(Math.abs(wantedZoom-zoom)<.0004)zoom=wantedZoom;
    if(Math.abs(wantedHorizontal-horizontal)<.15)horizontal=wantedHorizontal;
    if (zoom > .15 && !imagesStarted) {
      works.forEach(work => { work.querySelector('img').loading = 'eager'; });
      imagesStarted = true;
    }
    const amount = ease(zoom);
    photo.style.transform = `translate(${(parseFloat(stage.style.getPropertyValue('--eye-x')) * amount).toFixed(2)}px,${(parseFloat(stage.style.getPropertyValue('--eye-y')) * amount).toFixed(2)}px) scale(${(1 + amount * 7.5).toFixed(4)})`;
    portrait.style.opacity = String(1 - ease((zoom - .78) / .22));
    portrait.style.pointerEvents = zoom < .98 ? '' : 'none';
    portrait.querySelector('.artist-hero__text').style.opacity = String(1 - ease(zoom * 3));
    portrait.querySelector('.artist-hero__shade').style.opacity = String(1 - ease(zoom * 2));
    track.style.transform = `translate3d(${-horizontal}px,0,0)`;
    track.style.opacity = String(ease((zoom - .78) / .22));
    track.style.visibility = zoom > .78 ? 'visible' : 'hidden';
    controls.style.opacity = zoom > .97 ? '1' : '0';
    controls.style.visibility = zoom > .97 ? 'visible' : 'hidden';
    status.textContent = `${Math.min(panes.length, Math.round(horizontal / width) + 1)} / ${panes.length} · Sigue bajando →`;
    if(Math.abs(wantedZoom-zoom)>.0004||Math.abs(wantedHorizontal-horizontal)>.15)schedule();
  }

  function schedule() { if (!scheduled && enabled) scheduled = requestAnimationFrame(render); }
  function goTo(index) {
    const top = window.scrollY + journey.getBoundingClientRect().top;
    window.scrollTo({top: top + zoomDistance + leadHold + Math.min(panes.length - 1, index) * width, behavior: 'smooth'});
  }
  next.addEventListener('click', () => {
    const index = Math.round(horizontal / width);
    if (index < panes.length - 1) goTo(index + 1);
    else skip.click();
  });
  skip.addEventListener('click', () => {
    window.scrollTo({top: window.scrollY + journey.getBoundingClientRect().bottom, behavior: 'smooth'});
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
  window.addEventListener('resize', () => { if (enabled) { measure(); schedule(); } }, {passive: true});
  document.addEventListener('visibilitychange', schedule);
  document.addEventListener('naroa:motionchange', update);
  update();
})();
