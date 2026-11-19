// Estado de uma partida: civilizações, criação do estado inicial e acesso às civilizações.
import {CIV_COLORS,CHART_COLORS,MAX_AI,VERSION,normMode} from "./config.js";
import {civIds,startPositions,startSeedFor} from "./map.js";
import {rand} from "./rng.js";
import {clone,clamp} from "./util.js";

export function newCiv(id,index,c,aiCount,profile=null,controller=null){
 return {id,index,name:index===0?"Jogador":aiCount===1?"IA":"IA "+index,color:CIV_COLORS[index%CIV_COLORS.length],chartColor:CHART_COLORS[index%CHART_COLORS.length],
  controller:controller||(index===0?"human":"ai"),profile,active:true,
  treasury:c.economy.initialBudget,military:0,
  invested:{military:0,infrastructure:0,technology:0},
  attacks:{wins:0,losses:0,neutralConquests:0,enemyConquests:0},
  techProgress:0,techActive:0,infraTotal:0,maxTerritories:1,territoryYears:0,
  lastRevenue:{normal:0,infrastructure:0,technology:0,total:0}};
}
// opts.mode: "slow" | "fast" (parâmetro da partida/simulação, não global).
// opts.profiles: perfis por índice de civilização (null = segue cfg.military.aiStyle).
// opts.allAI: true = todas as civilizações (incluindo o lugar do jogador) são controladas por IA.
// opts.endRules: true = aplica as condições de fim de partida (jogo normal e Modo B);
//   false = duração fixa (Modo A): tudo é calculado e registado, mas nada elimina nem encerra.
export function newState(cfg,opts={}){
 const c=clone(cfg), n=c.map.territories, aiCount=clamp(Number(c.map.aiCount??1)|0,1,MAX_AI), owners=Array(n).fill("neutral");
 const ids=civIds(aiCount),startSeed=c.map.randomStart?(Number(opts.startSeed)>>>0||0):null,pos=startPositions(n,ids.length,c.map.randomStart?rand(startSeedFor(c,startSeed)):null);
 ids.forEach((id,k)=>owners[pos[k]]=id);
 const civs=ids.map((id,k)=>newCiv(id,k,c,aiCount,opts.profiles?.[k]??null,opts.allAI?"ai":null));
 return {formatVersion:VERSION,mode:normMode(opts.mode),era:0,owners,civs,investments:[],orders:[],nextInvestmentId:1,history:[],timeline:[],log:[],
  attacks:{playerWins:0,playerLosses:0,aiWins:0,aiLosses:0,neutralConquests:0,enemyConquests:0},
  rngSeed:c.simulation.seed,startSeed,initialBudget:c.economy.initialBudget,lastEraProcessed:0,stopped:false,
  endRules:!!opts.endRules,maxEras:c.endgame?.maxEras??30,supremacy:{leader:null,streak:0,status:"none"},result:null};
}
export const getCiv=(s,id)=>s.civs.find(c=>c.id===id);
export const P=s=>s.civs[0];            // jogador
export const A=s=>s.civs[1];            // primeira IA (compatibilidade com os painéis 1×1)
export const aiCivs=s=>s.civs.slice(1);
export const ownerLabel=(s,o)=>o==="neutral"?"Neutro":o==="player"?"Seu":(getCiv(s,o)?.name||o);
export function addLog(s,text){s.log.unshift({era:s.era,text});if(s.log.length>300)s.log.length=300}
