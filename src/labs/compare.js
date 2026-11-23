// Comparar estratégias (aba Balanceamento): várias estratégias a partir do mesmo estado e da mesma semente.
import {configApplied,gameMode} from "../app/session.js";
import {simulate} from "../core/era.js";
import {P} from "../core/state.js";
import {safeNum,clone} from "../core/util.js";
import {strategyName} from "./settings-ui.js";
import {svgLine} from "../ui/charts.js";
import {$,setStatus} from "../ui/dom.js";
import {moneyBR as money,fmtBR as fmt} from "../ui/format.js";

export let compareResults=[];
export const COMPARE_COLORS=["#f4bd50","#56d6a1","#b49aff","#62a8ff","#ff737b","#e88a43","#72d0df","#d9a4c7"];
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
// Únicas formas de outros módulos substituírem estas variáveis (um módulo não pode reatribuir o que importa).
export function setCompareResults(v){compareResults=v;return v}
