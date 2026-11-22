// Corridas de fim de jogo dos mapas 2×–4×: Grande Descoberta (Ciência) e Maravilha da Humanidade (Obras).
// Faixa compacta do seu progresso no topo (as duas corridas numa linha só), barras por império no Placar, avisos de
// quem passou da metade da meta, aviso na divisão do ouro (Maravilha) e textos das regras. Só apresentação: os números
// vêm do motor (src/core/endgame.js). No mapa Original as regras não existem e nada disto aparece.
import {state,configApplied} from "../app/session.js";
import {MAP_SIZES} from "../core/config.js";
import {greatDiscoveryActive,greatDiscoveryProgress,greatDiscoveryGoal,greatDiscoveryMinRegions,wonderActive,wonderProgress,wonderGoal,wonderMinRegions} from "../core/endgame.js";
import {makeGreatDiscovery,makeWonder,getCiv} from "../core/state.js";
import {civName} from "../core/names.js";
import {$} from "./dom.js";
import {cssColor,escapeHtml,fmt} from "./format.js";
import {civLabel} from "./labels.js";

export const GD_NAME="Grande Descoberta",WD_NAME="Maravilha da Humanidade";
const pts=v=>fmt(Math.floor(v+1e-9),0);
const pct=x=>fmt(100*x,0)+"%";
// As duas corridas: o que muda entre elas (nome, área, ícone, funções do motor, textos).
export const RACES=[
 {key:"discovery",kind:"disc",name:GD_NAME,short:"Descoberta",area:"Ciência",icon:"i-spark",cls:"gd",
  active:s=>greatDiscoveryActive(s),progress:s=>greatDiscoveryProgress(s),goal:s=>greatDiscoveryGoal(s),min:s=>greatDiscoveryMinRegions(s),make:makeGreatDiscovery,
  rule:(goal,min)=>`${GD_NAME}: junte ${pts(goal)} pontos de Ciência (o que você investe em Ciência) com pelo menos ${min} regiões. Os rivais atacam quem se aproxima da meta.`,
  how:"Pontos = 20% do ouro que cada um investiu em Ciência (o saque não conta).",
  rival:n=>`${n} está a caminho da ${GD_NAME}`,me:`Você passou da metade da ${GD_NAME}`},
 {key:"wonder",kind:"wonder",name:WD_NAME,short:"Maravilha",area:"Obras",icon:"i-temple",cls:"wd",
  active:s=>wonderActive(s),progress:s=>wonderProgress(s),goal:s=>wonderGoal(s),min:s=>wonderMinRegions(s),make:makeWonder,
  rule:(goal,min)=>`${WD_NAME}: junte ${pts(goal)} pontos de Obras, contando só as eras em que Obras é o seu maior investimento, com pelo menos ${min} regiões. Os rivais atacam quem se aproxima da meta.`,
  how:"Pontos = 20% do ouro investido em Obras nas eras em que Obras foi a maior fatia (mais que Força e que Ciência; empate não conta). O saque não conta.",
  rival:n=>`${n} está construindo uma Maravilha`,me:`Você passou da metade da ${WD_NAME}`}
];
const raceOf=key=>RACES.find(r=>r.key===key);
const on=(r,s=state)=>!!s&&r.active(s);
export const gdActive=(s=state)=>on(RACES[0],s);
export const wdActive=(s=state)=>on(RACES[1],s);
// Meta e mínimo de regiões de um tamanho de mapa, antes de a partida existir (tela Personalizar).
function forSize(r,size){const g=MAP_SIZES[size];if(!g||size<=1)return null;try{return r.make(configApplied,size,g.cols*g.rows)}catch(_){return null}}
export const gdForSize=size=>forSize(RACES[0],size);
export const wdForSize=size=>forSize(RACES[1],size);
export const gdRuleText=(goal,min)=>RACES[0].rule(goal,min);
export const wdRuleText=(goal,min)=>RACES[1].rule(goal,min);
// Personalizar: as frases das corridas deste tamanho ("" no Original).
export function racesRuleForSize(size){return RACES.map(r=>{const g=forSize(r,size);return g?r.rule(g.goal,g.minRegions):""}).filter(Boolean)}
// Sem partida com a regra: os números dos 3 tamanhos.
function ruleGeneric(r){
 const l=[2,3,4].map(k=>{const g=forSize(r,k);return g?`${k}× ${pts(g.goal)} com ${g.minRegions} regiões`:""}).filter(Boolean).join("; ");
 return `${r.name} (só nos mapas 2×, 3× e 4×): ${r.key==="wonder"?"junte pontos de Obras (contam só as eras em que Obras é o seu maior investimento; o saque não conta)":"junte pontos de Ciência (o que você investe em Ciência; o saque não conta)"} e tenha um mínimo de regiões${l?` — ${l}`:""}. Vence no fim da era. Os rivais atacam quem se aproxima da meta.`;
}
export const gdRuleGeneric=()=>ruleGeneric(RACES[0]);
// Regras completas (Como jogar): [data-gd-rule] e [data-wd-rule].
export function fillGdRules(){
 const s=state;
 for(const r of RACES){const txt=on(r,s)?r.rule(r.goal(s),r.min(s))+" Vence no fim da era; o saque não conta.":ruleGeneric(r);
  document.querySelectorAll(`[data-${r.cls}-rule]`).forEach(el=>{el.textContent=txt})}
}
const mineOf=(r,s=state)=>r.progress(s).find(x=>x.id==="player")||null;
const ariaOf=(r,me)=>`${r.name}: ${pts(me.progress)} de ${pts(me.goal)} pontos de ${r.area} (${pct(me.share)}); regiões ${me.regions} de ${me.minRegions}${me.regionsOk?", mínimo atingido":`, faltam ${me.minRegions-me.regions}`}.`;

