// Laboratórios (só versão de desenvolvimento, dev.html): liga as abas, os botões e o "Exportar" da partida.
import {onHook} from "../app/hooks.js";
import {markLabGame} from "../app/medals.js";
import {state,gameMode,configApplied,configDefault,setConfigApplied,rememberAiBase,setState,newGame,setSelectedTerritory,setCancelRequested} from "../app/session.js";
import {VERSION,normalizeConfig} from "../core/config.js";
import {simulate} from "../core/era.js";
import {P} from "../core/state.js";
import {clone,safeNum} from "../core/util.js";
import {exportAiValidation,runAiValidation} from "./ai-validation.js";
import {exportBalanceLab,runBalanceLab} from "./balance.js";
import {compareStrategies,compareResults} from "./compare.js";
import {setupExpLab,redrawExpCharts} from "./experiment-ui.js";
import {setupFixedLab} from "./fixed.js";
import {renderParams,applyConfig,readParams,loadJsonFile,runLong,runStrategy,scenarioPreset,scenarioObject,scenarioLoaded,renderScenarioResult} from "./settings-ui.js";
import {setConfigEdited} from "./settings.js";
import {loadFtHistory} from "./tests-def.js";
import {runTests,setupFtLab} from "./tests-ui.js";
import {setupValLab,drawValChart} from "./validation-ui.js";
import {download} from "../platform/files.js";
import {$,setStatus} from "../ui/dom.js";
import {renderAll,showView} from "../ui/game.js";

export function exportHistory(){download(`imperios-partida-era${state.era}.json`,JSON.stringify({formatVersion:VERSION,exportedAt:new Date().toISOString(),gameMode,config:configApplied,state},null,2))}
// Laboratórios (versão de desenvolvimento): editor de configuração, testes funcionais, balanceamento, IAs.
export async function initLabs(){
 // Botões da tela inicial que só existem com os laboratórios.
 $("homeCompare").onclick=()=>{$("homeScreen").hidden=true;showView("balanceLab")};
 $("homeLab").onclick=()=>{$("homeScreen").hidden=true;showView("lab")};
 // Com os laboratórios, Início e Reiniciar ficam no cabeçalho (na versão do jogador estão no menu ☰).
 $("topActions").prepend($("returnHome"),$("restart"));
 renderParams();
 onHook("configChanged",()=>{setConfigEdited(clone(configApplied));renderParams()});
 onHook("viewShown",view=>{if(view==="balanceLab")redrawExpCharts()});
 $("exportHistory").onclick=exportHistory;
 $("applyConfig").onclick=()=>{try{applyConfig()}catch(e){setStatus("labStatus",e.message,"error")}};
 $("restoreConfig").onclick=()=>{setConfigEdited(clone(configDefault));renderParams();setStatus("labStatus","Padrões restaurados na área de edição; clique em Aplicar para usar.")};
 $("saveConfig").onclick=()=>{try{download("imperios-configuracao.json",JSON.stringify({formatVersion:VERSION,config:readParams()},null,2))}catch(e){setStatus("labStatus",e.message,"error")}};
 $("loadConfigBtn").onclick=()=>$("configFile").click();$("configFile").onchange=e=>{if(e.target.files[0])loadJsonFile(e.target.files[0],"config");e.target.value=""};
 $("restartWithConfig").onclick=()=>{try{setConfigApplied(readParams());rememberAiBase(configApplied);setConfigEdited(clone(configApplied));setState(newGame());markLabGame(state);setSelectedTerritory(null);renderParams();renderAll();setStatus("labStatus","Nova partida iniciada com a configuração atual.","success")}catch(e){setStatus("labStatus",e.message,"error")}};
 document.querySelectorAll(".quick").forEach(b=>b.onclick=()=>runLong(Number(b.dataset.n)));
 $("customAdvance").onclick=()=>{try{const n=safeNum($("customEras").value,1,1e9);if(!Number.isSafeInteger(n))throw Error("Use um inteiro positivo.");runLong(n)}catch(e){setStatus("advanceStatus",e.message,"error")}};
 $("cancelAdvance").onclick=()=>{setCancelRequested(true);setStatus("advanceStatus","Cancelamento solicitado; concluindo o bloco atual...")};
 document.querySelectorAll(".strategy").forEach(b=>b.onclick=()=>{try{runStrategy(b.dataset.strategy,$("strategyEras").value)}catch(e){setStatus("strategyStatus",e.message,"error")}});
 $("runCompare").onclick=()=>compareStrategies().catch(e=>setStatus("compareStatus",e.message,"error"));
 $("exportCompare").onclick=()=>{if(!compareResults.length){setStatus("compareStatus","Execute uma comparação primeiro.","error");return}const rows=[["strategy","era","revenue","cumulative_revenue","budget","military","territories","ai_territories","player_wins","player_losses","neutral_conquests","enemy_conquests","invested_military","invested_infrastructure","invested_technology"],...compareResults.flatMap(r=>r.state.history.map(h=>[r.strategy,h.era,h.total,h.cumRevenue,h.budget,h.military,h.territories,h.aiTerritories,h.attacksTotal?.playerWins||0,h.attacksTotal?.playerLosses||0,h.attacksTotal?.neutralConquests||0,h.attacksTotal?.enemyConquests||0,P(r.state).invested.military,P(r.state).invested.infrastructure,P(r.state).invested.technology]))];download("imperios-comparacao.csv",rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(";")).join("\n"),"text/csv;charset=utf-8")};
 document.querySelectorAll(".scenario").forEach(b=>b.onclick=()=>scenarioPreset(b.dataset.scenario));
 $("saveScenario").onclick=()=>{try{const o=scenarioObject();download("imperios-cenario.json",JSON.stringify(o,null,2));setStatus("scenarioStatus","Cenário exportado.","success")}catch(e){setStatus("scenarioStatus",e.message,"error")}};
 $("loadScenarioBtn").onclick=()=>$("scenarioFile").click();$("scenarioFile").onchange=e=>{if(e.target.files[0])loadJsonFile(e.target.files[0],"scenario");e.target.value=""};
 $("runScenario").onclick=()=>{try{const o=scenarioLoaded||scenarioObject(),c=normalizeConfig(o.config),s=simulate(o.strategy||"balanced",safeNum($("scenarioEras").value,1,1e7),c,null,undefined,null,gameMode);renderScenarioResult(s,o.name||$("scenarioName").value);setStatus("scenarioStatus","Cenário executado isoladamente; partida atual preservada.","success")}catch(e){setStatus("scenarioStatus",e.message,"error")}};
 $("runTests").onclick=runTests;
 $("runAiValidation").onclick=()=>runAiValidation().catch(e=>setStatus("aiValidationStatus",e.message,"error"));
 $("exportAiValidation").onclick=exportAiValidation;
 $("runBalanceLab").onclick=()=>runBalanceLab().catch(e=>setStatus("balanceStatus",e.message,"error"));
 $("exportBalanceLab").onclick=exportBalanceLab;
 setupFixedLab();
 await loadFtHistory();
 setupFtLab();setupExpLab();setupValLab();
 window.addEventListener("resize",()=>{redrawExpCharts();drawValChart()});
}
