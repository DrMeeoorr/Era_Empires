// Sondas das IAs (validação estratégica): uma era controlada para medir a divisão do investimento e os ataques.
import {configApplied,gameMode} from "../app/session.js";
import {processEra} from "../core/era.js";
import {newState,A} from "../core/state.js";
import {clone} from "../core/util.js";

export function profileExpectedWeights(profile,cfg){
 if(profile==="reference")return [34,33,33];if(profile==="military")return [65,25,10];if(profile==="aggressive")return [68,22,10];if(profile==="economist")return [20,65,15];if(profile==="technologist")return [20,20,60];if(profile==="custom")return [cfg.military.aiMilitary,cfg.military.aiInfrastructure,cfg.military.aiTechnology];return null;
}
export function aiProbe(profile,threatened,seed){
 const cfg=clone(configApplied);cfg.simulation.seed=seed;cfg.military.aiStyle=profile;cfg.military.aiAggression=0;cfg.military.aiReserve=0;cfg.military.aiEnabled=true;
 const s=newState(cfg,{mode:gameMode});s.owners=Array(cfg.map.territories).fill("neutral");s.owners[0]="player";s.owners[22]="ai";s.owners[23]="ai";if(threatened)s.owners[16]="player";
 processEra(s,cfg,{playerAllocation:{military:0,infrastructure:0,technology:0}});
 const r=s.history.at(-1),sum=r.aiBudgetInvested||0;
 return {military:sum?r.aiInvestment.military/sum:0,infrastructure:sum?r.aiInvestment.infrastructure/sum:0,technology:sum?r.aiInvestment.technology/sum:0,investment:sum};
}
export function runAiControlProbe(profile,aggression,seed){
 const cfg=clone(configApplied);cfg.simulation.seed=seed;cfg.military.aiStyle=profile;cfg.military.aiAggression=aggression;cfg.military.aiReserve=0;cfg.military.aiEnabled=true;cfg.military.aiTarget="neutralFirst";
 const s=newState(cfg,{mode:gameMode});s.owners[22]="ai";A(s).military=100;
 processEra(s,cfg,{playerAllocation:{military:0,infrastructure:0,technology:0}});
 return {attacks:s.attacks.aiWins+s.attacks.aiLosses,action:s.history.at(-1).aiAction,valid:Number.isFinite(A(s).treasury)&&A(s).treasury>=0};
}
export function pct(pass,total){return total?100*pass/total:0}
