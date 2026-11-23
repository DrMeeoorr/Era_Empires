// Aba "Validação das IAs": conformidade de cada perfil (disciplina, coerência, adaptação, controlo de ataques).
import {AI_PROFILE_NAMES} from "../ai/profiles.js";
import {busy,setBusy,configApplied,gameMode} from "../app/session.js";
import {processEra} from "../core/era.js";
import {newState,A} from "../core/state.js";
import {safeNum,clone,clamp} from "../core/util.js";
import {profileExpectedWeights,pct,runAiControlProbe,aiProbe} from "./ai-checks.js";
import {download} from "../platform/files.js";
import {$,setStatus} from "../ui/dom.js";
import {fmtBR as fmt} from "../ui/format.js";

export let aiValidationResults=[];
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
// Únicas formas de outros módulos substituírem estas variáveis (um módulo não pode reatribuir o que importa).
export function setAiValidationResults(v){aiValidationResults=v;return v}
