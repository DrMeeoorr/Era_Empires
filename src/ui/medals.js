// Medalhas na interface: arte (SVG próprio, estilo "Atlas"), aviso no resumo da era, lista na tela de resultado,
// tela "Medalhas" (tela inicial e menu ☰) e o aviso de "Primeiros passos" no fim do tutorial.
// Os critérios e a gravação ficam em src/app/medals.js (sem DOM).
import {MEDALS,MEDAL_BY_ID,earnedMedals,earnedCount,matchMedals,medalsAllowed,trackEra,awardMedals} from "../app/medals.js";
import {state} from "../app/session.js";
import {DIFFICULTIES} from "../core/config.js";
import {$} from "./dom.js";
import {escapeHtml} from "./format.js";
import {closeSheet,isSheetOpen,SHEET_HOOKS} from "./sheets.js";
import {showToast} from "./toast.js";

// Desenho de cada medalha (grade 24×24, traço) e a cor da fita (a forma do desenho distingue cada uma; a cor só ajuda).
const GLYPH={
 passos:`<ellipse cx="8.5" cy="9" rx="2.6" ry="4"/><ellipse cx="15.5" cy="14" rx="2.6" ry="4"/><path d="M7.5 15.5h2M14.5 20.5h2"/>`,
 coroa:`<path d="M4 18h16L19 8l-4 4-3-6-3 6-4-4z"/><path d="M5 21h14"/>`,
 muralha:`<path d="M4 20V8h3v3h2.5V8h5v3H17V8h3v12z"/><path d="M10 20v-4a2 2 0 0 1 4 0v4"/>`,
 construtor:`<path d="M13.5 4.5l6 6-2.5 2.5-6-6z"/><path d="M12.2 8.8L4 17l3 3 8.2-8.2"/>`,
 sabio:`<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/><circle cx="12" cy="12" r="2.4"/>`,
 diplomata:`<path d="M5 20C9 15 13 11 19 4"/><path d="M8.6 16.2c-2.2-.6-3.4-2.4-3-4.6 2.1.6 3.3 2.4 3 4.6zM11.6 12.6c-1.6-1.6-1.8-3.8-.4-5.6 1.5 1.6 1.7 3.8.4 5.6zM12.4 14.2c1.6-1.4 3.8-1.6 5.6-.4-1.6 1.4-3.8 1.6-5.6.4zM15.6 9.6c1.4-1.6 3.4-2 5.2-1.2-1.4 1.6-3.4 2-5.2 1.2z"/>`,
 relampago:`<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>`,
 hegemonia:`<path d="M7.5 19.5C3.5 16 3 9.5 6.5 5M16.5 19.5c4-3.5 4.5-10 1-14.5"/><path d="M5 15.5l-2 .5M4.4 11.5l-2-.6M5.4 7.6L4 6.2M19 15.5l2 .5M19.6 11.5l2-.6M18.6 7.6L20 6.2"/><path d="M12 8.5l1.1 2.3 2.5.3-1.9 1.7.5 2.5-2.2-1.2-2.2 1.2.5-2.5-1.9-1.7 2.5-.3z"/>`,
 mare:`<path d="M3 16c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 20c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M12 12.5V3M8.5 6.5L12 3l3.5 3.5"/>`,
 explorador:`<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>`,
 terra:`<path d="M2.5 19.5l6.5-9.5 4 5.5 3-3.5 5.5 7.5z"/><circle cx="17" cy="6" r="2.2"/>`,
 sobrevivente:`<path d="M12 20v-8.5"/><path d="M12 11.5c0-4-3-6-7-6 0 4 3 6 7 6zM12 14c0-3 2.2-5 6-5 0 3-2.2 5-6 5z"/><path d="M6 20.5h12"/>`,
};
const RIBBON={passos:"#2c9d87",coroa:"#d99a2b",muralha:"#c2505e",construtor:"#2f9e78",sabio:"#7d62d6",diplomata:"#4f8fd0",relampago:"#d99a2b",hegemonia:"#d99a2b",mare:"#c2505e",explorador:"#3f7fd0",terra:"#6b9e3a",sobrevivente:"#c27a3e"};
// Medalha em SVG: fita, disco escuro com aro dourado e o desenho no meio. Bloqueada: cinza e com cadeado.
export function medalSvg(id,{locked=false,cls=""}={}){
 const rib=locked?"#3a4558":RIBBON[id]||"#d99a2b",ring=locked?"#56637a":"#f4bd50",ink=locked?"#7f8ca3":"#ffd27a";
 return `<svg class="medal-svg${cls?" "+cls:""}${locked?" locked":""}" viewBox="0 0 64 72" aria-hidden="true" focusable="false"><path d="M20 44l-7 24 9-5 6 7 6-22z" fill="${rib}"/><path d="M44 44l7 24-9-5-6 7-6-22z" fill="${rib}" opacity=".85"/><circle cx="32" cy="30" r="25" fill="#0a1322" stroke="${ring}" stroke-width="3.2"/><circle cx="32" cy="30" r="19.5" fill="none" stroke="${locked?"#3a4558":"#e9d9ad"}" stroke-opacity=".55" stroke-dasharray="1.6 3.4"/><g transform="translate(18 16) scale(1.1667)" fill="none" stroke="${ink}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${GLYPH[id]||""}</g>${locked?`<g transform="translate(50 49)"><circle r="8.5" fill="#1b2638" stroke="#56637a" stroke-width="1.6"/><rect x="-4.2" y="-1.4" width="8.4" height="6.4" rx="1.4" fill="#9aa7bd"/><path d="M-2.6-1.4v-2a2.6 2.6 0 0 1 5.2 0v2" fill="none" stroke="#9aa7bd" stroke-width="1.6"/></g>`:""}</svg>`;
}
const total=()=>MEDALS.length;
const countTxt=()=>`${earnedCount()} de ${total()}`;

