// Tela da era: arranque do jogo (save ou partida nova), desenho completo, concluir a era, nova partida, vistas.
import {runHook,hooks,onHook} from "../app/hooks.js";
import {quarantineSave,saveGame,readSavedGame} from "../app/save.js";
import {setConfigApplied,configDefault,setGameMode,setCurrentDifficulty,DEFAULT_DIFFICULTY,setAiConfigBase,applyDifficulty,currentDifficulty,setOpponentChoices,DEFAULT_OPPONENT,setSelectedTerritory,setState,newGame,state,playEra,DEV_MODE} from "../app/session.js";
import {restoreSetupAfterTutorial} from "../app/setup.js";
import {pickAiDifficulty} from "../core/config.js";
import {P} from "../core/state.js";
import {clone} from "../core/util.js";
import {readAlloc,renderAllocation,AREAS,placePlans,round2,stepArea,restArea,setAlloc,applyPlan} from "./allocation.js";
import {$} from "./dom.js";
import {money,fmtInput,parseAmount} from "./format.js";
import {renderMetrics} from "./hud.js";
import {renderMap,fitRegionNames,attackSelected,markLegend} from "./map.js";
import {showModal} from "./modal.js";
import {renderForecast,renderHistory,renderNotifications,renderVictory,renderCharts,renderResult} from "./panels.js";
import {eraSnapshot,showEraSummary,toggleEraSummary,renderSummaryToggle} from "./report.js";
import {sheetOpen,closeSheet} from "./sheets.js";

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
  setConfigApplied(clone(configDefault));setGameMode("slow");setCurrentDifficulty(DEFAULT_DIFFICULTY);setAiConfigBase(pickAiDifficulty(configDefault));applyDifficulty(currentDifficulty);setOpponentChoices([DEFAULT_OPPONENT,DEFAULT_OPPONENT,DEFAULT_OPPONENT]);setSelectedTerritory(null);setState(newGame());runHook("configChanged");
  if(!saveProblem){saveProblem="erro ao desenhar: "+(e.message||e);noticeBrokenSave()}
  render();
 }
}
// Concluir a era (com o aviso de orçamento parado).
export function concludeEra(){
 if(hooks.beforeConclude.some(fn=>fn()===false))return;
 if(state.result){startNewGame();return}
 const vals=readAlloc(),sum=vals.reduce((a,b)=>a+b,0),b=P(state).treasury,left=b-sum;
 if(sum>b+1e-8){renderAllocation("O total ultrapassa o orçamento.");return}
 const go=()=>{const tst=$("toast");if(tst)tst.hidden=true;const alloc={military:vals[0],infrastructure:vals[1],technology:vals[2]},before=eraSnapshot();playEra(alloc);AREAS.forEach(([k])=>$(k+"Spend").value=0);setSelectedTerritory(null);renderAll();window.scrollTo({top:0,behavior:"smooth"});showEraSummary(before)};
 if(P(state).active&&!state.ui?.skipIdleWarning&&left>=Math.max(0.5,b*0.01)){
  showModal(`<h2>Você ainda tem ${money(left)} para investir</h2><p class="small muted">O saldo fica guardado para as próximas eras e conta para a vitória, mas não rende nada nem defende o império.</p><label class="small" style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="skipIdle"> Não perguntar de novo nesta partida</label>`,
   [{label:"Voltar e investir",cls:"primary",onClick:()=>{if($("skipIdle").checked){state.ui.skipIdleWarning=true;saveGame()}}},{label:"Concluir mesmo assim",onClick:()=>{if($("skipIdle").checked)state.ui.skipIdleWarning=true;go()}}]);
  return;
 }
 go();
}
export function startNewGame(){restoreSetupAfterTutorial();setState(newGame());setSelectedTerritory(null);saveGame();renderAll();window.scrollTo({top:0})}
export function renderAll(){if(!state.ui)state.ui={skipIdleWarning:false};updateFit();renderMetrics();renderMap();renderAllocation();renderForecast();renderHistory();renderNotifications();renderVictory();renderCharts();renderSummaryToggle();runHook("afterRender")}
// Tela da era sem rolagem: só na versão do jogador, com a aba Jogo à vista e sem resultado (a tela de resultado
// ainda rola; Fase 3). Na versão de desenvolvimento (dev.html) o cabeçalho e as abas ficam por cima e a página rola como antes.
export function updateFit(){const g=$("game");document.documentElement.classList.toggle("game-fit",!DEV_MODE&&!!g&&g.classList.contains("active")&&!state?.result);if(state?.result&&sheetOpen==="attackSheet")closeSheet({focus:false})}
// Mostra uma vista (Jogo ou, na versão de desenvolvimento, um laboratório) e marca a aba correspondente.
export function showView(view){
 document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.view===view));document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x.id===view));closeSheet({focus:false});updateFit();if(view==="game")fitRegionNames();runHook("viewShown",view);
}
/* ── Arranque, em partes: jogo, tela inicial, tutorial e (só no dev.html) laboratórios ── */
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
 // Resumo da era: liga/desliga no menu ☰ (o resumo aparece em concludeEra, só quando o jogador conclui a era).
 $("summaryToggle").onclick=toggleEraSummary;
 window.addEventListener("resize",()=>{fitRegionNames();markLegend();renderCharts();placePlans();if(state.result)renderResult()});
}
// Únicas formas de outros módulos substituírem estas variáveis (um módulo não pode reatribuir o que importa).
export function setSavedGameLoaded(v){savedGameLoaded=v;return v}
export function setSaveProblem(v){saveProblem=v;return v}
export function setSavedRaw(v){savedRaw=v;return v}
