/* Shared opt-in control for the artwork’s scroll motion. */
(() => {
 'use strict';
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 let choice=null;
 try { choice=sessionStorage.getItem('naroa-brush-motion'); } catch (_) {}
 const query=new URLSearchParams(location.search).get('brocha');
 if(query==='1'||query==='0') {
  choice=query==='1'?'on':'off';
  try { sessionStorage.setItem('naroa-brush-motion',choice); } catch (_) {}
 }
 let enabled=choice?choice==='on':!motion.matches;
 const host=document.querySelector('main');
 const bar=document.createElement('div');bar.className='brush-controls';
 const label=document.createElement('p');label.textContent='Arte en movimiento';
 const button=document.createElement('button');button.type='button';button.className='brush-toggle';
 bar.append(label,button);host?.prepend(bar);
 function update(){
  document.documentElement.dataset.brushEnabled=String(enabled);
  button.textContent=enabled?'Pausar efectos':'Activar efectos';button.setAttribute('aria-pressed',String(enabled));
  document.dispatchEvent(new CustomEvent('naroa:motionchange',{detail:{enabled}}));
 }
 button.addEventListener('click',()=>{
  enabled=!enabled;choice=enabled?'on':'off';
  try { sessionStorage.setItem('naroa-brush-motion',choice); } catch (_) {}
  update();
 });
 motion.addEventListener('change',()=>{if(choice===null){enabled=!motion.matches;update();}});
 update();
})();
