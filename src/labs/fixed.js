// Duração fixa (Modo A) e calibração das referências por era (aba Balanceamento).
import {LAB_PROFILE_NAME,LAB_PROFILES} from "../ai/profiles.js";
import {configApplied,busy,setBusy,setConfigApplied} from "../app/session.js";
import {MAX_AI,normalizeConfig,VERSION,mapTerritories} from "../core/config.js";
import {runFixedGame,fixedGameSeed} from "../core/match.js";
import {REF_DIMS,calibrateReferences,REF_SETS,validateReferences} from "../core/references.js";
import {safeNum,clone} from "../core/util.js";
import {configEdited} from "./settings.js";
import {download} from "../platform/files.js";
import {$,setStatus} from "../ui/dom.js";
import {fmt} from "../ui/format.js";

// Gera as partidas em lotes (async) para não bloquear a interface; pode ser cancelado
// e preserva as partidas já concluídas.
export async function runFixedDurationBatch(cfg,opts,onProgress=()=>{},shouldCancel=()=>false){
 const {games,eras,mode,profiles,civCount,baseSeed,batchSize=5}=opts,results=[],start=Date.now();
 for(let g=0;g<games;g++){
  if(shouldCancel())break;
  results.push(runFixedGame(cfg,{eras,mode,profiles,civCount,seed:fixedGameSeed(baseSeed,g),game:g}));
  if((g+1)%batchSize===0||g===games-1){onProgress(results.length,games,Date.now()-start);await new Promise(r=>setTimeout(r,0))}
 }
 return results;
}
// Resumo por perfil na última era (média simples de cada lugar ocupado pelo perfil).
export function fixedProfileSummary(games){
 const acc={};for(const g of games){const last=g.timeline.at(-1);if(!last)continue;for(const r of last.civs){const a=acc[r.profile]??={n:0,territories:0,military:0,infrastructure:0,technology:0,treasury:0,revenue:0};a.n++;a.territories+=r.territories;for(const [d] of REF_DIMS)a[d]+=r.dims[d]}}
 return Object.entries(acc).map(([profile,a])=>({profile,n:a.n,territories:a.territories/a.n,...Object.fromEntries(REF_DIMS.map(([d])=>[d,a[d]/a.n]))}));
}
/* ── Interface: duração fixa e referências ── */
export let fixedRun={games:[],calibration:null,opts:null},fixedCancel=false;
export function readFixedOpts(){
 const games=safeNum($("fixedGames").value,1,2000),eras=safeNum($("fixedEras").value,1,300),civCount=safeNum($("fixedCivs").value,2,1+MAX_AI),baseSeed=safeNum($("fixedSeed").value,0,4294967295);
 if(![games,eras,civCount,baseSeed].every(Number.isInteger))throw Error("Partidas, eras, civilizações e semente devem ser inteiros.");
 const profiles=[...document.querySelectorAll("#fixedProfiles input:checked")].map(x=>x.value);if(!profiles.length)throw Error("Selecione pelo menos um perfil.");
 if(civCount>mapTerritories(configApplied))throw Error("Mais civilizações do que territórios.");
 return {games,eras,civCount,baseSeed,profiles,mode:$("fixedMode").value==="fast"?"fast":"slow"};
}
export async function runFixedLab(){
 if(busy)return;const opts=readFixedOpts();setBusy(true);fixedCancel=false;fixedRun={games:[],calibration:null,opts};
 $("runFixed").disabled=true;$("cancelFixed").disabled=false;$("applyCalibration").disabled=true;$("fixedSummary").innerHTML="";$("fixedProgress").style.width="0%";
 try{
  const cfg=clone(configApplied);
  fixedRun.games=await runFixedDurationBatch(cfg,opts,(done,total,ms)=>{$("fixedProgress").style.width=(100*done/total)+"%";setStatus("fixedStatus",`A executar · ${done} de ${total} partidas (${fmt(100*done/total,0)}%) · ${fmt(ms/1000,1)} s`)},()=>fixedCancel);
  if(!fixedRun.games.length){setStatus("fixedStatus","Cancelado antes de concluir qualquer partida.","error");return}
  fixedRun.calibration=calibrateReferences(fixedRun.games,{seedBase:opts.baseSeed,mode:opts.mode,profiles:opts.profiles,civCount:opts.civCount,requestedGames:opts.games,date:new Date().toISOString()});
  renderFixedResults();$("applyCalibration").disabled=false;
  setStatus("fixedStatus",fixedCancel?`Cancelado: ${fixedRun.games.length} de ${opts.games} partidas concluídas e preservadas. A calibração usa apenas as concluídas.`:`Concluído: ${fixedRun.games.length} partidas × ${opts.eras} eras. Reveja as referências e clique em Aplicar.`,"success");
 }finally{setBusy(false);$("runFixed").disabled=false;$("cancelFixed").disabled=true}
}
export function renderFixedResults(){
 const cal=fixedRun.calibration;if(!cal)return;
 const warn=REF_DIMS.map(([d,name])=>{const n=cal.fallback[d].filter(Boolean).length,z=cal.stats[d].reduce((a,s)=>a+s.zeroShare,0)/cal.eras;return n||z>.25?`<div><strong>${name}</strong>: ${fmt(100*z,0)}% das observações são zero${n?`; mediana zero em ${n} de ${cal.eras} eras → referência de recurso (${d==="treasury"?"receita de referência da era":"média ou 1"})`:""}.</div>`:""}).join("");
 const prof=fixedProfileSummary(fixedRun.games);
 $("fixedSummary").innerHTML=`<div class="notice success"><strong>${cal.meta.games} partidas</strong> · ${cal.eras} eras · ${cal.meta.civCount} civilizações · modo ${cal.meta.mode==="fast"?"rápido":"lento"} · perfis: ${cal.meta.profiles.map(p=>LAB_PROFILE_NAME[p]).join(", ")}.</div>${warn?`<div class="notice">${warn}</div>`:""}
 <h3>Situação na última era, por perfil</h3><div class="tablewrap"><table><thead><tr><th>Perfil</th><th>Lugares</th><th>Territórios</th>${REF_DIMS.map(([,n])=>`<th>${n}</th>`).join("")}</tr></thead><tbody>${prof.map(r=>`<tr><td><strong>${LAB_PROFILE_NAME[r.profile]||r.profile}</strong></td><td>${r.n}</td><td>${fmt(r.territories,1)}</td>${REF_DIMS.map(([d])=>`<td>${fmt(r[d],1)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
 renderRefEditor();
}
export function currentRefTable(){return configApplied.references?.[$("refSet").value]||null}
export function renderRefEditor(){
 const set=$("refSet").value,t=currentRefTable(),cal=fixedRun.calibration;
 $("refHead").innerHTML=`<th>Era</th>${REF_DIMS.map(([,n,u])=>`<th>${n}<div class="small muted">${u}</div></th>`).join("")}${cal&&!t?"":""}`;
 if(!t){$("refTable").innerHTML=cal?cal.values.military.map((_,e)=>`<tr><td>${e+1}</td>${REF_DIMS.map(([d])=>`<td class="${cal.fallback[d][e]?"gold":""}" title="p25 ${fmt(cal.stats[d][e].p25,2)} · p75 ${fmt(cal.stats[d][e].p75,2)}">${fmt(cal.values[d][e],2)}${cal.fallback[d][e]?" *":""}</td>`).join("")}</tr>`).join(""):"";
  setStatus("refStatus",cal?"Pré-visualização da calibração (ainda não aplicada). * = mediana zero, valor de recurso.":"Ainda não há referências definidas. Execute as simulações e aplique a calibração, ou importe um JSON.");return}
 $("refTable").innerHTML=t.values.military.map((_,e)=>`<tr><td>${e+1}</td>${REF_DIMS.map(([d])=>`<td><input type="number" min="0" step="any" style="width:110px" data-ref="${d}.${e}" value="${+t.values[d][e].toFixed(4)}" class="${t.fallback?.[d]?.[e]?"gold":""}" title="${t.stats?`p25 ${fmt(t.stats[d][e].p25,2)} · p75 ${fmt(t.stats[d][e].p75,2)}`:""}"></td>`).join("")}</tr>`).join("");
 document.querySelectorAll("[data-ref]").forEach(el=>el.addEventListener("change",()=>{const [d,e]=el.dataset.ref.split("."),v=Number(el.value);if(!(Number.isFinite(v)&&v>0)){el.value=+t.values[d][e].toFixed(4);setStatus("refStatus","A referência tem de ser um número maior que zero.","error");return}t.values[d][+e]=v;t.edited=true;if(t.fallback?.[d])t.fallback[d][+e]=false;el.classList.remove("gold");configEdited.references=clone(configApplied.references);setStatus("refStatus",`Referência ${REF_SETS.find(x=>x[0]===set)[1]} · ${REF_DIMS.find(x=>x[0]===d)[1]} · era ${+e+1} ajustada manualmente.`,"success")}));
 setStatus("refStatus",`${REF_SETS.find(x=>x[0]===set)[1]}: ${t.eras} eras calibradas${t.meta?.games?` a partir de ${t.meta.games} partidas`:""}${t.edited?" · com ajustes manuais":""}. Depois da última era usa-se o último valor. Valores a dourado vieram de recurso (mediana zero).`);
}
export function applyCalibration(){
 const cal=fixedRun.calibration;if(!cal)throw Error("Execute as simulações primeiro.");
 configApplied.references={ice:clone(cal),score:clone(cal)};setConfigApplied(normalizeConfig(configApplied));configEdited.references=clone(configApplied.references);
 renderRefEditor();setStatus("refStatus","Calibração aplicada aos dois conjuntos (ICE e pontuação final). Ajuste cada conjunto separadamente, se necessário.","success");
}
export function exportFixedCsv(){
 if(!fixedRun.games.length){setStatus("fixedStatus","Execute as simulações antes de exportar.","error");return}
 const rows=[["game","seed","mode","era","seat","civ_id","profile","territories",...REF_DIMS.map(([d])=>d)]];
 for(const g of fixedRun.games)for(const e of g.timeline)e.civs.forEach((r,k)=>rows.push([g.game,g.seed,g.mode,e.era,k,r.id,r.profile,r.territories,...REF_DIMS.map(([d])=>r.dims[d])]));
 download("imperios-duracao-fixa.csv",rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(";")).join("\n"),"text/csv;charset=utf-8");
}
export function exportRefs(){if(!configApplied.references){setStatus("refStatus","Não há referências para exportar.","error");return}download("imperios-referencias.json",JSON.stringify({formatVersion:VERSION,references:configApplied.references},null,2))}
export function importRefs(file){const reader=new FileReader();reader.onload=()=>{try{const obj=JSON.parse(reader.result),refs=validateReferences(obj.references||obj);if(!refs)throw Error("Ficheiro sem referências.");configApplied.references={...(configApplied.references||{}),...refs};configEdited.references=clone(configApplied.references);renderRefEditor();setStatus("refStatus","Referências importadas e validadas.","success")}catch(e){setStatus("refStatus","Importação recusada: "+e.message,"error")}};reader.readAsText(file)}
export function setupFixedLab(){
 $("fixedProfiles").innerHTML=LAB_PROFILES.map(([v,n])=>`<label><input type="checkbox" value="${v}" checked> ${n}</label>`).join("");
 $("fixedCivs").value=1+configApplied.map.aiCount;$("fixedSeed").value=configApplied.simulation.seed;
 $("runFixed").onclick=()=>runFixedLab().catch(e=>{setBusy(false);setStatus("fixedStatus",e.message,"error")});
 $("cancelFixed").onclick=()=>{fixedCancel=true;setStatus("fixedStatus","Cancelamento pedido; a concluir a partida em curso...")};
 $("applyCalibration").onclick=()=>{try{applyCalibration()}catch(e){setStatus("refStatus",e.message,"error")}};
 $("exportFixedCsv").onclick=exportFixedCsv;$("exportRefs").onclick=exportRefs;
 $("importRefsBtn").onclick=()=>$("refsFile").click();$("refsFile").onchange=e=>{if(e.target.files[0])importRefs(e.target.files[0]);e.target.value=""};
 $("refSet").onchange=renderRefEditor;renderRefEditor();
}
// Únicas formas de outros módulos substituírem estas variáveis (um módulo não pode reatribuir o que importa).
export function setFixedRun(v){fixedRun=v;return v}
export function setFixedCancel(v){fixedCancel=v;return v}
