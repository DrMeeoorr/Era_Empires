// Estado de uma partida: civilizações, criação do estado inicial e acesso às civilizações.
import {CIV_COLORS,CHART_COLORS,MAX_AI,VERSION,normMode,mapTerritories,normMapSize} from "./config.js";
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
 const c=clone(cfg), n=mapTerritories(c), aiCount=clamp(Number(c.map.aiCount??1)|0,1,MAX_AI), owners=Array(n).fill("neutral");
 const ids=civIds(aiCount),startSeed=c.map.randomStart?(Number(opts.startSeed)>>>0||0):null,pos=startPositions(n,ids.length,c.map.randomStart?rand(startSeedFor(c,startSeed)):null);
 ids.forEach((id,k)=>owners[pos[k]]=id);
 const civs=ids.map((id,k)=>newCiv(id,k,c,aiCount,opts.profiles?.[k]??null,opts.allAI?"ai":null));
 const st={formatVersion:VERSION,mode:normMode(opts.mode),era:0,owners,civs,investments:[],orders:[],nextInvestmentId:1,history:[],timeline:[],log:[],
  attacks:{playerWins:0,playerLosses:0,aiWins:0,aiLosses:0,neutralConquests:0,enemyConquests:0},
  rngSeed:c.simulation.seed,startSeed,initialBudget:c.economy.initialBudget,lastEraProcessed:0,stopped:false,
  endRules:!!opts.endRules,maxEras:c.endgame?.maxEras??30,supremacy:{leader:null,streak:0,status:"none"},result:null};
 // Mapas maiores (config.map.mapSize 2–4): o estado guarda o tamanho; no mapa de sempre o campo nem existe.
 const size=normMapSize(c.map.mapSize);if(size>1)st.mapSize=size;
 // Grande Descoberta (vitória por Ciência): sempre nos mapas maiores; no Original só se ligada (endgame.greatDiscovery).
 const gd=makeGreatDiscovery(c,size,n);if(gd)st.greatDiscovery=gd;
 const wd=makeWonder(c,size,n);if(wd)st.wonder=wd;
 return st;
}
/* Grande Descoberta (22/11/2026): vence quem junta discoveryGoal × k pontos de Ciência tendo pelo menos
   ⌈discoveryMinRegions × k⌉ regiões (k = regiões/24). Pontos de Ciência = progresso gerado pelos SEUS investimentos em
   Ciência (ouro investido × progressPerInvestment); o que se saqueia não conta (senão quem conquista ganhava a corrida).
   A meta, o mínimo e o fator ficam gravados na partida (state.greatDiscovery = {goal, minRegions, perGold}); sem o campo
   a regra não existe (Original e saves antigos). */
export function makeGreatDiscovery(c,size,n){
 const g=c.endgame||{};if(!(size>1||g.greatDiscovery===true))return null;
 const k=size>1?n/24:1;return {goal:Math.round((g.discoveryGoal??6000)*k),minRegions:Math.ceil((g.discoveryMinRegions??5)*k-1e-9),perGold:c.technology?.progressPerInvestment??0.2};
}
/* Maravilha da Humanidade (vitória por Obras, espelho da Grande Descoberta): vence quem junta wonderGoal × k pontos de
   Maravilha (ouro que o próprio império investiu em Obras nas eras em que Obras foi a MAIOR fatia do seu investimento ×
   wonderPerGold; o saque não conta; civ.wonderInvested) com pelo menos
   ⌈wonderMinRegions × k⌉ regiões. Sempre nos mapas maiores; no Original só se ligada (endgame.wonder). */
export function makeWonder(c,size,n){
 const g=c.endgame||{};if(!(size>1||g.wonder===true))return null;
 const k=size>1?n/24:1;return {goal:Math.round((g.wonderGoal??3000)*k),minRegions:Math.ceil((g.wonderMinRegions??4)*k-1e-9),perGold:g.wonderPerGold??0.2};
}
export const getCiv=(s,id)=>s.civs.find(c=>c.id===id);
export const P=s=>s.civs[0];            // jogador
export const A=s=>s.civs[1];            // primeira IA (compatibilidade com os painéis 1×1)
export const aiCivs=s=>s.civs.slice(1);
export const ownerLabel=(s,o)=>o==="neutral"?"Neutro":o==="player"?"Seu":(getCiv(s,o)?.name||o);
export function addLog(s,text){s.log.unshift({era:s.era,text});if(s.log.length>300)s.log.length=300}
