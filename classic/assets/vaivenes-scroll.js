/* Native vertical scrolling advances the eight full-screen photographs. */
(() => {
  'use strict';
  const clamp=(n,low,high)=>Math.max(low,Math.min(high,n));
  let serial=0;
  function gallery(host, figures, insertionPoint, inline=false) {
    if(figures.length<2)return;
    const markers=figures.map(figure=>{const marker=document.createComment('Vaivenes original position');figure.before(marker);return marker;});
    const wrap=document.createElement('section');wrap.className='vaivenes-scroll';wrap.setAttribute('aria-label','Vaivenes: recorrido por las ocho obras');
    const stage=document.createElement('div');stage.className='vaivenes-scroll__stage';
    const track=document.createElement('div');track.className='vaivenes-scroll__track';
    const label=document.createElement('p');label.className='vaivenes-scroll__label';label.textContent='Vaivenes';
    const footer=document.createElement('div');footer.className='vaivenes-scroll__controls';
    const hint=document.createElement('span');hint.textContent='Sigue bajando, la obra sigue →';
    const previous=document.createElement('button');previous.type='button';previous.textContent='← Anterior';
    const next=document.createElement('button');next.type='button';next.textContent='Siguiente →';
    const details=document.createElement('button');details.type='button';details.textContent='Sobre la obra';details.setAttribute('aria-expanded','false');
    const leave=document.createElement('button');leave.type='button';leave.textContent='Seguir ↓';
    footer.append(hint,previous,next,details,leave);stage.append(track,label,footer);wrap.append(stage);
    let enabled=false,scheduled=0,width=0,height=0,distance=0,current=0,near=false,displayed=NaN,lastTick=0,velocity=0;
    const id=++serial;
    figures.forEach((figure,i)=>{figure.querySelector('figcaption').id=`vaivenes-caption-${id}-${i}`;});
    function measure(){width=stage.clientWidth;height=innerHeight;distance=(figures.length-1)*width;wrap.style.height=`${height+distance}px`;schedule();}
    function render(time){
      scheduled=0;if(!enabled||document.hidden)return;
      const rect=wrap.getBoundingClientRect();if(rect.top>height||rect.bottom<0)return;
      const desired=clamp(-rect.top,0,distance);
      const dt=Math.min(40,Math.max(8,time-lastTick||16));lastTick=time;
      if(!Number.isFinite(displayed)||desired===0||desired===distance||Math.abs(desired-displayed)>width*1.6)displayed=desired;
      const step=(desired-displayed)*(1-Math.exp(-dt/65));
      displayed+=step;velocity=velocity*.65+(step/dt)*.35;
      const travel=Math.abs(desired-displayed)<.15?desired:displayed;
      const index=clamp(Math.round(travel/Math.max(1,width)),0,figures.length-1);
      if(index!==current){figures[current].classList.remove('vaivenes-caption-open');details.setAttribute('aria-expanded','false');current=index;}
      track.style.transform=`translate3d(${-travel}px,0,0)`;
      previous.disabled=current===0;next.disabled=current===figures.length-1;
      details.setAttribute('aria-controls',`vaivenes-caption-${id}-${current}`);
      const title=figures[current].querySelector('h2').textContent;
      hint.textContent=`${title} · sigue bajando →`;
      figures.forEach((figure,i)=>{
        const image=figure.querySelector('img');
        if(Math.abs(i-current)<=1)image.loading='eager';
        const depth=clamp((i*width-travel)/Math.max(1,width),-1,1);
        const shift=depth*Math.min(22,width*.018);
        const tilt=clamp(velocity*.12,-.25,.25);
        image.style.transform=`translate3d(${shift.toFixed(2)}px,${(-Math.min(4,Math.abs(velocity))).toFixed(2)}px,0) rotate(${tilt.toFixed(3)}deg)`;
        figure.querySelector('figcaption').style.transform=`translate3d(${(depth*Math.min(32,width*.025)).toFixed(2)}px,0,0)`;
      });
      if(Math.abs(desired-displayed)>.15||Math.abs(velocity)>.03)schedule();
    }
    function schedule(){if(!scheduled&&enabled&&near)scheduled=requestAnimationFrame(render);}
    function go(index){if(!enabled)return;const top=scrollY+wrap.getBoundingClientRect().top;scrollTo({top:top+clamp(index,0,figures.length-1)*width,behavior:'smooth'});}
    previous.addEventListener('click',()=>go(current-1));next.addEventListener('click',()=>go(current+1));
    leave.addEventListener('click',()=>scrollTo({top:scrollY+wrap.getBoundingClientRect().bottom,behavior:'smooth'}));
    details.addEventListener('click',()=>{const open=figures[current].classList.toggle('vaivenes-caption-open');details.setAttribute('aria-expanded',String(open));});
    track.addEventListener('focusin',event=>{const index=figures.findIndex(figure=>figure.contains(event.target));if(index>=0&&index!==current)go(index);});
    stage.addEventListener('keydown',event=>{if(event.key==='ArrowRight'){event.preventDefault();go(current+1);}if(event.key==='ArrowLeft'){event.preventDefault();go(current-1);}if(event.key==='Escape'){figures[current].classList.remove('vaivenes-caption-open');details.setAttribute('aria-expanded','false');}});
    const intersection=new IntersectionObserver(entries=>{near=entries[0].isIntersecting;schedule();},{rootMargin:'100% 0px'});
    const resize=new ResizeObserver(()=>{if(enabled)measure();});
    resize.observe(host);
    function update(){
      const desired=document.documentElement.dataset.brushEnabled==='true';if(desired===enabled)return;enabled=desired;
      if(enabled){
        insertionPoint.after(wrap);figures.forEach(figure=>track.append(figure));host.classList.add('vaivenes-host-active');
        if(inline)host.classList.add('vaivenes-host-inline');
        measure();intersection.observe(wrap);addEventListener('scroll',schedule,{passive:true});
      }else{
        cancelAnimationFrame(scheduled);scheduled=0;intersection.disconnect();removeEventListener('scroll',schedule);
        figures.forEach((figure,i)=>{markers[i].after(figure);figure.classList.remove('vaivenes-caption-open');figure.querySelector('img').style.transform='';figure.querySelector('figcaption').style.transform='';});wrap.remove();host.classList.remove('vaivenes-host-active','vaivenes-host-inline');
      }
    }
    // Keep direct links to individual works meaningful inside the pinned sequence.
    document.querySelectorAll('.series-index a').forEach(link=>link.addEventListener('click',event=>{
      const index=figures.findIndex(figure=>'#'+figure.id===link.getAttribute('href'));if(enabled&&index>=0){event.preventDefault();go(index);history.replaceState(null,'',link.getAttribute('href'));}
    }));
    addEventListener('resize',()=>{if(enabled)measure();},{passive:true});document.addEventListener('visibilitychange',schedule);document.addEventListener('naroa:motionchange',update);update();
    const initial=figures.findIndex(figure=>'#'+figure.id===location.hash);if(enabled&&initial>=0)requestAnimationFrame(()=>go(initial));
  }
  const page=document.querySelector('.series-page #series-main');
  if(page){const figures=[...page.querySelectorAll('.series-work')];const intro=page.querySelector('.series-intro');if(intro)gallery(page,figures,intro);}
  const entry=document.querySelector('.series-entry');
  if(entry){
    // Start downloading the small manifest only as the series approaches the screen.
    const observer=new IntersectionObserver(async entries=>{
      if(!entries.some(entry=>entry.isIntersecting))return;observer.disconnect();
      try{
        const response=await fetch('/data/vaivenes.json');if(!response.ok)return;const data=await response.json();
        const figures=data.images.map((work,i)=>{
          const figure=document.createElement('figure');figure.className='series-work';figure.id=`home-vaivenes-${work.slug}`;
          const image=document.createElement('img');image.src=work.src;image.width=work.width;image.height=work.height;image.alt=work.title+' · '+work.caption;image.loading='lazy';image.decoding='async';
          const photo=document.createElement('div');photo.className='project-photo';photo.append(image);
          const caption=document.createElement('figcaption'),number=document.createElement('span'),copy=document.createElement('div'),title=document.createElement('h2'),text=document.createElement('p'),source=document.createElement('a');
          number.textContent=String(i+1).padStart(2,'0');title.textContent=work.title;text.textContent=work.caption;source.href='/series/vaivenes/#'+work.slug;source.textContent='Ver la obra en la serie ↗';source.className='series-source';copy.append(title,text,source);caption.append(number,copy);figure.append(photo,caption);return figure;
        });
        const store=document.createElement('div');store.hidden=true;figures.forEach(figure=>store.append(figure));entry.append(store);
        gallery(entry,figures,entry.querySelector('a'),true);
      }catch(_){/* The original series link remains available if the manifest fails. */}
    },{rootMargin:'100% 0px'});observer.observe(entry);
  }
})();
