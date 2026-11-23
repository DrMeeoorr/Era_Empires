// Laboratório 3 (validação estratégica das IAs): execução, resultados, gráfico e exportação.
import {busy,configApplied,setBusy} from "../app/session.js";
import {clone} from "../core/util.js";
import {mapTerritories} from "../core/config.js";
import {readSimOpts,profileChecks} from "./common-ui.js";
import {estimateRows,ROW_WARN,buildJobs,runGameJobs,profileStats,consolidateProfiles,mean,RC,profileName} from "./engine.js";
import {SCENARIO_COLORS,expState} from "./experiment.js";
import {setValCancel,valState,valCancel,profileDiagnostics,PROFILE_EXPECTATIONS} from "./validation.js";
import {csvDownload} from "../platform/files.js";
import {svgLine,legendHtml} from "../ui/charts.js";
import {$,setStatus} from "../ui/dom.js";
import {fmtBR as fmt,escapeHtml} from "../ui/format.js";

export async function runValidation(){
 if(busy)return;const opts=readSimOpts("val");if(opts.civCount>mapTerritories(configApplied))throw Error("Mais civilizações do que territórios.");
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
