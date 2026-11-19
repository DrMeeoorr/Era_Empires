// Decisão das IAs em cada era: quanto investir em cada área e quem atacar, conforme o perfil.
import {SEED} from "../core/config.js";
import {releaseMilitaryInvestments,invest} from "../core/economy.js";
import {fmtCore} from "../core/format.js";
import {countTerritories,eligibleTargets} from "../core/map.js";
import {territoryDefense,attackNeed,orderAttack,attackTerritory,orderCostMultiplier} from "../core/military.js";
import {rand} from "../core/rng.js";
import {clamp} from "../core/util.js";

// Decisão de uma IA: mesmos perfis do MVP, agora comparando-se com o rival mais forte.
export function aiDecide(s,civ,cfg,era){
 const investment={military:0,infrastructure:0,technology:0};
 const style=civ.profile||cfg.military.aiStyle||"adaptive";
 const myTerr=countTerritories(s,civ.id);
 const rivals=s.civs.filter(c=>c.id!==civ.id&&c.active);
 const rivalTerr=rivals.length?Math.max(...rivals.map(c=>countTerritories(s,c.id))):0;
 const targetsNow=eligibleTargets(s,civ.id),threat=targetsNow.some(t=>t.o!=="neutral");
 const neutralTargets=targetsNow.filter(t=>t.o==="neutral").length;
 const defenseNeed=targetsNow.length?Math.min(...targetsNow.map(t=>attackNeed(s,t.i,civ.id,cfg))):Infinity;
 const readyToAttack=civ.military>=defenseNeed;
 let weights;
 // Perfis revistos no balanceamento (decisão 33): menos extremos, para não ficarem sem economia ou sem território.
 if(style==="military")weights=[65,25,10];
 else if(style==="reference"){
  // Perfil "Equilibrado" (id interno reference).
  // Equilibrado: divisão fixa e igual entre as três dimensões (decisão de balanceamento).
  weights=[34,33,33];
 }
 else if(style==="aggressive")weights=[68,22,10];
 else if(style==="economist")weights=[20,65,15];
 else if(style==="technologist")weights=[20,20,60];
 else if(style==="custom")weights=[cfg.military.aiMilitary,cfg.military.aiInfrastructure,cfg.military.aiTechnology];
 else {
  // Adaptativa: reserva militar quando ameaçada ou perto de uma conquista acessível;
  // caso contrário investe na economia e depois em tecnologia à medida que amadurece.
  if(threat||myTerr<=rivalTerr)weights=[55,30,15];
  else if(readyToAttack||neutralTargets>0&&civ.military>=defenseNeed*0.65)weights=[48,37,15];
  else if(myTerr>=Math.max(3,rivalTerr+2))weights=[22,43,35];
  else weights=[32,43,25];
 }
 const weightSum=weights.reduce((a,b)=>a+Math.max(0,Number(b)||0),0)||1;
 const reservePct=clamp(Number(cfg.military.aiReserve||0),0,90)/100;
 const treasuryBefore=civ.treasury;
 // Mantém a reserva configurada; investe o resto, nunca mais do que o disponível.
 const budget=Math.min(treasuryBefore,treasuryBefore*(1-reservePct));
 investment.military=budget*Math.max(0,weights[0])/weightSum;
 investment.infrastructure=budget*Math.max(0,weights[1])/weightSum;
 investment.technology=Math.max(0,budget-investment.military-investment.infrastructure);
 for(const [type,val] of Object.entries(investment))invest(s,type,val,cfg,civ.id);
 releaseMilitaryInvestments(s,era);
 const aggression=clamp(Number(cfg.military.aiAggression??75),0,100);
 const roll=rand((s.rngSeed||cfg.simulation.seed||SEED)+era*7919+37+(civ.index-1)*104729)();
 // Tutorial: a IA pode ter de evitar o jogador ou territórios reservados.
 const av=s.aiAvoid,targets=eligibleTargets(s,civ.id).filter(t=>!(av&&((av.player&&t.o==="player")||(av.idx||[]).includes(t.i))));let action;
 if(targets.length&&roll<aggression/100){
  const priority=cfg.military.aiTarget||"neutralFirst";
  // Coligação contra o líder: alvos pagáveis (custo cheio) primeiro; depois o líder em territórios
  // (exceto a própria IA; em empate, o jogador), os neutros e, por último, as outras IAs; o mais barato em cada grupo.
  let leaderId=null,payable=null,leaderClass=null;
  if(priority==="leader"){const others=s.civs.filter(c=>c.active&&c.id!==civ.id),top=Math.max(...others.map(c=>countTerritories(s,c.id)));
   leaderId=(others.find(c=>c.id==="player"&&countTerritories(s,c.id)===top)||others.find(c=>countTerritories(s,c.id)===top))?.id??null;
   payable=t=>civ.military+1e-9>=cfg.military.conquestCost+territoryDefense(s,t.i,cfg);leaderClass=t=>t.o===leaderId?0:t.o==="neutral"?1:2}
  targets.sort((a,b)=>{
   if(priority==="leader")return (payable(a)?0:1)-(payable(b)?0:1)||leaderClass(a)-leaderClass(b)||territoryDefense(s,a.i,cfg)-territoryDefense(s,b.i,cfg)||a.i-b.i;
   if(priority==="playerFirst")return (a.o==="player"?0:1)-(b.o==="player"?0:1)||a.i-b.i;
   // Estratega: o alvo mais barato (menor defesa); em empate prefere o jogador humano.
   if(priority==="cheapest"){const da=territoryDefense(s,a.i,cfg),db=territoryDefense(s,b.i,cfg);return da-db||(a.o==="player"?-1:b.o==="player"?1:0)||a.i-b.i}
   if(priority==="weakest")return a.i-b.i;
   if(priority==="strongest")return b.i-a.i;
   return (a.o==="neutral"?0:1)-(b.o==="neutral"?0:1)||a.i-b.i;
  });
  // IA prudente: só dá a 1ª ordem com o custo cheio (sem desconto tecnológico), mas paga o custo com desconto.
  const t=targets[0],required=cfg.military.conquestCost+territoryDefense(s,t.i,cfg);
  if(civ.military+1e-9>=required){const result=cfg.military.simultaneousOrders?orderAttack(s,t.i,civ.id,cfg):attackTerritory(s,t.i,civ.id,cfg,true);action=result.ok?(result.queued?`${civ.name} ordenou ataque ao território ${t.i+1}`:result.win?`${civ.name} conquistou território ${t.i+1}`:`${civ.name} atacou território ${t.i+1} e foi repelida`):`${civ.name}: ${result.reason}`;}
  else action=`${civ.name} acumulando poder militar (precisa ${fmtCore(required)} para alvo ${t.i+1})`;
  // Ataques adicionais na mesma era (cada um mais caro), enquanto o poder chegar.
  if(cfg.military.simultaneousOrders&&cfg.military.maxOrdersPerEra!==1){let n=(s.orders||[]).filter(o=>o.owner===civ.id).length;const max=cfg.military.maxOrdersPerEra||Infinity;
   if(n>0)for(const t2 of targets.slice(1)){if(n>=max)break;const req=attackNeed(s,t2.i,civ.id,cfg)*orderCostMultiplier(cfg,n);if(civ.military+1e-9<req)continue;if(orderAttack(s,t2.i,civ.id,cfg).ok){n++;action+=` + território ${t2.i+1}`}}}
 }else if(targets.length)action=`${civ.name} decidiu não atacar nesta era`;
 else action=`${civ.name} sem alvos adjacentes`;
 return {style,action,investment,budgetInvested:investment.military+investment.infrastructure+investment.technology};
}