/* ── Na partida ── */
// Fim da partida fora do botão Concluir era ("Vencer agora" na pergunta do domínio): dá as medalhas de fim de partida.
export function noteEndMedals(){if(!state||!state.result||!medalsAllowed(state))return [];const got=awardMedals(state,"end");refreshMedalCounts();return got.filter(g=>g.first)}
// Depois de concluir a era pelo botão (game.js): conta as defesas, dá as medalhas e devolve as NOVAS no aparelho
// (só essas aparecem no resumo da era; as repetidas aparecem na tela de resultado).
export function noteEraMedals(before){
 if(!state||!before||!medalsAllowed(state))return [];
 trackEra(state,before.owners,before.era);
 const got=awardMedals(state,state.result?"end":"era");refreshMedalCounts();
 return got.filter(g=>g.first);
}
// Bloco do resumo da era: "Nova medalha" com a arte, o nome e o critério.
export function medalNoticeHtml(list){
 if(!list?.length)return "";
 return `<div class="sum-medals" role="status">${list.map(({id})=>{const m=MEDAL_BY_ID[id];return `<div class="sum-medal">${medalSvg(id,{cls:"pop"})}<div class="sm-t"><span class="sm-k">Nova medalha</span><b>${escapeHtml(m.name)}</b><span>${escapeHtml(m.goal)}</span></div></div>`}).join("")}</div>`;
}
// Aviso curto (eras tranquilas com o resumo desligado e fim do tutorial).
export const medalToastText=list=>list?.length?`<span class="toast-medal">${medalSvg(list[0].id)}</span> <strong>Nova medalha: ${list.map(g=>escapeHtml(MEDAL_BY_ID[g.id].name)).join(", ")}</strong>`:"";
// Fim do tutorial (todos os passos): "Primeiros passos".
export function noteTutorialMedal(){const got=awardMedals(state,"tutorial").filter(g=>g.first);refreshMedalCounts();if(got.length)showToast(medalToastText(got));return got}

/* ── Tela de resultado ── */
// Dá as medalhas do fim da partida (se ainda não foram dadas) e devolve uma faixa compacta (um botão que abre a tela
// Medalhas): as medalhas da partida, ou o próximo desafio quando não houve nenhuma. Cabe entre os números e os botões.
const listTxt=names=>names.length<=2?names.join(" e "):`${names.slice(0,2).join(", ")} e mais ${names.length-2}`;
export function resultMedalsHtml(){
 const s=state;if(!s?.result)return "";
 const btn=(icons,k,b,t,label)=>`<button type="button" class="res-medals" data-open="medalsScreen" aria-haspopup="dialog" aria-label="${escapeHtml(label)}"><span class="rm-icons" aria-hidden="true">${icons}</span><span class="rm-t"><span class="rm-k">${k}</span><b>${b}</b>${t?`<span>${t}</span>`:""}</span><span class="rm-c" aria-hidden="true">${earnedCount()}/${total()}<svg class="ic"><use href="#i-next"/></svg></span></button>`;
 if(!medalsAllowed(s)){const t=s.tutorial?"O tutorial só dá “Primeiros passos”.":"Partidas dos laboratórios não valem medalhas.";return btn(medalSvg("coroa",{locked:true}),"Medalhas","Esta partida não vale medalhas",t,`Medalhas: ${t} Ver todas (${countTxt()})`)}
 awardMedals(s,"end");refreshMedalCounts();
 const list=matchMedals(s);
 if(list.length){const names=list.map(g=>escapeHtml(MEDAL_BY_ID[g.id].name)),fresh=list.filter(g=>g.first).length;
  const k=fresh?(fresh>1?`${fresh} novas medalhas`:"Nova medalha"):(list.length>1?"Medalhas da partida":"Medalha da partida");
  return btn(list.slice(0,3).map(g=>medalSvg(g.id,{cls:g.first?"pop":""})).join(""),k,listTxt(names),"",`${k}: ${list.map(g=>MEDAL_BY_ID[g.id].name).join(", ")}. Ver todas (${countTxt()})`)}
 const locked=MEDALS.filter(m=>!earnedMedals[m.id]&&m.id!=="passos"),tip=locked.length?locked[s.result.era%locked.length]:null;
 if(!tip)return btn(medalSvg("coroa"),"Medalhas","Todas conquistadas!","",`Medalhas: todas conquistadas (${countTxt()})`);
 return btn(medalSvg(tip.id,{locked:true}),"Próximo desafio",escapeHtml(tip.name),escapeHtml(tip.goal),`Próximo desafio: ${tip.name}. ${tip.goal} Ver todas as medalhas (${countTxt()})`);
}

