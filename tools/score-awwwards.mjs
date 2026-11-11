#!/usr/bin/env node
// Deterministic panel scorer. Missing tests are null, NEVER zero.
import fs from 'node:fs';
const paths = process.argv.slice(2);
if (paths.length !== 3) {
 console.error('Usage: node tools/score-awwwards.mjs art.json ux.json tech.json');
 process.exit(2);
}
const rubric=JSON.parse(fs.readFileSync(new URL('../docs/awwwards/rubric-50.json',import.meta.url),'utf8')).criteria;
const idSet=new Set(rubric.map(c=>c.id));
const allowed=new Set(['observed','code-only','interpretive','untested']);
const reviews=paths.map((p)=>{
 const r=JSON.parse(fs.readFileSync(p,'utf8'));
 if(!Array.isArray(r.criteria)||r.criteria.length!==50) throw Error(p+': expected 50 criteria');
 const ids=new Set();
 for(const item of r.criteria) {
  if(!idSet.has(item.id)||ids.has(item.id)) throw Error(p+': unexpected/duplicate '+item.id);
  ids.add(item.id);
  if(!allowed.has(item.status)) throw Error(p+': bad status at '+item.id);
  if(item.score===null) {if(item.status!=='untested')throw Error(p+': null must be untested');}
  else if(typeof item.score!=='number'||!Number.isFinite(item.score)||item.score<0||item.score>10||!(String(item.evidence||'').trim()))throw Error(p+': invalid score/evidence '+item.id);
 }
 return r;
});
function mean(xs){return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;}
const cats=['Diseño','Usabilidad','Creatividad','Contenido'];
for(const r of reviews){
 const map=new Map(r.criteria.map(c=>[c.id,c]));
 const matched=rubric.map(c=>({rubric:c,review:map.get(c.id)}));
 const rated=matched.filter(x=>x.review.score!==null);
 const data=Object.fromEntries(cats.map(cat=>{const a=matched.filter(x=>x.rubric.category===cat);const b=a.filter(x=>x.review.score!==null);return [cat,{scored:b.length,total:a.length,average:mean(b.map(x=>x.review.score))}]}));
 const raw=mean(rated.map(x=>x.review.score));
 console.log(JSON.stringify({agent:r.agent,coverage:rated.length+'/50',categories:data,observed_mean:raw===null?null:+raw.toFixed(2),jury_equivalent:rated.length===50?+raw.toFixed(2):null},null,2));
}
const panel=rubric.map(c=>{const vals=reviews.map(r=>r.criteria.find(x=>x.id===c.id).score).filter(x=>x!==null);return {id:c.id,score:mean(vals),votes:vals.length}});
const full=panel.every(c=>c.votes===3);
const highRisk=['U30','U31','U32','U33','U34','U35'];
const criticalVerified=reviews.every(r=>highRisk.every(id=>r.criteria.find(c=>c.id===id).status==='observed'));
const panelAverage=mean(panel.filter(c=>c.score!==null).map(c=>c.score));
console.log(JSON.stringify({panel_criteria_complete:full,panel_score:full&&criticalVerified?+panelAverage.toFixed(2):null,provisional_observed_mean:panelAverage===null?null:+panelAverage.toFixed(2),critical_mobile_accessibility_performance_verified:criticalVerified,verdict:full&&criticalVerified?'READY_FOR_HUMAN_REVIEW':'INCOMPLETE_NO_AWWWARDS_PREDICTION'},null,2));
