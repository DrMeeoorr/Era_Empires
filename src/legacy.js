// Impérios — código do jogo que ainda não foi dividido em módulos (interface, gravação e laboratórios).
// Os passos 9 e 10 da reorganização dividem este ficheiro em src/ui, src/app e src/labs.
import * as ns_core_index from "./core/index.js";
import * as ns_ai_index from "./ai/index.js";
import * as ns_app_session from "./app/session.js";
import * as ns_app_save from "./app/save.js";
import * as ns_app_hooks from "./app/hooks.js";
import * as ns_platform_storage from "./platform/storage.js";
import * as ns_platform_files from "./platform/files.js";
import * as ns_ui_format from "./ui/format.js";
import * as ns_ui_dom from "./ui/dom.js";
import * as ns_labs_settings from "./labs/settings.js";
import * as ns_labs_ai_checks from "./labs/ai-checks.js";
import * as ns_labs_engine from "./labs/engine.js";
import * as ns_labs_experiment from "./labs/experiment.js";
import * as ns_labs_validation from "./labs/validation.js";
import * as ns_labs_tests_def from "./labs/tests-def.js";
import * as ns_legacy from "./legacy.js";
import {exposeGlobals} from "./app/debug.js";
import {LAB_PROFILE_NAME,AI_PROFILE_NAMES,LAB_PROFILES} from "./ai/profiles.js";
import {hooks,runHook,onHook} from "./app/hooks.js";
import {quarantineSave,saveGame,readSavedGame} from "./app/save.js";
import {configApplied,state,profileOf,setConfigApplied,configDefault,setGameMode,setCurrentDifficulty,currentDifficulty,DEFAULT_DIFFICULTY,setAiConfigBase,applyDifficulty,setOpponentChoices,DEFAULT_OPPONENT,setSelectedTerritory,setState,newGame,selectedTerritory,busy,playEra,gameMode,rememberAiBase,setBusy,setCancelRequested,cancelRequested,DEV_MODE,opponentChoices,visibleOpponentOptions} from "./app/session.js";
import {pickAiDifficulty,DIFFICULTIES,effectiveDelay,normalizeConfig,VERSION,SUPPORTED_VERSIONS,DEFAULTS,MAX_AI,CIV_COLORS} from "./core/config.js";
import {infraReturn,techReturn} from "./core/economy.js";
import {territorialMinimum,territoryBase,finalScores,describeResult,END_REASON_NAMES} from "./core/endgame.js";
import {simulate,processEra} from "./core/era.js";
import {countTerritories,eligibleTargets,adjacentOwned} from "./core/map.js";
import {runFixedGame,fixedGameSeed} from "./core/match.js";
import {territoryDefense,orderCostMultiplier,attackTerritory,cancelOrder,orderAttack} from "./core/military.js";
import {civSym,civName,regionName,RIVAL_NAMES} from "./core/names.js";
import {REF_DIMS,calibrateReferences,REF_SETS,validateReferences} from "./core/references.js";
import {P,aiCivs,getCiv,addLog,newState,A} from "./core/state.js";
import {clone,clamp,safeNum} from "./core/util.js";
import {profileExpectedWeights,pct,runAiControlProbe,aiProbe} from "./labs/ai-checks.js";
import {estimateRows,ROW_WARN,buildJobs,runGameJobs,summarizeRecords,profileStats,mean,median,profileName,consolidateProfiles,OUTCOME_KEYS,RC} from "./labs/engine.js";
import {paramCatalog,expState,SCENARIO_COLORS,getParam,parseParamValue,setExpCancel,expCancel,scenarioConfig,exportExp} from "./labs/experiment.js";
import {setConfigEdited,PARAM_GROUPS,paramInput,configEdited,PARAM_OPTIONS} from "./labs/settings.js";
import {executeTests,testRegistry,ftHistory,TEST_CATS,ftResults,ftLastRun,loadFtHistory} from "./labs/tests-def.js";
import {setValCancel,valCancel,valState,profileDiagnostics,PROFILE_EXPECTATIONS} from "./labs/validation.js";
import {download,csvDownload} from "./platform/files.js";
import {storage} from "./platform/storage.js";
import {$,setStatus} from "./ui/dom.js";
import {cssColor,escapeHtml,fmt,money,uiText,parseAmount,fmtInput} from "./ui/format.js";
export let compareResults=[];
export let lastStrategyResult=null;
export let scenarioLoaded=null;
export const COMPARE_COLORS=["#f4bd50","#56d6a1","#b49aff","#62a8ff","#ff737b","#e88a43","#72d0df","#d9a4c7"];
export function makeSnapshot(){return {config:clone(configApplied),state:clone(state)}}
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
// Nomes de estilo mostrados ao jogador (os laboratórios continuam a usar LAB_PROFILE_NAME).
export const PLAYER_PROFILE_NAME={reference:"Equilibrado",military:"Militar",aggressive:"Agressivo",technologist:"Científico",economist:"Construtor",adaptive:"Adaptativo"};
export const playerProfileName=p=>PLAYER_PROFILE_NAME[p]||LAB_PROFILE_NAME[p]||p;
export function profileLabel(c,reveal=false){if(c.id==="player")return "";if(c.hiddenProfile&&!reveal&&!state.result)return "estilo oculto";return playerProfileName(profileOf(c))}
export function showSaveWarning(err){
 if(typeof document==="undefined")return;let el=document.getElementById("saveWarning");
 if(!err){if(el)el.hidden=true;return}
 if(!el){el=document.createElement("div");el.id="saveWarning";el.className="save-warning";el.setAttribute("role","alert");document.body.appendChild(el)}
 const full=err&&(err.name==="QuotaExceededError"||err.code===22);
 el.innerHTML=`<span>⚠ <strong>Não foi possível salvar a partida.</strong> ${full?"O espaço de armazenamento do navegador está cheio.":"O navegador bloqueou o armazenamento."} Se você fechar o jogo agora, pode perder o progresso desde o último salvamento.</span><button type="button" aria-label="Fechar aviso">✕</button>`;
 el.querySelector("button").onclick=()=>{el.hidden=true};el.hidden=false;
}
// savedRaw: o texto do save carregado ao abrir o jogo (para pôr de lado se falhar ao desenhar).
export let savedGameLoaded=false,saveProblem=null,savedRaw=null;
export function noticeBrokenSave(){setTimeout(()=>showModal(`<h2>Não foi possível continuar a partida salva</h2><p class="small muted">Os dados da partida salva neste aparelho estão danificados ou são de uma versão incompatível. Uma nova partida foi iniciada, e uma cópia dos dados antigos foi guardada separadamente.</p>`,[{label:"Entendi",cls:"primary"}]),350)}
// Primeiro desenho com um save carregado: se falhar, o save é posto de lado e começa uma partida nova.
export function renderSavedSafely(render){
 try{render()}catch(e){
  if(!savedGameLoaded)throw e;
  savedGameLoaded=false;try{quarantineSave(savedRaw||JSON.stringify({v:1,state}))}catch(_){}
  setConfigApplied(clone(configDefault));setConfigEdited(clone(configDefault));setGameMode("slow");setCurrentDifficulty(DEFAULT_DIFFICULTY);setAiConfigBase(pickAiDifficulty(configDefault));applyDifficulty(currentDifficulty);setOpponentChoices([DEFAULT_OPPONENT,DEFAULT_OPPONENT,DEFAULT_OPPONENT]);setSelectedTerritory(null);setState(newGame());
  if(!saveProblem){saveProblem="erro ao desenhar: "+(e.message||e);noticeBrokenSave()}
  render();
 }
}
// Nome do jogador/rival com o símbolo (★ ▲ ● ◆ ■ ✚) na cor do mapa: não depende só da cor.
export const civSymHtml=c=>`<span class="csym" style="color:${cssColor(c.color)}" aria-hidden="true">${civSym(c)}</span>`;
export const civLabel=c=>`${civSymHtml(c)} ${escapeHtml(civName(c))}`;
/* ── Barra de recursos (topo) ── */
// Números curtos para a barra: sem casas decimais a partir de 100.
export const hudNum=v=>fmt(v,Math.abs(v)>=100?0:1);
export function renderMetrics(){
 const s=state,me=P(s),r=s.pending?.revenue?.player||s.history.at(-1)||{normal:0,infra:0,tech:0,total:0},g=configApplied.endgame,min=territorialMinimum(territoryBase(s),g.territoryPct),mine=countTerritories(s,"player");
 const pct=clamp(100*s.era/Math.max(1,s.maxEras),0,100);
 $("statEra").innerHTML=`<div class="hud-era-t"><span>Era</span><span class="of"><b>${escapeHtml(s.era)}</b>/${escapeHtml(s.maxEras)}</span></div><div class="hud-prog" role="progressbar" aria-label="Eras jogadas" aria-valuemin="0" aria-valuemax="${escapeHtml(s.maxEras)}" aria-valuenow="${escapeHtml(s.era)}"><span style="width:${pct}%"></span></div>`;
 $("statGold").innerHTML=`<span class="hud-ico gold-ico" aria-hidden="true">$</span><span class="hud-v"><b>${hudNum(me.treasury)} <small>ouro</small></b><span class="k"><span class="green">+${hudNum(r.total)}</span>/era</span></span>`;
 $("statGold").title=`Ouro para investir agora (já com o ouro desta era). Esta era rendeu ${money(r.total)}: territórios ${fmt(r.normal,1)} · Obras ${fmt(r.infra,1)} · Ciência ${fmt(r.tech,1)}.`;
 $("statForce").innerHTML=`<span class="hud-ico force-ico" aria-hidden="true">⚔</span><span class="hud-v"><b>${fmt(me.military,1)}</b><span class="k">Força</span></span>`;
 $("statForce").title="Força para atacar (perde 20% por era se não for usada).";
 $("statTerr").innerHTML=`<span class="hud-ico terr-ico" aria-hidden="true">⚑</span><span class="hud-v"><b>${mine}<small>/${min}</small></b><span class="k">terras</span></span>`;
 $("statTerr").setAttribute("aria-label",`Terras: ${mine} de ${min} para a maioria${mine>=min?" (maioria atingida)":""}. Abrir placar e condições de vitória`);
 const lv=liveScores(),pill=$("scorePill"),meS=lv?.find(x=>x.id==="player");
 if(!lv){pill.innerHTML=`<span aria-hidden="true">🏆</span> <span class="gap none">—</span>`;pill.setAttribute("aria-label","Placar: aparece no fim da 1.ª era. Abrir placar e condições de vitória")}
 else if(!meS){pill.innerHTML=`<span aria-hidden="true">🏆</span> <span class="gap down">fora</span>`;pill.setAttribute("aria-label","Placar: você foi eliminado. Abrir placar")}
 else{const pos=lv.indexOf(meS)+1,lead=lv[0],d=pos===1?(lv[1]?PTS(meS.score)-PTS(lv[1].score):0):PTS(lead.score)-PTS(meS.score);
  pill.innerHTML=`<span aria-hidden="true">🏆</span> ${pos}.º <span class="gap ${pos===1?"up":"down"}">${pos===1?"+":"−"}${d}</span>`;
  pill.setAttribute("aria-label",`Placar: você está em ${pos}.º${pos===1?(lv[1]?`, ${d} pontos à frente`:""):`, ${d} pontos atrás de ${lead.name}`}. Abrir placar e condições de vitória`)}
 $("matchInfo").textContent=`${s.maxEras} eras · ${DIFFICULTIES[s.difficulty]?.name||"Médio"} · modo ${s.mode==="fast"?"rápido":"lento"}${g.supremacyEnabled===false?" · Conquista":""} · ${mine} terras suas, ${countTerritories(s,"neutral")} livres.`;
 // Placar completo (folha "Placar e vitória"): posição, pontos, diferença para o líder e variação na última era.
 const strip=$("scoreStrip");
 if(!lv){strip.innerHTML=`<p class="muted small">O placar aparece no fim da 1.ª era.</p>`;return}
  const top=PTS(lv[0].score),prev=state.timeline.length>1?(()=>{const e=state.timeline.at(-2);const sc=finalScores(e.civs.map(r=>({id:r.id,dims:r.dims})),e.era,configApplied);const m={};e.civs.forEach((r,k)=>m[r.id]=PTS(sc[k].score));return m})():{};
  strip.innerHTML=`<p class="small muted" style="margin:0">Pontos = pontuação final se a partida acabasse agora: territórios valem 40%; Força, Obras, Ciência e ouro guardado, 15% cada. 1000 pontos = desempenho de referência.</p>`+lv.map((x,i)=>{const p=PTS(x.score),d=prev[x.id]!=null?p-prev[x.id]:null;
   return `<div class="score-row ${x.id==="player"?"me":""}" style="--c:${cssColor(x.civ?.chartColor)}"><span class="pos">${i+1}.º</span><span>${x.civ?civLabel(x.civ):escapeHtml(x.name)}${x.civ&&x.id!=="player"?` <span class="muted small">· ${escapeHtml(profileLabel(x.civ))}</span>`:""}</span><span class="pts"><strong>${p}</strong>${i>0?` <span class="gap">−${top-p}</span>`:""}${d?` <span class="trend ${d>0?"up":"down"}">${d>0?"↑":"↓"}${Math.abs(d)}</span>`:""}</span></div>`}).join("")
}
/* ── Mapa e painel do alvo ── */
/* Ajusta cada nome de região ao seu quadrado: a largura das letras muda com a fonte de cada
   celular. Primeiro reduz a fonte (até 8,5 px), depois aperta o espaço entre letras. */
