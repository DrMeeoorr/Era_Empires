// Aba "Configurações" (só versão de desenvolvimento): editor de parâmetros, aplicar/guardar/carregar a configuração,
// avanço rápido de várias eras, estratégias automáticas e cenários.
import {configApplied,state,rememberAiBase,setConfigApplied,setState,newGame,setSelectedTerritory,gameMode,busy,setBusy,setCancelRequested,cancelRequested,playEra} from "../app/session.js";
import {markLabGame} from "../app/medals.js";
import {normalizeConfig,SUPPORTED_VERSIONS,DEFAULTS,VERSION} from "../core/config.js";
import {describeResult} from "../core/endgame.js";
import {simulate} from "../core/era.js";
import {addLog,P,newState} from "../core/state.js";
import {clone,safeNum} from "../core/util.js";
import {PARAM_GROUPS,paramInput,configEdited,setConfigEdited} from "./settings.js";
import {$,setStatus} from "../ui/dom.js";
import {money,fmt,escapeHtml} from "../ui/format.js";
import {renderAll} from "../ui/game.js";
import {renderMetrics} from "../ui/hud.js";

export let lastStrategyResult=null;
export let scenarioLoaded=null;
export function makeSnapshot(){return {config:clone(configApplied),state:clone(state)}}
export function renderParams(){
 const groups=PARAM_GROUPS;
 $("params").innerHTML=groups.map(([title,g,items])=>`<h3>${title}</h3><div class="param-grid">${items.map(p=>paramInput(g,...p)).join("")}</div>`).join("");
 document.querySelectorAll("[data-param]").forEach(el=>el.addEventListener("change",()=>{const [g,k]=el.dataset.param.split(".");let v;try{v=paramValue(el)}catch(e){el.setAttribute("aria-invalid","true");setStatus("labStatus",e.message,"error");return}el.removeAttribute("aria-invalid");configEdited[g][k]=v;$("configState").textContent="Edição pendente";}));
}
// Valor de um campo das Configurações. Campo numérico vazio ou inválido é recusado (Number("") seria 0).
export function paramValue(el){
 if(el.type==="checkbox")return el.checked;
 if(el.type!=="number")return el.value;
 const raw=String(el.value).trim(),n=Number(raw);
 if(raw===""||!Number.isFinite(n)){const [g,k]=el.dataset.param.split("."),grp=PARAM_GROUPS.find(x=>x[1]===g),item=grp&&grp[2].find(x=>x[0]===k);throw Error(`Campo “${item?item[1]:el.dataset.param}” vazio ou inválido: escreva um número. Nada foi alterado.`)}
 return n;
}
// Lê todos os campos; se algum for inválido, lança erro sem alterar configEdited.
export function readParams(){const next=clone(configEdited);document.querySelectorAll("[data-param]").forEach(el=>{const [g,k]=el.dataset.param.split(".");next[g][k]=paramValue(el)});const c=normalizeConfig(next);setConfigEdited(next);return c}
export function applyConfig(){
 const c=readParams();rememberAiBase(c);if($("recalcExisting").checked){setConfigApplied(clone(c));setState(newGame());setSelectedTerritory(null);addLog(state,"Partida reiniciada com recálculo explícito.");}
 else setConfigApplied(clone(c));
 markLabGame(state);   // partida com a configuração dos laboratórios: não vale medalhas
 setConfigEdited(clone(c));renderParams();renderAll();$("configState").textContent="Configuração aplicada";setStatus("labStatus",$("recalcExisting").checked?"Configuração aplicada e partida reiniciada.":"Configuração aplicada. Investimentos existentes mantêm seus parâmetros originais.","success");
}
export function loadJsonFile(file,kind){
 const reader=new FileReader();reader.onload=()=>{try{const obj=JSON.parse(reader.result);if(kind==="config"){const c=normalizeConfig(obj.config||obj);setConfigEdited(clone(c));renderParams();setStatus("labStatus","Configuração validada e carregada na área de edição. Clique em Aplicar configurações para usar.","success")}else{if(!SUPPORTED_VERSIONS.includes(obj.formatVersion))throw Error("Versão de cenário não suportada.");const c=normalizeConfig(obj.config);if(!obj.initial||!Number.isInteger(obj.eras)||obj.eras<1)throw Error("Cenário incompleto.");scenarioLoaded=obj;setConfigEdited(clone(c));renderParams();$("scenarioName").value=obj.name||"Cenário importado";$("scenarioEras").value=obj.eras;setStatus("scenarioStatus","Cenário validado. Execute-o ou salve-o novamente.","success")}}catch(e){setStatus(kind==="config"?"labStatus":"scenarioStatus","Importação recusada: "+e.message,"error")}};reader.readAsText(file)}
