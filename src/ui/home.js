// Tela inicial e configuração da partida (modo, rivais, dificuldade, eras, vitória, mapa, posição inicial).
import {runHook} from "../app/hooks.js";
import {DEV_MODE,DEFAULT_DIFFICULTY,gameMode,configApplied,currentDifficulty,setOpponentChoices,opponentChoices,visibleOpponentOptions,state,setGameMode,setCurrentDifficulty,applyDifficulty,setConfigApplied,mapType,setMapType,terrainEffectsChoice,setTerrainEffectsChoice,unlimitedChoice,setUnlimitedChoice} from "../app/session.js";
import {tutorialPrevSetup,restoreSetupAfterTutorial} from "../app/setup.js";
import {DIFFICULTIES,MAX_AI,CIV_COLORS,normalizeConfig} from "../core/config.js";
import {UNLIMITED} from "../core/endgame.js";
import {RIVAL_NAMES} from "../core/names.js";
import {clamp} from "../core/util.js";
import {$} from "./dom.js";
import {startNewGame,showView,renderAll} from "./game.js";
import {civSymHtml,playerProfileName,rivalDisplayName,diffName,diffDesc} from "./labels.js";
import {onLanguageChange,t} from "../i18n/index.js";
import {showDialog} from "./modal.js";
import {recommendedRivalsFor} from "./mapshape.js";
import {racesRuleForSize} from "./discovery.js";
import {closeSheet,openSheet,isSheetOpen} from "./sheets.js";

