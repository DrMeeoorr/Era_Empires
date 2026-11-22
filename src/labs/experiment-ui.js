// Laboratório 2 (balanceamento): tela das experiências — cenários, execução, resultados e gráficos.
import {configApplied,busy,setBusy,setConfigApplied,rememberAiBase} from "../app/session.js";
import {normalizeConfig,mapTerritories} from "../core/config.js";
import {END_REASON_NAMES} from "../core/endgame.js";
import {clone} from "../core/util.js";
import {readSimOpts,profileChecks} from "./common-ui.js";
import {estimateRows,ROW_WARN,buildJobs,runGameJobs,summarizeRecords,profileStats,mean,median,profileName,consolidateProfiles,OUTCOME_KEYS} from "./engine.js";
import {paramCatalog,expState,SCENARIO_COLORS,getParam,parseParamValue,setExpCancel,scenarioConfig,expCancel,exportExp} from "./experiment.js";
import {renderParams} from "./settings-ui.js";
import {PARAM_OPTIONS,setConfigEdited} from "./settings.js";
import {refreshValConfigOptions} from "./validation-ui.js";
import {barChart,legendHtml,svgLine} from "../ui/charts.js";
import {$,setStatus} from "../ui/dom.js";
import {escapeHtml,fmt,cssColor} from "../ui/format.js";
import {renderAll} from "../ui/game.js";

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
 if(opts.civCount>mapTerritories(configApplied))throw Error("Mais civilizações do que territórios.");
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
