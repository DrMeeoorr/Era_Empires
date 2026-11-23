// Tutorial: partida guiada (1 rival, roteiro controlado; depois jogo livre no Fácil).
import {onHook,runHook} from "../app/hooks.js";
import {saveGame} from "../app/save.js";
import {state,configApplied,selectedTerritory,setSelectedTerritory} from "../app/session.js";
import {newTutorialGame,TUTORIAL_POS} from "../app/setup.js";
import {territorialMinimum,territoryBase} from "../core/endgame.js";
import {countTerritories} from "../core/map.js";
import {regionName} from "../core/names.js";
import {storage} from "../platform/storage.js";
import {readAlloc} from "./allocation.js";
import {$} from "./dom.js";
import {fmt,escapeHtml} from "./format.js";
import {renderAll,showView} from "./game.js";
import {noteTutorialMedal} from "./medals.js";
import {showModal,showDialog} from "./modal.js";
import {onLanguageChange,t} from "../i18n/index.js";

/* ── Tutorial: partida guiada (1 rival "Equilibrado", posições fixas TUTORIAL_POS; depois jogo livre no Fácil) ──
   5 passos de ação: investir → concluir → atacar → ver o resumo → como vencer.
   O estado vive em state.tutorial={v:2,step,…} e é guardado com a partida; as escolhas do jogador de antes do
   tutorial ficam em state.tutorial.prevSetup (src/app/setup.js) e voltam na próxima partida nova.
   Proteções do motor usadas só aqui: state.aiAvoid (a IA não ataca o jogador nem o território reservado)
   e state.forcedAttack (o ataque do passo 3 dá certo). */
