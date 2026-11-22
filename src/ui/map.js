// Mapa e folha de ataque (ataque imediato ou ordens simultâneas).
import {saveGame} from "../app/save.js";
import {state,selectedTerritory,configApplied,setSelectedTerritory} from "../app/session.js";
import {eligibleTargets,adjacentOwned} from "../core/map.js";
import {territoryDefense,defenseParts,attackNeed,techAttackDiscount,orderCostMultiplier,attackTerritory,cancelOrder,orderAttack} from "../core/military.js";
import {regionName,civName,civSym} from "../core/names.js";
import {P,aiCivs,getCiv} from "../core/state.js";
import {$} from "./dom.js";
import {cssColor,escapeHtml,fmt,uiText} from "./format.js";
import {renderAll} from "./game.js";
import {civLabel,profileLabel} from "./labels.js";
import {openSheet,isSheetOpen,closeSheet} from "./sheets.js";
import {showToast} from "./toast.js";
import {regionShapes,mapGrid} from "./mapshape.js";
import {setupMapView,mapViewAfterRender,isBigGrid} from "./mapview.js";
import {TERRAINS,TERRAIN_NAMES,TERRAIN_HINTS,terrainOf,mapTypeOf,terrainEffectsOn,ruleTerrain,terrainStartsOf,terrainDefenseBonus,terrainAttackFactor} from "../core/terrain.js";
import {TERRAIN_STYLE,terrainGlyph,terrainTexture,terrainSpots,terrainChip,terrainListHtml,terrainEffectChips} from "./terrain-art.js";

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
  return `<button class="territory ${cls} ${target?"target":""} ${sel?"selected":""}" data-territory="${i}" style="${shapeStyle(shapes[i],W,H)}" aria-label="${escapeHtml(regionName(i))}, região ${i+1}, ${o==="neutral"?"livre":o==="player"?"sua":"de "+escapeHtml(civName(civ))}${target?", alvo possível":""}, ${TERRAIN_NAMES[ter[i]]}"><span class="rname">${escapeHtml(regionName(i))}</span><span class="who"><span class="tnum">${i+1}</span>${civ?`<span class="csym">${civSym(civ)}</span>`:""}</span>${target?`<span class="def gold">Def. ${fmt(territoryDefense(state,i,configApplied),0)}</span>`:""}</button>`}).join("")+(big?"</div>":"");
 $("mapLegend").innerHTML=`<span>${flagIcon(P(state))}${civLabel(P(state))}</span>`+aiCivs(state).map(c=>`<span>${flagIcon(c)}${civLabel(c)}<span class="muted lg-style"> · ${escapeHtml(profileLabel(c))}</span>${c.active?"":" (eliminado)"}</span>`).join("")+`<span><i class="dot sq lg-free"></i>Livre</span><span>${swordsIcon(15)}Pode atacar</span>`;
 document.querySelectorAll("[data-territory]").forEach(b=>b.addEventListener("click",()=>{const i=Number(b.dataset.territory);setSelectedTerritory(i);renderMap();openSheet("attackSheet",()=>document.querySelector(`[data-territory="${i}"]`))}));
 bindMapFocus();setupMapView(big);fitRegionNames();markLegend();
 renderAttack();renderEvents();
 if(simOrders())myOrders().forEach((o,k)=>{const cell=document.querySelector(`[data-territory="${o.idx}"]`);if(cell){cell.classList.add("ordered");cell.insertAdjacentHTML("beforeend",`<span class="order-tag">${myOrders().length>1?"⚔ "+(k+1)+".ª":"⚔ ordem"}</span>`)}});
 mapViewAfterRender(big);
}
// Folha "ⓘ Terrenos": os 7 terrenos e o tipo de mapa desta partida.
// Com terrenos com efeitos mostra as 2 vantagens e 1 desvantagem de cada um (etiquetas + / −) e, num bloco que abre
// com um toque, os detalhes das regras; só visual, avisa que nada muda.
export const TERRAIN_FX_NOTE="Nesta partida os terrenos têm efeito: quem ocupa a região ganha as 2 vantagens (+) e a desvantagem (−) do terreno.";
export const TERRAIN_FX_RULES=["As % de Obras, Força e Ciência somam por região desse terreno.","Defesa e custo de ataque do terreno só valem em regiões com dono.","A região inicial de cada império conta como Campina."];
export const TERRAIN_VISUAL_NOTE="Nesta partida o terreno é só visual: não muda as regras. Para jogar com efeitos: Nova partida → Personalizar → Terrenos → Com efeitos.";
export const terrainNote=()=>terrainEffectsOn(state)?TERRAIN_FX_NOTE:TERRAIN_VISUAL_NOTE;
const terrainNoteHtml=()=>terrainEffectsOn(state)?`${TERRAIN_FX_NOTE}<details class="ter-more"><summary>Como os efeitos funcionam</summary><ul>${TERRAIN_FX_RULES.map(x=>`<li>${x}</li>`).join("")}</ul></details>`:TERRAIN_VISUAL_NOTE;
export function renderTerrainSheet(){const el=$("terrainBody");if(!el)return;const fx=terrainEffectsOn(state);
 el.innerHTML=`<p class="small muted ter-mapnote">${mapTypeOf(state)==="sorteado"?"<b>Mapa sorteado</b>: os terrenos desta partida foram sorteados.":"<b>Mapa padrão</b>: cada região tem sempre o mesmo terreno."}</p><div class="small ter-rulenote${fx?" on":""}">${terrainNoteHtml()}</div>${terrainListHtml(TERRAIN_HINTS,fx)}`}
