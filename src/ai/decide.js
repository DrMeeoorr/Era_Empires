// Decisão das IAs em cada era: quanto investir em cada área e quem atacar, conforme o perfil.
import {SEED} from "../core/config.js";
import {releaseMilitaryInvestments,invest} from "../core/economy.js";
import {fmtCore} from "../core/format.js";
import {countTerritories,eligibleTargets} from "../core/map.js";
import {territoryDefense,attackNeed,orderAttack,attackTerritory,orderCostMultiplier,fullAttackCost} from "../core/military.js";
import {terrainEffectsOn,ruleTerrain,TERRAIN_EFFECTS} from "../core/terrain.js";
import {rand} from "../core/rng.js";
import {clamp} from "../core/util.js";
import {greatDiscoveryOf,discoveryPoints} from "../core/endgame.js";

// Terrenos com efeitos: a IA mede cada alvo pelo custo dividido pelo valor do terreno = ouro que ele rende
// (Campina/Montanha/Deserto 1,2; os outros 0,8) + a afinidade do seu estilo (Construtor gosta de Obras,
// Científico de Ciência, Militar/Agressivo de Força; Adaptativo um pouco de tudo). Desligado, nada disto é lido.
export const AI_TERRAIN_AFFINITY=Object.freeze({
 economist:{campina:0.4,floresta:0.4},
 technologist:{deserto:0.4,pantano:0.4,tundra:0.4},
 military:{colinas:0.4},aggressive:{colinas:0.4},
 adaptive:{campina:0.2,floresta:0.2,colinas:0.2,deserto:0.2,pantano:0.2,tundra:0.2},
 reference:{},
});
export function aiTerrainValue(s,i,style){const k=ruleTerrain(s,i);return (TERRAIN_EFFECTS[k]?.income??1)+(AI_TERRAIN_AFFINITY[style]?.[k]||0)}
// Menor = alvo melhor (com os efeitos ligados).
export function aiTargetScore(s,i,civ,cfg,style){return attackNeed(s,i,civ.id,cfg)/aiTerrainValue(s,i,style)}

// Alvo efetivo: "leader" vira "neutralFirst" no Só visual quando há mais de 2 impérios ativos.
export function leaderTargetMode(s,priority){return priority==="leader"&&!terrainEffectsOn(s)&&s.civs.filter(c=>c.active).length>2?"neutralFirst":priority}

// Reflexo de defesa (rodada 2 de balanceamento, 20/11/2026).
export const DEFENSE_REFLEX_POINTS=15;
export function defenseReflexOn(s,civ,targetsNow=eligibleTargets(s,civ.id)){
 return s.civs[0]?.controller==="human"&&civ.id!=="player"&&targetsNow.some(t=>t.o==="player")&&(s.civs[0].military||0)>civ.military;
}
/* Grande Descoberta (22/11/2026; só com state.greatDiscovery): quando um rival passa de discoveryReact (50%) da meta e
   tem mais pontos de Ciência que esta IA, ela põe +discoveryReactMilitary pontos no Militar (tirados de Obras e Ciência na
   proporção) e ataca primeiro esse rival quando faz fronteira com ele (mesmo nas eras em que não atacaria).
   Uma IA perto da meta mas abaixo do mínimo de regiões também reforça o Militar, para chegar ao mínimo. */
export function discoveryThreat(s,civ,cfg){
 const g=greatDiscoveryOf(s);if(!g)return null;const react=cfg.endgame?.discoveryReact??0.5;
 const others=s.civs.filter(c=>c.active&&c.id!==civ.id);if(!others.length)return null;
 const pts=c=>discoveryPoints(s,c),top=others.reduce((a,b)=>pts(b)>pts(a)?b:a);
 return pts(top)>=react*g.goal&&pts(top)>pts(civ)?top.id:null;
}
export function discoveryNeedsRegions(s,civ,cfg){const g=greatDiscoveryOf(s);if(!g)return false;
 return discoveryPoints(s,civ)>=(cfg.endgame?.discoveryReact??0.5)*g.goal&&countTerritories(s,civ.id)<g.minRegions}
export function shiftToMilitary(weights,b){const tot=weights[1]+weights[2]||1;
 return [weights[0]+b,Math.max(0,weights[1]-b*weights[1]/tot),Math.max(0,weights[2]-b*weights[2]/tot)]}
