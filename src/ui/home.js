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
import {civSymHtml,playerProfileName} from "./labels.js";
import {showDialog} from "./modal.js";
import {recommendedRivalsFor} from "./mapshape.js";
import {racesRuleForSize} from "./discovery.js";
import {VICTORY_KEYS,VICTORY_SHORT,victoriesOfConfig,victoryAvailable,effectiveVictories} from "./victories.js";
import {closeSheet,openSheet,isSheetOpen} from "./sheets.js";

// Ações da tela inicial: o jogo existente permanece intacto por trás da proposta.
// Tamanho do mapa: 1 = Original (6×4), 2×, 3×, 4× a área (8×6, 10×7, 12×8). Grava em config.map.mapSize.
const MAP_SIZE_INFO={1:["6 × 4",24],2:["8 × 6",48],3:["10 × 7",70],4:["12 × 8",96]};
const mapSizeChoice=v=>MAP_SIZE_INFO[Number(v)]?Number(v):1;
// Tipos de vitória escolhidos. A chave Supremacia é o único controle da supremacia (substitui Clássica/Conquista):
// desligada grava supremacyEnabled=false, como o antigo modo Conquista; saves antigos de Conquista abrem com ela desligada.
const victoriesOf=(v,sup)=>({...victoriesOfConfig({endgame:{victories:v}}),supremacy:sup!==false});
const joinOu=l=>l.length<2?(l[0]||""):l.slice(0,-1).join(", ")+" ou "+l.at(-1);
export function initHome(){
 const home=$("homeScreen");if(!home)return;const setup=$("setupScreen");
 // Abre a configuração com as escolhas atuais (também usada no fim da partida: "Mudar definições").
 // fromGame=true repõe as escolhas da partida atual; a partir da tela inicial mantém as escolhas em curso.
 // Escolhas atuais; durante/depois do tutorial, as que o jogador tinha antes de o começar.
 // Na versão do jogador, "Configurações" (de um save antigo) aparece como "Médio" na próxima partida.
 const shownDiff=d=>DIFFICULTIES[d]&&(DEV_MODE||d!=="config")?d:"medio";
 const currentChoice=()=>{const p=tutorialPrevSetup();if(p)return {mode:p.mode==="fast"?"fast":"slow",ai:clamp(Number(p.ai)|0,1,MAX_AI),eras:p.unlimited===true?30:clamp(Number(p.eras)|0,10,150),conquest:p.supremacy===false,difficulty:shownDiff(DIFFICULTIES[p.difficulty]?p.difficulty:DEFAULT_DIFFICULTY),randomStart:!!p.randomStart,map:p.mapType==="sorteado"?"sorteado":"padrao",mapSize:mapSizeChoice(p.mapSize),victories:victoriesOf(p.victories,p.supremacy!==false),effects:p.terrainEffects===true,unlimited:p.unlimited===true};
  // Sem limite: o campo "Outra" mostra 30 (o teto de segurança, 100 eras no Original, não é uma duração escolhida).
  return {mode:gameMode,ai:configApplied.map.aiCount||1,eras:unlimitedChoice?30:configApplied.endgame.maxEras,conquest:configApplied.endgame.supremacyEnabled===false,difficulty:shownDiff(currentDifficulty),randomStart:!!configApplied.map.randomStart,map:mapType,mapSize:mapSizeChoice(configApplied.map.mapSize),victories:victoriesOf(configApplied.endgame.victories,configApplied.endgame.supremacyEnabled!==false),effects:terrainEffectsChoice,unlimited:unlimitedChoice}};
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
  // Duração: 15 / 30 / Sem limite (teto de segurança por tamanho do mapa, decidido por pontos) / Outra (10–150).
  let preset=false;document.querySelectorAll("#homeEraPresets [data-eras]").forEach(b=>{const on=b.dataset.eras==="unlimited"?!!choice.unlimited:!choice.unlimited&&Number(b.dataset.eras)===choice.eras;preset||=on;b.classList.toggle("selected",on);b.setAttribute("aria-pressed",String(on))});$("homeMaxEras").value=choice.eras;$("homeMaxEras").closest(".pg-other")?.classList.toggle("on",!preset);
  // Textos da Duração e da Vitória a partir dos tipos de vitória ligados (os de sempre quando está tudo no padrão).
  choice.conquest=!choice.victories.supremacy;
  const vOn=k=>choice.victories[k]&&victoryAvailable(k,choice.mapSize),dom=vOn("dominion"),sup=vOn("supremacy");
  const ends=[dom&&"domínio","eliminação",sup&&"supremacia",vOn("discovery")&&"Grande Descoberta",vOn("wonder")&&"Maravilha"].filter(Boolean);
  $("homeErasDesc").textContent=choice.unlimited?`Termina por ${joinOu(ends)}.`:`A partida acaba na era ${choice.eras}, ou antes se alguém vencer.`;
  // Vitória: ao chegar a 70% você escolhe vencer na hora ou continuar até o limite (Sem limite: vence na hora).
  {const l=[dom&&"domínio (70% das regiões)",dom||sup||vOn("discovery")||vOn("wonder")?"eliminação":"eliminação dos rivais",sup&&(choice.unlimited?`supremacia (a partir da era ${UNLIMITED.supremacyFromEra})`:"supremacia (na fase final)"),vOn("discovery")&&"Grande Descoberta",vOn("wonder")&&"Maravilha da Humanidade"].filter(Boolean);
   let t=joinOu(l);t=(!sup&&l.length<=2?"Só "+t:t.charAt(0).toUpperCase()+t.slice(1))+".";
   if(dom)t+=choice.unlimited?" Ao dominar o mapa, você vence na hora.":" Ao dominar o mapa, vença na hora ou continue.";
   if(!choice.unlimited)t+=" No limite de eras, vencem os pontos.";
   $("homeVictoryDesc").textContent=t}
  // Tipos de vitória: chaves (Descoberta e Maravilha só nos mapas 2×–4×), linha resumida e aviso quando nada sobra.
  document.querySelectorAll("#victoryTypes [data-victory]").forEach(el=>{const k=el.dataset.victory,av=victoryAvailable(k,choice.mapSize);
   el.checked=!!choice.victories[k]&&av;el.disabled=!av;el.closest(".pg-vrow")?.classList.toggle("na",!av);
   const txt=document.querySelector(`[data-vtxt="${k}"]`);if(txt){txt.dataset.base??=txt.textContent;txt.textContent=av?txt.dataset.base:"Só em mapas 2×, 3× e 4×."}});
  {const eff=effectiveVictories(choice.victories,choice.mapSize);
   $("victoryNoneTip").hidden=eff.length>0}
  const offTxt=VICTORY_KEYS.filter(k=>victoryAvailable(k,choice.mapSize)&&!choice.victories[k]).map(k=>` · sem ${VICTORY_SHORT[k]}`).join("");
  for(const [id,on] of [["mapFixed",choice.map!=="sorteado"],["mapRandom",choice.map==="sorteado"]]){$(id).classList.toggle("selected",on);$(id).setAttribute("aria-pressed",String(on))}
  $("mapDesc").textContent=choice.map==="sorteado"?"Os terrenos mudam a cada partida. Todos começam em Campina e o sorteio evita mapas injustos.":"Cada região tem sempre o mesmo terreno: Jaspe é montanha, Musgo é floresta. Bom para aprender o mapa.";
  document.querySelectorAll("#homeMapSize [data-map-size]").forEach(b=>{const on=Number(b.dataset.mapSize)===choice.mapSize;b.classList.toggle("selected",on);b.setAttribute("aria-pressed",String(on))});
  {const [grid,n]=MAP_SIZE_INFO[choice.mapSize];$("mapSizeDesc").textContent=choice.mapSize===1?`${grid} = ${n} regiões. O mapa cabe inteiro na tela.`:`${grid} = ${n} regiões, do mesmo tamanho. Arraste o mapa para ver o resto; aproxime com dois dedos ou + e −.`}
  // Grande Descoberta (Ciência) e Maravilha da Humanidade (Obras): só nos mapas 2×–4×, com a meta e o mínimo de regiões do tamanho.
  {const l=racesRuleForSize(choice.mapSize),el=$("mapSizeGd");if(el){el.hidden=!l.length;el.textContent=l.join("\n")}}
  // Mapa grande com poucos rivais: aviso curto e atalho para usar o número recomendado (pelo motor, quando houver).
  {const most=Math.max(1,...[...document.querySelectorAll("#homeOpponents [data-ai]")].map(b=>Number(b.dataset.ai)||1)),rec=Math.min(MAX_AI,most,recommendedRivalsFor(choice.mapSize)),tip=$("mapSizeTip");
   if(tip){const show=choice.mapSize>1&&choice.ai<rec;tip.hidden=!show;
    if(show){$("mapSizeTipTxt").textContent=`Mapas ${choice.mapSize}× ficam melhores com ${rec}${rec<most?" ou mais":""} ${rec===1?"rival":"rivais"}.`;$("mapSizeUseRivals").textContent=`Usar ${rec} rivais`;$("mapSizeUseRivals").dataset.ai=rec}}}
  for(const [id,on] of [["terrVisual",!choice.effects],["terrEffects",!!choice.effects]]){$(id).classList.toggle("selected",on);$(id).setAttribute("aria-pressed",String(on))}
  $("terrFxDesc").textContent=choice.effects?"Cada terreno dá 2 vantagens e 1 desvantagem (ouro, defesa, Obras, Força ou Ciência). Veja em ⓘ Terrenos.":"O terreno só enfeita o mapa: as regras são as de sempre. Bom para começar.";
  $("homeRandomStart").checked=!!choice.randomStart;
  renderProfiles();
  document.querySelectorAll("#homeDifficulty [data-diff]").forEach(b=>{const on=b.dataset.diff===choice.difficulty;b.classList.toggle("selected",on);b.setAttribute("aria-pressed",String(on))});$("homeDiffDesc").textContent=DIFFICULTIES[choice.difficulty]?.desc||"";
  const styleName=v=>v==="random"?"aleatório":v==="config"?"das Configurações":playerProfileName(v).toLowerCase();
  const styles=Array.from({length:choice.ai},(_,i)=>styleName(opponentChoices[i]||"random"));const uniq=[...new Set(styles)];
  const erasTxt=choice.unlimited?"sem limite":`${choice.eras} eras`;
  $("customizeSummary").textContent=`${choice.unlimited?"Sem limite":erasTxt} · ritmo ${choice.mode==="fast"?"rápido":"normal"}${offTxt}${choice.randomStart?" · posição aleatória":""}${choice.mapSize>1?` · mapa ${choice.mapSize}×`:""}${choice.map==="sorteado"?" · mapa sorteado":""}${choice.effects?" · terrenos com efeito":""}`;
  $("setupSummary").innerHTML=`<strong>${rivalsTxt(choice.ai)}</strong> ${uniq.length===1?(choice.ai===1?uniq[0]:(uniq[0]==="aleatório"?"aleatórios":uniq[0])):"("+styles.join(", ")+")"} · <strong>${DIFFICULTIES[choice.difficulty]?.name||""}</strong> · ${erasTxt}${offTxt}${choice.randomStart?" · posição aleatória":""}${choice.mapSize>1?` · mapa ${choice.mapSize}×`:""}${choice.map==="sorteado"?" · mapa sorteado":""}${choice.effects?" · terrenos com efeito":""} · ritmo ${choice.mode==="fast"?"rápido":"normal"}`;
  // Com partida salva: "Continuar · Era N" é o botão principal e "Nova partida" fica como secundário.
  const saved=inProgress(),cont=$("homeContinue"),start=$("homeStart");
  cont.classList.toggle("hidden",!saved);
  start.classList.toggle("btn-main",!saved);start.classList.toggle("btn-line",saved);
  $("homeStartLabel").textContent=saved?"Nova partida":"Jogar";start.querySelector(".ic")?.classList.toggle("hidden",saved);
  if(saved){
   const tut=state.tutorial&&!state.tutorial.done,diff=DIFFICULTIES[state.difficulty]&&(DEV_MODE||state.difficulty!=="config")?DIFFICULTIES[state.difficulty].name:"";
   $("homeContinueLabel").textContent=`Continuar · Era ${state.era}`;
   $("homeContinueMeta").textContent=[state.unlimited?"sem limite":`de ${state.maxEras}`,tut?"tutorial":diff,rivalsTxt(Math.max(1,(state.civs?.length||2)-1))].filter(Boolean).join(" · ");
   cont.setAttribute("aria-label",`Continuar a partida: era ${state.era}${state.unlimited?", sem limite de eras":` de ${state.maxEras}`}`);
  }
 };
 document.querySelectorAll("#homeDifficulty [data-diff]").forEach(b=>b.onclick=()=>{choice.difficulty=b.dataset.diff;sync()});
 $("modeSlow").onclick=()=>{choice.mode="slow";sync()};$("modeFast").onclick=()=>{choice.mode="fast";sync()};
 document.querySelectorAll("#homeOpponents [data-ai]").forEach(b=>b.onclick=()=>{choice.ai=Number(b.dataset.ai);sync()});
 document.querySelectorAll("#homeEraPresets [data-eras]").forEach(b=>b.onclick=()=>{if(b.dataset.eras==="unlimited")choice.unlimited=true;else{choice.unlimited=false;choice.eras=Number(b.dataset.eras)}sync()});
 document.querySelectorAll("#victoryTypes [data-victory]").forEach(el=>el.onchange=()=>{const k=el.dataset.victory;choice.victories[k]=el.checked;sync()});
 $("homeRandomStart").onchange=()=>{choice.randomStart=$("homeRandomStart").checked;sync()};
 $("mapFixed").onclick=()=>{choice.map="padrao";sync()};$("mapRandom").onclick=()=>{choice.map="sorteado";sync()};
 document.querySelectorAll("#homeMapSize [data-map-size]").forEach(b=>b.onclick=()=>{choice.mapSize=mapSizeChoice(b.dataset.mapSize);sync()});
 if($("mapSizeUseRivals"))$("mapSizeUseRivals").onclick=()=>{choice.ai=clamp(Number($("mapSizeUseRivals").dataset.ai)|0,1,MAX_AI);sync();$("homeMapSize").querySelector(".selected")?.focus()};
 $("terrVisual").onclick=()=>{choice.effects=false;sync()};$("terrEffects").onclick=()=>{choice.effects=true;sync()};
 $("homeMaxEras").onchange=()=>{const v=Math.round(Number($("homeMaxEras").value));choice.eras=Number.isFinite(v)?clamp(v,10,150):30;choice.unlimited=false;sync()};
 const begin=()=>{restoreSetupAfterTutorial();setGameMode(choice.mode);setCurrentDifficulty(choice.difficulty);applyDifficulty(choice.difficulty);configApplied.map.aiCount=choice.ai;configApplied.endgame.maxEras=choice.unlimited?UNLIMITED.maxEras:choice.eras;configApplied.endgame.supremacyEnabled=!choice.conquest;configApplied.endgame.victories={...choice.victories,supremacy:!choice.conquest};configApplied.map.randomStart=!!choice.randomStart;configApplied.map.mapSize=choice.mapSize;setMapType(choice.map);setTerrainEffectsChoice(!!choice.effects);setUnlimitedChoice(!!choice.unlimited);setConfigApplied(normalizeConfig(configApplied));runHook("configChanged");startNewGame();home.hidden=true;setup.hidden=true;showView("game")};
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