export function fitRegionNames(){
 const MIN=8.5;
 document.querySelectorAll("[data-territory] .rname").forEach(n=>{
  n.style.fontSize="";n.style.letterSpacing="";
  const cell=n.closest("[data-territory]"),cs=getComputedStyle(cell);
  const room=cell.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
  if(!(room>0)||n.scrollWidth<=room)return;
  const base=parseFloat(getComputedStyle(n).fontSize);
  const size=Math.max(MIN,Math.floor(base*room/n.scrollWidth*10)/10);
  n.style.fontSize=size+"px";
  for(let ls=-.04;n.scrollWidth>room&&ls>=-.1;ls-=.02)n.style.letterSpacing=ls.toFixed(2)+"em";
 });
}
// Legenda mais larga que a tela: marca para esmaecer a borda (indica que rola para o lado).
export function markLegend(){const l=$("mapLegend");if(!l)return;const upd=()=>l.classList.toggle("more",l.scrollWidth>l.clientWidth+1&&l.scrollLeft+l.clientWidth<l.scrollWidth-2);upd();if(!l.dataset.mk){l.dataset.mk=1;l.addEventListener("scroll",upd,{passive:true})}}
export function renderMap(){
 const targets=eligibleTargets(state,"player");
 $("map").innerHTML=state.owners.map((o,i)=>{const civ=o==="neutral"?null:getCiv(state,o),cls=o==="player"?"player":civ?"ai":"",style=civ&&o!=="player"?` style="background:${cssColor(civ.color)}55;border-color:${cssColor(civ.color)}"`:"",target=targets.some(t=>t.i===i)&&P(state).active&&!state.result,sel=selectedTerritory===i;
  return `<button class="territory ${cls} ${target?"target":""} ${sel?"selected":""}" data-territory="${i}" aria-label="${escapeHtml(regionName(i))}, região ${i+1}, ${o==="neutral"?"livre":o==="player"?"sua":"de "+escapeHtml(civName(civ))}${target?", alvo possível":""}"${style}><span class="rname">${escapeHtml(regionName(i))}</span><span class="who"><span class="tnum">${i+1}</span>${civ?`<span class="csym">${civSym(civ)}</span>`:""}</span>${target?`<span class="def gold">Def. ${fmt(territoryDefense(state,i,configApplied),0)}</span>`:""}</button>`}).join("");
 $("mapLegend").innerHTML=`<span>${civLabel(P(state))}</span>`+aiCivs(state).map(c=>`<span>${civLabel(c)}<span class="muted lg-style"> · ${escapeHtml(profileLabel(c))}</span>${c.active?"":" (eliminado)"}</span>`).join("")+`<span><i class="dot sq" style="background:#1a2940;border:1px solid #64758e"></i>Livre</span><span><i class="dot sq" style="border:2px solid #f4bd50"></i>Pode atacar</span>`;
 document.querySelectorAll("[data-territory]").forEach(b=>b.addEventListener("click",()=>{const i=Number(b.dataset.territory);setSelectedTerritory(i);renderMap();openSheet("attackSheet",()=>document.querySelector(`[data-territory="${i}"]`))}));
 fitRegionNames();markLegend();
 renderAttack();renderEvents();
 if(simOrders())myOrders().forEach((o,k)=>{const cell=document.querySelector(`[data-territory="${o.idx}"]`);if(cell){cell.classList.add("ordered");cell.insertAdjacentHTML("beforeend",`<span class="order-tag">${myOrders().length>1?"⚔ "+(k+1)+".ª":"⚔ ordem"}</span>`)}});
}
// Folha de ataque: região + dono, 3 números (Custo, Sua força, Chance), botão com o motivo quando não dá,
// atalho "Investir em Militar" e a explicação longa atrás de "Por quê?".
export const ATTACK_CHANCE="82%";
export const infoTip=(html,label="Por quê?")=>`<details class="tgt-info"><summary><span aria-hidden="true">ⓘ</span> O ataque acontece no fim da era. <u>${label}</u></summary><div>${html}</div></details>`;
export const targetNums=(cost,have)=>`<div class="tgt-nums"><div class="tgt-num"><span>Custo</span> <b>${fmt(cost,1)}</b></div><div class="tgt-num"><span>Sua força</span> <b class="${have+1e-9>=cost?"ok":"red"}">${fmt(have,1)}</b></div><div class="tgt-num"><span>Chance</span> <b>${ATTACK_CHANCE}</b></div></div>`;
// Região no painel do alvo: nome + número pequeno (o mesmo do mapa).
export const regionHtml=t=>`<strong>${escapeHtml(regionName(t))}</strong> <span class="muted small">${t+1}</span>`;
export const tgtTitle=html=>`<h2 class="tgt-title" id="attackTitle">${html}</h2>`;
export const setAttackBtn=(btn,text,enabled,{cancel=false,invest=false}={})=>{btn.textContent=text;btn.disabled=!enabled;btn.classList.toggle("cancel",cancel);const inv=$("attackInvest");if(inv)inv.hidden=!invest};
// Ordens simultâneas: a ordem fica marcada no mapa e o resultado sai no relatório do fim da era.
export const simOrders=()=>!!configApplied.military.simultaneousOrders,myOrders=()=>(state.orders||[]).filter(o=>o.owner==="player"),myOrder=t=>myOrders().find(o=>o.idx===t);
// Painel do alvo com ordens simultâneas (configuração padrão): a ordem é resolvida no fim da era.
export function renderOrderAttack(){
 const t=selectedTerritory,m=configApplied.military,btn=$("attack"),mil=P(state).military,ords=myOrders(),ord=t!==null?myOrder(t):null,next=orderCostMultiplier(configApplied,ords.length),maxO=m.maxOrdersPerEra||Infinity;
 setAttackBtn(btn,"Escolha um alvo",false);
 if(t===null&&isSheetOpen("attackSheet"))closeSheet();
 if(state.result||!P(state).active){setAttackBtn(btn,state.result?"Partida terminada":"Sem ataques",false);$("mapStatus").innerHTML=tgtTitle(t===null?"Mapa":regionHtml(t))+`<p class="tgt-sub">${state.result?"A partida terminou.":"Você foi eliminado e não pode mais atacar."}</p>`;return}
 const ordTxt=ords.length?`<p class="tgt-orders">⚔ Ordens desta era: ${ords.map(o=>`${escapeHtml(regionName(o.idx))} (${fmt(o.need,1)}${o.mult>1?`, ×${fmt(o.mult,1)}`:""})`).join(" · ")}</p>`:"";
 const costTxt=maxO===1?"":ords.length?` O próximo ataque desta era custa ×${fmt(next,1)}.`:" Você pode dar várias ordens por era; cada ataque a mais custa mais (2.º ×2, 3.º ×3…).";
 const howOrders=`As ordens de todos são resolvidas juntas no fim da era: se um rival atacar o mesmo território, há <strong>batalha</strong> (vence quem tiver mais Força, somada à Ciência); depois, ${ATTACK_CHANCE} de chance de conquistar. A Força é gasta mesmo se o ataque falhar.`;
 if(t===null){$("mapStatus").innerHTML=`${tgtTitle("Escolha um alvo")}${ordTxt}<p class="tgt-sub">Toque em um território com <span class="gold">contorno dourado</span> para atacar. Força livre: <strong>${fmt(mil,1)}</strong>.</p>${infoTip(`Cada ataque custa, em Força, a defesa do alvo + ${fmt(m.conquestCost,0)} de conquista.${costTxt} ${howOrders}`)}`;return}
 if(ord){setAttackBtn(btn,"Cancelar ordem",true,{cancel:true});$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ordem dada`)}${ordTxt}<p class="tgt-sub">${fmt(ord.need,1)} de Força reservada. Cancelar devolve a Força${ords.length>1?" e recalcula o custo das outras ordens":""}.</p>${infoTip(`A ordem é resolvida quando você concluir a era, junto com as dos rivais. ${howOrders}`)}`;return}
 const owner=state.owners[t];
 if(owner==="player"){setAttackBtn(btn,"Território seu",false);$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · seu`)}${ordTxt}<p class="tgt-sub">Defesa ${fmt(territoryDefense(state,t,configApplied),1)}. Obras e Ciência reforçam a defesa.</p>`;return}
 if(!adjacentOwned(state,t,"player")){setAttackBtn(btn,"Fora do alcance",false);$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ${owner==="neutral"?"livre":"de "+civLabel(getCiv(state,owner))}`)}${ordTxt}<p class="tgt-sub">Não faz fronteira com o seu império. Escolha um com contorno dourado.</p>`;return}
 const replacing=maxO===1&&ords.length,mult=replacing?1:next,def=territoryDefense(state,t,configApplied),base=m.conquestCost+def,need=base*mult,civ=owner==="neutral"?null:getCiv(state,owner),avail=mil+(replacing?ords[0].need:0);
 if(!replacing&&ords.length>=maxO){setAttackBtn(btn,`Máximo de ${maxO} ordens`,false);$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ${civ?"de "+civLabel(civ):"livre"}`)}${ordTxt}<p class="tgt-sub">Você já deu o máximo de ${maxO} ordens nesta era.</p>`;return}
 const ok=avail+1e-9>=need;setAttackBtn(btn,ok?`${replacing?"Trocar ordem":"Atacar"} · usa ${fmt(need,1)} de Força`:`Faltam ${fmt(need-avail,1)} de Força`,ok,{invest:!ok&&mult<=1});
 $("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ${civ?"de "+civLabel(civ):"livre"}`)}${mult>1?`<p class="tgt-sub">${ords.length+1}.º ataque desta era: custo ×${fmt(mult,1)}</p>`:""}${ordTxt}${targetNums(need,avail)}${infoTip(`Custo = defesa ${fmt(def,1)} + conquista ${fmt(m.conquestCost,0)} = ${fmt(base,1)}${mult>1?` × ${fmt(mult,1)} (${ords.length+1}.º ataque da era)`:""} = ${fmt(need,1)} de Força.${ok?"":mult>1?" Ataques a mais na mesma era custam mais.":" Invista em Militar: a Força chega na era seguinte."} ${howOrders}`)}`;
}
export function renderAttack(){
 if(simOrders())return renderOrderAttack();
 const t=selectedTerritory,m=configApplied.military,btn=$("attack"),mil=P(state).military;
 setAttackBtn(btn,"Escolha um alvo",false);
 if(t===null&&isSheetOpen("attackSheet"))closeSheet();
 if(state.result||!P(state).active){setAttackBtn(btn,state.result?"Partida terminada":"Sem ataques",false);$("mapStatus").innerHTML=tgtTitle(t===null?"Mapa":regionHtml(t))+`<p class="tgt-sub">${state.result?"A partida terminou.":"Você foi eliminado e não pode mais atacar."}</p>`;return}
 if(t===null){$("mapStatus").innerHTML=`${tgtTitle("Escolha um alvo")}<p class="tgt-sub">Toque em um território com <span class="gold">contorno dourado</span> para atacar. Força: <strong>${fmt(mil,1)}</strong>.</p>`;return}
 const owner=state.owners[t];
 if(owner==="player"){setAttackBtn(btn,"Território seu",false);$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · seu`)}<p class="tgt-sub">Defesa ${fmt(territoryDefense(state,t,configApplied),1)}. Obras e Ciência reforçam a defesa.</p>`;return}
 if(!adjacentOwned(state,t,"player")){setAttackBtn(btn,"Fora do alcance",false);$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ${owner==="neutral"?"livre":"de "+civLabel(getCiv(state,owner))}`)}<p class="tgt-sub">Não faz fronteira com o seu império. Escolha um com contorno dourado.</p>`;return}
 const def=territoryDefense(state,t,configApplied),need=m.conquestCost+def,civ=owner==="neutral"?null:getCiv(state,owner);
 const extra=civ?def-m.defenseOwned:0,defTxt=civ?`defesa ${fmt(m.defenseOwned,0)}${extra>0.05?` + ${fmt(extra,1)} de Obras/Ciência`:""}`:`defesa ${fmt(def,0)}`;
 const ok=mil+1e-9>=need;setAttackBtn(btn,ok?`Atacar · usa ${fmt(need,1)} de Força`:`Faltam ${fmt(need-mil,1)} de Força`,ok,{invest:!ok});
 $("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ${civ?"de "+civLabel(civ):"livre"}`)}${targetNums(need,mil)}${infoTip(`Custo = ${defTxt} + conquista ${fmt(m.conquestCost,0)} = ${fmt(need,1)} de Força. Vence em ${ATTACK_CHANCE} das vezes; a Força é gasta mesmo se o ataque falhar.${ok?"":" Invista em Militar: a Força chega na era seguinte."}`)}`;
}
// Botão "Atacar" do painel do alvo (ataque imediato quando as ordens simultâneas estão desligadas).
export function attackSelected(){
 if(simOrders())return orderSelected();
 if(selectedTerritory===null)return;
 const t=selectedTerritory,r=attackTerritory(state,t,"player",configApplied);setSelectedTerritory(null);closeSheet({focus:false});saveGame();renderAll();const msg=r.ok?(r.win?`<span class="green"><strong>Você conquistou ${escapeHtml(regionName(t))}!</strong></span>`:`<span class="red"><strong>O ataque a ${escapeHtml(regionName(t))} falhou</strong></span>; a Força foi gasta.`):escapeHtml(uiText(r.reason));$("mapStatus").innerHTML=msg;showToast(msg,!(r.ok&&r.win))
}
// Botão do painel com ordens simultâneas: dá ou cancela a ordem contra o território escolhido.
export function orderSelected(){
 if(selectedTerritory===null)return;const t=selectedTerritory,ord=myOrder(t);let msg,bad=false;
 if(ord){cancelOrder(state,"player",t);msg=`Ordem contra ${escapeHtml(regionName(t))} cancelada; Força devolvida.`}
 else{const r=orderAttack(state,t,"player",configApplied);bad=!r.ok;msg=r.ok?`<span class="gold"><strong>⚔ Ordem dada:</strong></span> atacar ${escapeHtml(regionName(t))} no fim da era (${fmt(r.need,1)} de Força reservada${r.mult>1?`, ${myOrders().length}.º ataque ×${fmt(r.mult,1)}`:""}).`:escapeHtml(uiText(r.reason))}
 setSelectedTerritory(null);closeSheet({focus:false});saveGame();renderAll();$("mapStatus").innerHTML=msg;showToast(msg,bad)}
export function renderEvents(){
 if(!$("lastEvents"))return;
 const ev=state.log.filter(x=>/ataque|conquist|repelid|falhou|eliminad|🏁/i.test(x.text)).slice(0,3);
 $("lastEvents").innerHTML=ev.length?ev.map(e=>`<div><span class="muted">Era ${escapeHtml(e.era)}</span> · ${escapeHtml(uiText(e.text))}</div>`).join(""):"";
}
/* ── Investimentos: botões, planos e valores ── */
export const AREAS=[["mil","military"],["infra","infrastructure"],["tech","technology"]];
export const PLANS={balanced:[34,33,33],attack:[65,25,10],economy:[20,65,15],tech:[20,20,60],clear:[0,0,0]};
export const round2=v=>Math.floor(v*100+1e-6)/100;
// Resto: o que falta, arredondado ao cêntimo mais próximo sem passar do disponível.
export const restOf=avail=>{const r=Math.round(avail*100)/100;return r>avail+1e-9?r-0.01:r};
export function readAlloc(){return AREAS.map(([k])=>Math.max(0,parseAmount($(k+"Spend").value)))}
export function setAlloc(vals){AREAS.forEach(([k],i)=>{$(k+"Spend").value=fmtInput(vals[i])});renderAllocation()}
export function applyPlan(name){const b=P(state).treasury,w=PLANS[name];const a=round2(b*w[0]/100),i=round2(b*w[1]/100),t=name==="clear"?0:Math.max(0,restOf(b-a-i));setAlloc([a,i,t])}
export function stepArea(idx,dir){const b=P(state).treasury,v=readAlloc(),others=v.reduce((s,x,j)=>s+(j===idx?0:x),0),step=Math.max(1,round2(b*0.1));v[idx]=clamp(round2(v[idx]+dir*step),0,round2(Math.max(0,b-others)));setAlloc(v)}
export function restArea(idx){const b=P(state).treasury,v=readAlloc(),others=v.reduce((s,x,j)=>s+(j===idx?0:x),0);v[idx]=restOf(Math.max(0,b-others));setAlloc(v)}
export function renderAllocation(statusMessage=null){
 const vals=readAlloc(),sum=vals.reduce((a,b)=>a+b,0),b=P(state).treasury,left=Math.max(0,b-sum),c=configApplied;
 const shownLeft=left<0.01?0:left,ended=!!state.result,over=sum>b+1e-8;
 $("actionLeft").classList.toggle("hidden",ended);$("actionEnded").classList.toggle("hidden",!ended);
 if(!ended)$("actionLeft").innerHTML=statusMessage?escapeHtml(statusMessage):over?"O total passa do ouro disponível":shownLeft===0?`<span aria-hidden="true">✓</span> tudo investido`:`sobram <strong>${fmt(shownLeft,2)}</strong> de ouro`;
 $("advance").classList.toggle("done-all",!ended&&shownLeft===0&&!over&&!statusMessage);
 AREAS.forEach(([k],i)=>{$(k+"Bar").style.width=(b>0?clamp(100*vals[i]/b,0,100):0)+"%";$(k+"Fine").textContent=fmt(vals[i],2)});
 $("allocationStatus").className="status"+(statusMessage||over?" error":"");$("allocationStatus").textContent=statusMessage||(over?"O total ultrapassa o orçamento.":left<0.01?"Orçamento todo investido.":`Por investir: ${money(left)} (fica guardado para a próxima era).`);
 const milGain=vals[0]*c.military.pointsPerInvestment,infraGain=vals[1]*c.infrastructure.initialReturn,techGain=vals[2]*c.technology.progressPerInvestment*c.technology.benefitPerProgress,techEra=state.era+effectiveDelay("technology",c.technology.delay,state.mode);
 $("milForecast").textContent=`+${fmt(milGain,1)} de Força na próxima era. Curto prazo: a Força não usada perde 20% por era.`;
 $("infraForecast").textContent=`Rende cerca de ${money(infraGain)} por era a partir da próxima, crescendo até a 4.ª era e depois acabando.`;
 $("techForecast").textContent=`Rende ${money(techGain)} por era, para sempre, a partir da era ${techEra}.`;
 $("milPrev").innerHTML=vals[0]>0?`<span class="gold">+${fmt(milGain,1)}</span> de Força`:"curto prazo";
 $("infraPrev").innerHTML=vals[1]>0?`<span class="green">+${fmt(infraGain,2)}</span>/era`:"médio prazo";
 $("techPrev").innerHTML=vals[2]>0?`<span class="purple">+${fmt(techGain,2)}</span>/era<span class="wide"> · era ${techEra}</span>`:"longo prazo";
 $("advTitle").textContent=ended?"Jogar de novo →":`Concluir era ${state.era}`;
 $("advance").setAttribute("aria-label",ended?"Jogar de novo":`Concluir era ${state.era}: ${$("actionLeft").textContent.trim()}`);
 $("advance").disabled=busy||(!ended&&over);
 document.querySelectorAll("#investCard button, #investCard input, #fineSheet button, #plans button").forEach(el=>{if(!el.matches("[data-open]"))el.disabled=ended||!P(state).active});
}
/* ── Gráficos ── */
export function svgLine(canvas,series,opts={}){
 const ctx=canvas.getContext("2d"),dpr=window.devicePixelRatio||1,w=canvas.clientWidth||300,h=canvas.clientHeight||220;if(!w)return;canvas.width=w*dpr;canvas.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
 const pad={l:38,r:10,t:14,b:26},pw=w-pad.l-pad.r,ph=h-pad.t-pad.b;ctx.strokeStyle="#293951";ctx.fillStyle="#9fb0c7";ctx.font="10px system-ui";ctx.lineWidth=1;
 const all=series.flatMap(s=>s.data.map(p=>p.y)).filter(Number.isFinite),max=Math.max(opts.minMax??1,...all),min=Math.min(0,...all),range=max-min||1;
 for(let i=0;i<=4;i++){let y=pad.t+ph*i/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText(fmt(max-(max-min)*i/4,range<5?2:0),2,y+3)}
 const n=Math.max(1,...series.map(s=>s.data.length));
 if(opts.markX){const x=pad.l+(n<=1?0:(opts.markX-1)/(n-1))*pw;ctx.save();ctx.strokeStyle="#f4bd50";ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x,pad.t);ctx.lineTo(x,pad.t+ph);ctx.stroke();ctx.restore()}
 series.forEach(s=>{ctx.strokeStyle=s.color;ctx.lineWidth=2;ctx.beginPath();let started=false;s.data.forEach((p,i)=>{let x=pad.l+(n<=1?0:i/(n-1))*pw,y=pad.t+ph-(p.y-min)/range*ph;if(!Number.isFinite(y))return;if(!started){ctx.moveTo(x,y);started=true}else ctx.lineTo(x,y)});ctx.stroke()});
 ctx.fillStyle="#9fb0c7";ctx.textAlign="center";ctx.fillText("Era",pad.l+pw/2,h-5);if(n>1){ctx.fillText("1",pad.l,h-5);ctx.fillText(String(n),w-pad.r-4,h-5)}ctx.textAlign="start";
}
export function chartData(key){return state.history.map(r=>({x:r.era,y:r[key]||0}))}
export function renderCharts(){
 if(!$("details").open)return;
 const tl=state.timeline;svgLine($("revenueChart"),[{data:chartData("normal"),color:"#62a8ff"},{data:chartData("infra"),color:"#56d6a1"},{data:chartData("tech"),color:"#b49aff"}]);
 const perCiv=key=>state.civs.map((c,k)=>({color:c.chartColor,data:tl.map(e=>({x:e.era,y:e.civs[k]?.[key]||0}))}));
 svgLine($("territoryChart"),perCiv("territories"));svgLine($("militaryChart"),perCiv("military"));
 const legend=state.civs.map(c=>`<span style="--c:${cssColor(c.chartColor)}">${civLabel(c)}</span>`).join("");$("territoryLegend").innerHTML=legend;$("militaryLegend").innerHTML=legend;
}
export function renderHistory(){
 const h=state.history;$("historyCount").textContent=h.length;
 $("historyTable").innerHTML=h.slice(-150).reverse().map(r=>`<tr><td>${escapeHtml(r.era)}</td><td>${fmt(r.total,2)}</td><td>${fmt(r.militaryInvested||0,2)}</td><td>${fmt(r.infraInvested||0,2)}</td><td>${fmt(r.techInvested||0,2)}</td><td>${fmt(r.budget,2)}</td><td>${escapeHtml(r.territories)}</td><td>${fmt(r.military,1)}</td></tr>`).join("");
 const last=state.pending?.revenue?.player||h.at(-1),tot=Math.max(1,last?.total||0);
 $("revenueBreakdown").innerHTML=[["Territórios",last?.normal||0,"#62a8ff","blue"],["Obras",last?.infra||0,"#56d6a1","green"],["Ciência",last?.tech||0,"#b49aff","purple"]].map(([n,v,c,cl])=>`<div class="row between" style="margin-top:6px"><span class="muted">${n}</span><strong class="${cl}">${money(v)}</strong></div><div class="bar"><span style="width:${100*v/tot}%;background:${c}"></span></div>`).join("");
}
export function renderForecast(){
 const era=state.era;let infra=[],tech=[];
 for(let t=1;t<=12;t++){let e=era+t,ir=0,tr=0;for(const inv of state.investments){if(inv.owner!=="player")continue;if(inv.type==="infrastructure")ir+=infraReturn(inv,e-inv.origin);if(inv.type==="technology")tr+=techReturn(state,inv,e)}infra.push(ir);tech.push(tr)}
 $("forecast").innerHTML=`<div class="log-item"><strong class="gold">Militar</strong><p class="small muted">Força disponível: ${fmt(P(state).military,1)}. Perde 20% por era se não for usada.</p></div><div class="log-item"><strong class="green">Obras</strong><p class="small muted">Na próxima era: ${money(infra[0]||0)}; daqui a 5 eras: ${money(infra[4]||0)}</p></div><div class="log-item"><strong class="purple">Ciência</strong><p class="small muted">Na próxima era: ${money(tech[0]||0)}; daqui a 5 eras: ${money(tech[4]||0)} (sem contar o bônus sobre todo o ouro da era).</p></div><div class="small muted">Só investimentos já feitos.</div>`;
}
export function renderNotifications(){const events=state.log.filter(x=>/ataque|conquist|repelid|falhou|eliminad/i.test(x.text)).slice(0,30);$("notificationCount").textContent=events.length;$("notifications").innerHTML=events.length?events.map(e=>`<div class="log-item"><strong>Era ${escapeHtml(e.era)}</strong> · ${escapeHtml(uiText(e.text))}</div>`).join(""):'<div class="small muted">Ainda não houve ataques.</div>'}
/* ── Condições de vitória e fim de partida ── */
// Relatório da era: ataques, batalhas, conquistas e saques revelados um a um.
export function showEraReport(era){
 if(state.ui?.skipReport)return;
 const ev=state.log.filter(x=>x.era===era&&/conquist|repelid|batalha|ordem de|ataque|eliminad|saque/i.test(x.text)&&!/ordenou/i.test(x.text)).reverse();
 if(!ev.length)return;
 const mine=x=>/você|Você|Jogador|bem-sucedido|malsucedido|Seu/.test(x.text)||/de Jogador|\(de você\)/.test(x.text);
 showModal(`<h2>Relatório da era ${escapeHtml(era)}</h2><p class="small muted">As ordens de todos foram resolvidas juntas, em ordem sorteada.</p><div class="report">${ev.map((e,i)=>`<div class="report-line ${mine(e)?"mine":""}" style="animation-delay:${0.25+i*0.45}s">${escapeHtml(uiText(e.text))}</div>`).join("")}</div><label class="small" style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="skipReport"> Não mostrar relatórios nesta partida</label>`,
  [{label:"Continuar",cls:"primary",onClick:()=>{if($("skipReport")?.checked){state.ui.skipReport=true;saveGame()}}}]);
}
export function renderVictory(){
 const s=state,cfg=configApplied,g=cfg.endgame;
 const last=s.timeline.at(-1),min=territorialMinimum(territoryBase(s),g.territoryPct),left=Math.max(0,s.maxEras-s.era+(s.pending?1:0));
 $("victoryPill").textContent=s.result?"Partida encerrada":`${left===1?"Última era":`Faltam ${left} eras`}`;
 const bar=(v,max,c)=>`<div class="bar" style="margin:3px 0 8px"><span style="width:${clamp(100*v/Math.max(1e-9,max),0,100)}%;background:${cssColor(c)}"></span></div>`;
 const terr=s.civs.map(c=>{const t=countTerritories(s,c.id);return `<div class="row between small"><span>${civLabel(c)}${c.id!=="player"?` <span class="muted">· ${escapeHtml(profileLabel(c))}</span>`:""}${c.active?"":' <span class="red">· eliminado</span>'}</span><strong>${t} / ${min}</strong></div>${bar(t,min,c.chartColor)}`}).join("");
 const sup=s.supremacy||{},row=id=>last?.civs.find(r=>r.id===id),ices=s.civs.filter(c=>c.active).map(c=>({c,ice:row(c.id)?.ice})).sort((a,b)=>(b.ice??-1)-(a.ice??-1));
 const statusTxt={off:"Desativada neste modo (Conquista).",none:"Ainda não avaliada.",suspended:"Suspensa nesta era.",tiedLeadership:"Sem líder claro.",gapTooSmall:`O 2.º ainda tem mais de ${fmt(100*g.supremacyRelative,0)}% do índice do líder.`,belowMinimum:"O líder ainda não é forte o suficiente.",counting:"Condição cumprida nesta era.",notYet:`Só conta a partir da era ${Math.ceil(g.supremacyMinEraShare*s.maxEras)} e com no máximo ${Math.floor(g.supremacyMaxNeutralShare*territoryBase(s)+1e-9)} territórios livres (agora ${countTerritories(s,"neutral")}).`,notApplicable:"—"}[sup.status]||"";
 const iceRows=ices.map(({c,ice})=>`<div class="row between small"><span>${civLabel(c)}${sup.leader===c.id?' <span class="gold">· líder</span>':""}</span><strong>${ice==null?"—":fmt(ice,2)}</strong></div>`).join("");
 $("victoryPanel").innerHTML=`<h3>Maioria territorial: ${min} de ${territoryBase(s)}</h3>${terr}
 <h3>Supremacia: liderar com folga ${g.supremacyEras} eras seguidas</h3>${iceRows||'<div class="small muted">Calculada a partir do fim da 1.ª era.</div>'}
 <div class="small" style="margin-top:6px">Sequência: <strong class="gold">${sup.streak||0} / ${g.supremacyEras}</strong>${sup.leader?` (${sup.leader==="player"?"você":escapeHtml(civName(getCiv(s,sup.leader)))})`:""}. <span class="muted">${statusTxt}</span></div>
 <h3>Última era (${s.maxEras}): pontuação</h3><div class="small muted">Sem outra vitória, ganha a maior pontuação. Territórios valem ${fmt(100*g.scoreWTerritory,0)}%; Força, Obras, Ciência e ouro guardado dividem o resto.</div>${(()=>{const lv=liveScores();if(!lv)return "";const mx=Math.max(...lv.map(x=>x.score));return `<div class="small muted" style="margin:6px 0 2px">Se a partida acabasse agora:</div>`+lv.map((x,i)=>`<div class="row between small"><span>${x.civ?civLabel(x.civ):escapeHtml(x.name)}${i===0?' <span class="gold">· 1.º</span>':""}</span><strong>${PTS(x.score)} pts</strong></div>${bar(x.score,mx,x.civ?.chartColor||"#888")}`).join("")})()}`;
 renderResult();
}
export const PTS=x=>Math.round(1000*x);   // pontos mostrados ao jogador (1000 = desempenho de referência)
// Placar atual: pontuação final calculada com os dados do fim da última era (civilizações ativas).
export function liveScores(){const e=state.timeline.at(-1);if(!e)return null;const act=e.civs.filter(r=>r.active!==false&&getCiv(state,r.id)?.active);if(!act.length)return null;
 return finalScores(act.map(r=>({id:r.id,dims:r.dims})),e.era,configApplied).map(x=>({...x,name:x.id==="player"?"você":civName(getCiv(state,x.id))||x.id,civ:getCiv(state,x.id)})).sort((a,b)=>b.score-a.score)}
// Pontuação de cada civilização ao longo da partida (mesma fórmula da pontuação final).
export function scoreSeries(){return state.timeline.map(e=>{const rows=e.civs.map(r=>({id:r.id,dims:r.dims}));const sc=finalScores(rows,e.era,configApplied);return e.civs.map((r,k)=>r.active?sc[k].score:0)})}
export function advantageEra(winnerIdx,series){let lastNotLead=0;series.forEach((row,i)=>{const max=Math.max(...row);if(row[winnerIdx]<max-1e-9)lastNotLead=i+1});return lastNotLead+1}
export function renderResult(){
 const s=state,b=$("resultBanner"),r=s.result;
 if(!r){if(!P(s).active){b.className="notice error";b.innerHTML=`<strong>Você foi eliminado na era ${escapeHtml(P(s).eliminatedEra)}.</strong> A partida continua entre os rivais; você pode concluir as eras para ver o final.`}else{b.className="hidden";b.innerHTML=""}return}
 const won=r.type==="victory"&&r.winners[0]==="player",drawn=r.type==="draw"&&r.winners.includes("player");
 const series=scoreSeries(),wIdx=r.type==="victory"?s.civs.findIndex(c=>c.id===r.winners[0]):-1,advEra=wIdx>=0?advantageEra(wIdx,series):null;
 const advTxt=wIdx>=0?(advEra>r.era?"":`${wIdx===0?"Você assumiu":escapeHtml(civName(s.civs[wIdx]))+" assumiu"} a liderança da pontuação na era ${advEra} e não a perdeu mais.`):"";
 const scoreTable=r.scores?`<div class="tablewrap" style="margin-top:8px"><table><thead><tr><th>Civilização</th><th>Pontuação</th><th>Força</th><th>Obras</th><th>Ciência</th><th>Ouro</th><th>Territórios</th></tr></thead><tbody>${[...r.scores].sort((a,b)=>b.score-a.score).map(x=>`<tr><td>${getCiv(s,x.id)?civLabel(getCiv(s,x.id)):escapeHtml(x.id)}</td><td><strong>${PTS(x.score)}</strong></td>${["military","infrastructure","technology","treasury","territories"].map(d=>`<td>${fmt(100*(x.parts[d]??0),0)}%</td>`).join("")}</tr>`).join("")}</tbody></table></div>`:"";
 const legend=s.civs.map(c=>`<span style="--c:${c.chartColor}">${civLabel(c)}</span>`).join("");
 b.className="notice "+(won?"success":drawn?"":"error");
 b.innerHTML=`<strong style="font-size:17px">${won?"🏆 Vitória!":drawn?"🤝 Empate":"Derrota"}</strong> · ${escapeHtml(uiText(describeResult(s,r)))} <span class="pill">${DIFFICULTIES[s.difficulty]?.name||"Médio"}</span>${advTxt?`<div style="margin-top:4px">${advTxt}</div>`:""}<div style="margin-top:4px">Estilos dos rivais: ${aiCivs(s).map(c=>`${civSymHtml(c)} <strong>${escapeHtml(civName(c))}</strong> jogou como ${escapeHtml(profileLabel(c,true))}${c.hiddenProfile?" (sorteado)":""}`).join(" · ")}.</div>
 <div class="grid two" style="margin-top:10px"><section><div class="small muted">Pontuação ao longo da partida${advEra&&advEra<=r.era?" (linha tracejada: início da vantagem)":""}</div><canvas id="endScoreChart" class="chart" style="height:180px"></canvas><div class="chart-legend">${legend}</div></section><section><div class="small muted">Territórios por era</div><canvas id="endTerrChart" class="chart" style="height:180px"></canvas><div class="chart-legend">${legend}</div></section></div>${scoreTable}
 <div class="actions" style="margin-top:10px"><button id="newGameAfterEnd" class="primary">Jogar de novo (mesmas escolhas)</button><button id="changeSettingsAfterEnd">Mudar escolhas</button></div>`;
 svgLine($("endScoreChart"),s.civs.map((c,k)=>({color:c.chartColor,data:series.map((row,i)=>({x:i+1,y:PTS(row[k])}))})),{markX:advEra&&advEra<=r.era?advEra:null});
 svgLine($("endTerrChart"),s.civs.map((c,k)=>({color:c.chartColor,data:s.timeline.map(e=>({x:e.era,y:e.civs[k].territories}))})));
 $("newGameAfterEnd").onclick=startNewGame;$("changeSettingsAfterEnd").onclick=()=>window.openSetup&&window.openSetup(true);
}
/* ── Aviso de orçamento parado ── */
export function showModal(html,buttons){
 $("modalRoot").innerHTML=`<div class="modal-back" role="dialog" aria-modal="true"><div class="modal">${html}<div class="actions" style="margin-top:14px">${buttons.map((b,i)=>`<button data-mb="${i}" class="${b.cls||""}">${b.label}</button>`).join("")}</div></div></div>`;
 buttons.forEach((b,i)=>$("modalRoot").querySelector(`[data-mb="${i}"]`).onclick=()=>{const keep=b.onClick?.();if(keep!==true)$("modalRoot").innerHTML=""});
 $("modalRoot").querySelector('[data-mb="0"]').focus();
}
export function concludeEra(){
 if(hooks.beforeConclude.some(fn=>fn()===false))return;
 if(state.result){startNewGame();return}
 const vals=readAlloc(),sum=vals.reduce((a,b)=>a+b,0),b=P(state).treasury,left=b-sum;
 if(sum>b+1e-8){renderAllocation("O total ultrapassa o orçamento.");return}
 const go=()=>{const tst=$("toast");if(tst)tst.hidden=true;const alloc={military:vals[0],infrastructure:vals[1],technology:vals[2]};playEra(alloc);AREAS.forEach(([k])=>$(k+"Spend").value=0);setSelectedTerritory(null);renderAll();window.scrollTo({top:0,behavior:"smooth"})};
 if(P(state).active&&!state.ui?.skipIdleWarning&&left>=Math.max(0.5,b*0.01)){
  showModal(`<h2>Você ainda tem ${money(left)} para investir</h2><p class="small muted">O saldo fica guardado para as próximas eras e conta para a vitória, mas não rende nada nem defende o império.</p><label class="small" style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="skipIdle"> Não perguntar de novo nesta partida</label>`,
   [{label:"Voltar e investir",cls:"primary",onClick:()=>{if($("skipIdle").checked){state.ui.skipIdleWarning=true;saveGame()}}},{label:"Concluir mesmo assim",onClick:()=>{if($("skipIdle").checked)state.ui.skipIdleWarning=true;go()}}]);
  return;
 }
 go();
}
// O tutorial joga com Fácil/1 IA/30 eras/modo lento, mas guarda as escolhas anteriores do jogador em
// state.tutorial.prevSetup; a próxima partida nova (Jogar de novo, Reiniciar...) volta a elas.
export function tutorialPrevSetup(){const p=state?.tutorial?.prevSetup;return p&&typeof p==="object"?p:null}
export function restoreSetupAfterTutorial(){
 const p=tutorialPrevSetup();if(!p)return;delete state.tutorial.prevSetup;
 try{const c=clone(configApplied),diff=DIFFICULTIES[p.difficulty]?p.difficulty:DEFAULT_DIFFICULTY;
  c.map.aiCount=p.ai;c.endgame.maxEras=p.eras;c.endgame.supremacyEnabled=p.supremacy!==false;const n=normalizeConfig(c);
  setConfigApplied(n);setGameMode(p.mode==="fast"?"fast":"slow");setCurrentDifficulty(diff);applyDifficulty(diff);runHook("configChanged");
 }catch(e){}
}
export function startNewGame(){restoreSetupAfterTutorial();setState(newGame());setSelectedTerritory(null);saveGame();renderAll();window.scrollTo({top:0})}
export function renderAll(){if(!state.ui)state.ui={skipIdleWarning:false};updateFit();renderMetrics();renderMap();renderAllocation();renderForecast();renderHistory();renderNotifications();renderVictory();renderCharts();runHook("afterRender")}
export function exportHistory(){download(`imperios-partida-era${state.era}.json`,JSON.stringify({formatVersion:VERSION,exportedAt:new Date().toISOString(),gameMode,config:configApplied,state},null,2))}
export function renderParams(){
 const groups=PARAM_GROUPS;
 $("params").innerHTML=groups.map(([title,g,items])=>`<h3>${title}</h3><div class="param-grid">${items.map(p=>paramInput(g,...p)).join("")}</div>`).join("");
 document.querySelectorAll("[data-param]").forEach(el=>el.addEventListener("change",()=>{const [g,k]=el.dataset.param.split(".");let v;try{v=paramValue(el)}catch(e){el.setAttribute("aria-invalid","true");setStatus("labStatus",e.message,"error");return}el.removeAttribute("aria-invalid");configEdited[g][k]=v;$("configState").textContent="Edição pendente";}));
}
// Valor de um campo das Configurações. Campo numérico vazio ou inválido é recusado (Number("") seria 0).
export function paramValue(el){
 if(el.type==="checkbox")return el.checked;
 if(el.type!=="number")return el.value;
 const raw=String(el.value).trim(),n=Number(raw);
 if(raw===""||!Number.isFinite(n)){const [g,k]=el.dataset.param.split("."),grp=PARAM_GROUPS.find(x=>x[1]===g),item=grp&&grp[2].find(x=>x[0]===k);throw Error(`Campo “${item?item[1]:el.dataset.param}” vazio ou inválido: escreva um número. Nada foi alterado.`)}
 return n;
}
// Lê todos os campos; se algum for inválido, lança erro sem alterar configEdited.
export function readParams(){const next=clone(configEdited);document.querySelectorAll("[data-param]").forEach(el=>{const [g,k]=el.dataset.param.split(".");next[g][k]=paramValue(el)});const c=normalizeConfig(next);setConfigEdited(next);return c}
export function applyConfig(){
 const c=readParams();rememberAiBase(c);if($("recalcExisting").checked){setConfigApplied(clone(c));setState(newGame());setSelectedTerritory(null);addLog(state,"Partida reiniciada com recálculo explícito.");}
 else setConfigApplied(clone(c));
 setConfigEdited(clone(c));renderParams();renderAll();$("configState").textContent="Configuração aplicada";setStatus("labStatus",$("recalcExisting").checked?"Configuração aplicada e partida reiniciada.":"Configuração aplicada. Investimentos existentes mantêm seus parâmetros originais.","success");
}
export function loadJsonFile(file,kind){
 const reader=new FileReader();reader.onload=()=>{try{const obj=JSON.parse(reader.result);if(kind==="config"){const c=normalizeConfig(obj.config||obj);setConfigEdited(clone(c));renderParams();setStatus("labStatus","Configuração validada e carregada na área de edição. Clique em Aplicar configurações para usar.","success")}else{if(!SUPPORTED_VERSIONS.includes(obj.formatVersion))throw Error("Versão de cenário não suportada.");const c=normalizeConfig(obj.config);if(!obj.initial||!Number.isInteger(obj.eras)||obj.eras<1)throw Error("Cenário incompleto.");scenarioLoaded=obj;setConfigEdited(clone(c));renderParams();$("scenarioName").value=obj.name||"Cenário importado";$("scenarioEras").value=obj.eras;setStatus("scenarioStatus","Cenário validado. Execute-o ou salve-o novamente.","success")}}catch(e){setStatus(kind==="config"?"labStatus":"scenarioStatus","Importação recusada: "+e.message,"error")}};reader.readAsText(file)}
export function strategyName(s){return ({military:"Militar",aggressive:"Militar agressiva",infrastructure:"Infraestrutura",technology:"Tecnologia",techFirst:"Tecnologia primeiro",growth:"Crescimento",balanced:"Equilibrada",custom:"Personalizada"})[s]||s}
export function runStrategy(strategy,eras){
 eras=safeNum(eras,1,1e7);if(!Number.isSafeInteger(eras))throw Error("Informe um número inteiro de eras.");
 const cfg=clone(configApplied),s=simulate(strategy,eras,cfg,null,[Number($("customMil").value),Number($("customInfra").value),Number($("customTech").value)],null,gameMode);
 lastStrategyResult={strategy,eras,state:s};const r=s.history[s.history.length-1]||{};
 $("strategyResult").innerHTML=`<div class="notice success"><strong>${strategyName(strategy)}</strong> após ${eras} eras: saldo ${money(P(s).treasury)}, receita acumulada ${money(r.cumRevenue||0)}, territórios ${s.owners.filter(o=>o==="player").length}, poder militar ${fmt(P(s).military,1)}.</div>`;
 setStatus("strategyStatus","Simulação concluída sem alterar a partida atual.","success");return s;
}
export async function runLong(n,opts={}){
 if(busy)return;setBusy(true);setCancelRequested(false);$("cancelAdvance").disabled=false;$("advance").disabled=true;let done=0;const start=performance.now();
 try{while(done<n&&!cancelRequested&&!state.result){const batch=Math.min(configApplied.simulation.blockSize,n-done);for(let i=0;i<batch&&!state.result;i++){playEra({military:0,infrastructure:0,technology:0});done++}$("advanceProgress").style.width=(100*done/n)+"%";setStatus("advanceStatus",`Processadas ${fmt(done,0)} de ${fmt(n,0)} eras · era atual ${state.era} · ${fmt(performance.now()-start,0)} ms`);renderMetrics();await new Promise(r=>setTimeout(r,0))}
 renderAll();setStatus("advanceStatus",cancelRequested?`Cancelado após ${done} eras concluídas. O histórico foi preservado.`:state.result?`Partida encerrada após ${done} eras: ${describeResult(state,state.result)}`:`Concluído: ${done} eras processadas. Era atual: ${state.era}.`,"success");
 }catch(e){renderAll();setStatus("advanceStatus","Simulação interrompida: "+e.message,"error")}finally{setBusy(false);$("cancelAdvance").disabled=true;$("advance").disabled=false}
}
export async function compareStrategies(){
 const selected=[...document.querySelectorAll('#compareChecks input:checked')].map(x=>x.value);if(selected.length<2){setStatus("compareStatus","Selecione pelo menos duas estratégias.","error");return}
 const eras=safeNum($("compareEras").value,1,1e6);if(!Number.isSafeInteger(eras))throw Error("Quantidade de eras deve ser inteira.");
 let custom=[34,33,33];const raw=$("compareCustom").value.split(/[\/;, ]+/).filter(Boolean).map(Number);if(raw.length===3&&raw.every(v=>Number.isFinite(v)&&v>=0))custom=raw;
 compareResults=[];$("compareTable").innerHTML="";setStatus("compareStatus","Executando simulações independentes com expansão territorial ativa...");await new Promise(r=>setTimeout(r,0));
 for(let i=0;i<selected.length;i++){
  const strategy=selected[i],cfg=clone(configApplied);cfg.military.aiEnabled=$("compareAI").checked;cfg.military.aiTarget=$("compareTarget").value;
  const s=simulate(strategy,eras,cfg,null,custom,null,gameMode),last=s.history[s.history.length-1]||{},a=s.attacks||{};
  const rec={strategy,state:s,summary:{lastRevenue:last.total||0,cumRevenue:last.cumRevenue||0,budget:P(s).treasury,military:P(s).military,territories:s.owners.filter(o=>o==="player").length,maxTerritories:P(s).maxTerritories||1,territoryYears:P(s).territoryYears||0,militaryEfficiency:((a.playerWins||0)+(a.playerLosses||0))?100*(a.playerWins||0)/((a.playerWins||0)+(a.playerLosses||0)):0,neutralConquests:a.neutralConquests||0,enemyConquests:a.enemyConquests||0,attackWins:a.playerWins||0,attackLosses:a.playerLosses||0,aiWins:a.aiWins||0,invested:P(s).invested,infra:P(s).infraTotal,tech:s.history.reduce((z,r)=>z+r.tech,0),milEfficiency:(a.neutralConquests||0)+(a.enemyConquests||0),firstInfra:s.investments.find(x=>x.owner==="player"&&x.type==="infrastructure")?.origin+cfg.infrastructure.delay||"—",firstTech:s.investments.find(x=>x.owner==="player"&&x.type==="technology")?.origin+cfg.technology.delay||"—"} };
  compareResults.push(rec);const q=rec.summary;
  $("compareTable").innerHTML+=`<tr><td><strong>${strategyName(strategy)}</strong></td><td>${money(q.lastRevenue)}</td><td>${money(q.cumRevenue)}</td><td>${money(q.budget)}</td><td>${fmt(q.military,1)}</td><td>${q.territories}</td><td>${q.maxTerritories}</td><td>${q.territoryYears}</td><td>${fmt(q.militaryEfficiency,1)}%</td><td>${q.neutralConquests}</td><td>${q.enemyConquests}</td><td>${q.attackWins}</td><td>${q.attackLosses}</td><td>${money(q.invested.military)}</td><td>${money(q.invested.infrastructure)}</td><td>${money(q.invested.technology)}</td><td>${money(q.infra)}</td><td>${money(q.tech)}</td><td>${q.firstInfra}</td><td>${q.firstTech}</td></tr>`;
  setStatus("compareStatus",`Concluídas ${i+1}/${selected.length}: ${strategyName(strategy)}.`);await new Promise(r=>setTimeout(r,0));
 }
 const draw=(canvas,key,acc=false)=>svgLine($(canvas),compareResults.map((r,i)=>({color:COMPARE_COLORS[i%COMPARE_COLORS.length],data:r.state.history.map(h=>({x:h.era,y:acc?h.cumRevenue:key==="budget"?h.budget:key==="territories"?h.territories:key==="military"?h.military:h.total}))})));
 draw("compareRevenue","revenue");draw("compareAccum","revenue",true);draw("compareTerritory","territories");draw("compareBalance","budget");svgLine($("compareAttacks"),compareResults.map((r,i)=>({color:COMPARE_COLORS[i%COMPARE_COLORS.length],data:r.state.history.map(h=>({x:h.era,y:(h.attacksTotal?.playerWins||0)}))})));
 $("compareLegend").innerHTML=compareResults.map((r,i)=>`<span style="--c:${COMPARE_COLORS[i%COMPARE_COLORS.length]}">${strategyName(r.strategy)}</span>`).join("");
 setStatus("compareStatus",`${compareResults.length} estratégias comparadas em ${eras} eras. Métricas territoriais incluem máximo de territórios, conquistas neutras/inimigas e ataques ganhos/perdidos. IA ${$("compareAI").checked?"ativada":"desativada"}. Partida principal preservada.`,"success");
}
export function scenarioPreset(kind){
 const c=clone(DEFAULTS);
 if(kind==="fast"){c.military.pointsPerInvestment=.22;c.military.conquestCost=3;c.military.defenseNeutral=2;c.military.defenseOwned=5;c.military.delay=1;c.infrastructure.delay=1;c.infrastructure.duration=6;c.technology.delay=6}
 if(kind==="balanced"){c.military.pointsPerInvestment=.12;c.military.conquestCost=8;c.military.defenseNeutral=3;c.military.defenseOwned=8;c.infrastructure.initialReturn=.12;c.infrastructure.peakEra=3;c.infrastructure.declineRate=.16;c.technology.delay=4}
 if(kind==="long"){c.military.pointsPerInvestment=.08;c.infrastructure.delay=3;c.infrastructure.duration=30;c.infrastructure.peakEra=8;c.infrastructure.growthRate=.12;c.infrastructure.declineRate=.08;c.technology.delay=7;c.technology.benefitPerProgress=.13}
 setConfigEdited(clone(c));renderParams();setStatus("scenarioStatus",`Cenário "${kind}" carregado na edição. Aplique a configuração ou exporte como cenário.`,"success");
 scenarioLoaded={formatVersion:VERSION,name:kind,config:c,initial:newState(c),eras:Number($("scenarioEras").value)||50,strategy:"balanced"};
}
export function scenarioObject(){return {formatVersion:VERSION,name:$("scenarioName").value||"Meu cenário",config:normalizeConfig(configEdited),initial:newState(normalizeConfig(configEdited)),eras:safeNum($("scenarioEras").value,1,1e7),strategy:"balanced"}}
export function renderScenarioResult(s,name){const r=s.history[s.history.length-1]||{};$("scenarioResult").innerHTML=`<div class="notice success">${escapeHtml(name)}: ${s.era} eras, saldo ${money(P(s).treasury)}, receita acumulada ${money(r.cumRevenue||0)}, ${s.owners.filter(o=>o==="player").length} territórios e poder militar ${fmt(P(s).military,1)}.</div>`}
export let aiValidationResults=[];
export let balanceLabResults=[];
export async function runAiValidation(){
 if(busy)return;const profiles=[...document.querySelectorAll('#aiValidationProfiles input:checked')].map(x=>x.value);if(!profiles.length)throw Error("Selecione ao menos um perfil.");
 const runs=safeNum($("aiValidationRuns").value,3,100),eras=safeNum($("aiValidationEras").value,5,100);if(!Number.isInteger(runs)||!Number.isInteger(eras))throw Error("Sementes e eras devem ser números inteiros.");
 setBusy(true);$("runAiValidation").disabled=true;aiValidationResults=[];$("aiValidationTable").innerHTML="";$("aiValidationDetails").innerHTML="";$("aiValidationProgress").style.width="0%";
 const total=profiles.length,details=[];
 try{
  for(let pi=0;pi<profiles.length;pi++){
   const profile=profiles[pi],cfg=clone(configApplied);cfg.military.aiStyle=profile;cfg.military.aiEnabled=true;cfg.military.aiAggression=55;cfg.military.aiReserve=0;
   let financePass=0,financeTotal=0,attackControlPass=0,attackControlTotal=0,investShares=[0,0,0],investCount=0,completed=0,invalid=0;
   for(let k=0;k<runs;k++){
    const c=clone(cfg);c.simulation.seed=(Number(configApplied.simulation.seed)+k*7919+pi*104729)>>>0;const s=newState(c,{mode:gameMode});
    try{for(let e=0;e<eras;e++){const treasuryBefore=A(s).treasury;processEra(s,c,{playerAllocation:e===0?{military:0,infrastructure:0,technology:0}:undefined});const row=s.history.at(-1);financeTotal++;const available=treasuryBefore+(row.aiRevenue?.total||0);if(Number.isFinite(A(s).treasury)&&A(s).treasury>=-1e-8&&Number.isFinite(row.aiBudgetInvested)&&row.aiBudgetInvested<=available+1e-6&&Math.abs(A(s).treasury-(available-row.aiBudgetInvested))<1e-5)financePass++;const inv=row.aiInvestment||{},sum=inv.military+inv.infrastructure+inv.technology;if(sum>0){investShares[0]+=inv.military/sum;investShares[1]+=inv.infrastructure/sum;investShares[2]+=inv.technology/sum;investCount++}}completed++;}catch(e){invalid++;details.push(`${AI_PROFILE_NAMES[profile]} · semente ${c.simulation.seed}: ${e.message}`)}
    const noAttack=runAiControlProbe(profile,0,c.simulation.seed+17),mustAttack=runAiControlProbe(profile,100,c.simulation.seed+31);attackControlTotal+=2;if(noAttack.attacks===0&&mustAttack.attacks>0&&mustAttack.valid)attackControlPass+=2;
   }
   const actual=investShares.map(v=>investCount?v/investCount:0),expected=profileExpectedWeights(profile,cfg);let profileScore=null;
   if(expected){const es=expected.reduce((a,b)=>a+Math.max(0,b),0)||1,dist=actual.reduce((a,v,i)=>a+Math.abs(v-Math.max(0,expected[i])/es),0)/2;profileScore=clamp(100*(1-dist),0,100)}
   let adaptation=null;if(profile==="adaptive"){const safe=aiProbe(profile,false,cfg.simulation.seed+777),threat=aiProbe(profile,true,cfg.simulation.seed+777);adaptation=clamp(50+(threat.military-safe.military)*100,0,100);details.push(`${AI_PROFILE_NAMES[profile]}: parcela militar em segurança ${fmt(safe.military*100,1)}% → sob ameaça ${fmt(threat.military*100,1)}%.`);if(threat.military<=safe.military+0.02)details.push(`${AI_PROFILE_NAMES[profile]}: a participação militar não aumentou claramente sob ameaça.`)}
   const finance=pct(financePass,financeTotal),attack=pct(attackControlPass,attackControlTotal);let weighted=finance*.35+attack*.15,weightTotal=50;if(profileScore!==null){weighted+=profileScore*.35;weightTotal+=35}if(adaptation!==null){weighted+=adaptation*.15;weightTotal+=15}const overall=weighted*100/weightTotal;
   const rec={profile,name:AI_PROFILE_NAMES[profile],finance,profileScore,adaptation,attack,overall,completed,invalid,shares:actual};aiValidationResults.push(rec);
   $("aiValidationTable").innerHTML+=`<tr><td><strong>${rec.name}</strong></td><td>${fmt(finance,1)}%</td><td>${profileScore===null?'N/A':fmt(profileScore,1)+'%'}</td><td>${adaptation===null?'N/A':fmt(adaptation,1)+'%'}</td><td>${fmt(attack,1)}%</td><td><strong>${fmt(overall,1)}%</strong></td></tr>`;
   $("aiValidationProgress").style.width=(100*(pi+1)/total)+"%";setStatus("aiValidationStatus",`Validando ${rec.name}: ${pi+1}/${total} perfis · ${completed}/${runs} execuções completas.`);await new Promise(r=>setTimeout(r,0));
  }
  const avg=aiValidationResults.reduce((a,r)=>a+r.overall,0)/aiValidationResults.length;
  $("aiValidationSummary").innerHTML=`<div class="notice ${avg>=80?'success':'notice'}"><strong>Conformidade média: ${fmt(avg,1)}%</strong> · ${aiValidationResults.reduce((a,r)=>a+r.completed,0)} execuções completas · ${aiValidationResults.reduce((a,r)=>a+r.invalid,0)} execuções com erro. Esta nota resume apenas os benchmarks implementados.</div>`;
  $("aiValidationDetails").innerHTML=details.length?`<div class="notice">${details.map(x=>`<div>${x}</div>`).join("")}</div>`:'<div class="notice success">Nenhuma anomalia adicional detectada pelos benchmarks executados.</div>';
  setStatus("aiValidationStatus","Validação concluída. Examine as dimensões individualmente; uma média alta não substitui revisão de decisões reais.","success");
 }finally{setBusy(false);$("runAiValidation").disabled=false}
}
export function exportAiValidation(){if(!aiValidationResults.length){setStatus("aiValidationStatus","Execute a validação antes de exportar.","error");return}const rows=[["profile","finance_pct","profile_alignment_pct","adaptation_pct","attack_control_pct","overall_pct","completed","invalid","military_share","infrastructure_share","technology_share"],...aiValidationResults.map(r=>[r.profile,r.finance,r.profileScore??"",r.adaptation??"",r.attack,r.overall,r.completed,r.invalid,...r.shares])];download("imperios-validacao-ias.csv",rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(";")).join("\n"),"text/csv;charset=utf-8")}
export function sideMetrics(s){const last=s.history.at(-1)||{},aiRevenue=s.history.reduce((a,r)=>a+(r.aiRevenue?.total||0),0),playerRevenue=s.history.reduce((a,r)=>a+(r.total||0),0);return {pTerr:s.owners.filter(o=>o==="player").length,aTerr:s.owners.filter(o=>o==="ai").length,pBudget:P(s).treasury,aBudget:A(s).treasury,pMil:P(s).military,aMil:A(s).military,pRevenue:playerRevenue,aRevenue:aiRevenue,pInvest:s.investments.filter(i=>i.owner==="player").reduce((a,i)=>a+i.amount,0),aInvest:s.investments.filter(i=>i.owner==="ai").reduce((a,i)=>a+i.amount,0),eras:s.era,valid:Number.isFinite(P(s).treasury)&&Number.isFinite(A(s).treasury)&&P(s).treasury>=-1e-8&&A(s).treasury>=-1e-8}}
export function share(a,b){return a+b>0?a/(a+b):.5}
export function matchupIndex(m){return 100*(share(m.pTerr,m.aTerr)+share(m.pBudget,m.aBudget)+share(m.pMil,m.aMil)+share(m.pRevenue,m.aRevenue))/4}
export async function runBalanceLab(){
 if(busy)return;const strategies=[...document.querySelectorAll('#balanceStrategies input:checked')].map(x=>x.value),profiles=[...document.querySelectorAll('#balanceProfiles input:checked')].map(x=>x.value);if(!strategies.length||!profiles.length)throw Error("Selecione ao menos uma estratégia e um perfil adversário.");
 const seeds=safeNum($("balanceSeeds").value,3,100),eras=safeNum($("balanceEras").value,5,300);if(!Number.isInteger(seeds)||!Number.isInteger(eras))throw Error("Sementes e eras devem ser inteiros.");
 const total=strategies.length*profiles.length*seeds;let done=0;setBusy(true);$("runBalanceLab").disabled=true;balanceLabResults=[];$("balanceTable").innerHTML="";$("balanceProgress").style.width="0%";
 try{
  for(const strategy of strategies)for(const profile of profiles){let aggregate={pTerr:0,aTerr:0,pBudget:0,aBudget:0,pMil:0,aMil:0,pRevenue:0,aRevenue:0,pInvest:0,aInvest:0},valid=0;
   for(let k=0;k<seeds;k++){
    const cfg=clone(configApplied);cfg.military.aiEnabled=true;cfg.military.aiStyle=profile;cfg.simulation.seed=(Number(configApplied.simulation.seed)+k*104729)>>>0;
    const s=simulate(strategy,eras,cfg,null,undefined,null,gameMode);const m=sideMetrics(s);if(m.valid){valid++;for(const key of Object.keys(aggregate))aggregate[key]+=m[key]}
    done++;$("balanceProgress").style.width=(100*done/total)+"%";
    if(done%4===0){setStatus("balanceStatus",`Executando confrontos: ${done}/${total} partidas · ${strategyName(strategy)} contra ${AI_PROFILE_NAMES[profile]}.`);await new Promise(r=>setTimeout(r,0))}
   }
   const avg={};for(const key of Object.keys(aggregate))avg[key]=valid?aggregate[key]/valid:0;const advantage=matchupIndex(avg);const rec={strategy,profile,name:AI_PROFILE_NAMES[profile],valid,total:seeds,advantage,...avg};balanceLabResults.push(rec);
   $("balanceTable").innerHTML+=`<tr><td><strong>${strategyName(strategy)}</strong></td><td>${rec.name}</td><td><strong>${fmt(advantage,1)}%</strong></td><td>${fmt(avg.pTerr,1)} / ${fmt(avg.aTerr,1)}</td><td>${money(avg.pBudget)} / ${money(avg.aBudget)}</td><td>${fmt(avg.pMil,1)} / ${fmt(avg.aMil,1)}</td><td>${money(avg.pRevenue)} / ${money(avg.aRevenue)}</td><td>${money(avg.pInvest)} / ${money(avg.aInvest)}</td><td>${valid}/${seeds}</td></tr>`;
  }
  const avgAdv=balanceLabResults.reduce((a,r)=>a+r.advantage,0)/balanceLabResults.length,invalid=balanceLabResults.reduce((a,r)=>a+r.total-r.valid,0);
  $("balanceSummary").innerHTML=`<div class="notice ${invalid===0?'success':'error'}"><strong>Índice médio de vantagem do jogador: ${fmt(avgAdv,1)}%</strong> · ${done} partidas executadas · ${invalid} partidas inválidas. 50% representa paridade nas quatro dimensões avaliadas.</div>`;
  setStatus("balanceStatus","Torneio concluído. Compare os confrontos e métricas individuais; o índice não representa taxa de vitória.","success");
 }finally{setBusy(false);$("runBalanceLab").disabled=false}
}
export function exportBalanceLab(){if(!balanceLabResults.length){setStatus("balanceStatus","Execute o torneio antes de exportar.","error");return}const rows=[["strategy","ai_profile","player_advantage_index","player_territories_avg","ai_territories_avg","player_treasury_avg","ai_treasury_avg","player_military_avg","ai_military_avg","player_cumulative_revenue_avg","ai_cumulative_revenue_avg","player_investment_avg","ai_investment_avg","valid_matches","requested_matches"],...balanceLabResults.map(r=>[r.strategy,r.profile,r.advantage,r.pTerr,r.aTerr,r.pBudget,r.aBudget,r.pMil,r.aMil,r.pRevenue,r.aRevenue,r.pInvest,r.aInvest,r.valid,r.total])];download("imperios-laboratorio-balanceamento.csv",rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(";")).join("\n"),"text/csv;charset=utf-8")}
/* ── Interface: duração fixa e referências ── */
export let fixedRun={games:[],calibration:null,opts:null},fixedCancel=false;
export function readFixedOpts(){
 const games=safeNum($("fixedGames").value,1,2000),eras=safeNum($("fixedEras").value,1,300),civCount=safeNum($("fixedCivs").value,2,1+MAX_AI),baseSeed=safeNum($("fixedSeed").value,0,4294967295);
 if(![games,eras,civCount,baseSeed].every(Number.isInteger))throw Error("Partidas, eras, civilizações e semente devem ser inteiros.");
 const profiles=[...document.querySelectorAll("#fixedProfiles input:checked")].map(x=>x.value);if(!profiles.length)throw Error("Selecione pelo menos um perfil.");
 if(civCount>configApplied.map.territories)throw Error("Mais civilizações do que territórios.");
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
export function readSimOpts(prefix){
 const num=(id,min,max)=>{const v=safeNum($(prefix+id).value,min,max);if(!Number.isInteger(v))throw Error("Use números inteiros nas configurações da simulação.");return v};
 const profiles=[...document.querySelectorAll(`#${prefix}Profiles input:checked`)].map(x=>x.value);if(!profiles.length)throw Error("Selecione pelo menos um perfil.");
 return {kind:$(prefix+"Kind").value==="fixed"?"fixed":"auto",games:num("Games",1,5000),eras:num("Eras",1,300),civCount:num("Civs",2,1+MAX_AI),baseSeed:num("Seed",0,4294967295),mode:["fast","both"].includes($(prefix+"Mode").value)?$(prefix+"Mode").value:"slow",profiles};
}
export function profileChecks(containerId){$(containerId).innerHTML=LAB_PROFILES.map(([v,n])=>`<label><input type="checkbox" value="${v}" checked> ${n}</label>`).join("")}
/* ── Gráfico de barras agrupadas (canvas) ── */
export function barChart(canvas,labels,series,opts={}){
 const ctx=canvas.getContext("2d"),dpr=window.devicePixelRatio||1,w=canvas.clientWidth||300,h=canvas.clientHeight||220;canvas.width=w*dpr;canvas.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
 const pad={l:38,r:8,t:12,b:34},pw=w-pad.l-pad.r,ph=h-pad.t-pad.b,all=series.flatMap(s=>s.values).filter(Number.isFinite),max=opts.max??Math.max(1,...all);
 ctx.font="10px system-ui";ctx.strokeStyle="#293951";ctx.fillStyle="#9fb0c7";
 for(let i=0;i<=4;i++){const y=pad.t+ph*i/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText(fmt(max*(1-i/4),0)+(opts.unit||""),2,y+3)}
 const gw=pw/Math.max(1,labels.length),bw=Math.max(2,Math.min(26,(gw-8)/Math.max(1,series.length)));
 labels.forEach((lab,i)=>{const x0=pad.l+gw*i+(gw-bw*series.length)/2;series.forEach((s,k)=>{const v=s.values[i];if(!Number.isFinite(v))return;const bh=ph*clamp(v/max,0,1);ctx.fillStyle=s.color;ctx.fillRect(x0+k*bw,pad.t+ph-bh,bw-1,bh)});ctx.fillStyle="#9fb0c7";const t=String(lab);ctx.fillText(t.length>14?t.slice(0,13)+"…":t,pad.l+gw*i+2,h-pad.b+14)});
}
export const legendHtml=items=>items.map(([name,color])=>`<span style="--c:${cssColor(color)}">${escapeHtml(name)}</span>`).join("");
// Corre os testes e, se a aba "Testes funcionais" estiver ligada (versão de desenvolvimento), mostra o resultado.
export let ftLabReady=false;
export function runFtTests(filter,label){const r=executeTests(filter,label);if(ftLabReady){$("ftRepeat").disabled=false;renderFtLab()}return r}
export function runTests(){return runFtTests(()=>true,"Todos os testes")}
export function renderFtLab(){
 const reg=testRegistry(),q=($("ftFilter")?.value||"").trim().toLowerCase(),onlyFail=$("ftOnlyFail")?.checked;
 const ran=reg.filter(t=>ftResults.has(t.id)),pass=ran.filter(t=>ftResults.get(t.id).ok).length,last=ftHistory[0];
 const perCat=TEST_CATS.map(([c,n])=>{const ts=reg.filter(t=>t.cat===c),r=ts.filter(t=>ftResults.has(t.id)),p=r.filter(t=>ftResults.get(t.id).ok).length;return {c,n,total:ts.length,ran:r.length,pass:p}});
 if(ran.length){const allOk=pass===ran.length;$("testSummary").className="notice "+(allOk?"success":"error");
  $("testSummary").innerHTML=`<strong>${pass}/${ran.length} testes aprovados.</strong> ${allOk?"Núcleo validado pelos testes incluídos.":"Revise as falhas listadas abaixo."} · Aprovação ${fmt(100*pass/ran.length,1)}% · ${reg.length-ran.length?`${reg.length-ran.length} por executar · `:""}${last?`última execução: ${last.label}, ${fmt(last.ms,0)} ms`:""}<pre class="small" style="margin:8px 0 0;white-space:pre-wrap;color:inherit">LABORATÓRIO DE TESTES FUNCIONAIS\nTotal de testes: ${ran.length}  Aprovados: ${pass}  Reprovados: ${ran.length-pass}\n${perCat.filter(x=>x.ran).map(x=>`${x.n.toUpperCase()}: ${x.pass}/${x.ran}`).join("\n")}\nEstado: ${allOk?"SEM FALHAS":"FALHAS DETETADAS"}</pre>`}
 $("ftCategories").innerHTML=perCat.map(x=>`<div class="card metric"><div class="label">${x.c} · ${x.n}</div><div class="value ${!x.ran?"":x.pass===x.ran?"green":"red"}" style="font-size:20px">${x.ran?`${x.pass}/${x.ran}`:`— /${x.total}`}</div><div class="foot"><button class="small" data-ft-cat="${x.c}" style="padding:4px 8px">Executar categoria</button></div></div>`).join("");
 const rows=reg.filter(t=>{const r=ftResults.get(t.id);if(onlyFail&&!(r&&!r.ok))return false;return !q||t.name.toLowerCase().includes(q)||t.id.toLowerCase().includes(q)});
 $("testResults").innerHTML=TEST_CATS.map(([c,n])=>{const ts=rows.filter(t=>t.cat===c);if(!ts.length)return "";return `<h3>${n}</h3>`+ts.map(t=>{const r=ftResults.get(t.id);return `<div class="test"><div style="min-width:0"><strong>${t.name}</strong> <span class="pill">${t.id}</span><div class="small muted">${r?(r.ok?r.msg:`<span class="red">Falha:</span> ${r.msg}`):"Ainda não executado."}${r?` · ${fmt(r.ms,1)} ms`:""}</div></div><div class="row" style="flex-wrap:nowrap"><span class="${r?(r.ok?"pass":"fail"):"muted"}">${r?(r.ok?"APROVADO":"REPROVADO"):"—"}</span><button class="small" data-ft-run="${t.id}" style="padding:4px 8px">${r?"Repetir":"Executar"}</button></div></div>`}).join("")}).join("")||'<div class="small muted">Nenhum teste corresponde ao filtro.</div>';
 $("ftHistory").innerHTML=ftHistory.length?`<div class="tablewrap"><table><thead><tr><th>Quando</th><th>Execução</th><th>Aprovados</th><th>Reprovados</th><th>Tempo</th><th>Falhas</th></tr></thead><tbody>${ftHistory.map(h=>`<tr><td>${new Date(h.at).toLocaleString("pt-BR")}</td><td>${h.label}</td><td>${h.pass}/${h.total}</td><td class="${h.fail?"red":""}">${h.fail}</td><td>${fmt(h.ms,0)} ms</td><td>${h.failed.join(", ")||"—"}</td></tr>`).join("")}</tbody></table></div>`:"Sem execuções registadas.";
 document.querySelectorAll("[data-ft-run]").forEach(b=>b.onclick=()=>{const id=b.dataset.ftRun;runFtTests(t=>t.id===id,"Teste "+id)});
 document.querySelectorAll("[data-ft-cat]").forEach(b=>b.onclick=()=>{const c=b.dataset.ftCat;runFtTests(t=>t.cat===c,"Categoria "+c)});
}
export function exportFtReport(){const reg=testRegistry();csvDownload("imperios-testes-funcionais.csv",[["id","category","name","status","ms","message"],...reg.map(t=>{const r=ftResults.get(t.id);return [t.id,t.cat,t.name,r?(r.ok?"pass":"fail"):"not_run",r?r.ms.toFixed(2):"",r?.msg||""]})])}
export function setupFtLab(){
 $("ftCategory").innerHTML=TEST_CATS.map(([c,n])=>`<option value="${c}">${c} · ${n}</option>`).join("");
 $("runCategory").onclick=()=>{const c=$("ftCategory").value;runFtTests(t=>t.cat===c,"Categoria "+c)};
 $("ftRepeat").onclick=()=>{if(ftLastRun)runFtTests(ftLastRun.filter,ftLastRun.label+" (repetição)")};
 $("ftFilter").oninput=renderFtLab;$("ftOnlyFail").onchange=renderFtLab;$("ftExport").onclick=exportFtReport;
 ftLabReady=true;if(ftLastRun)$("ftRepeat").disabled=false;renderFtLab();
}
export function renderExpTable(){
 const cat=paramCatalog(),defs=expState.params.map(id=>cat.find(c=>c.id===id)).filter(Boolean);
 $("expHead").innerHTML=`<th>Cenário</th>${defs.map(d=>`<th>${d.label}<button class="small" data-exp-delparam="${d.id}" title="Remover coluna" style="padding:1px 6px;margin-left:6px">×</button></th>`).join("")}<th></th>`;
 $("expBody").innerHTML=expState.scenarios.map((s,i)=>`<tr><td><span class="dot" style="background:${SCENARIO_COLORS[i%SCENARIO_COLORS.length]}"></span><input data-exp-name="${i}" value="${escapeHtml(s.name)}" style="width:230px"></td>${defs.map(d=>{const v=s.values[d.id]??getParam(configApplied,d.id);return `<td>${d.type==="boolean"?`<input type="checkbox" data-exp-cell="${i}|${d.id}" ${v?"checked":""}>`:d.type==="string"?`<select data-exp-cell="${i}|${d.id}">${(PARAM_OPTIONS[d.key]||[]).map(([o,t])=>`<option value="${o}" ${o===v?"selected":""}>${t}</option>`).join("")}</select>`:`<input type="number" step="any" data-exp-cell="${i}|${d.id}" value="${v}" style="width:100px">`}</td>`}).join("")}<td class="row" style="flex-wrap:nowrap"><button class="small" data-exp-dup="${i}" style="padding:4px 8px">Duplicar</button><button class="small danger" data-exp-del="${i}" style="padding:4px 8px" ${expState.scenarios.length<2?"disabled":""}>Remover</button></td></tr>`).join("");
 document.querySelectorAll("[data-exp-name]").forEach(el=>el.onchange=()=>{expState.scenarios[+el.dataset.expName].name=el.value||"Cenário"});
 document.querySelectorAll("[data-exp-cell]").forEach(el=>el.onchange=()=>{const [i,id]=el.dataset.expCell.split("|"),d=cat.find(c=>c.id===id);try{expState.scenarios[+i].values[id]=parseParamValue(d,el.type==="checkbox"?el.checked:el.value);setStatus("expStatus","Cenário atualizado.")}catch(e){setStatus("expStatus",e.message,"error")}});
 document.querySelectorAll("[data-exp-dup]").forEach(b=>b.onclick=()=>{const s=expState.scenarios[+b.dataset.expDup];expState.scenarios.splice(+b.dataset.expDup+1,0,{name:s.name+" (cópia)",values:clone(s.values)});renderExpTable()});
 document.querySelectorAll("[data-exp-del]").forEach(b=>b.onclick=()=>{expState.scenarios.splice(+b.dataset.expDel,1);renderExpTable()});
 document.querySelectorAll("[data-exp-delparam]").forEach(b=>b.onclick=()=>{const id=b.dataset.expDelparam;expState.params=expState.params.filter(p=>p!==id);expState.scenarios.forEach(s=>delete s.values[id]);renderExpTable()});
}
export function addExpParam(id){if(!expState.params.includes(id)){expState.params.push(id);expState.scenarios.forEach(s=>{if(s.values[id]===undefined)s.values[id]=getParam(configApplied,id)})}renderExpTable()}
export function generateVariations(){
 const id=$("expVaryParam").value,d=paramCatalog().find(c=>c.id===id),raw=$("expVaryValues").value.split(/[;|]+/).map(x=>x.trim()).filter(Boolean);
 if(!raw.length)throw Error("Indique os valores separados por ponto e vírgula.");
 const vals=raw.map(v=>parseParamValue(d,v));if(!expState.params.includes(id))expState.params.push(id);
 const base=expState.scenarios[0]?.values||{};
 expState.scenarios=vals.map(v=>({name:`${d.label.split(" · ")[1]} = ${typeof v==="number"?fmt(v,3):v}`,values:{...clone(base),[id]:v}}));
 expState.scenarios.forEach(s=>expState.params.forEach(p=>{if(s.values[p]===undefined)s.values[p]=getParam(configApplied,p)}));
 renderExpTable();setStatus("expStatus",`${vals.length} cenários gerados a partir de ${d.label}.`,"success");
}
export async function runExperiment(){
 if(busy)return;const opts=readSimOpts("exp");
 if(!expState.scenarios.length)throw Error("Crie pelo menos um cenário.");
 const modes=opts.mode==="both"?["slow","fast"]:[opts.mode],scen=[];
 expState.scenarios.forEach(s=>{let cfg;try{cfg=scenarioConfig(configApplied,s.values)}catch(e){throw Error(`Cenário "${s.name}": ${e.message}`)}
  for(const m of modes)scen.push({name:modes.length>1?`${s.name} · ${m==="fast"?"rápido":"lento"}`:s.name,values:clone(s.values),cfg,mode:m,color:SCENARIO_COLORS[scen.length%SCENARIO_COLORS.length]})});
 const est=estimateRows(opts,scen.length,scen.map(s=>s.cfg));if(est>ROW_WARN&&!confirm(`Esta experiência vai guardar cerca de ${fmt(est/1e6,1)} milhões de registos (civilização × era) em memória. Continuar?`))return;
 if(opts.civCount>configApplied.map.territories)throw Error("Mais civilizações do que territórios.");
 setBusy(true);setExpCancel(false);$("runExp").disabled=true;$("cancelExp").disabled=false;$("expProgress").style.width="0%";$("expResults").innerHTML="";$("expCharts").classList.add("hidden");
 // Mesmas sementes, perfis e condições em todos os cenários: a partida g de cada cenário usa a
 // semente g e a mesma rotação de perfis. As partidas são intercaladas por rodada para que um
 // cancelamento deixe todos os cenários com o mesmo número de partidas.
 const perScen=scen.map(s=>buildJobs(s.cfg,opts,{scenario:s.name,mode:s.mode})),jobs=[];for(let g=0;g<opts.games;g++)perScen.forEach(js=>jobs.push(js[g]));
 try{
  const recs=await runGameJobs(jobs,(d,t,ms)=>{$("expProgress").style.width=(100*d/t)+"%";setStatus("expStatus",`A executar · ${d} de ${t} partidas (${fmt(100*d/t,0)}%) · ${fmt(ms/1000,1)} s decorridos`)},()=>expCancel,scen.length);
  if(!recs.length){setStatus("expStatus","Cancelado antes de concluir qualquer rodada.","error");return}
  scen.forEach(s=>s.recs=[]);recs.forEach(r=>scen.find(s=>s.name===r.scenario).recs.push(r));
  expState.results={opts,scenarios:scen,at:new Date().toISOString()};
  renderExpResults();
  const per=scen[0].recs.length;setStatus("expStatus",expCancel?`Cancelado: ${per} partidas por cenário concluídas e preservadas (rodadas completas).`:`Concluído: ${scen.length} cenários × ${per} partidas (${opts.kind==="auto"?"encerramento automático":"duração fixa"}${modes.length>1?", lento e rápido":""}).`,"success");refreshValConfigOptions();
 }finally{setBusy(false);$("runExp").disabled=false;$("cancelExp").disabled=true}
}
export function renderExpResults(){
 const R=expState.results;if(!R)return;const fixed=R.opts.kind==="fixed";
 R.scenarios.forEach(s=>{s.sum=summarizeRecords(s.recs);s.prof=profileStats(s.recs)});
 const pc=v=>fmt(v,1)+"%";
 const head=`<tr><th>Cenário</th><th>Partidas</th>${fixed?"<th>Condição atingida</th>":""}<th>Supremacia</th><th>Territorial</th><th>Eliminação</th>${fixed?"":"<th>Pontuação</th>"}<th>Empates</th>${fixed?"<th>Sem condição</th>":""}<th>${fixed?"Era média da 1ª condição":"Era média"}</th><th>Mediana</th><th>Mín–máx</th><th>% territórios do vencedor</th><th>Era em que alguém atinge o mínimo territorial</th><th>Sequências iniciadas / partida</th><th>Interrompidas</th><th>Relação ICE média</th><th>Recursos não usados</th><th></th></tr>`;
 const rows=R.scenarios.map(s=>{const m=s.sum,ratios=m.ratioMean.filter(v=>v!=null);return `<tr><td><span class="dot" style="background:${cssColor(s.color)}"></span><strong>${escapeHtml(s.name)}</strong></td><td>${m.games}</td>${fixed?`<td>${pc(100-m.pct("none"))}</td>`:""}<td>${pc(m.pct("supremacy"))}</td><td>${pc(m.pct("territorial"))}</td><td>${pc(m.pct("elimination"))}</td>${fixed?"":`<td>${pc(m.pct("score"))}</td>`}<td>${pc(m.pct("draw"))}</td>${fixed?`<td>${pc(m.pct("none"))}</td>`:""}<td>${fmt(mean(m.endEras),1)}</td><td>${fmt(median(m.endEras),1)}</td><td>${m.endEras.length?`${Math.min(...m.endEras)}–${Math.max(...m.endEras)}`:"—"}</td><td>${m.winnerTerrShare.length?pc(100*mean(m.winnerTerrShare)):"—"}</td><td>${m.thresholdEra.length?`${fmt(mean(m.thresholdEra),1)} (${pc(100*m.thresholdEra.length/m.games)})`:"nunca"}</td><td>${fmt(m.streaksStarted/m.games,2)}</td><td>${m.streaksStarted?pc(100*m.streaksInterrupted/m.streaksStarted):"—"}</td><td>${ratios.length?fmt(mean(ratios),3):"—"}</td><td>${pc(100*mean(m.unusedShare))}</td><td><button class="small" data-exp-apply="${R.scenarios.indexOf(s)}" style="padding:4px 8px" title="Usar os parâmetros deste cenário no jogo e nos laboratórios">Aplicar à configuração</button></td></tr>`}).join("");
 const mentions=R.scenarios.map(s=>`${escapeHtml(s.name)}: ${Object.entries(s.sum.reasonMentions).filter(([,v])=>v).map(([k,v])=>`${END_REASON_NAMES[k]} ${v}`).join(", ")||"nenhum"}`).join(" · ");
 $("expResults").innerHTML=`<h3>Comparação entre cenários</h3><div class="notice small">${fixed?"<strong>Duração fixa:</strong> as condições não encerram a partida; as colunas mostram a primeira condição de vitória que <em>teria</em> ocorrido.":"Cada partida conta uma vez no seu desfecho (vitórias com vários motivos não são duplicadas)."} Motivos registados, contando todos os motivos dos vencedores: ${mentions}.</div><div class="tablewrap"><table><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
 document.querySelectorAll("[data-exp-apply]").forEach(b=>b.onclick=()=>applyScenarioToConfig(+b.dataset.expApply));
 const opts=R.scenarios.map((s,i)=>`<option value="${i}">${escapeHtml(s.name)}</option>`).join("");$("expResScenario").innerHTML=opts;$("expProfScenario").innerHTML=opts;
 $("expResProfile").innerHTML=`<option value="">Todos os perfis</option>`+R.opts.profiles.map(p=>`<option value="${p}">${profileName(p)}</option>`).join("");
 $("expCharts").classList.remove("hidden");renderExpProfileTable();redrawExpCharts();
}
// Integração: leva os parâmetros de um cenário para a configuração aplicada (jogo e laboratórios).
export function applyScenarioToConfig(i){
 const s=expState.results?.scenarios[i];if(!s)return;
 setConfigApplied(normalizeConfig({...clone(s.cfg),references:configApplied.references}));rememberAiBase(configApplied);setConfigEdited(clone(configApplied));renderParams();renderAll();refreshValConfigOptions();
 setStatus("expStatus",`Parâmetros do cenário "${s.name}" aplicados à configuração. A partida em curso mantém os investimentos já feitos; reinicie-a para jogar só com as novas regras. Recomenda-se executar de novo os testes funcionais.`,"success");
}
export function renderExpProfileTable(){
 const R=expState.results;if(!R)return;const s=R.scenarios[+$("expProfScenario").value||0],st=s.prof,pc=v=>Number.isFinite(v)?fmt(100*v,1)+"%":"—";
 const cons=consolidateProfiles(st,["winRate","drawRate","meanScore","meanWinEra","meanFinalTerr","conquestsPerGame"]);
 const typeTxt=a=>Object.entries(a.types).map(([k,v])=>`${END_REASON_NAMES[k]} ${v}`).join(", ")||"—";
 $("expProfileTable").innerHTML=`<div class="tablewrap"><table><thead><tr><th>Perfil</th><th>Lugares</th><th>Taxa de vitória</th><th>Empates</th><th>Pontuação média</th><th>Era média de vitória</th><th>Tipos de vitória</th><th>Territórios finais</th><th>Conquistas / partida</th><th>Investimento M / I / T</th></tr></thead><tbody>${st.map(a=>`<tr><td><strong>${profileName(a.profile)}</strong></td><td>${a.seats}</td><td>${pc(a.winRate)}</td><td>${pc(a.drawRate)}</td><td>${fmt(100*a.meanScore,1)}</td><td>${fmt(a.meanWinEra,1)}</td><td>${typeTxt(a)}</td><td>${fmt(a.meanFinalTerr,1)}</td><td>${fmt(a.conquestsPerGame,1)}</td><td>${a.shares.map(v=>fmt(100*v,0)+"%").join(" / ")}</td></tr>`).join("")}<tr><td><strong>Consolidado</strong><div class="small muted">média simples entre perfis</div></td><td>—</td><td>${pc(cons.winRate)}</td><td>${pc(cons.drawRate)}</td><td>${fmt(100*cons.meanScore,1)}</td><td>${fmt(cons.meanWinEra,1)}</td><td>—</td><td>${fmt(cons.meanFinalTerr,1)}</td><td>${fmt(cons.conquestsPerGame,1)}</td><td>—</td></tr></tbody></table></div>`;
}
export function redrawExpCharts(){
 const R=expState.results;if(!R||$("expCharts").classList.contains("hidden"))return;
 const sc=R.scenarios,fixed=R.opts.kind==="fixed",keys=OUTCOME_KEYS.filter(([k])=>fixed?k!=="score":k!=="none"||sc.some(s=>s.sum.outcomes.none));
 barChart($("expChartTypes"),sc.map(s=>s.name.includes(" = ")?s.name.split(" = ").pop():s.name),keys.map(([k,n,c])=>({name:n,color:c,values:sc.map(s=>s.sum.pct(k))})),{max:100,unit:"%"});
 $("expLegendTypes").innerHTML=legendHtml(keys.map(([,n,c])=>[n,c]));
 const maxEra=Math.max(1,...sc.map(s=>s.sum.maxEra)),eraAxis=Array.from({length:maxEra},(_,i)=>i+1);
 svgLine($("expChartDuration"),sc.map(s=>({color:s.color,data:eraAxis.map(e=>({x:e,y:s.sum.durationHist[e]||0}))})));
 svgLine($("expChartIce"),sc.map(s=>({color:s.color,data:eraAxis.map(e=>({x:e,y:s.sum.ratioMean[e]??NaN}))})));
 const sl=legendHtml(sc.map(s=>[s.name,s.color]));$("expLegendScen1").innerHTML=sl;$("expLegendScen2").innerHTML=sl;
 const s0=sc[+$("expProfScenario").value||0];
 barChart($("expChartProfiles"),s0.prof.map(a=>profileName(a.profile)),[{name:"Taxa de vitória",color:"#f4bd50",values:s0.prof.map(a=>100*a.winRate)},{name:"Empates",color:"#9fb0c7",values:s0.prof.map(a=>100*a.drawRate)},{name:"Pontuação média",color:"#62a8ff",values:s0.prof.map(a=>100*a.meanScore)}]);
 $("expLegendProfiles").innerHTML=legendHtml([["Taxa de vitória (%)","#f4bd50"],["Empates (%)","#9fb0c7"],["Pontuação média (×100)","#62a8ff"]])+` <span class="muted">· ${escapeHtml(s0.name)}</span>`;
 const sr=sc[+$("expResScenario").value||0],pf=$("expResProfile").value,stats=profileStats(sr.recs).filter(a=>!pf||a.profile===pf);
 const series=[["military","#f4bd50"],["infrastructure","#56d6a1"],["technology","#b49aff"],["treasury","#62a8ff"],["revenue","#ff737b"]].map(([d,c])=>({color:c,data:eraAxis.map((e,i)=>{let sum=0,n=0;for(const a of stats){const b=a.byEra[i];if(b){sum+=b[d];n+=b.n}}return {x:e,y:n?sum/n:NaN}})}));
 svgLine($("expChartRes"),series);
}
export function setupExpLab(){
 profileChecks("expProfiles");$("expCivs").value=1+configApplied.map.aiCount;$("expSeed").value=configApplied.simulation.seed;
 const cat=paramCatalog(),opts=cat.map(c=>`<option value="${c.id}">${c.label}</option>`).join("");$("expParamPick").innerHTML=opts;$("expVaryParam").innerHTML=opts;$("expVaryParam").value="endgame.supremacyRelative";
 expState.scenarios=[{name:"Base",values:Object.fromEntries(expState.params.map(id=>[id,getParam(configApplied,id)]))}];renderExpTable();
 $("expGamesPreset").onchange=()=>{const v=$("expGamesPreset").value;if(v!=="custom")$("expGames").value=v;else $("expGames").focus()};
 $("expGames").oninput=()=>{$("expGamesPreset").value=["20","50","100"].includes($("expGames").value)?$("expGames").value:"custom"};
 $("expAddParam").onclick=()=>addExpParam($("expParamPick").value);
 $("expAddScenario").onclick=()=>{expState.scenarios.push({name:"Cenário "+(expState.scenarios.length+1),values:Object.fromEntries(expState.params.map(id=>[id,getParam(configApplied,id)]))});renderExpTable()};
 $("expVary").onclick=()=>{try{generateVariations()}catch(e){setStatus("expStatus",e.message,"error")}};
 $("runExp").onclick=()=>runExperiment().catch(e=>{setBusy(false);$("runExp").disabled=false;$("cancelExp").disabled=true;setStatus("expStatus",e.message,"error")});
 $("cancelExp").onclick=()=>{setExpCancel(true);setStatus("expStatus","Cancelamento pedido; a concluir a rodada em curso...")};
 $("exportExpSummary").onclick=()=>exportExp("summary");$("exportExpGames").onclick=()=>exportExp("games");$("exportExpEras").onclick=()=>exportExp("eras");
 $("expResScenario").onchange=redrawExpCharts;$("expResProfile").onchange=redrawExpCharts;$("expProfScenario").onchange=()=>{renderExpProfileTable();redrawExpCharts()};
}
export async function runValidation(){
 if(busy)return;const opts=readSimOpts("val");if(opts.civCount>configApplied.map.territories)throw Error("Mais civilizações do que territórios.");
 setBusy(true);setValCancel(false);$("runVal").disabled=true;$("cancelVal").disabled=false;$("valProgress").style.width="0%";$("valResults").innerHTML="";$("valChartBox").classList.add("hidden");
 const src=valConfigSource(),cfg=clone(src.cfg);
 // Um cenário do balanceamento é validado na velocidade em que foi testado.
 if(src.mode){opts.mode=src.mode;$("valMode").value=src.mode}
 if(opts.mode==="both")throw Error("Escolha uma velocidade (lenta ou rápida).");
 const est=estimateRows(opts,1,[cfg]);if(est>ROW_WARN&&!confirm(`Esta validação vai guardar cerca de ${fmt(est/1e6,1)} milhões de registos em memória. Continuar?`)){setBusy(false);$("runVal").disabled=false;$("cancelVal").disabled=true;return}
 const jobs=buildJobs(cfg,opts,{scenario:src.name});
 try{
  const recs=await runGameJobs(jobs,(d,t,ms)=>{$("valProgress").style.width=(100*d/t)+"%";setStatus("valStatus",`A executar · ${d} de ${t} partidas (${fmt(100*d/t,0)}%) · ${fmt(ms/1000,1)} s decorridos`)},()=>valCancel,1);
  if(!recs.length){setStatus("valStatus","Cancelado antes de concluir qualquer partida.","error");return}
  valState.results={opts,recs,stats:profileStats(recs),source:src.name};renderValidation();
  setStatus("valStatus",valCancel?`Cancelado: ${recs.length} partidas concluídas e analisadas.`:`Concluído: ${recs.length} partidas analisadas.`,"success");
 }finally{setBusy(false);$("runVal").disabled=false;$("cancelVal").disabled=true}
}
export function renderValidation(){
 const V=valState.results;if(!V)return;const st=V.stats,pc=v=>Number.isFinite(v)?fmt(100*v,1)+"%":"—",auto=V.opts.kind==="auto";
 const keys=["winRate","drawRate","meanScore","combatsPerGame","successRate","conquestsPerGame","meanFinalTerr","meanFinalIce","revenuePerGame","meanFinalTreasury","infraConversion","eliminatedRate","idleRate"],cons=consolidateProfiles(st,keys);
 const unused=a=>{const recs=V.recs;let u=[];for(const rec of recs)rec.seats.forEach((p,k)=>{if(p!==a.profile)return;for(const row of rec.rows){const c=row.civs[k],av=c[RC.TRE]+c[RC.IM]+c[RC.II]+c[RC.IT];if(c[RC.ACT]&&av>0)u.push(c[RC.TRE]/av)}});return mean(u)};
 const row=a=>`<td>${a.seats??"—"}</td><td>${a.shares?a.shares.map(v=>fmt(100*v,0)+"%").join(" / "):"—"}</td><td>${fmt(a.revenuePerGame,0)}</td><td>${pc(a.unusedShare)}</td><td>${fmt(a.conquestsPerGame,1)}</td><td>${fmt(a.combatsPerGame,1)}</td><td>${pc(a.successRate)}</td><td>${fmt(a.meanFinalTerr,1)}</td><td>${fmt(a.meanFinalIce,3)}</td><td>${fmt(100*a.meanScore,1)}</td>${auto?`<td>${pc(a.winRate)}</td><td>${pc(a.drawRate)}</td>`:""}<td>${pc(a.infraConversion)}</td><td>${pc(a.eliminatedRate)}</td>`;
 st.forEach(a=>a.unusedShare=unused(a));cons.unusedShare=mean(st.map(a=>a.unusedShare));
 const table=`<h3>Indicadores por perfil (valores acumulados por partida)</h3><div class="tablewrap"><table><thead><tr><th>Perfil</th><th>Lugares</th><th>Investimento M / I / T</th><th>Receita acumulada</th><th>Recursos não usados</th><th>Territórios conquistados</th><th>Combates iniciados</th><th>Combates vencidos</th><th>Territórios finais</th><th>ICE final</th><th>Pontuação final</th>${auto?"<th>Taxa de vitória</th><th>Empates</th>":""}<th>Retorno infra / investido</th><th>Eliminado</th></tr></thead><tbody>${st.map(a=>`<tr><td><strong>${profileName(a.profile)}</strong></td>${row(a)}</tr>`).join("")}<tr><td><strong>Consolidado</strong><div class="small muted">média simples entre perfis</div></td>${row({...cons,seats:null,shares:null})}</tr></tbody></table></div>`;
 const ident=`<h3>Identidade estratégica</h3><div class="tablewrap"><table><thead><tr><th>Perfil</th><th>Comportamento esperado</th><th>Observado</th><th>Estado</th></tr></thead><tbody>${st.map(a=>{const ex=PROFILE_EXPECTATIONS[a.profile];if(!ex)return "";const r=ex.check(a,st);return `<tr><td><strong>${profileName(a.profile)}</strong></td><td>${ex.text}</td><td class="small">${r.detail}</td><td class="${r.ok?"pass":"fail"}">${r.ok?"COERENTE":"VERIFICAR"}</td></tr>`}).join("")}</tbody></table></div>`;
 const diags=profileDiagnostics(st,V.opts);
 const diagHtml=`<h3>Diagnóstico automático</h3><div class="notice ${diags.length?"":"success"}">${diags.length?diags.map(([who,msg])=>`<div>⚠ <strong>${who}</strong>: ${msg}</div>`).join(""):"Nenhum comportamento inadequado detetado pelos critérios implementados."}<div class="small muted" style="margin-top:6px">Os alertas são pistas para investigação; o laboratório não altera regras nem perfis.</div></div>`;
 $("valResults").innerHTML=`<div class="notice success small">Configuração: <strong>${escapeHtml(V.source)}</strong> · ${V.recs.length} partidas · ${V.opts.civCount} civilizações · modo ${V.opts.mode==="fast"?"rápido":"lento"} · ${V.opts.kind==="auto"?"encerramento automático":"duração fixa"} · mesmas sementes e rotação de perfis para todos.</div>`+diagHtml+ident+table;
 $("valChartPick").innerHTML=[["military","Militar (pontos)"],["infrastructure","Receita de infraestrutura"],["technology","Progresso tecnológico"],["treasury","Tesouraria"],["revenue","Receita total"],["territories","Territórios"],["ice","ICE"]].map(([v,t])=>`<option value="${v}">${t}</option>`).join("");
 $("valChartBox").classList.remove("hidden");drawValChart();
}
export function drawValChart(){
 const V=valState.results;if(!V)return;const key=$("valChartPick").value,maxE=Math.max(...V.stats.map(a=>a.byEra.length));
 svgLine($("valChart"),V.stats.map((a,i)=>({color:SCENARIO_COLORS[i%SCENARIO_COLORS.length],data:Array.from({length:maxE},(_,e)=>{const b=a.byEra[e];const y=!b?NaN:key==="ice"?(b.iceN?b.ice/b.iceN:NaN):b[key]/b.n;return {x:e+1,y}})})));
 $("valChartLegend").innerHTML=legendHtml(V.stats.map((a,i)=>[profileName(a.profile),SCENARIO_COLORS[i%SCENARIO_COLORS.length]]));
}
export function exportValidation(){
 const V=valState.results;if(!V){setStatus("valStatus","Execute a validação antes de exportar.","error");return}
 const rows=[["profile","seats","share_military","share_infrastructure","share_technology","revenue_per_game","unused_share","conquests_per_game","combats_per_game","combat_success","final_territories","final_ice","final_score","win_rate","draw_rate","infra_return_ratio","eliminated_rate","idle_rate","expectation_ok"]];
 for(const a of V.stats){const ex=PROFILE_EXPECTATIONS[a.profile]?.check(a,V.stats);rows.push([a.profile,a.seats,...a.shares,a.revenuePerGame,a.unusedShare,a.conquestsPerGame,a.combatsPerGame,a.successRate,a.meanFinalTerr,a.meanFinalIce,a.meanScore,a.winRate,a.drawRate,a.infraConversion,a.eliminatedRate,a.idleRate,ex?ex.ok:""])}
 rows.push([],["era","profile","military","infrastructure_revenue","technology","treasury","revenue","territories","ice"]);
 for(const a of V.stats)a.byEra.forEach((b,e)=>rows.push([e+1,a.profile,b.military/b.n,b.infrastructure/b.n,b.technology/b.n,b.treasury/b.n,b.revenue/b.n,b.territories/b.n,b.iceN?b.ice/b.iceN:""]));
 csvDownload("imperios-validacao-estrategica.csv",rows);
}
export function valConfigSource(){const v=$("valConfig").value;if(v.startsWith("exp:")){const s=expState.results?.scenarios[+v.slice(4)];if(s)return {name:"cenário "+s.name,cfg:s.cfg,mode:s.mode}}return {name:"configuração aplicada",cfg:configApplied,mode:null}}
export function refreshValConfigOptions(){const el=$("valConfig");if(!el)return;const cur=el.value;el.innerHTML='<option value="applied">Configuração aplicada</option>'+(expState.results?.scenarios||[]).map((s,i)=>`<option value="exp:${i}">Cenário: ${escapeHtml(s.name)}</option>`).join("");if([...el.options].some(o=>o.value===cur))el.value=cur}
export function setupValLab(){
 refreshValConfigOptions();
 profileChecks("valProfiles");$("valCivs").value=1+configApplied.map.aiCount;$("valSeed").value=configApplied.simulation.seed;
 $("runVal").onclick=()=>runValidation().catch(e=>{setBusy(false);$("runVal").disabled=false;$("cancelVal").disabled=true;setStatus("valStatus",e.message,"error")});
 $("cancelVal").onclick=()=>{setValCancel(true);setStatus("valStatus","Cancelamento pedido...")};
 $("exportVal").onclick=exportValidation;$("valChartPick").onchange=drawValChart;
}
/* ── Folhas inferiores (bottom sheets): ataque, menu, placar, planos, ajuste fino, Como jogar e Detalhes ──
   Uma folha de cada vez. Fecham com toque fora, Esc, o botão ✕ e o botão voltar do navegador/Android
   (a folha aberta ocupa uma entrada do histórico). Enquanto há uma folha aberta, o resto da tela fica inerte
   e o foco fica preso dentro dela; ao fechar, o foco volta para quem a abriu. */
export const SHEET_HOOKS={
 attackSheet:{onClose:()=>{if(selectedTerritory!==null){setSelectedTerritory(null);renderMap()}}},
 details:{onOpen:()=>{renderForecast();renderHistory();renderNotifications();requestAnimationFrame(renderCharts)}},
 scoreSheet:{onOpen:()=>{renderMetrics();renderVictory()}},
};
export const FOCUSABLE='button:not([disabled]):not([hidden]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';
export let sheetOpen=null,sheetReturn=null,sheetHist=false,sheetIgnorePop=0;
export function isSheetOpen(id){return id?sheetOpen===id:!!sheetOpen}
export function setInertBehind(on){
 const keep=el=>el.classList.contains("sheet")||el.classList.contains("sheet-scrim");
 [...document.querySelectorAll(".wrap > *"),...document.querySelectorAll("#game > *")].forEach(el=>{if(el.id==="game"||keep(el))return;if(on)el.inert=true;else el.inert=false});
 const tut=$("tutBox");if(tut)tut.inert=on;
}
export function openSheet(id,opener){
 const el=$(id);if(!el||sheetOpen===id)return;
 if(sheetOpen)closeSheet({swap:true});
 else sheetReturn=opener||document.activeElement;
 sheetOpen=id;el.hidden=false;$("sheetScrim").hidden=false;setInertBehind(true);
 document.querySelectorAll(`[data-open="${id}"]`).forEach(b=>b.setAttribute("aria-expanded","true"));
 if(!sheetHist){try{history.pushState({imperiosSheet:id},"");sheetHist=true}catch(e){}}
 el.scrollTop=0;SHEET_HOOKS[id]?.onOpen?.();
 el.focus({preventScroll:true});
}
export function closeSheet({swap=false,fromPop=false,focus=true}={}){
 const id=sheetOpen;if(!id)return;sheetOpen=null;
 $(id).hidden=true;document.querySelectorAll(`[data-open="${id}"]`).forEach(b=>b.setAttribute("aria-expanded","false"));
 SHEET_HOOKS[id]?.onClose?.();
 if(swap)return;
 $("sheetScrim").hidden=true;setInertBehind(false);
 if(fromPop)sheetHist=false;
 else if(sheetHist){sheetHist=false;sheetIgnorePop++;try{history.back()}catch(e){sheetIgnorePop--}}
 let r=sheetReturn;sheetReturn=null;if(typeof r==="function")r=r();
 if(focus&&r&&r.isConnected&&r.offsetParent!==null)r.focus({preventScroll:true});
}
// .open nas folhas (como nos antigos <details> "Como jogar" e "Detalhes"): ler diz se está aberta, escrever abre/fecha.
document.querySelectorAll(".sheet").forEach(el=>Object.defineProperty(el,"open",{configurable:true,get(){return sheetOpen===el.id},set(v){if(v)openSheet(el.id);else if(sheetOpen===el.id)closeSheet()}}));
window.addEventListener("popstate",()=>{
 if(sheetIgnorePop>0){sheetIgnorePop--;if(sheetOpen&&!sheetHist){try{history.pushState({imperiosSheet:sheetOpen},"");sheetHist=true}catch(e){}}return}
 if(sheetOpen)closeSheet({fromPop:true});
});
document.addEventListener("click",e=>{
 const o=e.target.closest("[data-open]");if(o&&!o.disabled){e.preventDefault();openSheet(o.dataset.open,o);return}
 if(e.target.closest("[data-close]")||e.target.id==="sheetScrim")closeSheet();
});
document.addEventListener("keydown",e=>{
 if(!sheetOpen||$("modalRoot").firstChild)return;
 if(e.key==="Escape"){e.preventDefault();closeSheet();return}
 if(e.key!=="Tab")return;
 const el=$(sheetOpen),f=[...el.querySelectorAll(FOCUSABLE)].filter(x=>x.offsetParent!==null&&!x.closest("[hidden]"));if(!f.length){e.preventDefault();el.focus();return}
 const first=f[0],last=f.at(-1),a=document.activeElement;
 if(e.shiftKey&&(a===first||a===el||!el.contains(a))){e.preventDefault();last.focus()}
 else if(!e.shiftKey&&(a===last||!el.contains(a))){e.preventDefault();first.focus()}
});
// Aviso rápido no topo (ordem dada, ataque cancelado...): some sozinho ou com um toque.
export let toastTimer=null;
export function showToast(html,bad=false){
 let t=$("toast");if(!t){t=document.createElement("div");t.id="toast";t.className="toast";t.setAttribute("role","status");t.setAttribute("aria-live","polite");t.hidden=true;t.onclick=()=>{t.hidden=true};document.body.appendChild(t)}
 t.innerHTML=`<span>${html}</span>`;t.classList.toggle("bad",bad);t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{t.hidden=true},3500);
}
// Planos rápidos: chips na gaveta em telas altas; em telas baixas (≤ 700 px) ficam na folha "Planos ▾".
export const SHORT_SCREEN=matchMedia("(max-height:700px)");
export function placePlans(){const plans=$("plans"),slot=$(SHORT_SCREEN.matches?"plansSheetSlot":"plansInline");if(plans&&slot&&plans.parentElement!==slot)slot.appendChild(plans);if(!SHORT_SCREEN.matches&&sheetOpen==="planSheet")closeSheet({focus:false})}
SHORT_SCREEN.addEventListener?.("change",placePlans);
// Tela da era sem rolagem: só na versão do jogador, com a aba Jogo à vista e sem resultado (a tela de resultado
// ainda rola; Fase 3). Com ?dev=1 o cabeçalho e as abas ficam por cima e a página rola como antes.
export function updateFit(){const g=$("game");document.documentElement.classList.toggle("game-fit",!DEV_MODE&&!!g&&g.classList.contains("active")&&!state?.result);if(state?.result&&sheetOpen==="attackSheet")closeSheet({focus:false})}
// Mostra uma vista (Jogo ou, na versão de desenvolvimento, um laboratório) e marca a aba correspondente.
export function showView(view){
 document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.view===view));document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x.id===view));closeSheet({focus:false});updateFit();if(view==="game")fitRegionNames();runHook("viewShown",view);
}
/* ── Arranque, em partes: jogo, tela inicial, tutorial e (só com ?dev=1) laboratórios ── */
// Jogo: carrega o save (ou começa uma partida), desenha e liga os controles da tela da era.
export async function initGame(){
 onHook("saveStatus",showSaveWarning);
 const read=await readSavedGame(),saved=read.status==="ok"?read.game:null;
 if(read.status==="invalid"){quarantineSave(read.raw);saveProblem=read.reason;noticeBrokenSave()}
 if(saved&&!saved.state.result){setConfigApplied(saved.config);setGameMode(saved.gameMode);setState(saved.state);if(saved.opponentChoices)setOpponentChoices(saved.opponentChoices);if(saved.difficulty)setCurrentDifficulty(saved.difficulty);setAiConfigBase(saved.aiBase);savedGameLoaded=true;savedRaw=read.raw}
 else if(saved){
  // Partida terminada: não é retomada, mas as escolhas do jogador (rivais, eras, dificuldade, modo, estilos)
  // continuam. Se a partida terminada era a do tutorial, voltam as escolhas de antes do tutorial.
  try{setConfigApplied(saved.config);setGameMode(saved.gameMode);if(saved.opponentChoices)setOpponentChoices(saved.opponentChoices);if(saved.difficulty)setCurrentDifficulty(saved.difficulty);setAiConfigBase(saved.aiBase);setState(saved.state);restoreSetupAfterTutorial();setState(newGame())}
  catch(e){setConfigApplied(clone(configDefault));setGameMode("slow");setCurrentDifficulty(DEFAULT_DIFFICULTY);setAiConfigBase(pickAiDifficulty(configDefault));applyDifficulty(currentDifficulty);setOpponentChoices([DEFAULT_OPPONENT,DEFAULT_OPPONENT,DEFAULT_OPPONENT]);setState(newGame())}
 }
 else{applyDifficulty(currentDifficulty);setState(newGame())}
 renderSavedSafely(renderAll);
 document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
 AREAS.forEach(([k],idx)=>{
  const input=$(k+"Spend");
  input.addEventListener("input",()=>{const v=readAlloc(),b=P(state).treasury,others=v.reduce((s,x,j)=>s+(j===idx?0:x),0),max=Math.max(0,b-others);if(v[idx]>max+1e-9){input.value=fmtInput(round2(max));renderAllocation("Ajustado ao máximo disponível.")}else renderAllocation()});
  input.addEventListener("focus",()=>{if(parseAmount(input.value)===0)input.select()});
  const ctrl=input.parentElement,fine=document.querySelector(`.fine-row[data-area="${k}"]`);
  input.addEventListener("keydown",e=>{if(e.key==="Enter")input.blur()});
  ctrl.querySelectorAll("[data-step]").forEach(b=>b.onclick=()=>stepArea(idx,Number(b.dataset.step)));
  fine.querySelector("[data-rest]").onclick=()=>restArea(idx);fine.querySelector("[data-zero]").onclick=()=>{const v=readAlloc();v[idx]=0;setAlloc(v)};
 });
 document.querySelectorAll("[data-plan]").forEach(b=>b.onclick=()=>{applyPlan(b.dataset.plan);if(sheetOpen==="planSheet")closeSheet({focus:false})});
 placePlans();
 // "Investir em Militar" (folha de ataque sem Força suficiente): fecha a folha e leva ao + do Militar.
 $("attackInvest").onclick=()=>{closeSheet({focus:false});const row=document.querySelector('[data-row="mil"]'),plus=document.querySelector('[data-area="mil"] [data-step="1"]');row.classList.remove("flash");void row.offsetWidth;row.classList.add("flash");plus.focus({preventScroll:true})};
 $("advance").onclick=concludeEra;
 $("attack").onclick=attackSelected;
 // Menu: a folha fecha antes da ação (o aviso de Reiniciar é um modal por cima do jogo).
 $("restart").onclick=()=>{closeSheet({focus:false});showModal(`<h2>Reiniciar a partida?</h2><p class="small muted">A partida atual será substituída por uma nova com as mesmas escolhas.</p>`,[{label:"Cancelar"},{label:"Reiniciar",cls:"danger",onClick:startNewGame}])};
 onHook("afterEra",era=>setTimeout(()=>showEraReport(era),60));
 window.addEventListener("resize",()=>{fitRegionNames();markLegend();renderCharts();placePlans();if(state.result)renderResult()});
}
// Laboratórios (versão de desenvolvimento): editor de configuração, testes funcionais, balanceamento, IAs.
export async function initLabs(){
 // Com os laboratórios, Início e Reiniciar ficam no cabeçalho (na versão do jogador estão no menu ☰).
 $("topActions").prepend($("returnHome"),$("restart"));
 renderParams();
 onHook("configChanged",()=>{setConfigEdited(clone(configApplied));renderParams()});
 onHook("viewShown",view=>{if(view==="balanceLab")redrawExpCharts()});
 $("exportHistory").onclick=exportHistory;
 $("applyConfig").onclick=()=>{try{applyConfig()}catch(e){setStatus("labStatus",e.message,"error")}};
 $("restoreConfig").onclick=()=>{setConfigEdited(clone(configDefault));renderParams();setStatus("labStatus","Padrões restaurados na área de edição; clique em Aplicar para usar.")};
 $("saveConfig").onclick=()=>{try{download("imperios-configuracao.json",JSON.stringify({formatVersion:VERSION,config:readParams()},null,2))}catch(e){setStatus("labStatus",e.message,"error")}};
 $("loadConfigBtn").onclick=()=>$("configFile").click();$("configFile").onchange=e=>{if(e.target.files[0])loadJsonFile(e.target.files[0],"config");e.target.value=""};
 $("restartWithConfig").onclick=()=>{try{setConfigApplied(readParams());rememberAiBase(configApplied);setConfigEdited(clone(configApplied));setState(newGame());setSelectedTerritory(null);renderParams();renderAll();setStatus("labStatus","Nova partida iniciada com a configuração atual.","success")}catch(e){setStatus("labStatus",e.message,"error")}};
 document.querySelectorAll(".quick").forEach(b=>b.onclick=()=>runLong(Number(b.dataset.n)));
 $("customAdvance").onclick=()=>{try{const n=safeNum($("customEras").value,1,1e9);if(!Number.isSafeInteger(n))throw Error("Use um inteiro positivo.");runLong(n)}catch(e){setStatus("advanceStatus",e.message,"error")}};
 $("cancelAdvance").onclick=()=>{setCancelRequested(true);setStatus("advanceStatus","Cancelamento solicitado; concluindo o bloco atual...")};
 document.querySelectorAll(".strategy").forEach(b=>b.onclick=()=>{try{runStrategy(b.dataset.strategy,$("strategyEras").value)}catch(e){setStatus("strategyStatus",e.message,"error")}});
 $("runCompare").onclick=()=>compareStrategies().catch(e=>setStatus("compareStatus",e.message,"error"));
 $("exportCompare").onclick=()=>{if(!compareResults.length){setStatus("compareStatus","Execute uma comparação primeiro.","error");return}const rows=[["strategy","era","revenue","cumulative_revenue","budget","military","territories","ai_territories","player_wins","player_losses","neutral_conquests","enemy_conquests","invested_military","invested_infrastructure","invested_technology"],...compareResults.flatMap(r=>r.state.history.map(h=>[r.strategy,h.era,h.total,h.cumRevenue,h.budget,h.military,h.territories,h.aiTerritories,h.attacksTotal?.playerWins||0,h.attacksTotal?.playerLosses||0,h.attacksTotal?.neutralConquests||0,h.attacksTotal?.enemyConquests||0,P(r.state).invested.military,P(r.state).invested.infrastructure,P(r.state).invested.technology]))];download("imperios-comparacao.csv",rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(";")).join("\n"),"text/csv;charset=utf-8")};
 document.querySelectorAll(".scenario").forEach(b=>b.onclick=()=>scenarioPreset(b.dataset.scenario));
 $("saveScenario").onclick=()=>{try{const o=scenarioObject();download("imperios-cenario.json",JSON.stringify(o,null,2));setStatus("scenarioStatus","Cenário exportado.","success")}catch(e){setStatus("scenarioStatus",e.message,"error")}};
 $("loadScenarioBtn").onclick=()=>$("scenarioFile").click();$("scenarioFile").onchange=e=>{if(e.target.files[0])loadJsonFile(e.target.files[0],"scenario");e.target.value=""};
 $("runScenario").onclick=()=>{try{const o=scenarioLoaded||scenarioObject(),c=normalizeConfig(o.config),s=simulate(o.strategy||"balanced",safeNum($("scenarioEras").value,1,1e7),c,null,undefined,null,gameMode);renderScenarioResult(s,o.name||$("scenarioName").value);setStatus("scenarioStatus","Cenário executado isoladamente; partida atual preservada.","success")}catch(e){setStatus("scenarioStatus",e.message,"error")}};
 $("runTests").onclick=runTests;
 $("runAiValidation").onclick=()=>runAiValidation().catch(e=>setStatus("aiValidationStatus",e.message,"error"));
 $("exportAiValidation").onclick=exportAiValidation;
 $("runBalanceLab").onclick=()=>runBalanceLab().catch(e=>setStatus("balanceStatus",e.message,"error"));
 $("exportBalanceLab").onclick=exportBalanceLab;
 setupFixedLab();
 await loadFtHistory();
 setupFtLab();setupExpLab();setupValLab();
 window.addEventListener("resize",()=>{redrawExpCharts();drawValChart()});
}
// Arranque: espera o save (armazenamento assíncrono) e só depois liga a tela inicial e o tutorial.
// Os laboratórios só são ligados na versão de desenvolvimento (?dev=1).
// window.__imperiosReady fica true quando tudo está pronto (os testes automáticos esperam por isso).
(async function boot(){
 await initGame();
 initHome();
 await initTutorial();
 if(DEV_MODE&&$("lab"))await initLabs();
 window.__imperiosReady=true;
})();
// Ações da tela inicial: o jogo existente permanece intacto por trás da proposta.
export function initHome(){
 const home=$("homeScreen");if(!home)return;const setup=$("setupScreen");
 // Abre a configuração com as escolhas atuais (também usada no fim da partida: "Mudar definições").
 // fromGame=true repõe as escolhas da partida atual; a partir da tela inicial mantém as escolhas em curso.
 // Escolhas atuais; durante/depois do tutorial, as que o jogador tinha antes de o começar.
 // Na versão do jogador, "Configurações" (de um save antigo) aparece como "Médio" na próxima partida.
 const shownDiff=d=>DIFFICULTIES[d]&&(DEV_MODE||d!=="config")?d:"medio";
 const currentChoice=()=>{const p=tutorialPrevSetup();if(p)return {mode:p.mode==="fast"?"fast":"slow",ai:clamp(Number(p.ai)|0,1,MAX_AI),eras:clamp(Number(p.eras)|0,10,150),conquest:p.supremacy===false,difficulty:shownDiff(DIFFICULTIES[p.difficulty]?p.difficulty:DEFAULT_DIFFICULTY)};
  return {mode:gameMode,ai:configApplied.map.aiCount||1,eras:configApplied.endgame.maxEras,conquest:configApplied.endgame.supremacyEnabled===false,difficulty:shownDiff(currentDifficulty)}};
 const openSetup=(fromGame=false)=>{if(fromGame===true)choice=currentChoice();sync();setup.hidden=false;setup.scrollTop=0};window.openSetup=openSetup;
 let choice=currentChoice();
 const renderProfiles=()=>{if(!DEV_MODE)setOpponentChoices(opponentChoices.map(v=>v==="config"?"adaptive":v));$("homeProfiles").innerHTML=Array.from({length:choice.ai},(_,i)=>`<div class="profile-row"><span>${civSymHtml({index:i+1,color:CIV_COLORS[i+1]})} ${RIVAL_NAMES[i]}</span><select data-prof="${i}" aria-label="Estilo de ${RIVAL_NAMES[i]}">${visibleOpponentOptions().map(([v,t])=>`<option value="${v}" ${opponentChoices[i]===v?"selected":""}>${t}</option>`).join("")}</select></div>`).join("")+(choice.ai>1?`<div class="chips"><button type="button" class="chip" id="allRandom">🎲 Todos aleatórios</button></div>`:"");document.querySelectorAll("[data-prof]").forEach(el=>el.onchange=()=>{opponentChoices[+el.dataset.prof]=el.value;sync()});const ar=$("allRandom");if(ar)ar.onclick=()=>{setOpponentChoices(opponentChoices.map(()=>"random"));sync()}};
 const sync=()=>{
  $("modeSlow").classList.toggle("selected",choice.mode==="slow");$("modeFast").classList.toggle("selected",choice.mode==="fast");
  $("modeSlow").setAttribute("aria-pressed",String(choice.mode==="slow"));$("modeFast").setAttribute("aria-pressed",String(choice.mode==="fast"));
  document.querySelectorAll("#homeOpponents [data-ai]").forEach(b=>{b.classList.toggle("selected",Number(b.dataset.ai)===choice.ai);b.setAttribute("aria-pressed",String(Number(b.dataset.ai)===choice.ai))});
  document.querySelectorAll("#homeEraPresets [data-eras]").forEach(b=>b.classList.toggle("selected",Number(b.dataset.eras)===choice.eras));$("homeMaxEras").value=choice.eras;
  for(const [id,on] of [["homeClassic",!choice.conquest],["homeConquest",!!choice.conquest]]){$(id).classList.toggle("selected",on);$(id).setAttribute("aria-pressed",String(on))}
  $("homeVictoryDesc").textContent=choice.conquest?"Sem supremacia: vence quem conquistar 70% dos territórios ou eliminar os rivais; no limite de eras, decide a pontuação.":"Maioria territorial, eliminação ou supremacia (na fase final); no limite de eras, decide a pontuação.";
  renderProfiles();
  document.querySelectorAll("#homeDifficulty [data-diff]").forEach(b=>{const on=b.dataset.diff===choice.difficulty;b.classList.toggle("selected",on);b.setAttribute("aria-pressed",String(on))});$("homeDiffDesc").textContent=DIFFICULTIES[choice.difficulty]?.desc||"";
  const styleName=v=>v==="random"?"aleatório":v==="config"?"das Configurações":playerProfileName(v).toLowerCase();
  const styles=Array.from({length:choice.ai},(_,i)=>styleName(opponentChoices[i]||"random"));const uniq=[...new Set(styles)];
  $("setupSummary").innerHTML=`<strong>${choice.ai===1?"1 rival":choice.ai+" rivais"}</strong> ${uniq.length===1?(choice.ai===1?uniq[0]:(uniq[0]==="aleatório"?"aleatórios":uniq[0])):"("+styles.join(", ")+")"} · <strong>${DIFFICULTIES[choice.difficulty]?.name||""}</strong> · ${choice.eras} eras${choice.conquest?" · Conquista":""} · modo ${choice.mode==="fast"?"rápido":"lento"}`;
  const inProgress=state&&!state.result&&(state.era>1||state.history.length>0);
  $("homeContinue").classList.toggle("hidden",!inProgress);
  if(inProgress)$("homeContinue").textContent=`Continuar partida (era ${state.era} de ${state.maxEras})`;
 };
 document.querySelectorAll("#homeDifficulty [data-diff]").forEach(b=>b.onclick=()=>{choice.difficulty=b.dataset.diff;sync()});
 $("modeSlow").onclick=()=>{choice.mode="slow";sync()};$("modeFast").onclick=()=>{choice.mode="fast";sync()};
 document.querySelectorAll("#homeOpponents [data-ai]").forEach(b=>b.onclick=()=>{choice.ai=Number(b.dataset.ai);sync()});
 document.querySelectorAll("#homeEraPresets [data-eras]").forEach(b=>b.onclick=()=>{choice.eras=Number(b.dataset.eras);sync()});
 $("homeConquest").onclick=()=>{choice.conquest=true;sync()};$("homeClassic").onclick=()=>{choice.conquest=false;sync()};
 $("homeMaxEras").onchange=()=>{const v=Math.round(Number($("homeMaxEras").value));choice.eras=Number.isFinite(v)?clamp(v,10,150):30;sync()};
 const begin=()=>{restoreSetupAfterTutorial();setGameMode(choice.mode);setCurrentDifficulty(choice.difficulty);applyDifficulty(choice.difficulty);configApplied.map.aiCount=choice.ai;configApplied.endgame.maxEras=choice.eras;configApplied.endgame.supremacyEnabled=!choice.conquest;setConfigApplied(normalizeConfig(configApplied));runHook("configChanged");startNewGame();home.hidden=true;setup.hidden=true;showView("game")};
 $("homeStart").onclick=()=>openSetup(false);
 $("setupBack").onclick=()=>{setup.hidden=true;sync();home.hidden=false};
 $("homeHowTo").onclick=()=>showModal(`<h2>Como jogar</h2>${$("howTo").querySelector(".grid").innerHTML}`,[{label:"Entendi",cls:"primary"}]);
 $("setupStart").onclick=()=>{
  const inProgress=state&&!state.result&&(state.era>1||state.history.length>0);
  if(inProgress)showModal(`<h2>Começar uma nova partida?</h2><p class="small muted">A partida em andamento (era ${state.era}) será substituída.</p>`,[{label:"Cancelar"},{label:"Nova partida",cls:"primary",onClick:begin}]);else begin();
 };
 const openTab=v=>{home.hidden=true;showView(v)};
 $("homeContinue").onclick=()=>{openTab("game");renderAll();runHook("continueGame")};
 $("homeCompare").onclick=()=>openTab("balanceLab");
 $("homeLab").onclick=()=>openTab("lab");
 $("returnHome").onclick=()=>{closeSheet({focus:false});choice=currentChoice();sync();home.hidden=false;home.scrollTop=0;runHook("returnHome")};
 sync();
}
/* ── Tutorial: partida guiada (1 IA, roteiro controlado; depois jogo livre no Fácil) ──
   O estado do tutorial vive em state.tutorial={step,waitEra,attackDone} e é guardado com a partida.
   Proteções do motor usadas só aqui: state.aiAvoid (a IA não ataca o jogador nem o território reservado)
   e state.forcedAttack (resultado do próximo ataque de uma civilização). */
export async function initTutorial(){
 const TUT_KEY="imperios-tutorial-oferecido",P_START=7,AI_START=9,TARGET=8;
 const needMil=()=>(configApplied.military.conquestCost+configApplied.military.defenseNeutral)/configApplied.military.pointsPerInvestment;
 // Em telas baixas (≤ 700 px) os planos rápidos ficam na folha "Planos ▾".
 const planCta=name=>SHORT_SCREEN.matches?`Toque em “Planos” e escolha “${name}”.`:`Toque no plano “${name}”.`;
 const STEPS=[
  {t:"Bem-vindo a Impérios",target:()=>$("mapCard"),html:()=>`${civLabel(P(state))} (verde) e o rival ${civLabel(A(state))} disputam <strong>24 territórios</strong>. Vence quem primeiro:<br>• dominar <strong>70% do mapa</strong> (17 territórios);<br>• ou liderar com folga durante 5 eras (<strong>supremacia</strong>, só na fase final);<br>• ou tiver <strong>mais pontos</strong> na última era.`},
  {t:"Ouro e receita",target:()=>$("metrics"),html:()=>`A cada era você recebe <strong>ouro</strong>: cada território rende, e as Obras e a Ciência somam mais. O <strong>ouro</strong> aqui no topo é o que você pode investir agora; o <strong>+/era</strong> mostra quanto entrou nesta era.`},
  {t:"Investir",target:()=>$("investCard"),action:true,html:()=>`Há três áreas:<br>⚔ <strong>Militar</strong>: <strong>Força</strong> para atacar já na próxima era (perde 20% por era).<br>▰ <strong>Obras</strong>: rendem ouro a médio prazo e depois acabam.<br>✦ <strong>Ciência</strong>: rende tarde, mas para sempre.<br>Para atacar na próxima era, invista ao menos ${fmt(needMil(),0)} de ouro em Militar.<br><br>👉 <strong>${planCta("Ataque")}</strong>`,done:()=>readAlloc()[0]+1e-9>=needMil()},
  {t:"Concluir a era",target:()=>$("advance"),action:true,html:()=>`Seus investimentos estão definidos. 👉 <strong>Toque em “Concluir era”.</strong> Os rivais jogam ao mesmo tempo e começa a era seguinte.`,done:()=>state.era>=2},
  {t:"Atacar",target:()=>$("mapCard"),action:true,enter:()=>{state.forcedAttack={owner:"player",win:true}},html:()=>`Os territórios com <span class="gold">contorno dourado</span> são vizinhos e podem ser atacados. O ataque custa <strong>${configApplied.military.conquestCost} + a defesa</strong> do alvo em Força (territórios livres têm defesa ${configApplied.military.defenseNeutral}) e vence em 82% das vezes. Você pode dar várias ordens por era, mas cada ataque a mais custa mais (2.º ×2, 3.º ×3).<br><br>👉 <strong>Toque em ${regionName(TARGET)} (${TARGET+1}) e depois em “Atacar”.</strong>`,done:()=>!!(state.orders||[]).find(o=>o.owner==="player")||countTerritories(state,"player")>=2},
  {t:"Resolver as ordens",target:()=>$("advance"),action:true,html:()=>`Os ataques não são imediatos: as ordens de <strong>todos</strong> são resolvidas juntas no fim da era, em ordem sorteada. Se dois atacarem o mesmo território, há <strong>batalha</strong> — vence quem tiver mais Força (somada à Ciência).<br><br>👉 <strong>Toque em “Concluir era”</strong> e veja o relatório.`,done:()=>countTerritories(state,"player")>=2},
  {t:"Conquista!",target:()=>$("statTerr"),html:()=>`Mais territórios = mais receita e mais pontos: <strong>territórios valem 40% da pontuação</strong>. Aqui, <strong>terras</strong> mostra quantos você tem e quantos precisa para a maioria.<br><br>Invista e conclua as próximas eras à vontade; o tutorial volta na <strong>era 4</strong>.`,after:()=>{state.tutorial.waitEra=4}},
  {t:"As Obras rendem",target:()=>$("statGold"),html:()=>`O <strong>+/era</strong> ao lado do ouro soma o que rendem os territórios, as Obras e a Ciência (veja cada parte em ☰ → Detalhes da partida). Cada investimento em Obras cresce até a 4.ª era e depois vai acabando — reinvista para manter o ouro entrando.<br><br>Continue; algo vai acontecer na <strong>era 5</strong>.`,after:()=>{state.tutorial.waitEra=5}},
  {t:"Você foi atacado!",target:()=>$("mapCard"),enter:()=>scriptedAttack(),html:()=>`${state.tutorial.attackIdx!=null?`O rival ${civLabel(A(state))} atacou ${escapeHtml(regionName(state.tutorial.attackIdx))} (${state.tutorial.attackIdx+1}), um território seu, e <strong>foi repelido</strong> desta vez (todo ataque tem 18% de chance de falhar).`:"Os rivais também atacam: quando tiverem Força suficiente, seus territórios vizinhos a eles viram alvos."}<br>• A <strong>defesa</strong> dos seus territórios cresce com suas Obras e sua Ciência — o atacante precisa pagar ${configApplied.military.conquestCost} + essa defesa.<br>• Quem conquista um território <strong>saqueia</strong> parte da economia do dono.<br>Guarde um pouco de Força e não deixe o ouro parado.`},
  {t:"Como saber quem está ganhando",target:()=>$("scorePill"),html:()=>`O <strong>🏆</strong> no topo mostra sua <strong>posição</strong> no placar e a diferença de <strong>pontos</strong> para o líder. Toque nele (ou em “terras”) para ver o placar completo e quanto falta para cada vitória.<br><br>Agora é com você: a partida continua no nível <strong>Fácil</strong>. Boa sorte! 🏆`,last:true}
 ];
 function scriptedAttack(){
  const tu=state.tutorial;if(tu.attackDone)return;tu.attackDone=true;
  const ai=A(state);if(!ai?.active)return;
  const mine=state.owners.map((o,i)=>o==="player"&&eligibleTargets(state,ai.id).some(t=>t.i===i)?i:-1).filter(i=>i>=0);if(!mine.length)return;
  const idx=mine[0];tu.attackIdx=idx;const need=configApplied.military.conquestCost+territoryDefense(state,idx,configApplied);
  ai.military=Math.max(ai.military,need);state.forcedAttack={owner:ai.id,win:false};state.aiAvoid=null;
  attackTerritory(state,idx,ai.id,configApplied,true);state.aiAvoid={player:true};saveGame();renderAll();
 }
 function startTutorial(){
  scrolledStep=-1;
  storage.set(TUT_KEY,"1").catch(()=>{});
  // Escolhas do jogador antes do tutorial (se já estiver num tutorial, mantém as originais).
  const prevSetup=tutorialPrevSetup()||{mode:gameMode,difficulty:currentDifficulty,ai:configApplied.map.aiCount||1,eras:configApplied.endgame.maxEras,supremacy:configApplied.endgame.supremacyEnabled!==false};
  setGameMode("slow");setCurrentDifficulty("facil");applyDifficulty("facil");configApplied.map.aiCount=1;configApplied.endgame.maxEras=30;configApplied.endgame.supremacyEnabled=true;setConfigApplied(normalizeConfig(configApplied));
  // O rival do tutorial é sempre "Equilibrado" (definido abaixo em ai.profile); opponentChoices do jogador não muda.
  setState(newGame());
  // Posições do tutorial: você no 8, a IA no 10, o território 9 livre entre os dois.
  state.owners=state.owners.map(()=> "neutral");state.owners[P_START]="player";state.owners[AI_START]=A(state).id;
  const ai=A(state);ai.profile="reference";ai.hiddenProfile=false;
  state.aiAvoid={player:true,idx:[TARGET]};state.tutorial={step:0,waitEra:0,attackDone:false,prevSetup};state.ui.skipIdleWarning=true;   // sem o aviso de saldo parado durante o tutorial

  setSelectedTerritory(null);saveGame();
  runHook("configChanged");
  $("homeScreen").hidden=true;if($("setupScreen"))$("setupScreen").hidden=true;
  showView("game");
  renderAll();window.scrollTo({top:0});enterStep();
 }
 window.startTutorial=startTutorial;
 const box=document.createElement("div");box.id="tutBox";box.className="tut-box";box.hidden=true;box.setAttribute("role","dialog");box.setAttribute("aria-live","polite");document.body.appendChild(box);
 let focused=null,scrolledStep=-1;
 const cur=()=>state?.tutorial&&!state.tutorial.done?state.tutorial:null;
 function clearFocus(){if(focused)focused.classList.remove("tut-focus");focused=null}
 function endTutorial(skipped){const tu=cur();if(!tu)return;tu.done=true;state.aiAvoid=null;state.forcedAttack=null;state.ui.skipIdleWarning=false;saveGame();clearFocus();box.hidden=true;renderAll();
  if(skipped)showModal(`<h2>Tutorial terminado</h2><p class="small muted">A partida continua normalmente no nível Fácil. Você pode rever o tutorial pela tela inicial (botão “Tutorial”) e as regras em “Como jogar”.</p>`,[{label:"Continuar",cls:"primary"}])}
 function enterStep(){const tu=cur();if(!tu)return;const st=STEPS[tu.step];if(st?.enter&&!tu["entered"+tu.step]){tu["entered"+tu.step]=true;st.enter();saveGame()}draw()}
 function draw(msg){
  const tu=cur();clearFocus();if(!tu||!$("homeScreen").hidden||state.result){box.hidden=true;return}
  if(tu.waitEra&&state.era<tu.waitEra){box.hidden=false;box.className="tut-box tut-mini";box.innerHTML=`<span>🎓 Tutorial: continue jogando — volta na era ${tu.waitEra}.</span><button type="button" data-tut="skip" class="tut-link">Sair</button>`;bind();return}
  const st=STEPS[tu.step];if(!st){endTutorial(false);return}
  const el=st.target();if(el){focused=el;el.classList.add("tut-focus");if(scrolledStep!==tu.step){scrolledStep=tu.step;const tall=el.getBoundingClientRect().height>innerHeight*0.55;el.scrollIntoView({block:tall?"start":"center",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})}}
  box.hidden=false;box.className="tut-box";
  // Em ecrãs largos, o balão fica do lado oposto ao elemento destacado para não o tapar.
  if(window.innerWidth>640&&el){const r=el.getBoundingClientRect(),right=r.left+r.width/2>window.innerWidth/2;box.style.left=right?"16px":"auto";box.style.right=right?"auto":"16px"}else{box.style.left="";box.style.right=""}
  // A instrução de ação (👉 ...) fica sempre visível por baixo do texto, que rola dentro do balão se for longo.
  const full=st.html(),k=full.indexOf("👉"),body=(k>=0?full.slice(0,k):full).replace(/(<br>\s*)+$/,""),cta=k>=0?full.slice(k):"";
  box.innerHTML=`<div class="tut-head"><span class="pill">Tutorial ${tu.step+1}/${STEPS.length}</span><button type="button" data-tut="skip" class="tut-link">Pular tutorial</button></div><h3>${st.t}</h3><div class="tut-text">${body}</div>${cta?`<div class="tut-cta">${cta}</div>`:""}${msg?`<div class="tut-warn">${msg}</div>`:""}${st.action&&cta?"":`<div class="tut-actions">${st.action?'<span class="small muted">Faça a ação indicada para continuar.</span>':`<button type="button" class="primary" data-tut="next">${st.last?"Terminar tutorial":"Próximo →"}</button>`}</div>`}`;
  bind();place();
 }
 // Telemóvel (≤ 640 px): o balão fica acima ou abaixo do elemento destacado, do lado com mais espaço,
 // e nunca por cima da barra fixa de baixo. Se o elemento ocupar a tela toda, o balão fica em baixo.
 const safeProbe=document.createElement("div");safeProbe.style.cssText="position:fixed;left:0;top:env(safe-area-inset-top,0px);width:0;height:0;visibility:hidden;pointer-events:none";document.body.appendChild(safeProbe);
 // Texto mais comprido que o balão: esbate o fim para mostrar que dá para rolar.
 const markMore=()=>{const tt=box.querySelector(".tut-text");box.classList.toggle("more",!!tt&&tt.scrollHeight>tt.clientHeight+2&&tt.scrollTop+tt.clientHeight<tt.scrollHeight-2)};
 box.addEventListener("scroll",markMore,true);
 function place(){requestAnimationFrame(markMore);
  const reset=()=>{box.style.top="";box.style.bottom="";box.style.maxHeight=""};
  if(box.hidden||box.classList.contains("tut-mini")||!focused||window.innerWidth>640){reset();return}
  const vh=innerHeight,gap=10,minH=170,r=focused.getBoundingClientRect(),bar=document.querySelector(".actionbar");
  const sTop=safeProbe.getBoundingClientRect().top+8,barTop=bar&&bar.offsetParent?Math.min(vh,bar.getBoundingClientRect().top):vh;
  const inBar=bar&&bar.contains(focused),limitBot=inBar?vh:barTop;
  const visTop=Math.max(sTop,r.top),visBot=Math.min(limitBot,r.bottom);
  const above=visTop-gap-sTop,below=inBar?-1:barTop-8-(visBot+gap);
  if(below>=minH&&below>=above){box.style.top=(visBot+gap)+"px";box.style.bottom="auto";box.style.maxHeight=below+"px";return}
  if(above>=minH){box.style.top="auto";box.style.bottom=(vh-visTop+gap)+"px";box.style.maxHeight=above+"px";return}
  // Sem espaço livre suficiente (elemento grande): balão em baixo, por cima da barra, ocupando no máximo 45% da tela.
  box.style.top="auto";box.style.bottom=(vh-barTop+8)+"px";box.style.maxHeight=Math.round(Math.min(vh*0.45,barTop-sTop-8))+"px";
 }
 let placeQueued=false;const queuePlace=()=>{if(placeQueued)return;placeQueued=true;requestAnimationFrame(()=>{placeQueued=false;place()})};
 window.addEventListener("scroll",queuePlace,{passive:true});window.addEventListener("resize",queuePlace);
 function bind(){box.querySelectorAll("[data-tut]").forEach(b=>b.onclick=()=>{
  if(b.dataset.tut==="skip"){endTutorial(true);return}
  const tu=cur(),st=STEPS[tu.step];st.after?.();if(st.last){endTutorial(false);return}tu.step++;saveGame();enterStep()})}
 // Avanço automático das etapas com ação e retoma depois das eras de espera.
 setInterval(()=>{const tu=cur();if(!tu||!$("homeScreen").hidden)return;
  if(tu.waitEra){if(state.era>=tu.waitEra){tu.waitEra=0;saveGame();enterStep()}return}
  const st=STEPS[tu.step];if(st?.action&&st.done()){tu.step++;saveGame();enterStep()}},250);
 // Durante as etapas de ação, não deixa concluir a era antes do tempo.
 onHook("beforeConclude",()=>{const tu=cur();
  if(tu&&!tu.waitEra&&tu.step<=2){draw("Primeiro coloque pelo menos "+fmt(needMil(),0)+" de ouro em Militar (plano “Ataque”).");return false}
  if(tu&&!tu.waitEra&&tu.step===4){draw("Primeiro dê a ordem de ataque a "+regionName(TARGET)+" ("+(TARGET+1)+").");return false}
 });
 // Depois de cada desenho completo, redesenha o balão por cima.
 onHook("afterRender",()=>{if(cur())setTimeout(()=>{if(focused||box.hidden===false)draw()},0)});
 // Tela inicial: botão e oferta na primeira visita.
 const how=$("homeHowTo");if(how){const b=document.createElement("button");b.type="button";b.className="home-secondary";b.id="homeTutorial";b.textContent="🎓 Tutorial";how.insertAdjacentElement("beforebegin",b);
  b.onclick=()=>{const inProg=state&&!state.result&&(state.era>1||state.history.length>0)&&!cur();if(inProg)showModal(`<h2>Começar o tutorial?</h2><p class="small muted">A partida em andamento (era ${state.era}) será substituída por uma partida guiada.</p>`,[{label:"Cancelar"},{label:"Começar tutorial",cls:"primary",onClick:startTutorial}]);else startTutorial()}}
 let offered=false;try{offered=!!await storage.get(TUT_KEY)}catch(e){offered=true}
 const fresh=!state||(!state.history.length&&state.era<=1);
 if(!offered&&fresh)setTimeout(()=>showModal(`<h2>Primeira vez em Impérios?</h2><p class="small muted">Uma partida guiada mostra, em poucos minutos, como investir, atacar, defender e vencer. Você pode sair quando quiser.</p>`,[{label:"Jogar o tutorial",cls:"primary",onClick:startTutorial},{label:"Agora não",onClick:()=>{storage.set(TUT_KEY,"1").catch(()=>{})}}]),300);
 if(cur())setTimeout(draw,0);
 // Ao voltar ao jogo a partir da tela inicial, mostra de novo o balão.
 onHook("continueGame",()=>setTimeout(draw,0));
 onHook("returnHome",()=>{clearFocus();box.hidden=true});
}
// Únicas formas de outros módulos substituírem estas variáveis (um módulo não pode reatribuir o que importa).
export function setCompareResults(v){compareResults=v;return v}
export function setLastStrategyResult(v){lastStrategyResult=v;return v}
export function setScenarioLoaded(v){scenarioLoaded=v;return v}
export function setSavedGameLoaded(v){savedGameLoaded=v;return v}
export function setSaveProblem(v){saveProblem=v;return v}
export function setSavedRaw(v){savedRaw=v;return v}
export function setAiValidationResults(v){aiValidationResults=v;return v}
export function setBalanceLabResults(v){balanceLabResults=v;return v}
export function setFixedRun(v){fixedRun=v;return v}
export function setFixedCancel(v){fixedCancel=v;return v}
export function setFtLabReady(v){ftLabReady=v;return v}
export function setSheetOpen(v){sheetOpen=v;return v}
export function setSheetReturn(v){sheetReturn=v;return v}
export function setSheetHist(v){sheetHist=v;return v}
export function setSheetIgnorePop(v){sheetIgnorePop=v;return v}
export function setToastTimer(v){toastTimer=v;return v}

// Depuração e testes: variáveis globais só com ?dev=1 ou quando os testes automáticos o pedem (ver src/app/debug.js).
if(DEV_MODE||globalThis.__IMPERIOS_TEST__)exposeGlobals([ns_core_index,ns_ai_index,ns_app_session,ns_app_save,ns_app_hooks,ns_platform_storage,ns_platform_files,ns_ui_format,ns_ui_dom,ns_labs_settings,ns_labs_ai_checks,ns_labs_engine,ns_labs_experiment,ns_labs_validation,ns_labs_tests_def,ns_legacy]);