// Convite da primeira visita: folha embaixo com a medalha (bússola), no estilo das telas "Atlas".
const INVITE_HTML=()=>`<div class="grip" aria-hidden="true"></div><svg class="medal" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="#0a1322" stroke="#f4bd50" stroke-width="2"/><circle cx="50" cy="50" r="38" fill="none" stroke="#e9d9ad" stroke-dasharray="2 5"/><path d="M50 14l8 36-8 36-8-36z" fill="#e9d9ad"/><path d="M50 14l8 36h-16z" fill="#f4bd50"/><circle cx="50" cy="50" r="5" fill="#0a1322" stroke="#f4bd50" stroke-width="2"/></svg><h2>${t("tut.invite.title")}</h2><p>${t("tut.invite.text")}</p><div class="meta"><span><svg class="ic" aria-hidden="true"><use href="#i-flag"/></svg>${t("tut.invite.steps")}</span><span><svg class="ic" aria-hidden="true"><use href="#i-hourglass"/></svg>${t("tut.invite.time")}</span></div>`;
export async function initTutorial(){
 const TUT_KEY="imperios-tutorial-oferecido",TARGET=TUTORIAL_POS.target;
 const needMil=()=>(configApplied.military.conquestCost+configApplied.military.defenseNeutral)/configApplied.military.pointsPerInvestment;
 const tname=()=>escapeHtml(regionName(TARGET));
 const sheetOn=id=>{const el=$(id);return !!el&&!el.hidden};
 const anySheet=()=>!!document.querySelector(".sheet:not([hidden]),[data-sheet]:not([hidden])");
 const summaryBtn=()=>document.querySelector("#eraSummary .sum-next");
 /* ── Tutorial (Fase 3): 5 passos de ação, cada um com uma dica curta (no máximo 2 linhas) e uma seta para o alvo.
    O resto da tela fica escurecido e o balão fica sempre do lado oposto ao alvo, sem o cobrir.
    Cada passo: target() devolve o elemento a destacar (ou null: balão escondido) e o texto da dica para ele. */
 const STEPS=[
  {action:true,
   target:()=>{const inline=document.querySelector('#plansInline [data-plan="attack"]');if(inline&&inline.offsetParent)return [inline,t("tut.s1.inline")];
    if(sheetOn("planSheet"))return [document.querySelector('#planSheet [data-plan="attack"]'),t("tut.s1.sheet")];
    return anySheet()?null:[$("plansBtn"),t("tut.s1.plans")]},
   done:()=>readAlloc()[0]+1e-9>=needMil()},
  {action:true,target:()=>anySheet()?null:[$("advance"),t("tut.s2")],done:()=>state.era>=2},
  {action:true,enter:()=>{state.forcedAttack={owner:"player",win:true}},
   target:()=>{if(sheetOn("attackSheet")){if(selectedTerritory===TARGET)return [$("attack"),t("tut.s3.attack")];return null}
    return anySheet()?null:[document.querySelector(`[data-territory="${TARGET}"]`),t("tut.s3.region",{region:tname()})]},
   done:()=>!!(state.orders||[]).find(o=>o.owner==="player")||countTerritories(state,"player")>=2},
  {action:true,
   target:()=>{const b=summaryBtn();if(b)return [b,t("tut.s4.summary")];
    return anySheet()?null:[$("advance"),t("tut.s4.conclude")]},
   done:()=>countTerritories(state,"player")>=2&&!summaryBtn()},
  {last:true,target:()=>anySheet()?null:[$("scorePill"),t("tut.s5",{n:String(territorialMinimum(territoryBase(state),configApplied.endgame.territoryPct))})]}
 ];
 const LAST=STEPS.length-1;
 function startTutorial(){
  storage.set(TUT_KEY,"1").catch(()=>{});
  newTutorialGame();   // estado da partida guiada (src/app/setup.js): posições fixas, Fácil, 1 rival
  state.tutorial.v=2;
  setSelectedTerritory(null);saveGame();
  runHook("configChanged");
  $("homeScreen").hidden=true;if($("setupScreen"))$("setupScreen").hidden=true;
  showView("game");
  renderAll();window.scrollTo({top:0});enterStep();
 }
 window.startTutorial=startTutorial;
 const box=document.createElement("div");box.id="tutBox";box.className="tut-box";box.hidden=true;box.setAttribute("role","dialog");box.setAttribute("aria-live","polite");box.setAttribute("aria-label",t("tut.aria"));document.body.appendChild(box);
 const spot=document.createElement("div");spot.id="tutSpot";spot.className="tut-spot";spot.hidden=true;spot.setAttribute("aria-hidden","true");document.body.appendChild(spot);
 let focused=null,warn="",lastKey="";
 // Saves do tutorial antigo (10 passos): passa para o passo equivalente dos 5 novos.
 const cur=()=>{const tu=state?.tutorial;if(!tu||tu.done)return null;if(tu.v!==2){tu.step=[0,0,0,1,2,3,4,4,4,4][tu.step]??LAST;tu.waitEra=0;tu.v=2}return tu};
 function clearFocus(){if(focused)focused.classList.remove("tut-focus");focused=null}
 function hide(){clearFocus();box.hidden=true;spot.hidden=true;lastKey=""}
 function endTutorial(skipped){const tu=cur();if(!tu)return;tu.skipped=!!skipped;tu.done=true;state.aiAvoid=null;state.forcedAttack=null;state.ui.skipIdleWarning=false;saveGame();hide();renderAll();
  if(!skipped)noteTutorialMedal();   // "Primeiros passos": a única medalha do tutorial
  if(skipped)showDialog({icon:"compass",title:t("tut.done.title"),text:t("tut.done.text"),buttons:[{label:t("common.continue"),kind:"primary"}],esc:0})}
 function enterStep(){const tu=cur();if(!tu)return;warn="";const st=STEPS[tu.step];if(st?.enter&&!tu["entered"+tu.step]){tu["entered"+tu.step]=true;st.enter();saveGame()}draw(true)}
 // Desenha o balão: dica curta, seta e área destacada. Sem alvo visível (outra folha aberta, aviso...), esconde-se.
 function draw(force){
  const tu=cur();if(!tu||!$("homeScreen").hidden||state.result){hide();return}
  const st=STEPS[tu.step];if(!st){endTutorial(false);return}
  const modal=$("modalRoot").firstChild,tg=st.target(),el=tg?.[0];
  if(!el||!el.isConnected||el.offsetParent===null||(modal&&!modal.contains(el))){hide();return}
  const r=el.getBoundingClientRect(),key=[tu.step,tg[1],warn&&t(warn.key,warn.params),Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height),innerWidth,innerHeight].join("|");
  if(!force&&key===lastKey&&!box.hidden)return;lastKey=key;
  if(focused!==el){clearFocus();focused=el;el.classList.add("tut-focus")}
  const dots=STEPS.map((_,k)=>`<i class="${k===tu.step?"on":k<tu.step?"done":""}"></i>`).join("");
  box.innerHTML=`<div class="tut-head"><span class="tut-dots" aria-hidden="true">${dots}</span><span class="tut-count">${t("tut.step",{n:String(tu.step+1),total:String(STEPS.length)})}</span><button type="button" data-tut="skip" class="tut-link">${t("tut.skip")}</button></div><p class="tut-tip${warn?" tut-warn":""}">${warn?t(warn.key,warn.params):tg[1]}</p>${st.last?`<div class="tut-actions"><button type="button" class="primary" data-tut="next">${t("tut.play")}</button></div>`:""}`;
  box.hidden=false;spot.hidden=false;bind();place(r);
 }
 // O balão fica do lado oposto ao alvo (alvo na metade de baixo → balão em cima, e vice-versa) e nunca o cobre.
 const safeProbe=document.createElement("div");safeProbe.style.cssText="position:fixed;left:0;top:env(safe-area-inset-top,0px);bottom:env(safe-area-inset-bottom,0px);width:0;visibility:hidden;pointer-events:none";document.body.appendChild(safeProbe);
 function place(r){
  const vw=innerWidth,vh=innerHeight,pad=6,gap=14,sp=safeProbe.getBoundingClientRect(),sTop=sp.top+8,sBot=sp.bottom-8;
  spot.style.left=(r.left-pad)+"px";spot.style.top=(r.top-pad)+"px";spot.style.width=(r.width+2*pad)+"px";spot.style.height=(r.height+2*pad)+"px";
  const w=Math.min(420,vw-24),cx=r.left+r.width/2,left=Math.max(12,Math.min(vw-12-w,cx-w/2));
  box.style.width=w+"px";box.style.left=left+"px";box.style.setProperty("--ax",Math.max(22,Math.min(w-22,cx-left))+"px");
  const h=box.offsetHeight,upper=r.top+r.height/2<vh/2;
  let below=upper;if(below&&r.bottom+pad+gap+h>sBot&&r.top-pad-gap-h>=sTop)below=false;if(!below&&r.top-pad-gap-h<sTop&&r.bottom+pad+gap+h<=sBot)below=true;
  box.classList.toggle("below",below);box.classList.toggle("above",!below);
  box.style.top=(below?Math.min(sBot-h,r.bottom+pad+gap):Math.max(sTop,r.top-pad-gap-h))+"px";box.style.bottom="auto";
 }
 window.addEventListener("resize",()=>draw(true));window.addEventListener("scroll",()=>draw(),{passive:true});
 function bind(){box.querySelectorAll("[data-tut]").forEach(b=>b.onclick=()=>{
  if(b.dataset.tut==="skip"){endTutorial(true);return}
  const tu=cur(),st=STEPS[tu.step];if(st.last){endTutorial(false);return}tu.step++;saveGame();enterStep()})}
 // Avança sozinho quando a ação do passo foi feita, e acompanha o alvo (folhas que abrem, resumo, rotação).
 setInterval(()=>{const tu=cur();if(!tu||!$("homeScreen").hidden){if(!box.hidden)hide();return}
  const st=STEPS[tu.step];if(st?.action&&st.done()){tu.step++;saveGame();enterStep();return}draw()},250);
 // Durante os passos de ação, não deixa concluir a era antes do tempo (a dica vira o aviso).
 onHook("beforeConclude",()=>{const tu=cur();if(!tu)return;const st=STEPS[tu.step];
  if(tu.step===0&&!st.done()){warn={key:"tut.warn.plan"};draw(true);return false}
  if(tu.step<=1&&readAlloc()[0]+1e-9<needMil()){warn={key:"tut.warn.gold",params:{n:fmt(needMil(),0)}};draw(true);return false}
  if(tu.step===2&&!st.done()){warn={key:"tut.warn.order",params:{region:tname()}};draw(true);return false}
 });
 // Depois de cada desenho completo, o balão acompanha o alvo.
 onHook("afterRender",()=>{if(cur())setTimeout(()=>draw(true),0)});
 // Tela inicial: botão e oferta na primeira visita.
 let b=$("homeTutorial");if(!b&&$("homeHowTo")){b=document.createElement("button");b.type="button";b.className="btn-glass";b.id="homeTutorial";b.textContent=t("home.tutorial");$("homeHowTo").insertAdjacentElement("beforebegin",b)}
 if(b)b.onclick=()=>{const inProg=state&&!state.result&&(state.era>1||state.history.length>0)&&!cur();if(inProg)showDialog({icon:"compass",title:t("tut.start.title"),text:t("tut.start.text",{era:String(state.era)}),buttons:[{label:t("common.cancel")},{label:t("tut.start.button"),kind:"primary",onClick:startTutorial}],esc:0});else startTutorial()};
 let offered=false;try{offered=!!await storage.get(TUT_KEY)}catch(e){offered=true}
 const fresh=!state||(!state.history.length&&state.era<=1);
 if(!offered&&fresh)setTimeout(()=>showModal(INVITE_HTML(),[{label:t("tut.invite.play"),cls:"primary btn-main",onClick:startTutorial},{label:t("tut.invite.later"),cls:"txtbtn",onClick:()=>{storage.set(TUT_KEY,"1").catch(()=>{})}}],{cls:"modal-invite",label:t("tut.invite.title"),esc:1}),300);
 if(cur())setTimeout(()=>draw(true),0);
 // Ao voltar ao jogo a partir da tela inicial, mostra de novo o balão.
 onHook("continueGame",()=>setTimeout(()=>draw(true),0));
 onHook("returnHome",hide);
 // Trocar o idioma: o balão volta a ser desenhado com os textos novos.
 onLanguageChange(()=>{box.setAttribute("aria-label",t("tut.aria"));if(cur())draw(true)});
}