/* ── Tela "Medalhas" ── */
const fmtDate=at=>{try{return new Date(at).toLocaleDateString("pt-BR")}catch(e){return ""}};
function medalRow(m,tag="",{status=true}={}){
 const e=earnedMedals[m.id],st=e?[e.diff&&DIFFICULTIES[e.diff]?DIFFICULTIES[e.diff].name:"",e.at?fmtDate(e.at):""].filter(Boolean).join(" · "):"";
 return `<li class="md-row${e?" on":""}">${medalSvg(m.id,{locked:!e})}<div class="md-t"><b>${escapeHtml(m.name)}${tag?` <span class="md-tag">${tag}</span>`:""}</b><span class="md-goal">${escapeHtml(m.goal)}</span>${status?`<span class="md-st">${e?`<svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>Conquistada${st?" · "+escapeHtml(st):""}`:`<svg class="ic" aria-hidden="true"><use href="#i-lock"/></svg>A conquistar`}</span>`:""}</div></li>`;
}
export function renderMedalsScreen(){
 const box=$("medalsBody");if(!box)return;const n=earnedCount(),got=MEDALS.filter(m=>earnedMedals[m.id]),left=MEDALS.filter(m=>!earnedMedals[m.id]);
 const match=state?.result?matchMedals(state):[];
 box.innerHTML=`<div class="pg-card md-head"><div class="md-count"><b>${n}</b><span>de ${total()} medalhas</span></div><div class="md-bar" role="progressbar" aria-label="Medalhas conquistadas" aria-valuemin="0" aria-valuemax="${total()}" aria-valuenow="${n}"><i style="width:${(100*n/total()).toFixed(1)}%"></i></div><p class="pg-desc">Medalhas são só de honra: não mudam as regras. O tutorial só dá “Primeiros passos”.</p></div>
${match.length?`<section class="pg-card md-match"><h2 class="pg-lab">Nesta partida <span class="md-n">${match.length}</span></h2><ul class="md-list">${match.map(g=>medalRow(MEDAL_BY_ID[g.id],g.first?"Nova!":"de novo",{status:false})).join("")}</ul></section>`:""}
${got.length?`<section class="pg-card"><h2 class="pg-lab">Conquistadas <span class="md-n">${got.length}</span></h2><ul class="md-list">${got.map(m=>medalRow(m)).join("")}</ul></section>`:""}
${left.length?`<section class="pg-card"><h2 class="pg-lab">A conquistar <span class="md-n">${left.length}</span></h2><ul class="md-list">${left.map(m=>medalRow(m)).join("")}</ul></section>`:""}`;
}
// Contagem "3/12" no botão da tela inicial e no menu ☰.
export function refreshMedalCounts(){
 const t=`${earnedCount()}/${total()}`;
 for(const id of ["homeMedalsCount","menuMedalsCount"]){const el=$(id);if(el)el.textContent=t}
 const hb=$("homeMedals");if(hb)hb.setAttribute("aria-label",`Medalhas: ${countTxt()}`);
 const mb=$("menuMedals");if(mb)mb.setAttribute("aria-label",`Medalhas: ${countTxt()}`);
 if(isSheetOpen("medalsScreen"))renderMedalsScreen();
}
// Liga a tela: na tela inicial (seta Voltar) ou por cima da partida/resultado (✕), como o Como jogar.
export function initMedals(){
 const scr=$("medalsScreen");if(!scr)return;
 SHEET_HOOKS.medalsScreen={onOpen:medalsScreenOpen};
 $("medalsBack")?.addEventListener("click",()=>closeSheet());$("medalsOk")?.addEventListener("click",()=>closeSheet());
 refreshMedalCounts();
}
// Ao abrir: por cima da partida mostra o ✕ (como o Como jogar); na tela inicial, a seta Voltar.
export function medalsScreenOpen(){const h=$("homeScreen"),st=$("setupScreen");$("medalsScreen").classList.toggle("over-game",!!h&&h.hidden&&(!st||st.hidden));renderMedalsScreen()}
