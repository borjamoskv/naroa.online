/* A hand paints only mapped irises. Original photographs are never altered. */
(() => {
  'use strict';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = n => Math.max(0, Math.min(1, n));
  // Normalized coordinates measured against each source photograph, not its frame.
  const portraits = {
    'amy-rocks-hq-01.jpg': [[.396,.470,.012,.014], [.513,.424,.012,.015]],
    'johnny-rocks-hq-01.webp': [[.378,.451,.017,.010], [.576,.462,.016,.009]],
    'james-rocks-hq-01.webp': [[.420,.346,.013,.006], [.560,.334,.013,.006]],
    'naroa-portrait-new.webp': [[.110,.261,.006,.007], [.171,.271,.006,.007], [.438,.446,.008,.011], [.524,.456,.008,.010], [.798,.355,.005,.007], [.861,.332,.005,.007]]
  };
  let choice = null;
  try { choice = sessionStorage.getItem('naroa-brush-motion'); } catch (_) {}
  const query = new URLSearchParams(location.search).get('brocha');
  if (query === '1' || query === '0') {
    choice = query === '1' ? 'on' : 'off';
    try { sessionStorage.setItem('naroa-brush-motion',choice); } catch (_) {}
  }
  let enabled = choice ? choice === 'on' : !motion.matches;
  const buttons = [], states = [], active = new Set();
  let remembered = {};
  try { remembered = JSON.parse(sessionStorage.getItem('naroa-eye-colour-v1') || '{}'); } catch (_) {}
  let lastSaved = 0;
  function saveColour() { try { sessionStorage.setItem('naroa-eye-colour-v1',JSON.stringify(remembered)); } catch (_) {} }
  addEventListener('pagehide',saveColour);
  let scheduled = 0, lastY = scrollY, direction = 1, lastTime = performance.now(), lastArm = null, armPose = null, armKey = null, liftUntil = 0;
  const SVG = 'http://www.w3.org/2000/svg';
  const svg = (name, attrs={}) => {
    const element = document.createElementNS(SVG,name);
    for (const [key,value] of Object.entries(attrs)) element.setAttribute(key,value);
    return element;
  };
  function control(host, after=false) {
    if (!host) return;
    const bar = document.createElement('div'); bar.className = 'brush-controls';
    const label = document.createElement('p'); label.textContent = 'Arte en movimiento';
    const button = document.createElement('button'); button.type = 'button'; button.className = 'brush-toggle';
    button.addEventListener('click', () => {
      enabled = !enabled; choice = enabled ? 'on' : 'off';
      try { sessionStorage.setItem('naroa-brush-motion',choice); } catch (_) {}
      update();
    });
    buttons.push(button);bar.append(label,button);
    if (after) host.after(bar); else host.prepend(bar);
  }
  control(document.querySelector('main'));

  const arm = document.createElement('img');
  arm.className = 'naroa-painting-arm';arm.alt = '';arm.setAttribute('aria-hidden','true');
  arm.src = '/assets/naroa-brazo-pincel-v1.webp';arm.draggable = false;
  document.body.append(arm);
  document.querySelectorAll('.project-photo, .catalog-card__image').forEach((target,index) => {
    if (target.closest('.series-work')) return;
    const image = target.querySelector('img');
    if (!image) return;
    const file = (image.currentSrc || image.src).split('/').pop().split('?')[0];
    if (!portraits[file]) return;
    const scene = svg('svg', {class:'eye-paint-scene', 'aria-hidden':'true',focusable:'false'});
    const defs = svg('defs');
    scene.append(defs);target.append(scene);target.classList.add('eye-paint-target');
    const state = {target,image,scene,index,eyes:[],source:'',maximum:0,defs};
    states.push(state);
  });
  function measure(state) {
    const {image,target,scene} = state;
    const file = (image.currentSrc || image.src).split('/').pop().split('?')[0];
    const points = portraits[file];
    if (file !== state.source) {
      state.eyes.forEach(eye => {eye.paint.remove();eye.clip.remove();eye.group?.remove();});
      state.eyes = []; state.maximum = clamp(Number(remembered[file]) || 0); state.source = file;
      if (points) points.forEach((point,i) => {
        // Marilyn stays exactly as photographed, including in the opening triptych.
        if (file === 'naroa-portrait-new.webp' && i < 2) return;
        const clip = svg('clipPath',{id:`iris-clip-${state.index}-${i}`});
        const iris = svg('ellipse');clip.append(iris);state.defs.append(clip);
        const paint = svg('image',{href:image.currentSrc || image.src,preserveAspectRatio:'none','clip-path':`url(#iris-clip-${state.index}-${i})`});
        let group=null;
        if(file==='naroa-portrait-new.webp'){
          group=svg('g',{class:`hero-depth-eye hero-depth-eye--${Math.floor(i/2)+1}`});
          group.append(paint);scene.append(group);
        }else scene.append(paint);
        state.eyes.push({point,paint,clip,iris,group});
      });
    }
    if (!points || !image.naturalWidth) return null;
    const frame = target.getBoundingClientRect(), box = image.getBoundingClientRect();
    if (!box.width || !box.height) return null;
    const style = getComputedStyle(image);
    const fit = style.objectFit === 'cover' ? Math.max : Math.min;
    const scale = fit(box.width/image.naturalWidth,box.height/image.naturalHeight);
    const width = image.naturalWidth*scale, height=image.naturalHeight*scale;
    const pos=style.objectPosition.split(' ').map(parseFloat);
    const x=box.left-frame.left+(box.width-width)*(Number.isFinite(pos[0])?pos[0]/100:.5);
    const y=box.top-frame.top+(box.height-height)*(Number.isFinite(pos[1])?pos[1]/100:.5);
    scene.setAttribute('viewBox',`0 0 ${frame.width} ${frame.height}`);
    state.eyes.forEach(eye => {
      const [cx,cy,rx,ry]=eye.point;
      Object.assign(eye,{x:x+cx*width,y:y+cy*height,rx:rx*width,ry:ry*height});
      for (const [key,value] of Object.entries({cx:eye.x,cy:eye.y,rx:eye.rx,ry:eye.ry})) eye.iris.setAttribute(key,value);
      for (const [key,value] of Object.entries({x,y,width,height})) eye.paint.setAttribute(key,value);
    });
    return frame;
  }
  function render(time) {
    scheduled=0;
    if (!enabled || document.hidden) {arm.style.opacity='0';return;}
    const elapsed=Math.min(40,Math.max(0,time-lastTime));lastTime=time;
    const delta=scrollY-lastY;
    if (Math.abs(delta)>.5) direction=Math.sign(delta);
    lastY=scrollY;
    let candidate=null;
    for (const state of active) {
      const frame=measure(state);
      if (!frame || !state.eyes.length) continue;
      const center=state.eyes.reduce((sum,eye)=>sum+eye.y,0)/state.eyes.length;
      const progress=clamp((innerHeight*.78-frame.top-center)/Math.max(innerHeight*.42,120));
      const old=Math.max(state.maximum,Number(remembered[state.source]) || 0);
      state.maximum=old;
      if (direction>0 && progress>old) {
        state.maximum=Math.min(progress,old+elapsed/1600);
        remembered[state.source]=state.maximum;
        if(time-lastSaved>250 || state.maximum>=1){saveColour();lastSaved=time;}
        if(state.maximum<progress) schedule();
      }
      state.scene.dataset.painted=state.maximum.toFixed(5);
      const contact=direction>0 && state.maximum>old+.000001 && progress>=old-.002;
      state.scene.dataset.brushMode=contact?'painting':'lifted';
      state.eyes.forEach((eye,i)=>{
        const amount=clamp(state.maximum*state.eyes.length-i);
        const red = state.source.startsWith('james-rocks');
        eye.paint.style.filter = `grayscale(${1-amount}) sepia(${red ? amount*.85 : 0}) saturate(${1+amount*(red ? 3 : .35)}) hue-rotate(${red ? -42*amount : 0}deg)`;
        eye.paint.dataset.revealed = amount.toFixed(4);
      });
      if (!contact) continue;
      const walking=state.maximum;
      if (walking<=.001 || walking>=.995) continue;
      const portion=walking*state.eyes.length;
      const eye=state.eyes[Math.min(state.eyes.length-1,Math.floor(portion))];
      const t=portion%1;
      let tip={x:frame.left+eye.x-eye.rx+eye.rx*2*t,y:frame.top+eye.y+Math.sin(t*Math.PI*2)*eye.ry*.25};
      const screenMatrix=eye.paint.getScreenCTM?.();
      if(screenMatrix){
        const aligned=new DOMPoint(eye.x-eye.rx+eye.rx*2*t,eye.y+Math.sin(t*Math.PI*2)*eye.ry*.25).matrixTransform(screenMatrix);
        tip={x:aligned.x,y:aligned.y};
      }
      if (tip.y<70 || tip.y>innerHeight-60) continue;
      if (!candidate || Math.abs(tip.y-innerHeight*.5)<candidate.distance) candidate={tip,contact,key:state.source+':'+Math.floor(portion),distance:Math.abs(tip.y-innerHeight*.5)};
    }
    if (candidate) {
      if(armKey!==null&&candidate.key!==armKey)liftUntil=time+160;
      armKey=candidate.key;
      lastArm={tip:candidate.tip,until:time+340};
    }
    else if (lastArm && time<lastArm.until) {candidate={tip:lastArm.tip,contact:false};schedule();}
    else {arm.style.opacity='0';lastArm=null;armPose=null;armKey=null;return;}
    const {tip}=candidate;
    const contact=candidate.contact&&time>=liftUntil;
    if(!armPose)armPose={x:tip.x+Math.min(120,innerWidth*.18),y:tip.y+12,start:time};
    const follow=1-Math.exp(-elapsed/48);
    armPose.x+=(tip.x-armPose.x)*follow;armPose.y+=(tip.y-armPose.y)*follow;
    const retreat=candidate.contact?0:clamp((time-(lastArm.until-340))/340);
    const opacity=Math.min(1,(time-armPose.start)/100)*(1-retreat);
    // Sprite tip is at (3%,29%); its forearm continues beyond the right edge.
    const lift=contact?0:18;
    const width=(innerWidth-tip.x+30)/.97;
    arm.style.width=`${width}px`;
    arm.style.left=`${armPose.x-width*.03+lift+retreat*width*.23}px`;
    arm.style.top=`${armPose.y-width*(1024/1536)*.29-lift}px`;
    arm.style.transform=contact?'rotate(0deg)':'rotate(-5deg)';
    arm.dataset.brushMode=contact?'painting':'lifted';arm.style.opacity=String(Math.max(0,opacity));
    // Finish approaching and lifting the brush even after scrolling has stopped.
    if (Math.abs(tip.x-armPose.x)>.15 || Math.abs(tip.y-armPose.y)>.15 || time-armPose.start<100 || time<liftUntil) schedule();
  }
  function schedule() {if (!scheduled && enabled) scheduled=requestAnimationFrame(render);}
  const observer=new IntersectionObserver(entries=>{
    for (const entry of entries) {
      const state=states.find(state=>state.target===entry.target);
      if (entry.isIntersecting) active.add(state);else active.delete(state);
    }
    schedule();
  },{rootMargin:'15% 0px'});
  const resize=new ResizeObserver(schedule);
  states.forEach(state=>{observer.observe(state.target);resize.observe(state.target);state.image.addEventListener('load',schedule);});
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)arm.style.opacity='0';else schedule();});
  function update() {
    document.documentElement.dataset.brushEnabled=String(enabled);
    buttons.forEach(button=>{button.textContent=enabled?'Pausar efectos':'Activar efectos';button.setAttribute('aria-pressed',String(enabled));});
    if (!enabled) {cancelAnimationFrame(scheduled);scheduled=0;arm.style.opacity='0';}
    else {lastY=scrollY;schedule();}
    document.dispatchEvent(new CustomEvent('naroa:motionchange',{detail:{enabled}}));
  }
  motion.addEventListener('change',()=>{if(choice===null){enabled=!motion.matches;update();}});
  update();
})();
