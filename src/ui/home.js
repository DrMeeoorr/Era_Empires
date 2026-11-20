// Tela inicial e configuração da partida (modo, rivais, dificuldade, eras, vitória, mapa, posição inicial).
import {runHook} from "../app/hooks.js";
import {DEV_MODE,DEFAULT_DIFFICULTY,gameMode,configApplied,currentDifficulty,setOpponentChoices,opponentChoices,visibleOpponentOptions,state,setGameMode,setCurrentDifficulty,applyDifficulty,setConfigApplied,mapType,setMapType,terrainEffectsChoice,setTerrainEffectsChoice} from "../app/session.js";
import {tutorialPrevSetup,restoreSetupAfterTutorial} from "../app/setup.js";
import {DIFFICULTIES,MAX_AI,CIV_COLORS,normalizeConfig} from "../core/config.js";
import {RIVAL_NAMES} from "../core/names.js";
import {clamp} from "../core/util.js";
import {$} from "./dom.js";
import {startNewGame,showView,renderAll} from "./game.js";
import {civSymHtml,playerProfileName} from "./labels.js";
import {showDialog} from "./modal.js";
import {closeSheet,openSheet,isSheetOpen} from "./sheets.js";

// Ações da tela inicial: o jogo existente permanece intacto por trás da proposta.
export function initHome(){
 const home=$("homeScreen");if(!home)return;const setup=$("setupScreen");
 // Abre a configuração com as escolhas atuais (também usada no fim da partida: "Mudar definições").
 // fromGame=true repõe as escolhas da partida atual; a partir da tela inicial mantém as escolhas em curso.
 // Escolhas atuais; durante/depois do tutorial, as que o jogador tinha antes de o começar.
 // Na versão do jogador, "Configurações" (de um save antigo) aparece como "Médio" na próxima partida.
 const shownDiff=d=>DIFFICULTIES[d]&&(DEV_MODE||d!=="config")?d:"medio";
 const currentChoice=()=>{const p=tutorialPrevSetup();if(p)return {mode:p.mode==="fast"?"fast":"slow",ai:clamp(Number(p.ai)|0,1,MAX_AI),eras:clamp(Number(p.eras)|0,10,150),conquest:p.supremacy===false,difficulty:shownDiff(DIFFICULTIES[p.difficulty]?p.difficulty:DEFAULT_DIFFICULTY),randomStart:!!p.randomStart,map:p.mapType==="sorteado"?"sorteado":"padrao",effects:p.terrainEffects===true};
  return {mode:gameMode,ai:configApplied.map.aiCount||1,eras:configApplied.endgame.maxEras,conquest:configApplied.endgame.supremacyEnabled===false,difficulty:shownDiff(currentDifficulty),randomStart:!!configApplied.map.randomStart,map:mapType,effects:terrainEffectsChoice}};
 const openSetup=(fromGame=false)=>{if(fromGame===true)choice=currentChoice();sync();setup.hidden=false;setup.scrollTop=0};window.openSetup=openSetup;
 let choice=currentChoice();
 const renderProfiles=()=>{if(!DEV_MODE)setOpponentChoices(opponentChoices.map(v=>v==="config"?"adaptive":v));const opts=visibleOpponentOptions().map(([v,t])=>{const [short,desc]=t.split(" — ");return [v,short.replace(" (revelado no fim)",""),desc||(v==="random"?"revelado no fim da partida":"")]});
  $("homeProfiles").innerHTML=Array.from({length:choice.ai},(_,i)=>{const cur=opts.find(o=>o[0]===opponentChoices[i]);return `<div class="profile-row"><span>${civSymHtml({index:i+1,color:CIV_COLORS[i+1]})} ${RIVAL_NAMES[i]}</span><select data-prof="${i}" aria-label="Estilo de ${RIVAL_NAMES[i]}" aria-describedby="profDesc${i}">${opts.map(([v,t])=>`<option value="${v}" ${opponentChoices[i]===v?"selected":""}>${t}</option>`).join("")}</select><small class="profile-desc" id="profDesc${i}">${cur?.[2]||""}</small></div>`}).join("")+(choice.ai>1?`<div class="chips"><button type="button" class="chip" id="allRandom">🎲 Todos aleatórios</button></div>`:"");document.querySelectorAll("[data-prof]").forEach(el=>el.onchange=()=>{opponentChoices[+el.dataset.prof]=el.value;sync()});const ar=$("allRandom");if(ar)ar.onclick=()=>{setOpponentChoices(opponentChoices.map(()=>"random"));sync()}};
 const inProgress=()=>!!(state&&!state.result&&(state.era>1||state.history.length>0));
 const rivalsTxt=n=>n===1?"1 rival":n+" rivais";
 const sync=()=>{
  $("modeSlow").classList.toggle("selected",choice.mode==="slow");$("modeFast").classList.toggle("selected",choice.mode==="fast");
  $("modeSlow").setAttribute("aria-pressed",String(choice.mode==="slow"));$("modeFast").setAttribute("aria-pressed",String(choice.mode==="fast"));
  $("homeModeDesc").textContent=choice.mode==="fast"?"Os retornos chegam antes: tudo acontece em menos eras.":"Os investimentos rendem no tempo normal.";
  document.querySelectorAll("#homeOpponents [data-ai]").forEach(b=>{b.classList.toggle("selected",Number(b.dataset.ai)===choice.ai);b.setAttribute("aria-pressed",String(Number(b.dataset.ai)===choice.ai))});
  let preset=false;document.querySelectorAll("#homeEraPresets [data-eras]").forEach(b=>{const on=Number(b.dataset.eras)===choice.eras;preset||=on;b.classList.toggle("selected",on);b.setAttribute("aria-pressed",String(on))});$("homeMaxEras").value=choice.eras;$("homeMaxEras").closest(".pg-other")?.classList.toggle("on",!preset);
  for(const [id,on] of [["homeClassic",!choice.conquest],["homeConquest",!!choice.conquest]]){$(id).classList.toggle("selected",on);$(id).setAttribute("aria-pressed",String(on))}
  $("homeVictoryDesc").textContent=choice.conquest?"Só domínio (70% das regiões) ou eliminação. No limite de eras, vencem os pontos.":"Domínio, eliminação ou supremacia (na fase final). No limite de eras, vencem os pontos.";
  for(const [id,on] of [["mapFixed",choice.map!=="sorteado"],["mapRandom",choice.map==="sorteado"]]){$(id).classList.toggle("selected",on);$(id).setAttribute("aria-pressed",String(on))}
  $("mapDesc").textContent=choice.map==="sorteado"?"Os terrenos mudam a cada partida. Todos começam em Campina e o sorteio evita mapas injustos.":"Cada região tem sempre o mesmo terreno: Jaspe é montanha, Musgo é floresta. Bom para aprender o mapa.";
  for(const [id,on] of [["terrVisual",!choice.effects],["terrEffects",!!choice.effects]]){$(id).classList.toggle("selected",on);$(id).setAttribute("aria-pressed",String(on))}
  $("terrFxDesc").textContent=choice.effects?"Cada terreno dá 2 vantagens e 1 desvantagem (ouro, defesa, Obras, Força ou Ciência). Veja em ⓘ Terrenos.":"O terreno só enfeita o mapa: as regras são as de sempre. Bom para começar.";
  $("homeRandomStart").checked=!!choice.randomStart;
  renderProfiles();
  document.querySelectorAll("#homeDifficulty [data-diff]").forEach(b=>{const on=b.dataset.diff===choice.difficulty;b.classList.toggle("selected",on);b.setAttribute("aria-pressed",String(on))});$("homeDiffDesc").textContent=DIFFICULTIES[choice.difficulty]?.desc||"";
  const styleName=v=>v==="random"?"aleatório":v==="config"?"das Configurações":playerProfileName(v).toLowerCase();
  const styles=Array.from({length:choice.ai},(_,i)=>styleName(opponentChoices[i]||"random"));const uniq=[...new Set(styles)];
  $("customizeSummary").textContent=`${choice.eras} eras · ritmo ${choice.mode==="fast"?"rápido":"normal"} · vitória ${choice.conquest?"por conquista":"clássica"}${choice.randomStart?" · posição aleatória":""}${choice.map==="sorteado"?" · mapa sorteado":""}${choice.effects?" · terrenos com efeito":""}`;
  $("setupSummary").innerHTML=`<strong>${rivalsTxt(choice.ai)}</strong> ${uniq.length===1?(choice.ai===1?uniq[0]:(uniq[0]==="aleatório"?"aleatórios":uniq[0])):"("+styles.join(", ")+")"} · <strong>${DIFFICULTIES[choice.difficulty]?.name||""}</strong> · ${choice.eras} eras${choice.conquest?" · Conquista":""}${choice.randomStart?" · posição aleatória":""}${choice.map==="sorteado"?" · mapa sorteado":""}${choice.effects?" · terrenos com efeito":""} · ritmo ${choice.mode==="fast"?"rápido":"normal"}`;
  // Com partida salva: "Continuar · Era N" é o botão principal e "Nova partida" fica como secundário.
  const saved=inProgress(),cont=$("homeContinue"),start=$("homeStart");
  cont.classList.toggle("hidden",!saved);
  start.classList.toggle("btn-main",!saved);start.classList.toggle("btn-line",saved);
  $("homeStartLabel").textContent=saved?"Nova partida":"Jogar";start.querySelector(".ic")?.classList.toggle("hidden",saved);
  if(saved){
   const tut=state.tutorial&&!state.tutorial.done,diff=DIFFICULTIES[state.difficulty]&&(DEV_MODE||state.difficulty!=="config")?DIFFICULTIES[state.difficulty].name:"";
   $("homeContinueLabel").textContent=`Continuar · Era ${state.era}`;
   $("homeContinueMeta").textContent=[`de ${state.maxEras}`,tut?"tutorial":diff,rivalsTxt(Math.max(1,(state.civs?.length||2)-1))].filter(Boolean).join(" · ");
   cont.setAttribute("aria-label",`Continuar a partida: era ${state.era} de ${state.maxEras}`);
  }
 };
 document.querySelectorAll("#homeDifficulty [data-diff]").forEach(b=>b.onclick=()=>{choice.difficulty=b.dataset.diff;sync()});
 $("modeSlow").onclick=()=>{choice.mode="slow";sync()};$("modeFast").onclick=()=>{choice.mode="fast";sync()};
 document.querySelectorAll("#homeOpponents [data-ai]").forEach(b=>b.onclick=()=>{choice.ai=Number(b.dataset.ai);sync()});
 document.querySelectorAll("#homeEraPresets [data-eras]").forEach(b=>b.onclick=()=>{choice.eras=Number(b.dataset.eras);sync()});
 $("homeConquest").onclick=()=>{choice.conquest=true;sync()};$("homeRandomStart").onchange=()=>{choice.randomStart=$("homeRandomStart").checked;sync()};$("homeClassic").onclick=()=>{choice.conquest=false;sync()};
 $("mapFixed").onclick=()=>{choice.map="padrao";sync()};$("mapRandom").onclick=()=>{choice.map="sorteado";sync()};
 $("terrVisual").onclick=()=>{choice.effects=false;sync()};$("terrEffects").onclick=()=>{choice.effects=true;sync()};
 $("homeMaxEras").onchange=()=>{const v=Math.round(Number($("homeMaxEras").value));choice.eras=Number.isFinite(v)?clamp(v,10,150):30;sync()};
 const begin=()=>{restoreSetupAfterTutorial();setGameMode(choice.mode);setCurrentDifficulty(choice.difficulty);applyDifficulty(choice.difficulty);configApplied.map.aiCount=choice.ai;configApplied.endgame.maxEras=choice.eras;configApplied.endgame.supremacyEnabled=!choice.conquest;configApplied.map.randomStart=!!choice.randomStart;setMapType(choice.map);setTerrainEffectsChoice(!!choice.effects);setConfigApplied(normalizeConfig(configApplied));runHook("configChanged");startNewGame();home.hidden=true;setup.hidden=true;showView("game")};
 $("homeStart").onclick=()=>{$("setupCustomize").open=false;openSetup(false)};
 $("setupBack").onclick=()=>{setup.hidden=true;sync();home.hidden=false;$("homeStart").focus()};
 // Como jogar (tela própria, a mesma que o "?" abre por cima da partida): funciona como uma folha (sheets.js), por isso
 // fecha com Voltar, ✕, Entendi, Esc e o botão voltar do Android, e devolve o foco a quem a abriu.
 $("homeHowTo").onclick=()=>openSheet("howToScreen",$("homeHowTo"));
 $("howToBack").onclick=()=>closeSheet();$("howToOk").onclick=()=>closeSheet();
 $("setupStart").onclick=()=>{
  if(inProgress())showDialog({icon:"play",title:"Começar uma nova partida?",text:`A partida em andamento (era ${state.era}) será substituída.`,buttons:[{label:"Cancelar"},{label:"Nova partida",kind:"primary",onClick:begin}],esc:0});else begin();
 };
 const openTab=v=>{home.hidden=true;showView(v)};
 $("homeContinue").onclick=()=>{openTab("game");renderAll();runHook("continueGame")};
 $("returnHome").onclick=()=>{closeSheet({focus:false});choice=currentChoice();sync();home.hidden=false;home.scrollTop=0;runHook("returnHome")};
 // Tecla Esc / botão Voltar do teclado: fecha a configuração (se não houver janela nem folha aberta; o Como jogar é
 // uma folha e fecha sozinho).
 document.addEventListener("keydown",e=>{if(e.key!=="Escape"||e.defaultPrevented||isSheetOpen()||$("modalRoot").childElementCount)return;
  if(!setup.hidden){e.preventDefault();$("setupBack").click()}});
 sync();
}