export function applyDefenseReflex(weights){
 const b=DEFENSE_REFLEX_POINTS,tot=weights[1]+weights[2]||1;
 return [weights[0]+b,Math.max(0,weights[1]-b*weights[1]/tot),Math.max(0,weights[2]-b*weights[2]/tot)];
}
// O Científico decide se consegue pagar um ataque já com o desconto da Ciência (attackNeed); os outros estilos
// continuam a decidir pelo custo cheio (rodada 2 de balanceamento, 20/11/2026).
function decisionCost(s,i,civ,cfg,style,fx){
 if(style==="technologist")return attackNeed(s,i,civ.id,cfg);
 return fx?fullAttackCost(s,i,cfg):cfg.military.conquestCost+territoryDefense(s,i,cfg);
}

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
 // Rodada 2 de balanceamento (20/11/2026) — reflexo de defesa: se o rival faz fronteira com o jogador humano e o
 // exército do jogador é maior que o dele, ganha +15 pontos de Militar, tirados de Obras e Ciência na proporção
 // de cada uma (nunca abaixo de 0). Não dispara em partidas só de IAs.
 if(defenseReflexOn(s,civ,targetsNow))weights=applyDefenseReflex(weights);
 const sciLeader=discoveryThreat(s,civ,cfg),sciTarget=!!sciLeader&&targetsNow.some(t=>t.o===sciLeader);
 // (Só IAs: um lugar humano decidido por esta função, como nas simulações de estratégias, segue a sua própria divisão.)
 if(civ.controller!=="human"&&(sciLeader||discoveryNeedsRegions(s,civ,cfg)))weights=shiftToMilitary(weights,cfg.endgame?.discoveryReactMilitary??20);
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
 if(targets.length&&(roll<aggression/100||sciTarget)){
  const fx=terrainEffectsOn(s);
  // Rodada de balanceamento de 20/11/2026: no Só visual, com 2+ rivais ainda em jogo, a coligação contra o líder fazia
  // os rivais brigarem entre si e com regiões bem defendidas (o Difícil com 3 rivais ficava tão fácil como o Médio).
  // Aí o Difícil/Lendário vão primeiro às regiões livres (atacando sempre); no 1×1 e com efeitos, a coligação continua.
  const priority=sciTarget&&targets.some(t=>t.o===sciLeader)?"discovery":leaderTargetMode(s,cfg.military.aiTarget||"neutralFirst");
  // Coligação contra o líder: alvos pagáveis (custo cheio; Científico com desconto) primeiro; depois o líder em territórios
  // (exceto a própria IA; em empate, o jogador), os neutros e, por último, as outras IAs; o mais barato em cada grupo.
  let leaderId=null,payable=null,leaderClass=null;
  if(priority==="leader"){const others=s.civs.filter(c=>c.active&&c.id!==civ.id),top=Math.max(...others.map(c=>countTerritories(s,c.id)));
   leaderId=(others.find(c=>c.id==="player"&&countTerritories(s,c.id)===top)||others.find(c=>countTerritories(s,c.id)===top))?.id??null;
   payable=t=>civ.military+1e-9>=decisionCost(s,t.i,civ,cfg,style,fx);leaderClass=t=>t.o===leaderId?0:t.o==="neutral"?1:2}
  // Com terrenos com efeitos, os empates de cada critério desfazem-se pelo valor do terreno (aiTargetScore).
  const score=fx?new Map(targets.map(t=>[t.i,aiTargetScore(s,t.i,civ,cfg,style)])):null,tie=(a,b)=>fx?score.get(a.i)-score.get(b.i)||a.i-b.i:a.i-b.i;
  targets.sort((a,b)=>{
   if(priority==="leader")return (payable(a)?0:1)-(payable(b)?0:1)||leaderClass(a)-leaderClass(b)||(fx?tie(a,b):territoryDefense(s,a.i,cfg)-territoryDefense(s,b.i,cfg)||a.i-b.i);
   if(priority==="discovery")return (a.o===sciLeader?0:1)-(b.o===sciLeader?0:1)||(fx?tie(a,b):territoryDefense(s,a.i,cfg)-territoryDefense(s,b.i,cfg)||a.i-b.i);
   if(priority==="playerFirst")return (a.o==="player"?0:1)-(b.o==="player"?0:1)||a.i-b.i;
   // Estratega: o alvo mais barato (menor defesa); em empate prefere o jogador humano.
   if(priority==="cheapest"&&fx)return tie(a,b);
   if(priority==="cheapest"){const da=territoryDefense(s,a.i,cfg),db=territoryDefense(s,b.i,cfg);return da-db||(a.o==="player"?-1:b.o==="player"?1:0)||a.i-b.i}
   if(priority==="weakest")return a.i-b.i;
   if(priority==="strongest")return b.i-a.i;
   return (a.o==="neutral"?0:1)-(b.o==="neutral"?0:1)||tie(a,b);
  });
  // IA prudente: só dá a 1ª ordem com o custo cheio (sem desconto tecnológico), mas paga o custo com desconto.
  // Exceção: o Científico já decide com o desconto (decisionCost).
  const t=targets[0],required=decisionCost(s,t.i,civ,cfg,style,fx);
  if(civ.military+1e-9>=required){const result=cfg.military.simultaneousOrders?orderAttack(s,t.i,civ.id,cfg):attackTerritory(s,t.i,civ.id,cfg,true);action=result.ok?(result.queued?`${civ.name} ordenou ataque ao território ${t.i+1}`:result.win?`${civ.name} conquistou território ${t.i+1}`:`${civ.name} atacou território ${t.i+1} e foi repelida`):`${civ.name}: ${result.reason}`;}
  else action=`${civ.name} acumulando poder militar (precisa ${fmtCore(required)} para alvo ${t.i+1})`;
  // Ataques adicionais na mesma era (cada um mais caro), enquanto o poder chegar.
  if(cfg.military.simultaneousOrders&&cfg.military.maxOrdersPerEra!==1){let n=(s.orders||[]).filter(o=>o.owner===civ.id).length;const max=cfg.military.maxOrdersPerEra||Infinity;
   if(n>0)for(const t2 of targets.slice(1)){if(n>=max)break;const req=attackNeed(s,t2.i,civ.id,cfg)*orderCostMultiplier(cfg,n,s);if(civ.military+1e-9<req)continue;if(orderAttack(s,t2.i,civ.id,cfg).ok){n++;action+=` + território ${t2.i+1}`}}}
 }else if(targets.length)action=`${civ.name} decidiu não atacar nesta era`;
 else action=`${civ.name} sem alvos adjacentes`;
 return {style,action,investment,budgetInvested:investment.military+investment.infrastructure+investment.technology};
}
