// Mapa e folha de ataque (ataque imediato ou ordens simultâneas).
import {saveGame} from "../app/save.js";
import {state,selectedTerritory,configApplied,setSelectedTerritory} from "../app/session.js";
import {eligibleTargets,adjacentOwned} from "../core/map.js";
import {territoryDefense,defenseParts,attackNeed,techAttackDiscount,orderCostMultiplier,attackTerritory,cancelOrder,orderAttack} from "../core/military.js";
import {regionName,civSym} from "../core/names.js";
import {P,aiCivs,getCiv} from "../core/state.js";
import {$} from "./dom.js";
import {cssColor,escapeHtml,fmt,ord as ordinalOf} from "./format.js";
// tr: tradução (aqui `t` é o índice da região em muitas funções).
import {t as tr} from "../i18n/index.js";
import {renderAll} from "./game.js";
import {civLabel,profileLabel,civDisplayName,engineText} from "./labels.js";
import {openSheet,isSheetOpen,closeSheet} from "./sheets.js";
import {showToast} from "./toast.js";
import {regionShapes,mapGrid} from "./mapshape.js";
import {setupMapView,mapViewAfterRender,isBigGrid} from "./mapview.js";
import {TERRAINS,TERRAIN_HINTS,terrainOf,mapTypeOf,terrainEffectsOn,ruleTerrain,terrainStartsOf,terrainDefenseBonus,terrainAttackFactor} from "../core/terrain.js";
import {TERRAIN_STYLE,terrainGlyph,terrainTexture,terrainSpots,terrainChip,terrainListHtml,terrainEffectChips,terrainName} from "./terrain-art.js";

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
// Legenda larga demais (telas de 360 px, nomes longos em outros idiomas): o botão "ⓘ Terrenos" fica só "ⓘ" para
// que o último item ("Pode atacar") apareça inteiro; se ainda não couber, a legenda rola com a borda esmaecida.
export function markLegend(){const l=$("mapLegend");if(!l)return;const row=l.closest(".legend-row");if(row){row.classList.remove("lg-compact");if(l.scrollWidth>l.clientWidth+1)row.classList.add("lg-compact")}const upd=()=>l.classList.toggle("more",l.scrollWidth>l.clientWidth+1&&l.scrollLeft+l.clientWidth<l.scrollWidth-2);upd();if(!l.dataset.mk){l.dataset.mk=1;l.addEventListener("scroll",upd,{passive:true})}}
// Mapa ilustrado (Fase 3): um desenho em SVG (mar, costa, regiões com o seu terreno, fronteiras dos impérios) e, por cima,
// um botão por região recortado na forma dela (clip-path), com o nome, o número e o símbolo do dono.
// O toque só acerta a região desenhada; a vizinhança é a da grade (src/ui/mapshape.js). Mapas maiores que o Original
// ficam numa camada que rola e aproxima (src/ui/mapview.js), com as regiões do mesmo tamanho do Original.
const gridShapes=()=>{const g=mapGrid(state);return regionShapes(g.cols,g.rows)};
const pc=(v,t)=>(100*v/t).toFixed(3)+"%";
const SEA_PAD=10;
function shapeStyle(s,W,H){
 if(!s.style){const b=s.box;s.style=`left:${pc(b.x,W)};top:${pc(b.y,H)};width:${pc(b.w,W)};height:${pc(b.h,H)};padding-left:${pc(s.safeL-b.x,W)};padding-right:${pc(b.x+b.w-s.safeR,W)};clip-path:polygon(${s.poly.map(([x,y])=>`${(100*(x-b.x)/b.w).toFixed(2)}% ${(100*(y-b.y)/b.h).toFixed(2)}%`).join(",")})`}
 return s.style;
}
// Camadas: costa, terreno (textura + desenhos), bordas, fronteira de cada império (lisa sua, listrada dos rivais,
// com contorno escuro), alvos (brilho interno), ordens (dourado sólido), bandeiras e selos de espadas, e, com uma
// região escolhida, o resto do mapa escurecido.
const SWORDS=(x,y,ord)=>`<g class="${ord?"swd ord":"swd"}" transform="translate(${x} ${y})"><circle r="11.5" fill="${ord?"#f4bd50":"#0b1220"}" stroke="${ord?"#0b1220":"#f4bd50"}" stroke-width="2"/><g stroke="${ord?"#0b1220":"#f4bd50"}" stroke-width="2" stroke-linecap="round"><path d="M-6-6L6 6M6-6L-6 6"/><path d="M-7.8 1.8l6 6M7.8 1.8l-6 6" stroke-width="1.6"/></g></g>`;
export const swordsIcon=(px=16)=>`<svg class="swd-ico" width="${px}" height="${px}" viewBox="-13 -13 26 26" aria-hidden="true" focusable="false">${SWORDS(0,0,false)}</svg>`;
export const flagIcon=c=>`<svg class="flag-ico" width="17" height="15" viewBox="0 0 17 15" aria-hidden="true" focusable="false"><path d="M2 15V1" stroke="#efe6cc" stroke-width="1.8"/><path d="M2 1h14l-3.5 4 3.5 4h-14z" fill="${cssColor(c.color)}" stroke="#0b1220"/></svg>`;
function mapArt(targets){
 const {shapes,width:W,height:H}=gridShapes(),pad=SEA_PAD,ter=terrainOf(state);
 const ords=simOrders()?myOrders().map(o=>o.idx):[],sel=selectedTerritory;
 const paths=(list,attrs)=>list.map(s=>`<path d="${s.d}"${typeof attrs==="function"?attrs(s):attrs}/>`).join("");
 const owners=[...new Set(state.owners.filter(o=>o!=="neutral"))],civOf=o=>getCiv(state,o);
 const band=o=>o==="player"?"#3fd0b2":`url(#fb-${escapeHtml(o)})`;
 let defs=TERRAINS.map(k=>terrainTexture(k,"tx-"+k)).join("");
 for(const c of state.civs){if(c.id==="player")continue;const col=cssColor(c.color),id=escapeHtml(c.id);
  defs+=`<pattern id="fb-${id}" patternUnits="userSpaceOnUse" width="9" height="9" patternTransform="rotate(45)"><rect width="9" height="9" fill="${col}"/><rect width="3.2" height="9" fill="#0b1220"/></pattern><pattern id="fl-${id}" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)"><rect width="5" height="5" fill="${col}"/><rect width="1.8" height="5" fill="#0b1220" fill-opacity=".45"/></pattern>`}
 defs+=shapes.map(s=>`<clipPath id="mcl${s.i}"><path d="${s.d}"/></clipPath>`).join("");
 defs+=owners.map(o=>`<clipPath id="mcu-${escapeHtml(o)}">${paths(shapes.filter(s=>state.owners[s.i]===o),"")}</clipPath>`).join("");
 defs+=`<filter id="mpRing" x="-5%" y="-5%" width="110%" height="110%"><feMorphology in="SourceAlpha" operator="erode" radius="6" result="e"/><feComposite in="SourceGraphic" in2="e" operator="out"/></filter><filter id="mpRingDark" x="-5%" y="-5%" width="110%" height="110%"><feMorphology in="SourceAlpha" operator="erode" radius="8.5" result="e"/><feComposite in="SourceAlpha" in2="e" operator="out" result="r"/><feFlood flood-color="#0b1220"/><feComposite in2="r" operator="in"/></filter><filter id="mpGlow" x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceAlpha" operator="erode" radius="3" result="e"/><feGaussianBlur in="e" stdDeviation="6" result="b"/><feComposite in="SourceAlpha" in2="b" operator="out" result="r"/><feFlood flood-color="#ffe7a8"/><feComposite in2="r" operator="in"/></filter>`;
 let deco="",flags="",marks="";
 for(const s of shapes){const k=ter[s.i],st=TERRAIN_STYLE[k],o=state.owners[s.i],sp=terrainSpots(s),tgt=targets.has(s.i)||ords.includes(s.i);
  deco+=`<g clip-path="url(#mcl${s.i})">${sp.map(([x,y,a],n)=>(o!=="neutral"&&n===0)||(tgt&&n===3)?"":`<g transform="translate(${x} ${y}) scale(.9)">${terrainGlyph(k,st.ink,st.acc,!!a)}</g>`).join("")}</g>`;
  if(o!=="neutral"){const c=civOf(o);if(c){const [x,y]=sp[0],fx=+(x-4).toFixed(1),fy=+(y-12).toFixed(1);
   flags+=`<g class="flag" data-flag="${s.i}"><path d="M${fx} ${fy+24}V${fy}" stroke="#0b1220" stroke-width="3.4" stroke-linecap="round"/><path d="M${fx} ${fy+24}V${fy}" stroke="#efe6cc" stroke-width="1.6" stroke-linecap="round"/><path d="M${fx} ${fy}h26l-5.5 9l5.5 9h-26z" fill="${o==="player"?cssColor(c.color):`url(#fl-${escapeHtml(o)})`}" stroke="#0b1220" stroke-width="1.5" stroke-linejoin="round"/><text x="${fx+10}" y="${fy+13}" text-anchor="middle" font-size="12.5" font-weight="800" fill="#fff" stroke="#0b1220" stroke-width="2.2" style="paint-order:stroke">${civSym(c)}</text></g>`}}
  if(tgt){const [x,y]=sp[3];marks+=SWORDS(x,y,ords.includes(s.i))}
 }
 const front=owners.map(o=>{const list=shapes.filter(s=>state.owners[s.i]===o),b=band(o),id=escapeHtml(o);
  return `<g data-front="${id}" clip-path="url(#mcu-${id})"><g filter="url(#mpRingDark)">${paths(list,` fill="#000" stroke="#000" stroke-width="2"`)}</g><g filter="url(#mpRing)">${paths(list,` fill="${b}" stroke="${b}" stroke-width="2"`)}</g></g>`}).join("");
 const tg=shapes.filter(s=>targets.has(s.i)&&!ords.includes(s.i)),od=shapes.filter(s=>ords.includes(s.i)),sl=shapes.filter(s=>s.i===sel);
 return `<svg class="map-art" viewBox="${-pad} ${-pad} ${W+2*pad} ${H+2*pad}" preserveAspectRatio="none" aria-hidden="true" focusable="false" style="left:${pc(-pad,W)};top:${pc(-pad,H)};width:${pc(W+2*pad,W)};height:${pc(H+2*pad,H)}">
<defs>${defs}</defs>
<g class="coast">${paths(shapes,` fill="#cbb98c" stroke="#cbb98c" stroke-width="12"`)}${paths(shapes,` fill="#6f6448" stroke="#6f6448" stroke-width="6"`)}</g>
<g class="lands">${paths(shapes,s=>` data-region="${s.i}" data-terrain="${ter[s.i]}" fill="url(#tx-${ter[s.i]})"`)}</g>
<g class="deco">${deco}</g>
<g class="borders">${paths(shapes,` fill="none" stroke="#0a1322" stroke-width="1.6"`)}</g>
<g class="fronts">${front}</g>
<g class="targets"><g filter="url(#mpGlow)" opacity=".9">${paths(tg,` fill="#000"`)}</g>${paths(tg,s=>` data-target="${s.i}" fill="none" stroke="#fff3cf" stroke-width="1.6"`)}</g>
<g class="ordered">${paths(od,` fill="#f4bd50" fill-opacity=".22"`)}<g filter="url(#mpGlow)">${paths(od,` fill="#000"`)}</g>${paths(od,` fill="none" stroke="#0b1220" stroke-width="5.5"`)}${paths(od,s=>` data-order="${s.i}" fill="none" stroke="#f4bd50" stroke-width="3"`)}</g>
<g class="flags">${flags}</g><g class="marks">${marks}</g>
${sl.length?`<g class="selected"><path class="dim" d="M${-pad} ${-pad}H${W+pad}V${H+pad}H${-pad}Z${sl[0].d}" fill-rule="evenodd" fill="#050a14" fill-opacity=".55"/>${paths(sl,` fill="none" stroke="#0b1220" stroke-width="6"`)}${paths(sl,` fill="none" stroke="#ffffff" stroke-width="3.4"`)}</g>`:""}
<g class="rings">${paths(shapes,s=>` data-ring="${s.i}" fill="none" stroke="#ffd479" stroke-width="3.5"`)}</g>
</svg>`;
}
// Foco do teclado: o contorno do botão recortado não aparece, por isso o anel é desenhado no SVG.
function bindMapFocus(){const m=$("map");if(!m||m.dataset.fb)return;m.dataset.fb=1;
 m.addEventListener("focusin",e=>{const b=e.target.closest?.("[data-territory]");m.querySelectorAll(".rings path.on").forEach(p=>p.classList.remove("on"));if(b&&b.matches(":focus-visible"))m.querySelector(`.rings [data-ring="${b.dataset.territory}"]`)?.classList.add("on")});
 m.addEventListener("focusout",()=>m.querySelectorAll(".rings path.on").forEach(p=>p.classList.remove("on")));
}
export function renderMap(){
 const targets=eligibleTargets(state,"player"),live=P(state).active&&!state.result,tset=new Set(live?targets.map(t=>t.i):[]);
 const {shapes,width:W,height:H}=gridShapes(),ter=terrainOf(state);
 $("map").classList.toggle("has-sel",selectedTerritory!==null);
 const g=mapGrid(state),big=isBigGrid(g);
 $("map").innerHTML=(big?`<div class="map-stage" id="mapStage" style="width:${pc(g.cols,6)};height:${pc(g.rows,4)}">`:"")+mapArt(tset)+state.owners.map((o,i)=>{const civ=o==="neutral"?null:getCiv(state,o),cls=o==="player"?"player":civ?"ai":"free",target=tset.has(i),sel=selectedTerritory===i;
  return `<button class="territory ${cls} ${target?"target":""} ${sel?"selected":""}" data-territory="${i}" style="${shapeStyle(shapes[i],W,H)}" aria-label="${tr("map.regionAria",{region:escapeHtml(regionName(i)),n:String(i+1),owner:o==="neutral"?tr("map.owner.free"):o==="player"?tr("map.owner.you"):tr("map.owner.civ",{civ:escapeHtml(civDisplayName(civ))}),target:target?tr("map.targetAria"):"",terrain:terrainName(ter[i])})}"><span class="rname">${escapeHtml(regionName(i))}</span><span class="who"><span class="tnum">${i+1}</span>${civ?`<span class="csym">${civSym(civ)}</span>`:""}</span>${target?`<span class="def gold">${tr("map.def",{n:fmt(territoryDefense(state,i,configApplied),0)})}</span>`:""}</button>`}).join("")+(big?"</div>":"");
 $("mapLegend").innerHTML=`<span>${flagIcon(P(state))}${civLabel(P(state))}</span>`+aiCivs(state).map(c=>`<span>${flagIcon(c)}${civLabel(c)}<span class="muted lg-style"> · ${escapeHtml(profileLabel(c))}</span>${c.active?"":" "+tr("map.legendElim")}</span>`).join("")+`<span><i class="dot sq lg-free"></i>${tr("map.legendFree")}</span><span>${swordsIcon(15)}${tr("map.legendCanAttack")}</span>`;
 document.querySelectorAll("[data-territory]").forEach(b=>b.addEventListener("click",()=>{const i=Number(b.dataset.territory);setSelectedTerritory(i);renderMap();openSheet("attackSheet",()=>document.querySelector(`[data-territory="${i}"]`))}));
 bindMapFocus();setupMapView(big);fitRegionNames();markLegend();
 renderAttack();renderEvents();
 if(simOrders())myOrders().forEach((o,k)=>{const cell=document.querySelector(`[data-territory="${o.idx}"]`);if(cell){cell.classList.add("ordered");cell.insertAdjacentHTML("beforeend",`<span class="order-tag">${myOrders().length>1?tr("map.orderTagN",{n:ordinalOf(k+1,true)}):tr("map.orderTag")}</span>`)}});
 mapViewAfterRender(big);
}
// Folha "ⓘ Terrenos": os 7 terrenos e o tipo de mapa desta partida.
// Com terrenos com efeitos mostra as 2 vantagens e 1 desvantagem de cada um (etiquetas + / −) e, num bloco que abre
// com um toque, os detalhes das regras; só visual, avisa que nada muda.
export const terrainFxNote=()=>tr("terrain.fxNote");
export const terrainFxRules=()=>[1,2,3].map(k=>tr("terrain.fxRule"+k));
export const terrainVisualNote=()=>tr("terrain.visualNote");
export const terrainNote=()=>terrainEffectsOn(state)?terrainFxNote():terrainVisualNote();
const terrainNoteHtml=()=>terrainEffectsOn(state)?`${terrainFxNote()}<details class="ter-more"><summary>${tr("terrain.howFx")}</summary><ul>${terrainFxRules().map(x=>`<li>${x}</li>`).join("")}</ul></details>`:terrainVisualNote();
export function renderTerrainSheet(){const el=$("terrainBody");if(!el)return;const fx=terrainEffectsOn(state);
 el.innerHTML=`<p class="small muted ter-mapnote">${tr(mapTypeOf(state)==="sorteado"?"terrain.mapRandom":"terrain.mapFixed")}</p><div class="small ter-rulenote${fx?" on":""}">${terrainNoteHtml()}</div>${terrainListHtml(TERRAIN_HINTS,fx)}`}
// Listas de terrenos do Como jogar (tela inicial e dentro da partida): refeitas ao abrir, conforme a partida atual.
export function fillTerrainLists(){const fx=terrainEffectsOn(state);
 document.querySelectorAll("[data-terrain-list]").forEach(el=>{el.innerHTML=terrainListHtml(TERRAIN_HINTS,fx)});
 document.querySelectorAll("[data-terrain-note]").forEach(el=>{el.innerHTML=terrainNoteHtml();el.classList.toggle("on",fx)})}
// Folha da região com terrenos com efeitos: etiquetas + / − do terreno (a região inicial conta como Campina).
export function regionTerrainHtml(t){const k=terrainOf(state)[t];let h=terrainChip(k);
 if(terrainEffectsOn(state)){const r=ruleTerrain(state,t);h+=terrainEffectChips(r);if(r!==k)h+=`<span class="ter-note">${tr("terrain.startNote")}</span>`}
 return h}
// Parte do custo que vem do terreno (só com efeitos): "(terreno +2)" na defesa e "× 1,2 (Pântano)" no custo.
export function terrainCostParts(t){if(!terrainEffectsOn(state))return {def:"",mult:""};const d=terrainDefenseBonus(state,t),f=terrainAttackFactor(state,t),n=terrainName(ruleTerrain(state,t));
 return {def:d?` (${n} ${d>0?"+":"−"}${fmt(Math.abs(d),0)})`:"",mult:f!==1?` × ${fmt(f,1)} (${n})`:""}}
// Folha de ataque: região + dono, 3 números (Custo, Sua força, Chance), botão com o motivo quando não dá,
// atalho "Investir em Militar" e a explicação longa atrás de "Por quê?".
export const ATTACK_CHANCE="82%";
const chance=()=>tr("map.chance82");
// Defesa explicada (rodada 4): "defesa 8 + 2,1 de Obras + 3,4 de Força guardada (Floresta +2)"; região livre: "defesa 3".
export function defenseText(t){const d=defenseParts(state,t,configApplied),tc=terrainCostParts(t);
 if(state.owners[t]==="neutral")return tr("map.defBase",{n:fmt(d.total,0)});
 return `${tr("map.defBase",{n:fmt(d.base,0)})}${d.works>0.05?tr("map.defWorks",{n:fmt(d.works,1)}):""}${d.reserve>0.05?tr("map.defReserve",{n:fmt(d.reserve,1)}):""}${tc.def}`}
// Linha da folha de uma região sua: a defesa total e a parte que vem da Força guardada.
export function ownDefenseLine(t){const d=defenseParts(state,t,configApplied);
 return `<p class="tgt-sub own-def"><span class="od-n"><svg class="ic" aria-hidden="true"><use href="#i-shield"/></svg>${tr("map.ownDef",{n:`<strong>${fmt(d.total,1)}</strong>`})}</span>${d.reserve>0.05?` · <span class="od-n">${tr("map.ownReserve",{n:`<strong class="gold">+${fmt(d.reserve,1)}</strong>`})}</span>`:""}. <span class="od-why">${tr("map.ownWhy")}</span></p>`}
export const infoTip=(html,label=tr("map.why"))=>`<details class="tgt-info"><summary><span aria-hidden="true">ⓘ</span> ${tr("map.endOfEra")} <u>${label}</u></summary><div>${html}</div></details>`;
export const targetNums=(cost,have)=>`<div class="tgt-nums"><div class="tgt-num"><span>${tr("map.num.cost")}</span> <b>${fmt(cost,1)}</b></div><div class="tgt-num"><span>${tr("map.num.force")}</span> <b class="${have+1e-9>=cost?"ok":"red"}">${fmt(have,1)}</b></div><div class="tgt-num"><span>${tr("map.num.chance")}</span> <b>${chance()}</b></div></div>`;
// Região no painel do alvo: nome + número pequeno (o mesmo do mapa).
export const regionHtml=t=>`<strong>${escapeHtml(regionName(t))}</strong> <span class="muted small">${t+1}</span>`;
export const tgtTitle=html=>`<h2 class="tgt-title" id="attackTitle">${html}</h2>`;
export const setAttackBtn=(btn,text,enabled,{cancel=false,invest=false}={})=>{btn.textContent=text;btn.disabled=!enabled;btn.classList.toggle("cancel",cancel);const inv=$("attackInvest");if(inv)inv.hidden=!invest};
// Ordens simultâneas: a ordem fica marcada no mapa e o resultado sai no relatório do fim da era.
export const simOrders=()=>!!configApplied.military.simultaneousOrders,myOrders=()=>(state.orders||[]).filter(o=>o.owner==="player"),myOrder=t=>myOrders().find(o=>o.idx===t);
// Painel do alvo com ordens simultâneas (configuração padrão): a ordem é resolvida no fim da era.
export function renderOrderAttack(){
 const t=selectedTerritory,m=configApplied.military,btn=$("attack"),mil=P(state).military,ords=myOrders(),ord=t!==null?myOrder(t):null,next=orderCostMultiplier(configApplied,ords.length,state),maxO=m.maxOrdersPerEra||Infinity;
 setAttackBtn(btn,tr("map.chooseTarget"),false);
 if(t===null&&isSheetOpen("attackSheet"))closeSheet();
 if(state.result||!P(state).active){setAttackBtn(btn,tr(state.result?"map.btnEnded":"map.btnNoAttacks"),false);$("mapStatus").innerHTML=tgtTitle(t===null?tr("map.title"):regionHtml(t))+`<p class="tgt-sub">${tr(state.result?"map.ended":"map.eliminated")}</p>`;return}
 const ordTxt=ords.length?`<p class="tgt-orders">⚔ ${tr("map.ordersEra",{list:ords.map(o=>`${escapeHtml(regionName(o.idx))} (${fmt(o.need,1)}${o.mult>1?`, ×${fmt(o.mult,1)}`:""})`).join(" · ")})}</p>`:"";
 const costTxt=maxO===1?"":ords.length?" "+tr("map.nextCost",{m:fmt(next,1)}):" "+tr("map.manyOrders");
 const howOrders=tr("map.howOrders",{chance:chance()});
 if(t===null){$("mapStatus").innerHTML=`${tgtTitle(tr("map.chooseTarget"))}${ordTxt}<p class="tgt-sub">${tr("map.tapFree",{n:`<strong>${fmt(mil,1)}</strong>`})}</p>${infoTip(`${tr("map.eachCosts",{n:fmt(m.conquestCost,0)})}${costTxt} ${howOrders}`)}`;return}
 if(ord){setAttackBtn(btn,tr("map.cancelOrder"),true,{cancel:true});$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ${tr("map.orderGiven")}`)}${ordTxt}<p class="tgt-sub">${tr(ords.length>1?"map.reservedMany":"map.reserved",{n:fmt(ord.need,1)})}</p>${infoTip(`${tr("map.resolvedOnConclude")} ${howOrders}`)}`;return}
 const owner=state.owners[t];
 if(owner==="player"){setAttackBtn(btn,tr("map.btnOwn"),false);$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ${tr("map.titleOwn")}`)}${ordTxt}${ownDefenseLine(t)}`;return}
 if(!adjacentOwned(state,t,"player")){setAttackBtn(btn,tr("map.btnFar"),false);$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ${owner==="neutral"?tr("map.owner.free"):tr("map.owner.civ",{civ:civLabel(getCiv(state,owner))})}`)}${ordTxt}<p class="tgt-sub">${tr("map.far")}</p>`;return}
 const tc=terrainCostParts(t),replacing=maxO===1&&ords.length,mult=replacing?1:next,base=attackNeed(state,t,"player",configApplied),disc=techAttackDiscount(state,"player",configApplied),need=base*mult,civ=owner==="neutral"?null:getCiv(state,owner),avail=mil+(replacing?ords[0].need:0);
 const ownerTxt=civ?tr("map.owner.civ",{civ:civLabel(civ)}):tr("map.owner.free");
 if(!replacing&&ords.length>=maxO){setAttackBtn(btn,tr("map.btnMax",{n:String(maxO),count:maxO}),false);$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ${ownerTxt}`)}${ordTxt}<p class="tgt-sub">${tr("map.maxGiven",{n:String(maxO),count:maxO})}</p>`;return}
 const ok=avail+1e-9>=need;setAttackBtn(btn,ok?tr(replacing?"map.btnSwap":"map.btnAttack",{n:fmt(need,1)}):tr("map.btnLack",{n:fmt(need-avail,1)}),ok,{invest:!ok&&mult<=1});
 $("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ${ownerTxt}`)}${mult>1?`<p class="tgt-sub">${tr("map.nthCost",{k:ordinalOf(ords.length+1),m:fmt(mult,1)})}</p>`:""}${ordTxt}${targetNums(need,avail)}${infoTip(`${tr("map.costEq",{f:`${tc.mult?"(":""}${defenseText(t)}${tr("map.plusConquest",{n:fmt(m.conquestCost,0)})}${tc.mult?")"+tc.mult:""}${disc>=0.005?tr("map.minusSci",{pct:fmt(100*disc,0)}):""}${mult>1?tr("map.timesNth",{base:fmt(base,1),m:fmt(mult,1),k:ordinalOf(ords.length+1)}):""}`,n:fmt(need,1)})}${ok?"":mult>1?" "+tr("map.moreCost"):" "+tr("map.invest")} ${howOrders}`)}`;
}
// Painel do alvo com o terreno da região (ícone + nome) logo abaixo do título.
export function renderAttack(){
 renderAttackBody();
 const t=selectedTerritory,h=$("mapStatus")?.querySelector(".tgt-title");
 if(t!==null&&h)h.insertAdjacentHTML("afterend",`<p class="tgt-terrain">${regionTerrainHtml(t)}</p>`);
}
function renderAttackBody(){
 if(simOrders())return renderOrderAttack();
 const t=selectedTerritory,m=configApplied.military,btn=$("attack"),mil=P(state).military;
 setAttackBtn(btn,tr("map.chooseTarget"),false);
 if(t===null&&isSheetOpen("attackSheet"))closeSheet();
 if(state.result||!P(state).active){setAttackBtn(btn,tr(state.result?"map.btnEnded":"map.btnNoAttacks"),false);$("mapStatus").innerHTML=tgtTitle(t===null?tr("map.title"):regionHtml(t))+`<p class="tgt-sub">${tr(state.result?"map.ended":"map.eliminated")}</p>`;return}
 if(t===null){$("mapStatus").innerHTML=`${tgtTitle(tr("map.chooseTarget"))}<p class="tgt-sub">${tr("map.tapForce",{n:`<strong>${fmt(mil,1)}</strong>`})}</p>`;return}
 const owner=state.owners[t];
 if(owner==="player"){setAttackBtn(btn,tr("map.btnOwn"),false);$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ${tr("map.titleOwn")}`)}${ownDefenseLine(t)}`;return}
 if(!adjacentOwned(state,t,"player")){setAttackBtn(btn,tr("map.btnFar"),false);$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ${owner==="neutral"?tr("map.owner.free"):tr("map.owner.civ",{civ:civLabel(getCiv(state,owner))})}`)}<p class="tgt-sub">${tr("map.far")}</p>`;return}
 const need=attackNeed(state,t,"player",configApplied),disc=techAttackDiscount(state,"player",configApplied),discTxt=disc>=0.005?tr("map.minusSci",{pct:fmt(100*disc,0)}):"",civ=owner==="neutral"?null:getCiv(state,owner);
 const tc=terrainCostParts(t),defTxt=defenseText(t);
 const ok=mil+1e-9>=need;setAttackBtn(btn,ok?tr("map.btnAttack",{n:fmt(need,1)}):tr("map.btnLack",{n:fmt(need-mil,1)}),ok,{invest:!ok});
 $("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ${civ?tr("map.owner.civ",{civ:civLabel(civ)}):tr("map.owner.free")}`)}${targetNums(need,mil)}${infoTip(`${tr("map.costEq",{f:`${tc.mult?"(":""}${defTxt}${tr("map.plusConquest",{n:fmt(m.conquestCost,0)})}${tc.mult?")"+tc.mult:""}${discTxt}`,n:fmt(need,1)})} ${tr("map.winsChance",{chance:chance()})}${ok?"":" "+tr("map.invest")}`)}`;
}
// Botão "Atacar" do painel do alvo (ataque imediato quando as ordens simultâneas estão desligadas).
export function attackSelected(){
 if(simOrders())return orderSelected();
 if(selectedTerritory===null)return;
 const t=selectedTerritory,r=attackTerritory(state,t,"player",configApplied);setSelectedTerritory(null);closeSheet({focus:false});saveGame();renderAll();const msg=r.ok?(r.win?`<span class="green"><strong>${tr("map.youConquered",{region:escapeHtml(regionName(t))})}</strong></span>`:tr("map.attackFailed",{region:escapeHtml(regionName(t))})):escapeHtml(engineText(r.reason));$("mapStatus").innerHTML=msg;showToast(msg,!(r.ok&&r.win))
}
// Botão do painel com ordens simultâneas: dá ou cancela a ordem contra o território escolhido.
export function orderSelected(){
 if(selectedTerritory===null)return;const t=selectedTerritory,ord=myOrder(t);let msg,bad=false;
 if(ord){cancelOrder(state,"player",t);msg=tr("map.orderCanceled",{region:escapeHtml(regionName(t))})}
 else{const r=orderAttack(state,t,"player",configApplied);bad=!r.ok;msg=r.ok?tr(r.mult>1?"map.orderOkNth":"map.orderOk",{region:escapeHtml(regionName(t)),n:fmt(r.need,1),k:ordinalOf(myOrders().length),m:fmt(r.mult,1)}):escapeHtml(engineText(r.reason))}
 setSelectedTerritory(null);closeSheet({focus:false});saveGame();renderAll();$("mapStatus").innerHTML=msg;showToast(msg,bad)}
export function renderEvents(){
 if(!$("lastEvents"))return;
 const ev=state.log.filter(x=>/ataque|conquist|repelid|falhou|eliminad|🏁/i.test(x.text)).slice(0,3);
 $("lastEvents").innerHTML=ev.length?ev.map(e=>`<div><span class="muted">${tr("details.eraN",{era:escapeHtml(e.era)})}</span> · ${escapeHtml(engineText(e.text))}</div>`).join(""):"";
}