// Faixa do topo. Uma corrida: "✦ Descoberta [barra] 7.430/24.000 ⚑ 18/20". As duas (mapas 2×–4×): duas metades na
// mesma linha, "✦ [barra] 31% ⚑18/20 │ ▰ [barra] 12% ⚑18/16" (números exatos no leitor de tela e no Placar).
export function renderDiscoveryHud(){
 const el=$("statDiscovery");if(!el)return;
 const s=state,alive=!!getCiv(s,"player")?.active,list=alive?RACES.filter(r=>on(r,s)).map(r=>({r,me:mineOf(r,s)})).filter(x=>x.me):[];
 el.hidden=!list.length;if(!list.length){el.innerHTML="";el.removeAttribute("aria-label");return}
 const two=list.length>1;
 el.className=`hud-gd${two?" two":""}`;
 el.setAttribute("aria-label",list.map(({r,me})=>ariaOf(r,me)).join(" "));
 el.innerHTML=list.map(({r,me})=>{const st=me.reached?" done":me.share>=.5?" half":"";
  return `<span class="gd-part ${r.cls}${st}" data-race="${r.key}" aria-hidden="true"><svg class="ic gd-ic" aria-hidden="true"><use href="#${r.icon}"/></svg>${two?"":`<span class="gd-k">${r.short}</span>`}<span class="gd-bar"><i style="width:${(100*me.share).toFixed(1)}%"></i><b></b></span>${two?`<span class="gd-v gd-pct"><b>${pct(me.share)}</b></span>`:`<span class="gd-v"><b>${pts(me.progress)}</b>/${pts(me.goal)}</span>`}<span class="gd-r ${me.regionsOk?"ok":"lack"}">⚑${two?"":" "}${me.regions}/${me.minRegions}${me.regionsOk&&!two?" ✓":""}</span></span>`}).join(two?'<span class="gd-sep" aria-hidden="true"></span>':"");
}
// Blocos do Placar ("Condições de vitória"): uma barra por império, % da meta e regiões ok/faltando.
function racePanelHtml(r){
 const s=state;if(!on(r,s))return "";
 const list=r.progress(s).slice().sort((a,b)=>b.share-a.share||b.progress-a.progress);if(!list.length)return "";
 return `<h3>${r.name}: ${pts(r.goal(s))} pontos de ${r.area} + ${r.min(s)} regiões</h3><div class="small muted" style="margin:-2px 0 6px">${r.how} Quem passa da metade vira alvo dos rivais.</div>`+
  list.map(x=>{const c=getCiv(s,x.id),lack=x.minRegions-x.regions;
   return `<div class="gd-row${x.id==="player"?" me":""}" data-${r.cls}="${escapeHtml(x.id)}"><div class="row between small"><span>${civLabel(c)}${x.share>=.5&&!x.reached?' <span class="gold">· passou da metade</span>':""}</span><strong>${pts(x.progress)} <span class="muted">· ${pct(x.share)}</span></strong></div><div class="bar gd-pbar" style="margin:3px 0 2px"><span style="width:${(100*x.share).toFixed(1)}%;background:${cssColor(c?.chartColor)}"></span><i class="gd-half" aria-hidden="true"></i></div><div class="gd-reg small ${x.regionsOk?"ok":"lack"}">${x.regionsOk?`✓ ${x.regions} regiões (mínimo ${x.minRegions})`:`✗ ${x.regions} de ${x.minRegions} regiões · faltam ${lack}`}</div></div>`}).join("");
}
export const discoveryPanelHtml=()=>racePanelHtml(RACES[0]);
export const wonderPanelHtml=()=>racePanelHtml(RACES[1]);
// Foto antes de concluir a era (report.js): % da meta de cada império, por corrida.
export function gdSnapshot(){
 const out={};for(const r of RACES)if(on(r))out[r.key]=Object.fromEntries(r.progress(state).map(x=>[x.id,x.share]));
 return Object.keys(out).length?out:null;
}
// Avisos da era: quem passou de 50% de uma meta nesta era (cada império passa uma vez só: os pontos nunca diminuem).
// Aceita também a foto antiga (só a Grande Descoberta: {id: share}).
export function gdEvents(before){
 if(!before)return [];const out=[],old=!RACES.some(r=>before[r.key]&&typeof before[r.key]==="object");
 for(const r of RACES){if(!on(r))continue;const b=old?(r.key==="discovery"?before:null):before[r.key];if(!b)continue;
  for(const x of r.progress(state)){if(x.reached||x.share<.5||(b[x.id]??0)>=.5)continue;
   out.push(x.id==="player"
    ?{kind:r.kind,race:r.key,ok:null,title:r.me,sub:"os rivais vão reagir: mais Força e ataques contra você"}
    :{kind:r.kind,race:r.key,ok:null,civ:x.id,title:r.rival(civName(getCiv(state,x.id))),sub:`${pts(x.progress)} de ${pts(x.goal)} pontos de ${r.area} · ${x.regions}/${x.minRegions} regiões`});
  }
 }
 return out;
}
// Tela de resultado: pontos do jogador numa corrida (3.º número quando a partida foi decidida por ela).
export const gdPlayerPoints=()=>mineOf(RACES[0])?.progress??0;
export const racePlayerPoints=key=>{const r=raceOf(key);return r&&on(r)?mineOf(r)?.progress??0:0};
// Divisão do ouro: nesta era as Obras contam para a Maravilha? (só com a regra ativa e algum ouro investido).
// Devolve null (não se aplica), true (contam) ou false (não contam).
export function wonderCountsNow(vals){
 if(!wdActive()||!getCiv(state,"player")?.active||state.result)return null;
 const [m,i,t]=vals;if(!(m+i+t>0))return null;
 return i>m+1e-9&&i>t+1e-9;
}
export const WONDER_HINT_OFF="Nesta era as Obras não contam para a Maravilha: ponha em Obras mais do que em Força e em Ciência.";
export const WONDER_HINT_ON="Nesta era as Obras contam para a Maravilha (são o seu maior investimento).";
