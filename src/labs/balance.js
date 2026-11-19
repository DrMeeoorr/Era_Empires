// Torneio de balanceamento entre perfis (aba Balanceamento).
import {AI_PROFILE_NAMES} from "../ai/profiles.js";
import {busy,setBusy,configApplied,gameMode} from "../app/session.js";
import {simulate} from "../core/era.js";
import {P,A} from "../core/state.js";
import {safeNum,clone} from "../core/util.js";
import {strategyName} from "./settings-ui.js";
import {download} from "../platform/files.js";
import {$,setStatus} from "../ui/dom.js";
import {fmt,money} from "../ui/format.js";

export let balanceLabResults=[];
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
// Únicas formas de outros módulos substituírem estas variáveis (um módulo não pode reatribuir o que importa).
export function setBalanceLabResults(v){balanceLabResults=v;return v}