// Ações da tela inicial: o jogo existente permanece intacto por trás da proposta.
// Tamanho do mapa: 1 = Original (6×4), 2×, 3×, 4× a área (8×6, 10×7, 12×8). Grava em config.map.mapSize.
const PLAYER_STYLE=["reference","military","aggressive","technologist","economist","adaptive"];
const MAP_SIZE_INFO={1:["6 × 4",24],2:["8 × 6",48],3:["10 × 7",70],4:["12 × 8",96]};
const mapSizeChoice=v=>MAP_SIZE_INFO[Number(v)]?Number(v):1;
export function initHome(){
 const home=$("homeScreen");if(!home)return;const setup=$("setupScreen");
 // Abre a configuração com as escolhas atuais (também usada no fim da partida: "Mudar definições").
 // fromGame=true repõe as escolhas da partida atual; a partir da tela inicial mantém as escolhas em curso.
 // Escolhas atuais; durante/depois do tutorial, as que o jogador tinha antes de o começar.
 // Na versão do jogador, "Configurações" (de um save antigo) aparece como "Médio" na próxima partida.
 const shownDiff=d=>DIFFICULTIES[d]&&(DEV_MODE||d!=="config")?d:"medio";
 const currentChoice=()=>{const p=tutorialPrevSetup();if(p)return {mode:p.mode==="fast"?"fast":"slow",ai:clamp(Number(p.ai)|0,1,MAX_AI),eras:p.unlimited===true?30:clamp(Number(p.eras)|0,10,150),conquest:p.supremacy===false,difficulty:shownDiff(DIFFICULTIES[p.difficulty]?p.difficulty:DEFAULT_DIFFICULTY),randomStart:!!p.randomStart,map:p.mapType==="sorteado"?"sorteado":"padrao",mapSize:mapSizeChoice(p.mapSize),effects:p.terrainEffects===true,unlimited:p.unlimited===true};
  // Sem limite: o campo "Outra" mostra 30 (o teto de segurança, 100 eras no Original, não é uma duração escolhida).
  return {mode:gameMode,ai:configApplied.map.aiCount||1,eras:unlimitedChoice?30:configApplied.endgame.maxEras,conquest:configApplied.endgame.supremacyEnabled===false,difficulty:shownDiff(currentDifficulty),randomStart:!!configApplied.map.randomStart,map:mapType,mapSize:mapSizeChoice(configApplied.map.mapSize),effects:terrainEffectsChoice,unlimited:unlimitedChoice}};
 const openSetup=(fromGame=false)=>{if(fromGame===true)choice=currentChoice();sync();setup.hidden=false;setup.scrollTop=0};window.openSetup=openSetup;
 let choice=currentChoice();
 const renderProfiles=()=>{if(!DEV_MODE)setOpponentChoices(opponentChoices.map(v=>v==="config"?"adaptive":v));const opts=visibleOpponentOptions().map(([v])=>v==="random"?[v,t("setup.opt.random"),t("setup.opt.random.desc")]:v==="config"?[v,t("setup.opt.config"),""]:[v,playerProfileName(v),t("style."+v+".desc")]);
  $("homeProfiles").innerHTML=Array.from({length:choice.ai},(_,i)=>{const cur=opts.find(o=>o[0]===opponentChoices[i]);return `<div class="profile-row"><span>${civSymHtml({index:i+1,color:CIV_COLORS[i+1]})} ${rivalDisplayName(RIVAL_NAMES[i])}</span><select data-prof="${i}" aria-label="${t("setup.styleOf",{name:rivalDisplayName(RIVAL_NAMES[i])})}" aria-describedby="profDesc${i}">${opts.map(([v,txt])=>`<option value="${v}" ${opponentChoices[i]===v?"selected":""}>${txt}</option>`).join("")}</select><small class="profile-desc" id="profDesc${i}">${cur?.[2]||""}</small></div>`}).join("")+(choice.ai>1?`<div class="chips"><button type="button" class="chip" id="allRandom">${t("setup.allRandom")}</button></div>`:"");document.querySelectorAll("[data-prof]").forEach(el=>el.onchange=()=>{opponentChoices[+el.dataset.prof]=el.value;sync()});const ar=$("allRandom");if(ar)ar.onclick=()=>{setOpponentChoices(opponentChoices.map(()=>"random"));sync()}};
 const inProgress=()=>!!(state&&!state.result&&(state.era>1||state.history.length>0));
 const rivalsTxt=n=>t("common.rivals",{n:String(n),count:n});
 const sync=()=>{
  $("modeSlow").classList.toggle("selected",choice.mode==="slow");$("modeFast").classList.toggle("selected",choice.mode==="fast");
  $("modeSlow").setAttribute("aria-pressed",String(choice.mode==="slow"));$("modeFast").setAttribute("aria-pressed",String(choice.mode==="fast"));
  $("homeModeDesc").textContent=t(choice.mode==="fast"?"setup.mode.fast.desc":"setup.mode.slow.desc");
  document.querySelectorAll("#homeOpponents [data-ai]").forEach(b=>{b.classList.toggle("selected",Number(b.dataset.ai)===choice.ai);b.setAttribute("aria-pressed",String(Number(b.dataset.ai)===choice.ai))});
  // Duração: 15 / 30 / Sem limite (teto de segurança por tamanho do mapa, decidido por pontos) / Outra (10–150).
  let preset=false;document.querySelectorAll("#homeEraPresets [data-eras]").forEach(b=>{const on=b.dataset.eras==="unlimited"?!!choice.unlimited:!choice.unlimited&&Number(b.dataset.eras)===choice.eras;preset||=on;b.classList.toggle("selected",on);b.setAttribute("aria-pressed",String(on))});$("homeMaxEras").value=choice.eras;$("homeMaxEras").closest(".pg-other")?.classList.toggle("on",!preset);
  for(const [id,on] of [["homeClassic",!choice.conquest],["homeConquest",!!choice.conquest]]){$(id).classList.toggle("selected",on);$(id).setAttribute("aria-pressed",String(on))}
  $("homeErasDesc").textContent=choice.unlimited?t(choice.conquest?"setup.eras.unl.conquest":"setup.eras.unl.classic"):t("setup.eras.limit",{n:String(choice.eras)});
  // Vitória: ao chegar a 70% você escolhe vencer na hora ou continuar até o limite (Sem limite: vence na hora).
  $("homeVictoryDesc").textContent=choice.unlimited
   ?(choice.conquest?t("setup.victory.unl.conquest"):t("setup.victory.unl.classic",{era:String(UNLIMITED.supremacyFromEra)}))
   :t(choice.conquest?"setup.victory.conquest":"setup.victory.classic");
  for(const [id,on] of [["mapFixed",choice.map!=="sorteado"],["mapRandom",choice.map==="sorteado"]]){$(id).classList.toggle("selected",on);$(id).setAttribute("aria-pressed",String(on))}
  $("mapDesc").textContent=t(choice.map==="sorteado"?"setup.map.random.desc":"setup.map.fixed.desc");
  document.querySelectorAll("#homeMapSize [data-map-size]").forEach(b=>{const on=Number(b.dataset.mapSize)===choice.mapSize;b.classList.toggle("selected",on);b.setAttribute("aria-pressed",String(on))});
  {const [grid,n]=MAP_SIZE_INFO[choice.mapSize];$("mapSizeDesc").textContent=t(choice.mapSize===1?"setup.size.desc1":"setup.size.descBig",{grid,n:String(n),count:n})}
  // Grande Descoberta (Ciência) e Maravilha da Humanidade (Obras): só nos mapas 2×–4×, com a meta e o mínimo de regiões do tamanho.
  {const l=racesRuleForSize(choice.mapSize),el=$("mapSizeGd");if(el){el.hidden=!l.length;el.textContent=l.join("\n")}}
  // Mapa grande com poucos rivais: aviso curto e atalho para usar o número recomendado (pelo motor, quando houver).
  {const most=Math.max(1,...[...document.querySelectorAll("#homeOpponents [data-ai]")].map(b=>Number(b.dataset.ai)||1)),rec=Math.min(MAX_AI,most,recommendedRivalsFor(choice.mapSize)),tip=$("mapSizeTip");
   if(tip){const show=choice.mapSize>1&&choice.ai<rec;tip.hidden=!show;
    if(show){$("mapSizeTipTxt").textContent=t(rec<most?"setup.sizeTipMore":"setup.sizeTip",{size:String(choice.mapSize),n:String(rec),count:rec});$("mapSizeUseRivals").textContent=t("setup.useRivals",{n:String(rec),count:rec});$("mapSizeUseRivals").dataset.ai=rec}}}
  for(const [id,on] of [["terrVisual",!choice.effects],["terrEffects",!!choice.effects]]){$(id).classList.toggle("selected",on);$(id).setAttribute("aria-pressed",String(on))}
  $("terrFxDesc").textContent=t(choice.effects?"setup.terr.effects.desc":"setup.terr.visual.desc");
  $("homeRandomStart").checked=!!choice.randomStart;
  renderProfiles();
  document.querySelectorAll("#homeDifficulty [data-diff]").forEach(b=>{const on=b.dataset.diff===choice.difficulty;b.classList.toggle("selected",on);b.setAttribute("aria-pressed",String(on))});$("homeDiffDesc").textContent=DIFFICULTIES[choice.difficulty]?diffDesc(choice.difficulty):"";
  // Estilos no resumo (minúsculas no português: "adaptativo"; cada idioma tem a sua forma em style.*.lower).
  const styleName=v=>v==="random"?t("setup.sum.random"):v==="config"?t("setup.sum.config"):PLAYER_STYLE.includes(v)?t("style."+v+".lower"):playerProfileName(v).toLowerCase();
  const styleKeys=Array.from({length:choice.ai},(_,i)=>opponentChoices[i]||"random"),styles=styleKeys.map(styleName);const uniq=[...new Set(styles)];
  const erasTxt=choice.unlimited?t("setup.sum.unlimitedLower"):t("setup.sum.eras",{n:String(choice.eras)});
  const extras=[choice.randomStart&&t("setup.sum.randomStart"),choice.mapSize>1&&t("setup.sum.mapSize",{n:String(choice.mapSize)}),choice.map==="sorteado"&&t("setup.sum.mapRandom"),choice.effects&&t("setup.sum.effects")].filter(Boolean);
  const pace=t(choice.mode==="fast"?"setup.sum.paceFast":"setup.sum.paceNormal");
  $("customizeSummary").textContent=[choice.unlimited?t("setup.sum.unlimited"):erasTxt,pace,t(choice.conquest?"setup.sum.victoryConquest":"setup.sum.victoryClassic"),...extras].join(" · ");
  const stylesTxt=uniq.length===1?(choice.ai===1?uniq[0]:(styleKeys.every(v=>v==="random")?t("setup.sum.randomPlural"):uniq[0])):t("setup.sum.styleList",{list:styles.join(", ")});
  $("setupSummary").innerHTML=[t("setup.sum.rivals",{rivals:rivalsTxt(choice.ai),styles:stylesTxt}),`<strong>${DIFFICULTIES[choice.difficulty]?diffName(choice.difficulty):""}</strong>`,erasTxt,choice.conquest&&t("setup.sum.conquest"),...extras,pace].filter(Boolean).join(" · ");
  // Com partida salva: "Continuar · Era N" é o botão principal e "Nova partida" fica como secundário.
  const saved=inProgress(),cont=$("homeContinue"),start=$("homeStart");
  cont.classList.toggle("hidden",!saved);
  start.classList.toggle("btn-main",!saved);start.classList.toggle("btn-line",saved);
  $("homeStartLabel").textContent=t(saved?"home.newGame":"home.play");start.querySelector(".ic")?.classList.toggle("hidden",saved);
  if(saved){
   const tut=state.tutorial&&!state.tutorial.done,diff=DIFFICULTIES[state.difficulty]&&(DEV_MODE||state.difficulty!=="config")?diffName(state.difficulty):"";
   $("homeContinueLabel").textContent=t("home.continueEra",{era:String(state.era)});
   $("homeContinueMeta").textContent=[state.unlimited?t("home.meta.unlimited"):t("home.meta.of",{n:String(state.maxEras)}),tut?t("home.meta.tutorial"):diff,rivalsTxt(Math.max(1,(state.civs?.length||2)-1))].filter(Boolean).join(" · ");
   cont.setAttribute("aria-label",state.unlimited?t("home.continueAriaUnl",{era:String(state.era)}):t("home.continueAria",{era:String(state.era),max:String(state.maxEras)}));
  }
 };
 document.querySelectorAll("#homeDifficulty [data-diff]").forEach(b=>b.onclick=()=>{choice.difficulty=b.dataset.diff;sync()});
 $("modeSlow").onclick=()=>{choice.mode="slow";sync()};$("modeFast").onclick=()=>{choice.mode="fast";sync()};
 document.querySelectorAll("#homeOpponents [data-ai]").forEach(b=>b.onclick=()=>{choice.ai=Number(b.dataset.ai);sync()});
 document.querySelectorAll("#homeEraPresets [data-eras]").forEach(b=>b.onclick=()=>{if(b.dataset.eras==="unlimited")choice.unlimited=true;else{choice.unlimited=false;choice.eras=Number(b.dataset.eras)}sync()});
 $("homeConquest").onclick=()=>{choice.conquest=true;sync()};$("homeRandomStart").onchange=()=>{choice.randomStart=$("homeRandomStart").checked;sync()};$("homeClassic").onclick=()=>{choice.conquest=false;sync()};
 $("mapFixed").onclick=()=>{choice.map="padrao";sync()};$("mapRandom").onclick=()=>{choice.map="sorteado";sync()};
 document.querySelectorAll("#homeMapSize [data-map-size]").forEach(b=>b.onclick=()=>{choice.mapSize=mapSizeChoice(b.dataset.mapSize);sync()});
 if($("mapSizeUseRivals"))$("mapSizeUseRivals").onclick=()=>{choice.ai=clamp(Number($("mapSizeUseRivals").dataset.ai)|0,1,MAX_AI);sync();$("homeMapSize").querySelector(".selected")?.focus()};
 $("terrVisual").onclick=()=>{choice.effects=false;sync()};$("terrEffects").onclick=()=>{choice.effects=true;sync()};
 $("homeMaxEras").onchange=()=>{const v=Math.round(Number($("homeMaxEras").value));choice.eras=Number.isFinite(v)?clamp(v,10,150):30;choice.unlimited=false;sync()};
 const begin=()=>{restoreSetupAfterTutorial();setGameMode(choice.mode);setCurrentDifficulty(choice.difficulty);applyDifficulty(choice.difficulty);configApplied.map.aiCount=choice.ai;configApplied.endgame.maxEras=choice.unlimited?UNLIMITED.maxEras:choice.eras;configApplied.endgame.supremacyEnabled=!choice.conquest;configApplied.map.randomStart=!!choice.randomStart;configApplied.map.mapSize=choice.mapSize;setMapType(choice.map);setTerrainEffectsChoice(!!choice.effects);setUnlimitedChoice(!!choice.unlimited);setConfigApplied(normalizeConfig(configApplied));runHook("configChanged");startNewGame();home.hidden=true;setup.hidden=true;showView("game")};
 $("homeStart").onclick=()=>{$("setupCustomize").open=false;openSetup(false)};
 $("setupBack").onclick=()=>{setup.hidden=true;sync();home.hidden=false;$("homeStart").focus()};
 // Como jogar (tela própria, a mesma que o "?" abre por cima da partida): funciona como uma folha (sheets.js), por isso
 // fecha com Voltar, ✕, Entendi, Esc e o botão voltar do Android, e devolve o foco a quem a abriu.
 $("homeHowTo").onclick=()=>openSheet("howToScreen",$("homeHowTo"));
 $("howToBack").onclick=()=>closeSheet();$("howToOk").onclick=()=>closeSheet();
 $("setupStart").onclick=()=>{
  if(inProgress())showDialog({icon:"play",title:t("setup.replace.title"),text:t("setup.replace.text",{era:String(state.era)}),buttons:[{label:t("common.cancel")},{label:t("home.newGame"),kind:"primary",onClick:begin}],esc:0});else begin();
 };
 const openTab=v=>{home.hidden=true;showView(v)};
 $("homeContinue").onclick=()=>{openTab("game");renderAll();runHook("continueGame")};
 $("returnHome").onclick=()=>{closeSheet({focus:false});choice=currentChoice();sync();home.hidden=false;home.scrollTop=0;runHook("returnHome")};
 // Tecla Esc / botão Voltar do teclado: fecha a configuração (se não houver janela nem folha aberta; o Como jogar é
 // uma folha e fecha sozinho).
 document.addEventListener("keydown",e=>{if(e.key!=="Escape"||e.defaultPrevented||isSheetOpen()||$("modalRoot").childElementCount)return;
  if(!setup.hidden){e.preventDefault();$("setupBack").click()}});
 // Trocar o idioma redesenha a tela inicial e a configuração (as escolhas não mudam).
 onLanguageChange(()=>sync());
 sync();
}