// Listas de terrenos do Como jogar (tela inicial e dentro da partida): refeitas ao abrir, conforme a partida atual.
export function fillTerrainLists(){const fx=terrainEffectsOn(state);
 document.querySelectorAll("[data-terrain-list]").forEach(el=>{el.innerHTML=terrainListHtml(TERRAIN_HINTS,fx)});
 document.querySelectorAll("[data-terrain-note]").forEach(el=>{el.innerHTML=terrainNoteHtml();el.classList.toggle("on",fx)})}
// Folha da região com terrenos com efeitos: etiquetas + / − do terreno (a região inicial conta como Campina).
export function regionTerrainHtml(t){const k=terrainOf(state)[t];let h=terrainChip(k);
 if(terrainEffectsOn(state)){const r=ruleTerrain(state,t);h+=terrainEffectChips(r);if(r!==k)h+=`<span class="ter-note">Região inicial: conta como Campina.</span>`}
 return h}
// Parte do custo que vem do terreno (só com efeitos): "(terreno +2)" na defesa e "× 1,2 (Pântano)" no custo.
export function terrainCostParts(t){if(!terrainEffectsOn(state))return {def:"",mult:""};const d=terrainDefenseBonus(state,t),f=terrainAttackFactor(state,t),n=TERRAIN_NAMES[ruleTerrain(state,t)];
 return {def:d?` (${n} ${d>0?"+":"−"}${fmt(Math.abs(d),0)})`:"",mult:f!==1?` × ${fmt(f,1)} (${n})`:""}}
// Folha de ataque: região + dono, 3 números (Custo, Sua força, Chance), botão com o motivo quando não dá,
// atalho "Investir em Militar" e a explicação longa atrás de "Por quê?".
export const ATTACK_CHANCE="82%";
// Defesa explicada (rodada 4): "defesa 8 + 2,1 de Obras + 3,4 de Força guardada (Floresta +2)"; região livre: "defesa 3".
export function defenseText(t){const d=defenseParts(state,t,configApplied),tc=terrainCostParts(t);
 if(state.owners[t]==="neutral")return `defesa ${fmt(d.total,0)}`;
 return `defesa ${fmt(d.base,0)}${d.works>0.05?` + ${fmt(d.works,1)} de Obras`:""}${d.reserve>0.05?` + ${fmt(d.reserve,1)} de Força guardada`:""}${tc.def}`}
