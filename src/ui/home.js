// Tela inicial e configuração da partida (modo, rivais, dificuldade, eras, vitória).
import {runHook} from "../app/hooks.js";
import {DEV_MODE,DEFAULT_DIFFICULTY,gameMode,configApplied,currentDifficulty,setOpponentChoices,opponentChoices,visibleOpponentOptions,state,setGameMode,setCurrentDifficulty,applyDifficulty,setConfigApplied} from "../app/session.js";
import {tutorialPrevSetup,restoreSetupAfterTutorial} from "../app/setup.js";
import {DIFFICULTIES,MAX_AI,CIV_COLORS,normalizeConfig} from "../core/config.js";
import {RIVAL_NAMES} from "../core/names.js";
import {clamp} from "../core/util.js";
import {$} from "./dom.js";
import {startNewGame,showView,renderAll} from "./game.js";
import {civSymHtml,playerProfileName} from "./labels.js";
import {showModal} from "./modal.js";
import {closeSheet} from "./sheets.js";

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
 $("returnHome").onclick=()=>{closeSheet({focus:false});choice=currentChoice();sync();home.hidden=false;home.scrollTop=0;runHook("returnHome")};
 sync();
}
