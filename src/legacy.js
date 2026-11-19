// Impérios — laboratórios (versão de desenvolvimento) que ainda estão neste ficheiro, o arranque do jogo e as
// variáveis globais de depuração. O passo 10 da reorganização divide-o em src/labs/*, src/main-player.js e src/main-dev.js.
import * as ns_ai_decide from "./ai/decide.js";
import * as ns_ai_profiles from "./ai/profiles.js";
import * as ns_app_hooks from "./app/hooks.js";
import * as ns_app_save from "./app/save.js";
import * as ns_app_session from "./app/session.js";
import * as ns_app_setup from "./app/setup.js";
import * as ns_core_config from "./core/config.js";
import * as ns_core_economy from "./core/economy.js";
import * as ns_core_endgame from "./core/endgame.js";
import * as ns_core_era from "./core/era.js";
import * as ns_core_format from "./core/format.js";
import * as ns_core_map from "./core/map.js";
import * as ns_core_match from "./core/match.js";
import * as ns_core_military from "./core/military.js";
import * as ns_core_names from "./core/names.js";
import * as ns_core_references from "./core/references.js";
import * as ns_core_rng from "./core/rng.js";
import * as ns_core_state from "./core/state.js";
import * as ns_core_util from "./core/util.js";
import * as ns_labs_ai_checks from "./labs/ai-checks.js";
import * as ns_labs_engine from "./labs/engine.js";
import * as ns_labs_experiment from "./labs/experiment.js";
import * as ns_labs_settings from "./labs/settings.js";
import * as ns_labs_tests_def from "./labs/tests-def.js";
import * as ns_labs_validation from "./labs/validation.js";
import * as ns_legacy from "./legacy.js";
import * as ns_platform_files from "./platform/files.js";
import * as ns_platform_storage from "./platform/storage.js";
import * as ns_ui_allocation from "./ui/allocation.js";
import * as ns_ui_charts from "./ui/charts.js";
import * as ns_ui_dom from "./ui/dom.js";
import * as ns_ui_format from "./ui/format.js";
import * as ns_ui_game from "./ui/game.js";
import * as ns_ui_home from "./ui/home.js";
import * as ns_ui_hud from "./ui/hud.js";
import * as ns_ui_labels from "./ui/labels.js";
import * as ns_ui_map from "./ui/map.js";
import * as ns_ui_modal from "./ui/modal.js";
import * as ns_ui_panels from "./ui/panels.js";
import * as ns_ui_report from "./ui/report.js";
import * as ns_ui_sheets from "./ui/sheets.js";
import * as ns_ui_toast from "./ui/toast.js";
import * as ns_ui_tutorial from "./ui/tutorial.js";
import {exposeGlobals} from "./app/debug.js";
import {AI_PROFILE_NAMES,LAB_PROFILE_NAME,LAB_PROFILES} from "./ai/profiles.js";
import {onHook} from "./app/hooks.js";
import {configApplied,state,gameMode,rememberAiBase,setConfigApplied,setState,newGame,setSelectedTerritory,busy,setBusy,setCancelRequested,cancelRequested,playEra,configDefault,DEV_MODE} from "./app/session.js";
import {VERSION,normalizeConfig,SUPPORTED_VERSIONS,DEFAULTS,MAX_AI} from "./core/config.js";
import {describeResult,END_REASON_NAMES} from "./core/endgame.js";
import {simulate,processEra} from "./core/era.js";
import {runFixedGame,fixedGameSeed} from "./core/match.js";
import {REF_DIMS,calibrateReferences,REF_SETS,validateReferences} from "./core/references.js";
import {addLog,P,newState,A} from "./core/state.js";
import {clone,safeNum,clamp} from "./core/util.js";
import {profileExpectedWeights,pct,runAiControlProbe,aiProbe} from "./labs/ai-checks.js";
import {estimateRows,ROW_WARN,buildJobs,runGameJobs,summarizeRecords,profileStats,mean,median,profileName,consolidateProfiles,OUTCOME_KEYS,RC} from "./labs/engine.js";
import {paramCatalog,expState,SCENARIO_COLORS,getParam,parseParamValue,setExpCancel,scenarioConfig,expCancel,exportExp} from "./labs/experiment.js";
import {PARAM_GROUPS,paramInput,configEdited,setConfigEdited,PARAM_OPTIONS} from "./labs/settings.js";
import {executeTests,testRegistry,ftHistory,TEST_CATS,ftResults,ftLastRun,loadFtHistory} from "./labs/tests-def.js";
import {setValCancel,valState,valCancel,profileDiagnostics,PROFILE_EXPECTATIONS} from "./labs/validation.js";
import {download,csvDownload} from "./platform/files.js";
import {watchShortScreen} from "./ui/allocation.js";
import {svgLine,barChart,legendHtml} from "./ui/charts.js";
import {$,setStatus} from "./ui/dom.js";
import {money,fmt,escapeHtml,cssColor} from "./ui/format.js";
import {renderAll,initGame} from "./ui/game.js";
import {initHome} from "./ui/home.js";
import {renderMetrics} from "./ui/hud.js";
import {initSheets} from "./ui/sheets.js";
import {initTutorial} from "./ui/tutorial.js";
export let compareResults=[];
export let lastStrategyResult=null;
export let scenarioLoaded=null;
export const COMPARE_COLORS=["#f4bd50","#56d6a1","#b49aff","#62a8ff","#ff737b","#e88a43","#72d0df","#d9a4c7"];
export function makeSnapshot(){return {config:clone(configApplied),state:clone(state)}}
// Gera as partidas em lotes (async) para não bloquear a interface; pode ser cancelado
// e preserva as partidas já concluídas.
export async function runFixedDurationBatch(cfg,opts,onProgress=()=>{},shouldCancel=()=>false){
 const {games,eras,mode,profiles,civCount,baseSeed,batchSize=5}=opts,results=[],start=Date.now();
 for(let g=0;g<games;g++){
  if(shouldCancel())break;
  results.push(runFixedGame(cfg,{eras,mode,profiles,civCount,seed:fixedGameSeed(baseSeed,g),game:g}));
  if((g+1)%batchSize===0||g===games-1){onProgress(results.length,games,Date.now()-start);await new Promise(r=>setTimeout(r,0))}
 }
 return results;
}
// Resumo por perfil na última era (média simples de cada lugar ocupado pelo perfil).
export function fixedProfileSummary(games){
 const acc={};for(const g of games){const last=g.timeline.at(-1);if(!last)continue;for(const r of last.civs){const a=acc[r.profile]??={n:0,territories:0,military:0,infrastructure:0,technology:0,treasury:0,revenue:0};a.n++;a.territories+=r.territories;for(const [d] of REF_DIMS)a[d]+=r.dims[d]}}
 return Object.entries(acc).map(([profile,a])=>({profile,n:a.n,territories:a.territories/a.n,...Object.fromEntries(REF_DIMS.map(([d])=>[d,a[d]/a.n]))}));
}
export function exportHistory(){download(`imperios-partida-era${state.era}.json`,JSON.stringify({formatVersion:VERSION,exportedAt:new Date().toISOString(),gameMode,config:configApplied,state},null,2))}
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
 try{while(done<n&&!cancelRequested&&!state.result){const batch=Math.min(configApplied.simulation.blockSize,n-done);for(let i=0;i<batch&&!state.result;i++){playEra({military:0,infrastructure:0,technology:0});done++}$("advanceProgress").style.width=(100*done/n)+"%";setStatus("advanceStatus",`Processadas ${fmt(done,0)} de ${fmt(n,0)} eras · era atual ${state.era} · ${fmt(performance.now()-start,0)} ms`);renderMetrics();await new Promise(r=>setTimeout(r,0))}
 renderAll();setStatus("advanceStatus",cancelRequested?`Cancelado após ${done} eras concluídas. O histórico foi preservado.`:state.result?`Partida encerrada após ${done} eras: ${describeResult(state,state.result)}`:`Concluído: ${done} eras processadas. Era atual: ${state.era}.`,"success");
 }catch(e){renderAll();setStatus("advanceStatus","Simulação interrompida: "+e.message,"error")}finally{setBusy(false);$("cancelAdvance").disabled=true;$("advance").disabled=false}
}
export async function compareStrategies(){
 const selected=[...document.querySelectorAll('#compareChecks input:checked')].map(x=>x.value);if(selected.length<2){setStatus("compareStatus","Selecione pelo menos duas estratégias.","error");return}
 const eras=safeNum($("compareEras").value,1,1e6);if(!Number.isSafeInteger(eras))throw Error("Quantidade de eras deve ser inteira.");
 let custom=[34,33,33];const raw=$("compareCustom").value.split(/[\/;, ]+/).filter(Boolean).map(Number);if(raw.length===3&&raw.every(v=>Number.isFinite(v)&&v>=0))custom=raw;
 compareResults=[];$("compareTable").innerHTML="";setStatus("compareStatus","Executando simulações independentes com expansão territorial ativa...");await new Promise(r=>setTimeout(r,0));
 for(let i=0;i<selected.length;i++){
  const strategy=selected[i],cfg=clone(configApplied);cfg.military.aiEnabled=$("compareAI").checked;cfg.military.aiTarget=$("compareTarget").value;
  const s=simulate(strategy,eras,cfg,null,custom,null,gameMode),last=s.history[s.history.length-1]||{},a=s.attacks||{};
  const rec={strategy,state:s,summary:{lastRevenue:last.total||0,cumRevenue:last.cumRevenue||0,budget:P(s).treasury,military:P(s).military,territories:s.owners.filter(o=>o==="player").length,maxTerritories:P(s).maxTerritories||1,territoryYears:P(s).territoryYears||0,militaryEfficiency:((a.playerWins||0)+(a.playerLosses||0))?100*(a.playerWins||0)/((a.playerWins||0)+(a.playerLosses||0)):0,neutralConquests:a.neutralConquests||0,enemyConquests:a.enemyConquests||0,attackWins:a.playerWins||0,attackLosses:a.playerLosses||0,aiWins:a.aiWins||0,invested:P(s).invested,infra:P(s).infraTotal,tech:s.history.reduce((z,r)=>z+r.tech,0),milEfficiency:(a.neutralConquests||0)+(a.enemyConquests||0),firstInfra:s.investments.find(x=>x.owner==="player"&&x.type==="infrastructure")?.origin+cfg.infrastructure.delay||"—",firstTech:s.investments.find(x=>x.owner==="player"&&x.type==="technology")?.origin+cfg.technology.delay||"—"} };
  compareResults.push(rec);const q=rec.summary;
  $("compareTable").innerHTML+=`<tr><td><strong>${strategyName(strategy)}</strong></td><td>${money(q.lastRevenue)}</td><td>${money(q.cumRevenue)}</td><td>${money(q.budget)}</td><td>${fmt(q.military,1)}</td><td>${q.territories}</td><td>${q.maxTerritories}</td><td>${q.territoryYears}</td><td>${fmt(q.militaryEfficiency,1)}%</td><td>${q.neutralConquests}</td><td>${q.enemyConquests}</td><td>${q.attackWins}</td><td>${q.attackLosses}</td><td>${money(q.invested.military)}</td><td>${money(q.invested.infrastructure)}</td><td>${money(q.invested.technology)}</td><td>${money(q.infra)}</td><td>${money(q.tech)}</td><td>${q.firstInfra}</td><td>${q.firstTech}</td></tr>`;
  setStatus("compareStatus",`Concluídas ${i+1}/${selected.length}: ${strategyName(strategy)}.`);await new Promise(r=>setTimeout(r,0));
 }
 const draw=(canvas,key,acc=false)=>svgLine($(canvas),compareResults.map((r,i)=>({color:COMPARE_COLORS[i%COMPARE_COLORS.length],data:r.state.history.map(h=>({x:h.era,y:acc?h.cumRevenue:key==="budget"?h.budget:key==="territories"?h.territories:key==="military"?h.military:h.total}))})));
 draw("compareRevenue","revenue");draw("compareAccum","revenue",true);draw("compareTerritory","territories");draw("compareBalance","budget");svgLine($("compareAttacks"),compareResults.map((r,i)=>({color:COMPARE_COLORS[i%COMPARE_COLORS.length],data:r.state.history.map(h=>({x:h.era,y:(h.attacksTotal?.playerWins||0)}))})));
 $("compareLegend").innerHTML=compareResults.map((r,i)=>`<span style="--c:${COMPARE_COLORS[i%COMPARE_COLORS.length]}">${strategyName(r.strategy)}</span>`).join("");
 setStatus("compareStatus",`${compareResults.length} estratégias comparadas em ${eras} eras. Métricas territoriais incluem máximo de territórios, conquistas neutras/inimigas e ataques ganhos/perdidos. IA ${$("compareAI").checked?"ativada":"desativada"}. Partida principal preservada.`,"success");
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
export let aiValidationResults=[];
export let balanceLabResults=[];
export async function runAiValidation(){
 if(busy)return;const profiles=[...document.querySelectorAll('#aiValidationProfiles input:checked')].map(x=>x.value);if(!profiles.length)throw Error("Selecione ao menos um perfil.");
 const runs=safeNum($("aiValidationRuns").value,3,100),eras=safeNum($("aiValidationEras").value,5,100);if(!Number.isInteger(runs)||!Number.isInteger(eras))throw Error("Sementes e eras devem ser números inteiros.");
 setBusy(true);$("runAiValidation").disabled=true;aiValidationResults=[];$("aiValidationTable").innerHTML="";$("aiValidationDetails").innerHTML="";$("aiValidationProgress").style.width="0%";
 const total=profiles.length,details=[];
 try{
  for(let pi=0;pi<profiles.length;pi++){
   const profile=profiles[pi],cfg=clone(configApplied);cfg.military.aiStyle=profile;cfg.military.aiEnabled=true;cfg.military.aiAggression=55;cfg.military.aiReserve=0;
   let financePass=0,financeTotal=0,attackControlPass=0,attackControlTotal=0,investShares=[0,0,0],investCount=0,completed=0,invalid=0;
   for(let k=0;k<runs;k++){
    const c=clone(cfg);c.simulation.seed=(Number(configApplied.simulation.seed)+k*7919+pi*104729)>>>0;const s=newState(c,{mode:gameMode});
    try{for(let e=0;e<eras;e++){const treasuryBefore=A(s).treasury;processEra(s,c,{playerAllocation:e===0?{military:0,infrastructure:0,technology:0}:undefined});const row=s.history.at(-1);financeTotal++;const available=treasuryBefore+(row.aiRevenue?.total||0);if(Number.isFinite(A(s).treasury)&&A(s).treasury>=-1e-8&&Number.isFinite(row.aiBudgetInvested)&&row.aiBudgetInvested<=available+1e-6&&Math.abs(A(s).treasury-(available-row.aiBudgetInvested))<1e-5)financePass++;const inv=row.aiInvestment||{},sum=inv.military+inv.infrastructure+inv.technology;if(sum>0){investShares[0]+=inv.military/sum;investShares[1]+=inv.infrastructure/sum;investShares[2]+=inv.technology/sum;investCount++}}completed++;}catch(e){invalid++;details.push(`${AI_PROFILE_NAMES[profile]} · semente ${c.simulation.seed}: ${e.message}`)}
    const noAttack=runAiControlProbe(profile,0,c.simulation.seed+17),mustAttack=runAiControlProbe(profile,100,c.simulation.seed+31);attackControlTotal+=2;if(noAttack.attacks===0&&mustAttack.attacks>0&&mustAttack.valid)attackControlPass+=2;
   }
   const actual=investShares.map(v=>investCount?v/investCount:0),expected=profileExpectedWeights(profile,cfg);let profileScore=null;
   if(expected){const es=expected.reduce((a,b)=>a+Math.max(0,b),0)||1,dist=actual.reduce((a,v,i)=>a+Math.abs(v-Math.max(0,expected[i])/es),0)/2;profileScore=clamp(100*(1-dist),0,100)}
   let adaptation=null;if(profile==="adaptive"){const safe=aiProbe(profile,false,cfg.simulation.seed+777),threat=aiProbe(profile,true,cfg.simulation.seed+777);adaptation=clamp(50+(threat.military-safe.military)*100,0,100);details.push(`${AI_PROFILE_NAMES[profile]}: parcela militar em segurança ${fmt(safe.military*100,1)}% → sob ameaça ${fmt(threat.military*100,1)}%.`);if(threat.military<=safe.military+0.02)details.push(`${AI_PROFILE_NAMES[profile]}: a participação militar não aumentou claramente sob ameaça.`)}
   const finance=pct(financePass,financeTotal),attack=pct(attackControlPass,attackControlTotal);let weighted=finance*.35+attack*.15,weightTotal=50;if(profileScore!==null){weighted+=profileScore*.35;weightTotal+=35}if(adaptation!==null){weighted+=adaptation*.15;weightTotal+=15}const overall=weighted*100/weightTotal;
   const rec={profile,name:AI_PROFILE_NAMES[profile],finance,profileScore,adaptation,attack,overall,completed,invalid,shares:actual};aiValidationResults.push(rec);
   $("aiValidationTable").innerHTML+=`<tr><td><strong>${rec.name}</strong></td><td>${fmt(finance,1)}%</td><td>${profileScore===null?'N/A':fmt(profileScore,1)+'%'}</td><td>${adaptation===null?'N/A':fmt(adaptation,1)+'%'}</td><td>${fmt(attack,1)}%</td><td><strong>${fmt(overall,1)}%</strong></td></tr>`;
   $("aiValidationProgress").style.width=(100*(pi+1)/total)+"%";setStatus("aiValidationStatus",`Validando ${rec.name}: ${pi+1}/${total} perfis · ${completed}/${runs} execuções completas.`);await new Promise(r=>setTimeout(r,0));
  }
  const avg=aiValidationResults.reduce((a,r)=>a+r.overall,0)/aiValidationResults.length;
  $("aiValidationSummary").innerHTML=`<div class="notice ${avg>=80?'success':'notice'}"><strong>Conformidade média: ${fmt(avg,1)}%</strong> · ${aiValidationResults.reduce((a,r)=>a+r.completed,0)} execuções completas · ${aiValidationResults.reduce((a,r)=>a+r.invalid,0)} execuções com erro. Esta nota resume apenas os benchmarks implementados.</div>`;
  $("aiValidationDetails").innerHTML=details.length?`<div class="notice">${details.map(x=>`<div>${x}</div>`).join("")}</div>`:'<div class="notice success">Nenhuma anomalia adicional detectada pelos benchmarks executados.</div>';
  setStatus("aiValidationStatus","Validação concluída. Examine as dimensões individualmente; uma média alta não substitui revisão de decisões reais.","success");
 }finally{setBusy(false);$("runAiValidation").disabled=false}
}
export function exportAiValidation(){if(!aiValidationResults.length){setStatus("aiValidationStatus","Execute a validação antes de exportar.","error");return}const rows=[["profile","finance_pct","profile_alignment_pct","adaptation_pct","attack_control_pct","overall_pct","completed","invalid","military_share","infrastructure_share","technology_share"],...aiValidationResults.map(r=>[r.profile,r.finance,r.profileScore??"",r.adaptation??"",r.attack,r.overall,r.completed,r.invalid,...r.shares])];download("imperios-validacao-ias.csv",rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(";")).join("\n"),"text/csv;charset=utf-8")}
export function sideMetrics(s){const last=s.history.at(-1)||{},aiRevenue=s.history.reduce((a,r)=>a+(r.aiRevenue?.total||0),0),playerRevenue=s.history.reduce((a,r)=>a+(r.total||0),0);return {pTerr:s.owners.filter(o=>o==="player").length,aTerr:s.owners.filter(o=>o==="ai").length,pBudget:P(s).treasury,aBudget:A(s).treasury,pMil:P(s).military,aMil:A(s).military,pRevenue:playerRevenue,aRevenue:aiRevenue,pInvest:s.investments.filter(i=>i.owner==="player").reduce((a,i)=>a+i.amount,0),aInvest:s.investments.filter(i=>i.owner==="ai").reduce((a,i)=>a+i.amount,0),eras:s.era,valid:Number.isFinite(P(s).treasury)&&Number.isFinite(A(s).treasury)&&P(s).treasury>=-1e-8&&A(s).treasury>=-1e-8}}
export function share(a,b){return a+b>0?a/(a+b):.5}
export function matchupIndex(m){return 100*(share(m.pTerr,m.aTerr)+share(m.pBudget,m.aBudget)+share(m.pMil,m.aMil)+share(m.pRevenue,m.aRevenue))/4}
export async function runBalanceLab(){
 if(busy)return;const strategies=[...document.querySelectorAll('#balanceStrategies input:checked')].map(x=>x.value),profiles=[...document.querySelectorAll('#balanceProfiles input:checked')].map(x=>x.value);if(!strategies.length||!profiles.length)throw Error("Selecione ao menos uma estratégia e um perfil adversário.");
 const seeds=safeNum($("balanceSeeds").value,3,100),eras=safeNum($("balanceEras").value,5,300);if(!Number.isInteger(seeds)||!Number.isInteger(eras))throw Error("Sementes e eras devem ser inteiros.");
 const total=strategies.length*profiles.length*seeds;let done=0;setBusy(true);$("runBalanceLab").disabled=true;balanceLabResults=[];$("balanceTable").innerHTML="";$("balanceProgress").style.width="0%";
 try{
  for(const strategy of strategies)for(const profile of profiles){let aggregate={pTerr:0,aTerr:0,pBudget:0,aBudget:0,pMil:0,aMil:0,pRevenue:0,aRevenue:0,pInvest:0,aInvest:0},valid=0;
   for(let k=0;k<seeds;k++){
    const cfg=clone(configApplied);cfg.military.aiEnabled=true;cfg.military.aiStyle=profile;cfg.simulation.seed=(Number(configApplied.simulation.seed)+k*104729)>>>0;
    const s=simulate(strategy,eras,cfg,null,undefined,null,gameMode);const m=sideMetrics(s);if(m.valid){valid++;for(const key of Object.keys(aggregate))aggregate[key]+=m[key]}
    done++;$("balanceProgress").style.width=(100*done/total)+"%";
    if(done%4===0){setStatus("balanceStatus",`Executando confrontos: ${done}/${total} partidas · ${strategyName(strategy)} contra ${AI_PROFILE_NAMES[profile]}.`);await new Promise(r=>setTimeout(r,0))}
   }
   const avg={};for(const key of Object.keys(aggregate))avg[key]=valid?aggregate[key]/valid:0;const advantage=matchupIndex(avg);const rec={strategy,profile,name:AI_PROFILE_NAMES[profile],valid,total:seeds,advantage,...avg};balanceLabResults.push(rec);
   $("balanceTable").innerHTML+=`<tr><td><strong>${strategyName(strategy)}</strong></td><td>${rec.name}</td><td><strong>${fmt(advantage,1)}%</strong></td><td>${fmt(avg.pTerr,1)} / ${fmt(avg.aTerr,1)}</td><td>${money(avg.pBudget)} / ${money(avg.aBudget)}</td><td>${fmt(avg.pMil,1)} / ${fmt(avg.aMil,1)}</td><td>${money(avg.pRevenue)} / ${money(avg.aRevenue)}</td><td>${money(avg.pInvest)} / ${money(avg.aInvest)}</td><td>${valid}/${seeds}</td></tr>`;
  }
  const avgAdv=balanceLabResults.reduce((a,r)=>a+r.advantage,0)/balanceLabResults.length,invalid=balanceLabResults.reduce((a,r)=>a+r.total-r.valid,0);
  $("balanceSummary").innerHTML=`<div class="notice ${invalid===0?'success':'error'}"><strong>Índice médio de vantagem do jogador: ${fmt(avgAdv,1)}%</strong> · ${done} partidas executadas · ${invalid} partidas inválidas. 50% representa paridade nas quatro dimensões avaliadas.</div>`;
  setStatus("balanceStatus","Torneio concluído. Compare os confrontos e métricas individuais; o índice não representa taxa de vitória.","success");
 }finally{setBusy(false);$("runBalanceLab").disabled=false}
}
export function exportBalanceLab(){if(!balanceLabResults.length){setStatus("balanceStatus","Execute o torneio antes de exportar.","error");return}const rows=[["strategy","ai_profile","player_advantage_index","player_territories_avg","ai_territories_avg","player_treasury_avg","ai_treasury_avg","player_military_avg","ai_military_avg","player_cumulative_revenue_avg","ai_cumulative_revenue_avg","player_investment_avg","ai_investment_avg","valid_matches","requested_matches"],...balanceLabResults.map(r=>[r.strategy,r.profile,r.advantage,r.pTerr,r.aTerr,r.pBudget,r.aBudget,r.pMil,r.aMil,r.pRevenue,r.aRevenue,r.pInvest,r.aInvest,r.valid,r.total])];download("imperios-laboratorio-balanceamento.csv",rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(";")).join("\n"),"text/csv;charset=utf-8")}
/* ── Interface: duração fixa e referências ── */
export let fixedRun={games:[],calibration:null,opts:null},fixedCancel=false;
export function readFixedOpts(){
 const games=safeNum($("fixedGames").value,1,2000),eras=safeNum($("fixedEras").value,1,300),civCount=safeNum($("fixedCivs").value,2,1+MAX_AI),baseSeed=safeNum($("fixedSeed").value,0,4294967295);
 if(![games,eras,civCount,baseSeed].every(Number.isInteger))throw Error("Partidas, eras, civilizações e semente devem ser inteiros.");
 const profiles=[...document.querySelectorAll("#fixedProfiles input:checked")].map(x=>x.value);if(!profiles.length)throw Error("Selecione pelo menos um perfil.");
 if(civCount>configApplied.map.territories)throw Error("Mais civilizações do que territórios.");
 return {games,eras,civCount,baseSeed,profiles,mode:$("fixedMode").value==="fast"?"fast":"slow"};
}
export async function runFixedLab(){
 if(busy)return;const opts=readFixedOpts();setBusy(true);fixedCancel=false;fixedRun={games:[],calibration:null,opts};
 $("runFixed").disabled=true;$("cancelFixed").disabled=false;$("applyCalibration").disabled=true;$("fixedSummary").innerHTML="";$("fixedProgress").style.width="0%";
 try{
  const cfg=clone(configApplied);
  fixedRun.games=await runFixedDurationBatch(cfg,opts,(done,total,ms)=>{$("fixedProgress").style.width=(100*done/total)+"%";setStatus("fixedStatus",`A executar · ${done} de ${total} partidas (${fmt(100*done/total,0)}%) · ${fmt(ms/1000,1)} s`)},()=>fixedCancel);
  if(!fixedRun.games.length){setStatus("fixedStatus","Cancelado antes de concluir qualquer partida.","error");return}
  fixedRun.calibration=calibrateReferences(fixedRun.games,{seedBase:opts.baseSeed,mode:opts.mode,profiles:opts.profiles,civCount:opts.civCount,requestedGames:opts.games,date:new Date().toISOString()});
  renderFixedResults();$("applyCalibration").disabled=false;
  setStatus("fixedStatus",fixedCancel?`Cancelado: ${fixedRun.games.length} de ${opts.games} partidas concluídas e preservadas. A calibração usa apenas as concluídas.`:`Concluído: ${fixedRun.games.length} partidas × ${opts.eras} eras. Reveja as referências e clique em Aplicar.`,"success");
 }finally{setBusy(false);$("runFixed").disabled=false;$("cancelFixed").disabled=true}
}
export function renderFixedResults(){
 const cal=fixedRun.calibration;if(!cal)return;
 const warn=REF_DIMS.map(([d,name])=>{const n=cal.fallback[d].filter(Boolean).length,z=cal.stats[d].reduce((a,s)=>a+s.zeroShare,0)/cal.eras;return n||z>.25?`<div><strong>${name}</strong>: ${fmt(100*z,0)}% das observações são zero${n?`; mediana zero em ${n} de ${cal.eras} eras → referência de recurso (${d==="treasury"?"receita de referência da era":"média ou 1"})`:""}.</div>`:""}).join("");
 const prof=fixedProfileSummary(fixedRun.games);
 $("fixedSummary").innerHTML=`<div class="notice success"><strong>${cal.meta.games} partidas</strong> · ${cal.eras} eras · ${cal.meta.civCount} civilizações · modo ${cal.meta.mode==="fast"?"rápido":"lento"} · perfis: ${cal.meta.profiles.map(p=>LAB_PROFILE_NAME[p]).join(", ")}.</div>${warn?`<div class="notice">${warn}</div>`:""}
 <h3>Situação na última era, por perfil</h3><div class="tablewrap"><table><thead><tr><th>Perfil</th><th>Lugares</th><th>Territórios</th>${REF_DIMS.map(([,n])=>`<th>${n}</th>`).join("")}</tr></thead><tbody>${prof.map(r=>`<tr><td><strong>${LAB_PROFILE_NAME[r.profile]||r.profile}</strong></td><td>${r.n}</td><td>${fmt(r.territories,1)}</td>${REF_DIMS.map(([d])=>`<td>${fmt(r[d],1)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
 renderRefEditor();
}
export function currentRefTable(){return configApplied.references?.[$("refSet").value]||null}
export function renderRefEditor(){
 const set=$("refSet").value,t=currentRefTable(),cal=fixedRun.calibration;
 $("refHead").innerHTML=`<th>Era</th>${REF_DIMS.map(([,n,u])=>`<th>${n}<div class="small muted">${u}</div></th>`).join("")}${cal&&!t?"":""}`;
 if(!t){$("refTable").innerHTML=cal?cal.values.military.map((_,e)=>`<tr><td>${e+1}</td>${REF_DIMS.map(([d])=>`<td class="${cal.fallback[d][e]?"gold":""}" title="p25 ${fmt(cal.stats[d][e].p25,2)} · p75 ${fmt(cal.stats[d][e].p75,2)}">${fmt(cal.values[d][e],2)}${cal.fallback[d][e]?" *":""}</td>`).join("")}</tr>`).join(""):"";
  setStatus("refStatus",cal?"Pré-visualização da calibração (ainda não aplicada). * = mediana zero, valor de recurso.":"Ainda não há referências definidas. Execute as simulações e aplique a calibração, ou importe um JSON.");return}
 $("refTable").innerHTML=t.values.military.map((_,e)=>`<tr><td>${e+1}</td>${REF_DIMS.map(([d])=>`<td><input type="number" min="0" step="any" style="width:110px" data-ref="${d}.${e}" value="${+t.values[d][e].toFixed(4)}" class="${t.fallback?.[d]?.[e]?"gold":""}" title="${t.stats?`p25 ${fmt(t.stats[d][e].p25,2)} · p75 ${fmt(t.stats[d][e].p75,2)}`:""}"></td>`).join("")}</tr>`).join("");
 document.querySelectorAll("[data-ref]").forEach(el=>el.addEventListener("change",()=>{const [d,e]=el.dataset.ref.split("."),v=Number(el.value);if(!(Number.isFinite(v)&&v>0)){el.value=+t.values[d][e].toFixed(4);setStatus("refStatus","A referência tem de ser um número maior que zero.","error");return}t.values[d][+e]=v;t.edited=true;if(t.fallback?.[d])t.fallback[d][+e]=false;el.classList.remove("gold");configEdited.references=clone(configApplied.references);setStatus("refStatus",`Referência ${REF_SETS.find(x=>x[0]===set)[1]} · ${REF_DIMS.find(x=>x[0]===d)[1]} · era ${+e+1} ajustada manualmente.`,"success")}));
 setStatus("refStatus",`${REF_SETS.find(x=>x[0]===set)[1]}: ${t.eras} eras calibradas${t.meta?.games?` a partir de ${t.meta.games} partidas`:""}${t.edited?" · com ajustes manuais":""}. Depois da última era usa-se o último valor. Valores a dourado vieram de recurso (mediana zero).`);
}
export function applyCalibration(){
 const cal=fixedRun.calibration;if(!cal)throw Error("Execute as simulações primeiro.");
 configApplied.references={ice:clone(cal),score:clone(cal)};setConfigApplied(normalizeConfig(configApplied));configEdited.references=clone(configApplied.references);
 renderRefEditor();setStatus("refStatus","Calibração aplicada aos dois conjuntos (ICE e pontuação final). Ajuste cada conjunto separadamente, se necessário.","success");
}
export function exportFixedCsv(){
 if(!fixedRun.games.length){setStatus("fixedStatus","Execute as simulações antes de exportar.","error");return}
 const rows=[["game","seed","mode","era","seat","civ_id","profile","territories",...REF_DIMS.map(([d])=>d)]];
 for(const g of fixedRun.games)for(const e of g.timeline)e.civs.forEach((r,k)=>rows.push([g.game,g.seed,g.mode,e.era,k,r.id,r.profile,r.territories,...REF_DIMS.map(([d])=>r.dims[d])]));
 download("imperios-duracao-fixa.csv",rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(";")).join("\n"),"text/csv;charset=utf-8");
}
export function exportRefs(){if(!configApplied.references){setStatus("refStatus","Não há referências para exportar.","error");return}download("imperios-referencias.json",JSON.stringify({formatVersion:VERSION,references:configApplied.references},null,2))}
export function importRefs(file){const reader=new FileReader();reader.onload=()=>{try{const obj=JSON.parse(reader.result),refs=validateReferences(obj.references||obj);if(!refs)throw Error("Ficheiro sem referências.");configApplied.references={...(configApplied.references||{}),...refs};configEdited.references=clone(configApplied.references);renderRefEditor();setStatus("refStatus","Referências importadas e validadas.","success")}catch(e){setStatus("refStatus","Importação recusada: "+e.message,"error")}};reader.readAsText(file)}
export function setupFixedLab(){
 $("fixedProfiles").innerHTML=LAB_PROFILES.map(([v,n])=>`<label><input type="checkbox" value="${v}" checked> ${n}</label>`).join("");
 $("fixedCivs").value=1+configApplied.map.aiCount;$("fixedSeed").value=configApplied.simulation.seed;
 $("runFixed").onclick=()=>runFixedLab().catch(e=>{setBusy(false);setStatus("fixedStatus",e.message,"error")});
 $("cancelFixed").onclick=()=>{fixedCancel=true;setStatus("fixedStatus","Cancelamento pedido; a concluir a partida em curso...")};
 $("applyCalibration").onclick=()=>{try{applyCalibration()}catch(e){setStatus("refStatus",e.message,"error")}};
 $("exportFixedCsv").onclick=exportFixedCsv;$("exportRefs").onclick=exportRefs;
 $("importRefsBtn").onclick=()=>$("refsFile").click();$("refsFile").onchange=e=>{if(e.target.files[0])importRefs(e.target.files[0]);e.target.value=""};
 $("refSet").onchange=renderRefEditor;renderRefEditor();
}
export function readSimOpts(prefix){
 const num=(id,min,max)=>{const v=safeNum($(prefix+id).value,min,max);if(!Number.isInteger(v))throw Error("Use números inteiros nas configurações da simulação.");return v};
 const profiles=[...document.querySelectorAll(`#${prefix}Profiles input:checked`)].map(x=>x.value);if(!profiles.length)throw Error("Selecione pelo menos um perfil.");
 return {kind:$(prefix+"Kind").value==="fixed"?"fixed":"auto",games:num("Games",1,5000),eras:num("Eras",1,300),civCount:num("Civs",2,1+MAX_AI),baseSeed:num("Seed",0,4294967295),mode:["fast","both"].includes($(prefix+"Mode").value)?$(prefix+"Mode").value:"slow",profiles};
}
export function profileChecks(containerId){$(containerId).innerHTML=LAB_PROFILES.map(([v,n])=>`<label><input type="checkbox" value="${v}" checked> ${n}</label>`).join("")}
// Corre os testes e, se a aba "Testes funcionais" estiver ligada (versão de desenvolvimento), mostra o resultado.
export let ftLabReady=false;
export function runFtTests(filter,label){const r=executeTests(filter,label);if(ftLabReady){$("ftRepeat").disabled=false;renderFtLab()}return r}
export function runTests(){return runFtTests(()=>true,"Todos os testes")}
export function renderFtLab(){
 const reg=testRegistry(),q=($("ftFilter")?.value||"").trim().toLowerCase(),onlyFail=$("ftOnlyFail")?.checked;
 const ran=reg.filter(t=>ftResults.has(t.id)),pass=ran.filter(t=>ftResults.get(t.id).ok).length,last=ftHistory[0];
 const perCat=TEST_CATS.map(([c,n])=>{const ts=reg.filter(t=>t.cat===c),r=ts.filter(t=>ftResults.has(t.id)),p=r.filter(t=>ftResults.get(t.id).ok).length;return {c,n,total:ts.length,ran:r.length,pass:p}});
 if(ran.length){const allOk=pass===ran.length;$("testSummary").className="notice "+(allOk?"success":"error");
  $("testSummary").innerHTML=`<strong>${pass}/${ran.length} testes aprovados.</strong> ${allOk?"Núcleo validado pelos testes incluídos.":"Revise as falhas listadas abaixo."} · Aprovação ${fmt(100*pass/ran.length,1)}% · ${reg.length-ran.length?`${reg.length-ran.length} por executar · `:""}${last?`última execução: ${last.label}, ${fmt(last.ms,0)} ms`:""}<pre class="small" style="margin:8px 0 0;white-space:pre-wrap;color:inherit">LABORATÓRIO DE TESTES FUNCIONAIS\nTotal de testes: ${ran.length}  Aprovados: ${pass}  Reprovados: ${ran.length-pass}\n${perCat.filter(x=>x.ran).map(x=>`${x.n.toUpperCase()}: ${x.pass}/${x.ran}`).join("\n")}\nEstado: ${allOk?"SEM FALHAS":"FALHAS DETETADAS"}</pre>`}
 $("ftCategories").innerHTML=perCat.map(x=>`<div class="card metric"><div class="label">${x.c} · ${x.n}</div><div class="value ${!x.ran?"":x.pass===x.ran?"green":"red"}" style="font-size:20px">${x.ran?`${x.pass}/${x.ran}`:`— /${x.total}`}</div><div class="foot"><button class="small" data-ft-cat="${x.c}" style="padding:4px 8px">Executar categoria</button></div></div>`).join("");
 const rows=reg.filter(t=>{const r=ftResults.get(t.id);if(onlyFail&&!(r&&!r.ok))return false;return !q||t.name.toLowerCase().includes(q)||t.id.toLowerCase().includes(q)});
 $("testResults").innerHTML=TEST_CATS.map(([c,n])=>{const ts=rows.filter(t=>t.cat===c);if(!ts.length)return "";return `<h3>${n}</h3>`+ts.map(t=>{const r=ftResults.get(t.id);return `<div class="test"><div style="min-width:0"><strong>${t.name}</strong> <span class="pill">${t.id}</span><div class="small muted">${r?(r.ok?r.msg:`<span class="red">Falha:</span> ${r.msg}`):"Ainda não executado."}${r?` · ${fmt(r.ms,1)} ms`:""}</div></div><div class="row" style="flex-wrap:nowrap"><span class="${r?(r.ok?"pass":"fail"):"muted"}">${r?(r.ok?"APROVADO":"REPROVADO"):"—"}</span><button class="small" data-ft-run="${t.id}" style="padding:4px 8px">${r?"Repetir":"Executar"}</button></div></div>`}).join("")}).join("")||'<div class="small muted">Nenhum teste corresponde ao filtro.</div>';
 $("ftHistory").innerHTML=ftHistory.length?`<div class="tablewrap"><table><thead><tr><th>Quando</th><th>Execução</th><th>Aprovados</th><th>Reprovados</th><th>Tempo</th><th>Falhas</th></tr></thead><tbody>${ftHistory.map(h=>`<tr><td>${new Date(h.at).toLocaleString("pt-BR")}</td><td>${h.label}</td><td>${h.pass}/${h.total}</td><td class="${h.fail?"red":""}">${h.fail}</td><td>${fmt(h.ms,0)} ms</td><td>${h.failed.join(", ")||"—"}</td></tr>`).join("")}</tbody></table></div>`:"Sem execuções registadas.";
 document.querySelectorAll("[data-ft-run]").forEach(b=>b.onclick=()=>{const id=b.dataset.ftRun;runFtTests(t=>t.id===id,"Teste "+id)});
 document.querySelectorAll("[data-ft-cat]").forEach(b=>b.onclick=()=>{const c=b.dataset.ftCat;runFtTests(t=>t.cat===c,"Categoria "+c)});
}
export function exportFtReport(){const reg=testRegistry();csvDownload("imperios-testes-funcionais.csv",[["id","category","name","status","ms","message"],...reg.map(t=>{const r=ftResults.get(t.id);return [t.id,t.cat,t.name,r?(r.ok?"pass":"fail"):"not_run",r?r.ms.toFixed(2):"",r?.msg||""]})])}
export function setupFtLab(){
 $("ftCategory").innerHTML=TEST_CATS.map(([c,n])=>`<option value="${c}">${c} · ${n}</option>`).join("");
 $("runCategory").onclick=()=>{const c=$("ftCategory").value;runFtTests(t=>t.cat===c,"Categoria "+c)};
 $("ftRepeat").onclick=()=>{if(ftLastRun)runFtTests(ftLastRun.filter,ftLastRun.label+" (repetição)")};
 $("ftFilter").oninput=renderFtLab;$("ftOnlyFail").onchange=renderFtLab;$("ftExport").onclick=exportFtReport;
 ftLabReady=true;if(ftLastRun)$("ftRepeat").disabled=false;renderFtLab();
}
export function renderExpTable(){
 const cat=paramCatalog(),defs=expState.params.map(id=>cat.find(c=>c.id===id)).filter(Boolean);
 $("expHead").innerHTML=`<th>Cenário</th>${defs.map(d=>`<th>${d.label}<button class="small" data-exp-delparam="${d.id}" title="Remover coluna" style="padding:1px 6px;margin-left:6px">×</button></th>`).join("")}<th></th>`;
 $("expBody").innerHTML=expState.scenarios.map((s,i)=>`<tr><td><span class="dot" style="background:${SCENARIO_COLORS[i%SCENARIO_COLORS.length]}"></span><input data-exp-name="${i}" value="${escapeHtml(s.name)}" style="width:230px"></td>${defs.map(d=>{const v=s.values[d.id]??getParam(configApplied,d.id);return `<td>${d.type==="boolean"?`<input type="checkbox" data-exp-cell="${i}|${d.id}" ${v?"checked":""}>`:d.type==="string"?`<select data-exp-cell="${i}|${d.id}">${(PARAM_OPTIONS[d.key]||[]).map(([o,t])=>`<option value="${o}" ${o===v?"selected":""}>${t}</option>`).join("")}</select>`:`<input type="number" step="any" data-exp-cell="${i}|${d.id}" value="${v}" style="width:100px">`}</td>`}).join("")}<td class="row" style="flex-wrap:nowrap"><button class="small" data-exp-dup="${i}" style="padding:4px 8px">Duplicar</button><button class="small danger" data-exp-del="${i}" style="padding:4px 8px" ${expState.scenarios.length<2?"disabled":""}>Remover</button></td></tr>`).join("");
 document.querySelectorAll("[data-exp-name]").forEach(el=>el.onchange=()=>{expState.scenarios[+el.dataset.expName].name=el.value||"Cenário"});
 document.querySelectorAll("[data-exp-cell]").forEach(el=>el.onchange=()=>{const [i,id]=el.dataset.expCell.split("|"),d=cat.find(c=>c.id===id);try{expState.scenarios[+i].values[id]=parseParamValue(d,el.type==="checkbox"?el.checked:el.value);setStatus("expStatus","Cenário atualizado.")}catch(e){setStatus("expStatus",e.message,"error")}});
 document.querySelectorAll("[data-exp-dup]").forEach(b=>b.onclick=()=>{const s=expState.scenarios[+b.dataset.expDup];expState.scenarios.splice(+b.dataset.expDup+1,0,{name:s.name+" (cópia)",values:clone(s.values)});renderExpTable()});
 document.querySelectorAll("[data-exp-del]").forEach(b=>b.onclick=()=>{expState.scenarios.splice(+b.dataset.expDel,1);renderExpTable()});
 document.querySelectorAll("[data-exp-delparam]").forEach(b=>b.onclick=()=>{const id=b.dataset.expDelparam;expState.params=expState.params.filter(p=>p!==id);expState.scenarios.forEach(s=>delete s.values[id]);renderExpTable()});
}
export function addExpParam(id){if(!expState.params.includes(id)){expState.params.push(id);expState.scenarios.forEach(s=>{if(s.values[id]===undefined)s.values[id]=getParam(configApplied,id)})}renderExpTable()}
export function generateVariations(){
 const id=$("expVaryParam").value,d=paramCatalog().find(c=>c.id===id),raw=$("expVaryValues").value.split(/[;|]+/).map(x=>x.trim()).filter(Boolean);
 if(!raw.length)throw Error("Indique os valores separados por ponto e vírgula.");
 const vals=raw.map(v=>parseParamValue(d,v));if(!expState.params.includes(id))expState.params.push(id);
 const base=expState.scenarios[0]?.values||{};
 expState.scenarios=vals.map(v=>({name:`${d.label.split(" · ")[1]} = ${typeof v==="number"?fmt(v,3):v}`,values:{...clone(base),[id]:v}}));
 expState.scenarios.forEach(s=>expState.params.forEach(p=>{if(s.values[p]===undefined)s.values[p]=getParam(configApplied,p)}));
 renderExpTable();setStatus("expStatus",`${vals.length} cenários gerados a partir de ${d.label}.`,"success");
}
export async function runExperiment(){
 if(busy)return;const opts=readSimOpts("exp");
 if(!expState.scenarios.length)throw Error("Crie pelo menos um cenário.");
 const modes=opts.mode==="both"?["slow","fast"]:[opts.mode],scen=[];
 expState.scenarios.forEach(s=>{let cfg;try{cfg=scenarioConfig(configApplied,s.values)}catch(e){throw Error(`Cenário "${s.name}": ${e.message}`)}
  for(const m of modes)scen.push({name:modes.length>1?`${s.name} · ${m==="fast"?"rápido":"lento"}`:s.name,values:clone(s.values),cfg,mode:m,color:SCENARIO_COLORS[scen.length%SCENARIO_COLORS.length]})});
 const est=estimateRows(opts,scen.length,scen.map(s=>s.cfg));if(est>ROW_WARN&&!confirm(`Esta experiência vai guardar cerca de ${fmt(est/1e6,1)} milhões de registos (civilização × era) em memória. Continuar?`))return;
 if(opts.civCount>configApplied.map.territories)throw Error("Mais civilizações do que territórios.");
 setBusy(true);setExpCancel(false);$("runExp").disabled=true;$("cancelExp").disabled=false;$("expProgress").style.width="0%";$("expResults").innerHTML="";$("expCharts").classList.add("hidden");
 // Mesmas sementes, perfis e condições em todos os cenários: a partida g de cada cenário usa a
 // semente g e a mesma rotação de perfis. As partidas são intercaladas por rodada para que um
 // cancelamento deixe todos os cenários com o mesmo número de partidas.
 const perScen=scen.map(s=>buildJobs(s.cfg,opts,{scenario:s.name,mode:s.mode})),jobs=[];for(let g=0;g<opts.games;g++)perScen.forEach(js=>jobs.push(js[g]));
 try{
  const recs=await runGameJobs(jobs,(d,t,ms)=>{$("expProgress").style.width=(100*d/t)+"%";setStatus("expStatus",`A executar · ${d} de ${t} partidas (${fmt(100*d/t,0)}%) · ${fmt(ms/1000,1)} s decorridos`)},()=>expCancel,scen.length);
  if(!recs.length){setStatus("expStatus","Cancelado antes de concluir qualquer rodada.","error");return}
  scen.forEach(s=>s.recs=[]);recs.forEach(r=>scen.find(s=>s.name===r.scenario).recs.push(r));
  expState.results={opts,scenarios:scen,at:new Date().toISOString()};
  renderExpResults();
  const per=scen[0].recs.length;setStatus("expStatus",expCancel?`Cancelado: ${per} partidas por cenário concluídas e preservadas (rodadas completas).`:`Concluído: ${scen.length} cenários × ${per} partidas (${opts.kind==="auto"?"encerramento automático":"duração fixa"}${modes.length>1?", lento e rápido":""}).`,"success");refreshValConfigOptions();
 }finally{setBusy(false);$("runExp").disabled=false;$("cancelExp").disabled=true}
}
export function renderExpResults(){
 const R=expState.results;if(!R)return;const fixed=R.opts.kind==="fixed";
 R.scenarios.forEach(s=>{s.sum=summarizeRecords(s.recs);s.prof=profileStats(s.recs)});
 const pc=v=>fmt(v,1)+"%";
 const head=`<tr><th>Cenário</th><th>Partidas</th>${fixed?"<th>Condição atingida</th>":""}<th>Supremacia</th><th>Territorial</th><th>Eliminação</th>${fixed?"":"<th>Pontuação</th>"}<th>Empates</th>${fixed?"<th>Sem condição</th>":""}<th>${fixed?"Era média da 1ª condição":"Era média"}</th><th>Mediana</th><th>Mín–máx</th><th>% territórios do vencedor</th><th>Era em que alguém atinge o mínimo territorial</th><th>Sequências iniciadas / partida</th><th>Interrompidas</th><th>Relação ICE média</th><th>Recursos não usados</th><th></th></tr>`;
 const rows=R.scenarios.map(s=>{const m=s.sum,ratios=m.ratioMean.filter(v=>v!=null);return `<tr><td><span class="dot" style="background:${cssColor(s.color)}"></span><strong>${escapeHtml(s.name)}</strong></td><td>${m.games}</td>${fixed?`<td>${pc(100-m.pct("none"))}</td>`:""}<td>${pc(m.pct("supremacy"))}</td><td>${pc(m.pct("territorial"))}</td><td>${pc(m.pct("elimination"))}</td>${fixed?"":`<td>${pc(m.pct("score"))}</td>`}<td>${pc(m.pct("draw"))}</td>${fixed?`<td>${pc(m.pct("none"))}</td>`:""}<td>${fmt(mean(m.endEras),1)}</td><td>${fmt(median(m.endEras),1)}</td><td>${m.endEras.length?`${Math.min(...m.endEras)}–${Math.max(...m.endEras)}`:"—"}</td><td>${m.winnerTerrShare.length?pc(100*mean(m.winnerTerrShare)):"—"}</td><td>${m.thresholdEra.length?`${fmt(mean(m.thresholdEra),1)} (${pc(100*m.thresholdEra.length/m.games)})`:"nunca"}</td><td>${fmt(m.streaksStarted/m.games,2)}</td><td>${m.streaksStarted?pc(100*m.streaksInterrupted/m.streaksStarted):"—"}</td><td>${ratios.length?fmt(mean(ratios),3):"—"}</td><td>${pc(100*mean(m.unusedShare))}</td><td><button class="small" data-exp-apply="${R.scenarios.indexOf(s)}" style="padding:4px 8px" title="Usar os parâmetros deste cenário no jogo e nos laboratórios">Aplicar à configuração</button></td></tr>`}).join("");
 const mentions=R.scenarios.map(s=>`${escapeHtml(s.name)}: ${Object.entries(s.sum.reasonMentions).filter(([,v])=>v).map(([k,v])=>`${END_REASON_NAMES[k]} ${v}`).join(", ")||"nenhum"}`).join(" · ");
 $("expResults").innerHTML=`<h3>Comparação entre cenários</h3><div class="notice small">${fixed?"<strong>Duração fixa:</strong> as condições não encerram a partida; as colunas mostram a primeira condição de vitória que <em>teria</em> ocorrido.":"Cada partida conta uma vez no seu desfecho (vitórias com vários motivos não são duplicadas)."} Motivos registados, contando todos os motivos dos vencedores: ${mentions}.</div><div class="tablewrap"><table><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
 document.querySelectorAll("[data-exp-apply]").forEach(b=>b.onclick=()=>applyScenarioToConfig(+b.dataset.expApply));
 const opts=R.scenarios.map((s,i)=>`<option value="${i}">${escapeHtml(s.name)}</option>`).join("");$("expResScenario").innerHTML=opts;$("expProfScenario").innerHTML=opts;
 $("expResProfile").innerHTML=`<option value="">Todos os perfis</option>`+R.opts.profiles.map(p=>`<option value="${p}">${profileName(p)}</option>`).join("");
 $("expCharts").classList.remove("hidden");renderExpProfileTable();redrawExpCharts();
}
// Integração: leva os parâmetros de um cenário para a configuração aplicada (jogo e laboratórios).
export function applyScenarioToConfig(i){
 const s=expState.results?.scenarios[i];if(!s)return;
 setConfigApplied(normalizeConfig({...clone(s.cfg),references:configApplied.references}));rememberAiBase(configApplied);setConfigEdited(clone(configApplied));renderParams();renderAll();refreshValConfigOptions();
 setStatus("expStatus",`Parâmetros do cenário "${s.name}" aplicados à configuração. A partida em curso mantém os investimentos já feitos; reinicie-a para jogar só com as novas regras. Recomenda-se executar de novo os testes funcionais.`,"success");
}
export function renderExpProfileTable(){
 const R=expState.results;if(!R)return;const s=R.scenarios[+$("expProfScenario").value||0],st=s.prof,pc=v=>Number.isFinite(v)?fmt(100*v,1)+"%":"—";
 const cons=consolidateProfiles(st,["winRate","drawRate","meanScore","meanWinEra","meanFinalTerr","conquestsPerGame"]);
 const typeTxt=a=>Object.entries(a.types).map(([k,v])=>`${END_REASON_NAMES[k]} ${v}`).join(", ")||"—";
 $("expProfileTable").innerHTML=`<div class="tablewrap"><table><thead><tr><th>Perfil</th><th>Lugares</th><th>Taxa de vitória</th><th>Empates</th><th>Pontuação média</th><th>Era média de vitória</th><th>Tipos de vitória</th><th>Territórios finais</th><th>Conquistas / partida</th><th>Investimento M / I / T</th></tr></thead><tbody>${st.map(a=>`<tr><td><strong>${profileName(a.profile)}</strong></td><td>${a.seats}</td><td>${pc(a.winRate)}</td><td>${pc(a.drawRate)}</td><td>${fmt(100*a.meanScore,1)}</td><td>${fmt(a.meanWinEra,1)}</td><td>${typeTxt(a)}</td><td>${fmt(a.meanFinalTerr,1)}</td><td>${fmt(a.conquestsPerGame,1)}</td><td>${a.shares.map(v=>fmt(100*v,0)+"%").join(" / ")}</td></tr>`).join("")}<tr><td><strong>Consolidado</strong><div class="small muted">média simples entre perfis</div></td><td>—</td><td>${pc(cons.winRate)}</td><td>${pc(cons.drawRate)}</td><td>${fmt(100*cons.meanScore,1)}</td><td>${fmt(cons.meanWinEra,1)}</td><td>—</td><td>${fmt(cons.meanFinalTerr,1)}</td><td>${fmt(cons.conquestsPerGame,1)}</td><td>—</td></tr></tbody></table></div>`;
}
export function redrawExpCharts(){
 const R=expState.results;if(!R||$("expCharts").classList.contains("hidden"))return;
 const sc=R.scenarios,fixed=R.opts.kind==="fixed",keys=OUTCOME_KEYS.filter(([k])=>fixed?k!=="score":k!=="none"||sc.some(s=>s.sum.outcomes.none));
 barChart($("expChartTypes"),sc.map(s=>s.name.includes(" = ")?s.name.split(" = ").pop():s.name),keys.map(([k,n,c])=>({name:n,color:c,values:sc.map(s=>s.sum.pct(k))})),{max:100,unit:"%"});
 $("expLegendTypes").innerHTML=legendHtml(keys.map(([,n,c])=>[n,c]));
 const maxEra=Math.max(1,...sc.map(s=>s.sum.maxEra)),eraAxis=Array.from({length:maxEra},(_,i)=>i+1);
 svgLine($("expChartDuration"),sc.map(s=>({color:s.color,data:eraAxis.map(e=>({x:e,y:s.sum.durationHist[e]||0}))})));
 svgLine($("expChartIce"),sc.map(s=>({color:s.color,data:eraAxis.map(e=>({x:e,y:s.sum.ratioMean[e]??NaN}))})));
 const sl=legendHtml(sc.map(s=>[s.name,s.color]));$("expLegendScen1").innerHTML=sl;$("expLegendScen2").innerHTML=sl;
 const s0=sc[+$("expProfScenario").value||0];
 barChart($("expChartProfiles"),s0.prof.map(a=>profileName(a.profile)),[{name:"Taxa de vitória",color:"#f4bd50",values:s0.prof.map(a=>100*a.winRate)},{name:"Empates",color:"#9fb0c7",values:s0.prof.map(a=>100*a.drawRate)},{name:"Pontuação média",color:"#62a8ff",values:s0.prof.map(a=>100*a.meanScore)}]);
 $("expLegendProfiles").innerHTML=legendHtml([["Taxa de vitória (%)","#f4bd50"],["Empates (%)","#9fb0c7"],["Pontuação média (×100)","#62a8ff"]])+` <span class="muted">· ${escapeHtml(s0.name)}</span>`;
 const sr=sc[+$("expResScenario").value||0],pf=$("expResProfile").value,stats=profileStats(sr.recs).filter(a=>!pf||a.profile===pf);
 const series=[["military","#f4bd50"],["infrastructure","#56d6a1"],["technology","#b49aff"],["treasury","#62a8ff"],["revenue","#ff737b"]].map(([d,c])=>({color:c,data:eraAxis.map((e,i)=>{let sum=0,n=0;for(const a of stats){const b=a.byEra[i];if(b){sum+=b[d];n+=b.n}}return {x:e,y:n?sum/n:NaN}})}));
 svgLine($("expChartRes"),series);
}
export function setupExpLab(){
 profileChecks("expProfiles");$("expCivs").value=1+configApplied.map.aiCount;$("expSeed").value=configApplied.simulation.seed;
 const cat=paramCatalog(),opts=cat.map(c=>`<option value="${c.id}">${c.label}</option>`).join("");$("expParamPick").innerHTML=opts;$("expVaryParam").innerHTML=opts;$("expVaryParam").value="endgame.supremacyRelative";
 expState.scenarios=[{name:"Base",values:Object.fromEntries(expState.params.map(id=>[id,getParam(configApplied,id)]))}];renderExpTable();
 $("expGamesPreset").onchange=()=>{const v=$("expGamesPreset").value;if(v!=="custom")$("expGames").value=v;else $("expGames").focus()};
 $("expGames").oninput=()=>{$("expGamesPreset").value=["20","50","100"].includes($("expGames").value)?$("expGames").value:"custom"};
 $("expAddParam").onclick=()=>addExpParam($("expParamPick").value);
 $("expAddScenario").onclick=()=>{expState.scenarios.push({name:"Cenário "+(expState.scenarios.length+1),values:Object.fromEntries(expState.params.map(id=>[id,getParam(configApplied,id)]))});renderExpTable()};
 $("expVary").onclick=()=>{try{generateVariations()}catch(e){setStatus("expStatus",e.message,"error")}};
 $("runExp").onclick=()=>runExperiment().catch(e=>{setBusy(false);$("runExp").disabled=false;$("cancelExp").disabled=true;setStatus("expStatus",e.message,"error")});
 $("cancelExp").onclick=()=>{setExpCancel(true);setStatus("expStatus","Cancelamento pedido; a concluir a rodada em curso...")};
 $("exportExpSummary").onclick=()=>exportExp("summary");$("exportExpGames").onclick=()=>exportExp("games");$("exportExpEras").onclick=()=>exportExp("eras");
 $("expResScenario").onchange=redrawExpCharts;$("expResProfile").onchange=redrawExpCharts;$("expProfScenario").onchange=()=>{renderExpProfileTable();redrawExpCharts()};
}
export async function runValidation(){
 if(busy)return;const opts=readSimOpts("val");if(opts.civCount>configApplied.map.territories)throw Error("Mais civilizações do que territórios.");
 setBusy(true);setValCancel(false);$("runVal").disabled=true;$("cancelVal").disabled=false;$("valProgress").style.width="0%";$("valResults").innerHTML="";$("valChartBox").classList.add("hidden");
 const src=valConfigSource(),cfg=clone(src.cfg);
 // Um cenário do balanceamento é validado na velocidade em que foi testado.
 if(src.mode){opts.mode=src.mode;$("valMode").value=src.mode}
 if(opts.mode==="both")throw Error("Escolha uma velocidade (lenta ou rápida).");
 const est=estimateRows(opts,1,[cfg]);if(est>ROW_WARN&&!confirm(`Esta validação vai guardar cerca de ${fmt(est/1e6,1)} milhões de registos em memória. Continuar?`)){setBusy(false);$("runVal").disabled=false;$("cancelVal").disabled=true;return}
 const jobs=buildJobs(cfg,opts,{scenario:src.name});
 try{
  const recs=await runGameJobs(jobs,(d,t,ms)=>{$("valProgress").style.width=(100*d/t)+"%";setStatus("valStatus",`A executar · ${d} de ${t} partidas (${fmt(100*d/t,0)}%) · ${fmt(ms/1000,1)} s decorridos`)},()=>valCancel,1);
  if(!recs.length){setStatus("valStatus","Cancelado antes de concluir qualquer partida.","error");return}
  valState.results={opts,recs,stats:profileStats(recs),source:src.name};renderValidation();
  setStatus("valStatus",valCancel?`Cancelado: ${recs.length} partidas concluídas e analisadas.`:`Concluído: ${recs.length} partidas analisadas.`,"success");
 }finally{setBusy(false);$("runVal").disabled=false;$("cancelVal").disabled=true}
}
export function renderValidation(){
 const V=valState.results;if(!V)return;const st=V.stats,pc=v=>Number.isFinite(v)?fmt(100*v,1)+"%":"—",auto=V.opts.kind==="auto";
 const keys=["winRate","drawRate","meanScore","combatsPerGame","successRate","conquestsPerGame","meanFinalTerr","meanFinalIce","revenuePerGame","meanFinalTreasury","infraConversion","eliminatedRate","idleRate"],cons=consolidateProfiles(st,keys);
 const unused=a=>{const recs=V.recs;let u=[];for(const rec of recs)rec.seats.forEach((p,k)=>{if(p!==a.profile)return;for(const row of rec.rows){const c=row.civs[k],av=c[RC.TRE]+c[RC.IM]+c[RC.II]+c[RC.IT];if(c[RC.ACT]&&av>0)u.push(c[RC.TRE]/av)}});return mean(u)};
 const row=a=>`<td>${a.seats??"—"}</td><td>${a.shares?a.shares.map(v=>fmt(100*v,0)+"%").join(" / "):"—"}</td><td>${fmt(a.revenuePerGame,0)}</td><td>${pc(a.unusedShare)}</td><td>${fmt(a.conquestsPerGame,1)}</td><td>${fmt(a.combatsPerGame,1)}</td><td>${pc(a.successRate)}</td><td>${fmt(a.meanFinalTerr,1)}</td><td>${fmt(a.meanFinalIce,3)}</td><td>${fmt(100*a.meanScore,1)}</td>${auto?`<td>${pc(a.winRate)}</td><td>${pc(a.drawRate)}</td>`:""}<td>${pc(a.infraConversion)}</td><td>${pc(a.eliminatedRate)}</td>`;
 st.forEach(a=>a.unusedShare=unused(a));cons.unusedShare=mean(st.map(a=>a.unusedShare));
 const table=`<h3>Indicadores por perfil (valores acumulados por partida)</h3><div class="tablewrap"><table><thead><tr><th>Perfil</th><th>Lugares</th><th>Investimento M / I / T</th><th>Receita acumulada</th><th>Recursos não usados</th><th>Territórios conquistados</th><th>Combates iniciados</th><th>Combates vencidos</th><th>Territórios finais</th><th>ICE final</th><th>Pontuação final</th>${auto?"<th>Taxa de vitória</th><th>Empates</th>":""}<th>Retorno infra / investido</th><th>Eliminado</th></tr></thead><tbody>${st.map(a=>`<tr><td><strong>${profileName(a.profile)}</strong></td>${row(a)}</tr>`).join("")}<tr><td><strong>Consolidado</strong><div class="small muted">média simples entre perfis</div></td>${row({...cons,seats:null,shares:null})}</tr></tbody></table></div>`;
 const ident=`<h3>Identidade estratégica</h3><div class="tablewrap"><table><thead><tr><th>Perfil</th><th>Comportamento esperado</th><th>Observado</th><th>Estado</th></tr></thead><tbody>${st.map(a=>{const ex=PROFILE_EXPECTATIONS[a.profile];if(!ex)return "";const r=ex.check(a,st);return `<tr><td><strong>${profileName(a.profile)}</strong></td><td>${ex.text}</td><td class="small">${r.detail}</td><td class="${r.ok?"pass":"fail"}">${r.ok?"COERENTE":"VERIFICAR"}</td></tr>`}).join("")}</tbody></table></div>`;
 const diags=profileDiagnostics(st,V.opts);
 const diagHtml=`<h3>Diagnóstico automático</h3><div class="notice ${diags.length?"":"success"}">${diags.length?diags.map(([who,msg])=>`<div>⚠ <strong>${who}</strong>: ${msg}</div>`).join(""):"Nenhum comportamento inadequado detetado pelos critérios implementados."}<div class="small muted" style="margin-top:6px">Os alertas são pistas para investigação; o laboratório não altera regras nem perfis.</div></div>`;
 $("valResults").innerHTML=`<div class="notice success small">Configuração: <strong>${escapeHtml(V.source)}</strong> · ${V.recs.length} partidas · ${V.opts.civCount} civilizações · modo ${V.opts.mode==="fast"?"rápido":"lento"} · ${V.opts.kind==="auto"?"encerramento automático":"duração fixa"} · mesmas sementes e rotação de perfis para todos.</div>`+diagHtml+ident+table;
 $("valChartPick").innerHTML=[["military","Militar (pontos)"],["infrastructure","Receita de infraestrutura"],["technology","Progresso tecnológico"],["treasury","Tesouraria"],["revenue","Receita total"],["territories","Territórios"],["ice","ICE"]].map(([v,t])=>`<option value="${v}">${t}</option>`).join("");
 $("valChartBox").classList.remove("hidden");drawValChart();
}
export function drawValChart(){
 const V=valState.results;if(!V)return;const key=$("valChartPick").value,maxE=Math.max(...V.stats.map(a=>a.byEra.length));
 svgLine($("valChart"),V.stats.map((a,i)=>({color:SCENARIO_COLORS[i%SCENARIO_COLORS.length],data:Array.from({length:maxE},(_,e)=>{const b=a.byEra[e];const y=!b?NaN:key==="ice"?(b.iceN?b.ice/b.iceN:NaN):b[key]/b.n;return {x:e+1,y}})})));
 $("valChartLegend").innerHTML=legendHtml(V.stats.map((a,i)=>[profileName(a.profile),SCENARIO_COLORS[i%SCENARIO_COLORS.length]]));
}
export function exportValidation(){
 const V=valState.results;if(!V){setStatus("valStatus","Execute a validação antes de exportar.","error");return}
 const rows=[["profile","seats","share_military","share_infrastructure","share_technology","revenue_per_game","unused_share","conquests_per_game","combats_per_game","combat_success","final_territories","final_ice","final_score","win_rate","draw_rate","infra_return_ratio","eliminated_rate","idle_rate","expectation_ok"]];
 for(const a of V.stats){const ex=PROFILE_EXPECTATIONS[a.profile]?.check(a,V.stats);rows.push([a.profile,a.seats,...a.shares,a.revenuePerGame,a.unusedShare,a.conquestsPerGame,a.combatsPerGame,a.successRate,a.meanFinalTerr,a.meanFinalIce,a.meanScore,a.winRate,a.drawRate,a.infraConversion,a.eliminatedRate,a.idleRate,ex?ex.ok:""])}
 rows.push([],["era","profile","military","infrastructure_revenue","technology","treasury","revenue","territories","ice"]);
 for(const a of V.stats)a.byEra.forEach((b,e)=>rows.push([e+1,a.profile,b.military/b.n,b.infrastructure/b.n,b.technology/b.n,b.treasury/b.n,b.revenue/b.n,b.territories/b.n,b.iceN?b.ice/b.iceN:""]));
 csvDownload("imperios-validacao-estrategica.csv",rows);
}
export function valConfigSource(){const v=$("valConfig").value;if(v.startsWith("exp:")){const s=expState.results?.scenarios[+v.slice(4)];if(s)return {name:"cenário "+s.name,cfg:s.cfg,mode:s.mode}}return {name:"configuração aplicada",cfg:configApplied,mode:null}}
export function refreshValConfigOptions(){const el=$("valConfig");if(!el)return;const cur=el.value;el.innerHTML='<option value="applied">Configuração aplicada</option>'+(expState.results?.scenarios||[]).map((s,i)=>`<option value="exp:${i}">Cenário: ${escapeHtml(s.name)}</option>`).join("");if([...el.options].some(o=>o.value===cur))el.value=cur}
export function setupValLab(){
 refreshValConfigOptions();
 profileChecks("valProfiles");$("valCivs").value=1+configApplied.map.aiCount;$("valSeed").value=configApplied.simulation.seed;
 $("runVal").onclick=()=>runValidation().catch(e=>{setBusy(false);$("runVal").disabled=false;$("cancelVal").disabled=true;setStatus("valStatus",e.message,"error")});
 $("cancelVal").onclick=()=>{setValCancel(true);setStatus("valStatus","Cancelamento pedido...")};
 $("exportVal").onclick=exportValidation;$("valChartPick").onchange=drawValChart;
}
// Laboratórios (versão de desenvolvimento): editor de configuração, testes funcionais, balanceamento, IAs.
export async function initLabs(){
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
 $("restartWithConfig").onclick=()=>{try{setConfigApplied(readParams());rememberAiBase(configApplied);setConfigEdited(clone(configApplied));setState(newGame());setSelectedTerritory(null);renderParams();renderAll();setStatus("labStatus","Nova partida iniciada com a configuração atual.","success")}catch(e){setStatus("labStatus",e.message,"error")}};
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
// Arranque: espera o save (armazenamento assíncrono) e só depois liga a tela inicial e o tutorial.
// Os laboratórios só são ligados na versão de desenvolvimento (?dev=1).
// window.__imperiosReady fica true quando tudo está pronto (os testes automáticos esperam por isso).
(async function boot(){
 initSheets();watchShortScreen();
 await initGame();
 initHome();
 await initTutorial();
 if(DEV_MODE&&$("lab"))await initLabs();
 window.__imperiosReady=true;
})();
// Únicas formas de outros módulos substituírem estas variáveis (um módulo não pode reatribuir o que importa).
export function setCompareResults(v){compareResults=v;return v}
export function setLastStrategyResult(v){lastStrategyResult=v;return v}
export function setScenarioLoaded(v){scenarioLoaded=v;return v}
export function setAiValidationResults(v){aiValidationResults=v;return v}
export function setBalanceLabResults(v){balanceLabResults=v;return v}
export function setFixedRun(v){fixedRun=v;return v}
export function setFixedCancel(v){fixedCancel=v;return v}
export function setFtLabReady(v){ftLabReady=v;return v}

// Depuração e testes: variáveis globais só com ?dev=1 ou quando os testes automáticos o pedem (ver src/app/debug.js).
if(DEV_MODE||globalThis.__IMPERIOS_TEST__)exposeGlobals([ns_ai_decide,ns_ai_profiles,ns_app_hooks,ns_app_save,ns_app_session,ns_app_setup,ns_core_config,ns_core_economy,ns_core_endgame,ns_core_era,ns_core_format,ns_core_map,ns_core_match,ns_core_military,ns_core_names,ns_core_references,ns_core_rng,ns_core_state,ns_core_util,ns_labs_ai_checks,ns_labs_engine,ns_labs_experiment,ns_labs_settings,ns_labs_tests_def,ns_labs_validation,ns_legacy,ns_platform_files,ns_platform_storage,ns_ui_allocation,ns_ui_charts,ns_ui_dom,ns_ui_format,ns_ui_game,ns_ui_home,ns_ui_hud,ns_ui_labels,ns_ui_map,ns_ui_modal,ns_ui_panels,ns_ui_report,ns_ui_sheets,ns_ui_toast,ns_ui_tutorial]);