// Linha da folha de uma região sua: a defesa total e a parte que vem da Força guardada.
export function ownDefenseLine(t){const d=defenseParts(state,t,configApplied);
 return `<p class="tgt-sub own-def"><span class="od-n"><svg class="ic" aria-hidden="true"><use href="#i-shield"/></svg>Defesa <strong>${fmt(d.total,1)}</strong></span>${d.reserve>0.05?` · <span class="od-n">Força guardada <strong class="gold">+${fmt(d.reserve,1)}</strong></span>`:""}. <span class="od-why">Obras e a Força que você não usa em ataques reforçam a defesa.</span></p>`}
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
 const t=selectedTerritory,m=configApplied.military,btn=$("attack"),mil=P(state).military,ords=myOrders(),ord=t!==null?myOrder(t):null,next=orderCostMultiplier(configApplied,ords.length,state),maxO=m.maxOrdersPerEra||Infinity;
 setAttackBtn(btn,"Escolha um alvo",false);
 if(t===null&&isSheetOpen("attackSheet"))closeSheet();
 if(state.result||!P(state).active){setAttackBtn(btn,state.result?"Partida terminada":"Sem ataques",false);$("mapStatus").innerHTML=tgtTitle(t===null?"Mapa":regionHtml(t))+`<p class="tgt-sub">${state.result?"A partida terminou.":"Você foi eliminado e não pode mais atacar."}</p>`;return}
 const ordTxt=ords.length?`<p class="tgt-orders">⚔ Ordens desta era: ${ords.map(o=>`${escapeHtml(regionName(o.idx))} (${fmt(o.need,1)}${o.mult>1?`, ×${fmt(o.mult,1)}`:""})`).join(" · ")}</p>`:"";
 const costTxt=maxO===1?"":ords.length?` O próximo ataque desta era custa ×${fmt(next,1)}.`:" Você pode dar várias ordens por era; cada ataque a mais custa mais (2.º ×2, 3.º ×3…).";
 const howOrders=`As ordens de todos são resolvidas juntas no fim da era: se um rival atacar o mesmo território, há <strong>batalha</strong> (vence quem tiver mais Força, somada à Ciência); depois, ${ATTACK_CHANCE} de chance de conquistar. A Força é gasta mesmo se o ataque falhar.`;
 if(t===null){$("mapStatus").innerHTML=`${tgtTitle("Escolha um alvo")}${ordTxt}<p class="tgt-sub">Toque em uma região com <span class="gold">⚔</span> para atacar. Força livre: <strong>${fmt(mil,1)}</strong>.</p>${infoTip(`Cada ataque custa, em Força, a defesa do alvo + ${fmt(m.conquestCost,0)} de conquista. A defesa de um rival sobe com as Obras dele e com a Força que ele não usa em ataques (Força guardada).${costTxt} ${howOrders}`)}`;return}
 if(ord){setAttackBtn(btn,"Cancelar ordem",true,{cancel:true});$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ordem dada`)}${ordTxt}<p class="tgt-sub">${fmt(ord.need,1)} de Força reservada. Cancelar devolve a Força${ords.length>1?" e recalcula o custo das outras ordens":""}.</p>${infoTip(`A ordem é resolvida quando você concluir a era, junto com as dos rivais. ${howOrders}`)}`;return}
 const owner=state.owners[t];
 if(owner==="player"){setAttackBtn(btn,"Território seu",false);$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · seu`)}${ordTxt}${ownDefenseLine(t)}`;return}
 if(!adjacentOwned(state,t,"player")){setAttackBtn(btn,"Fora do alcance",false);$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ${owner==="neutral"?"livre":"de "+civLabel(getCiv(state,owner))}`)}${ordTxt}<p class="tgt-sub">Não faz fronteira com o seu império. Escolha uma com ⚔.</p>`;return}
 const tc=terrainCostParts(t),replacing=maxO===1&&ords.length,mult=replacing?1:next,base=attackNeed(state,t,"player",configApplied),disc=techAttackDiscount(state,"player",configApplied),need=base*mult,civ=owner==="neutral"?null:getCiv(state,owner),avail=mil+(replacing?ords[0].need:0);
 if(!replacing&&ords.length>=maxO){setAttackBtn(btn,`Máximo de ${maxO} ordens`,false);$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ${civ?"de "+civLabel(civ):"livre"}`)}${ordTxt}<p class="tgt-sub">Você já deu o máximo de ${maxO} ordens nesta era.</p>`;return}
 const ok=avail+1e-9>=need;setAttackBtn(btn,ok?`${replacing?"Trocar ordem":"Atacar"} · usa ${fmt(need,1)} de Força`:`Faltam ${fmt(need-avail,1)} de Força`,ok,{invest:!ok&&mult<=1});
 $("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ${civ?"de "+civLabel(civ):"livre"}`)}${mult>1?`<p class="tgt-sub">${ords.length+1}.º ataque desta era: custo ×${fmt(mult,1)}</p>`:""}${ordTxt}${targetNums(need,avail)}${infoTip(`Custo = ${tc.mult?"(":""}${defenseText(t)} + conquista ${fmt(m.conquestCost,0)}${tc.mult?")"+tc.mult:""}${disc>=0.005?` − ${fmt(100*disc,0)}% (Ciência)`:""}${mult>1?` = ${fmt(base,1)} × ${fmt(mult,1)} (${ords.length+1}.º ataque da era)`:""} = ${fmt(need,1)} de Força.${ok?"":mult>1?" Ataques a mais na mesma era custam mais.":" Invista em Militar: a Força chega na era seguinte."} ${howOrders}`)}`;
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
 setAttackBtn(btn,"Escolha um alvo",false);
 if(t===null&&isSheetOpen("attackSheet"))closeSheet();
 if(state.result||!P(state).active){setAttackBtn(btn,state.result?"Partida terminada":"Sem ataques",false);$("mapStatus").innerHTML=tgtTitle(t===null?"Mapa":regionHtml(t))+`<p class="tgt-sub">${state.result?"A partida terminou.":"Você foi eliminado e não pode mais atacar."}</p>`;return}
 if(t===null){$("mapStatus").innerHTML=`${tgtTitle("Escolha um alvo")}<p class="tgt-sub">Toque em uma região com <span class="gold">⚔</span> para atacar. Força: <strong>${fmt(mil,1)}</strong>.</p>`;return}
 const owner=state.owners[t];
 if(owner==="player"){setAttackBtn(btn,"Território seu",false);$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · seu`)}${ownDefenseLine(t)}`;return}
 if(!adjacentOwned(state,t,"player")){setAttackBtn(btn,"Fora do alcance",false);$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ${owner==="neutral"?"livre":"de "+civLabel(getCiv(state,owner))}`)}<p class="tgt-sub">Não faz fronteira com o seu império. Escolha uma com ⚔.</p>`;return}
 const need=attackNeed(state,t,"player",configApplied),disc=techAttackDiscount(state,"player",configApplied),discTxt=disc>=0.005?` − ${fmt(100*disc,0)}% (Ciência)`:"",civ=owner==="neutral"?null:getCiv(state,owner);
 const tc=terrainCostParts(t),defTxt=defenseText(t);
 const ok=mil+1e-9>=need;setAttackBtn(btn,ok?`Atacar · usa ${fmt(need,1)} de Força`:`Faltam ${fmt(need-mil,1)} de Força`,ok,{invest:!ok});
 $("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ${civ?"de "+civLabel(civ):"livre"}`)}${targetNums(need,mil)}${infoTip(`Custo = ${tc.mult?"(":""}${defTxt} + conquista ${fmt(m.conquestCost,0)}${tc.mult?")"+tc.mult:""}${discTxt} = ${fmt(need,1)} de Força. Vence em ${ATTACK_CHANCE} das vezes; a Força é gasta mesmo se o ataque falhar.${ok?"":" Invista em Militar: a Força chega na era seguinte."}`)}`;
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