export function strategyName(s){return ({military:"Militar",aggressive:"Militar agressiva",infrastructure:"Infraestrutura",technology:"Tecnologia",techFirst:"Tecnologia primeiro",growth:"Crescimento",balanced:"Equilibrada",custom:"Personalizada"})[s]||s}
export function runStrategy(strategy,eras){
 eras=safeNum(eras,1,1e7);if(!Number.isSafeInteger(eras))throw Error("Informe um número inteiro de eras.");
 const cfg=clone(configApplied),s=simulate(strategy,eras,cfg,null,[Number($("customMil").value),Number($("customInfra").value),Number($("customTech").value)],null,gameMode);
 lastStrategyResult={strategy,eras,state:s};const r=s.history[s.history.length-1]||{};
 $("strategyResult").innerHTML=`<div class="notice success"><strong>${strategyName(strategy)}</strong> após ${eras} eras: saldo ${money(P(s).treasury)}, receita acumulada ${money(r.cumRevenue||0)}, territórios ${s.owners.filter(o=>o==="player").length}, poder militar ${fmt(P(s).military,1)}.</div>`;
 setStatus("strategyStatus","Simulação concluída sem alterar a partida atual.","success");return s;
}
export async function runLong(n,opts={}){
 if(busy)return;setBusy(true);setCancelRequested(false);$("cancelAdvance").disabled=false;$("advance").disabled=true;let done=0;const start=performance.now();
 markLabGame(state);   // avanço rápido: a partida deixa de valer medalhas
 try{while(done<n&&!cancelRequested&&!state.result){const batch=Math.min(configApplied.simulation.blockSize,n-done);for(let i=0;i<batch&&!state.result;i++){playEra({military:0,infrastructure:0,technology:0});done++}$("advanceProgress").style.width=(100*done/n)+"%";setStatus("advanceStatus",`Processadas ${fmt(done,0)} de ${fmt(n,0)} eras · era atual ${state.era} · ${fmt(performance.now()-start,0)} ms`);renderMetrics();await new Promise(r=>setTimeout(r,0))}
 renderAll();setStatus("advanceStatus",cancelRequested?`Cancelado após ${done} eras concluídas. O histórico foi preservado.`:state.result?`Partida encerrada após ${done} eras: ${describeResult(state,state.result)}`:`Concluído: ${done} eras processadas. Era atual: ${state.era}.`,"success");
 }catch(e){renderAll();setStatus("advanceStatus","Simulação interrompida: "+e.message,"error")}finally{setBusy(false);$("cancelAdvance").disabled=true;$("advance").disabled=false}
}
export function scenarioPreset(kind){
 const c=clone(DEFAULTS);
 if(kind==="fast"){c.military.pointsPerInvestment=.22;c.military.conquestCost=3;c.military.defenseNeutral=2;c.military.defenseOwned=5;c.military.delay=1;c.infrastructure.delay=1;c.infrastructure.duration=6;c.technology.delay=6}
 if(kind==="balanced"){c.military.pointsPerInvestment=.12;c.military.conquestCost=8;c.military.defenseNeutral=3;c.military.defenseOwned=8;c.infrastructure.initialReturn=.12;c.infrastructure.peakEra=3;c.infrastructure.declineRate=.16;c.technology.delay=4}
 if(kind==="long"){c.military.pointsPerInvestment=.08;c.infrastructure.delay=3;c.infrastructure.duration=30;c.infrastructure.peakEra=8;c.infrastructure.growthRate=.12;c.infrastructure.declineRate=.08;c.technology.delay=7;c.technology.benefitPerProgress=.13}
 setConfigEdited(clone(c));renderParams();setStatus("scenarioStatus",`Cenário "${kind}" carregado na edição. Aplique a configuração ou exporte como cenário.`,"success");
 scenarioLoaded={formatVersion:VERSION,name:kind,config:c,initial:newState(c),eras:Number($("scenarioEras").value)||50,strategy:"balanced"};
}
export function scenarioObject(){return {formatVersion:VERSION,name:$("scenarioName").value||"Meu cenário",config:normalizeConfig(configEdited),initial:newState(normalizeConfig(configEdited)),eras:safeNum($("scenarioEras").value,1,1e7),strategy:"balanced"}}
export function renderScenarioResult(s,name){const r=s.history[s.history.length-1]||{};$("scenarioResult").innerHTML=`<div class="notice success">${escapeHtml(name)}: ${s.era} eras, saldo ${money(P(s).treasury)}, receita acumulada ${money(r.cumRevenue||0)}, ${s.owners.filter(o=>o==="player").length} territórios e poder militar ${fmt(P(s).military,1)}.</div>`}
// Únicas formas de outros módulos substituírem estas variáveis (um módulo não pode reatribuir o que importa).
export function setLastStrategyResult(v){lastStrategyResult=v;return v}
export function setScenarioLoaded(v){scenarioLoaded=v;return v}
