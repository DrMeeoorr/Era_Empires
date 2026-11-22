// Militar: defesa dos territórios, saque, ataques imediatos e ordens simultâneas (resolvidas no fim da era).
import {effectiveDelay,mapAreaFactor} from "./config.js";
import {fmtCore} from "./format.js";
import {countTerritories,adjacentOwned} from "./map.js";
import {rand} from "./rng.js";
import {getCiv,addLog,ownerLabel} from "./state.js";
import {terrainEffectsOn,terrainDefenseBonus,terrainAttackFactor} from "./terrain.js";

// Defesa de um território: neutro = valor fixo; com dono = base + fortificações pela receita de
// infraestrutura do dono + defesa pelo progresso tecnológico do dono (ambas configuráveis; 0 desliga).
// Terrenos com efeitos: soma a defesa do terreno (só regiões com dono; nunca abaixo de 0).
export function territoryDefense(s,idx,cfg){const d=baseDefense(s,idx,cfg);return terrainEffectsOn(s)?Math.max(0,d+terrainDefenseBonus(s,idx)):d}
function baseDefense(s,idx,cfg){
 const o=s.owners[idx],m=cfg.military;if(o==="neutral")return m.defenseNeutral;
 const civ=getCiv(s,o);if(!civ)return m.defenseOwned;
 const econ=(m.defensePerInfraRevenue||0)*(civ.lastRevenue?.infrastructure||0)+(m.defensePerTechProgress||0)*(civ.techProgress||0);
 // A defesa vinda da economia reparte-se pelos territórios (expoente 0,5 = raiz quadrada): um império rico
 // continua difícil de atacar, mas cada território já não recebe a força da economia inteira.
 const gar=reserveDefense(s,civ,m),split=m.defenseSplitExponent||0,div=split>0?Math.pow(Math.max(1,countTerritories(s,o)),split):1;
 return m.defenseOwned+(econ+gar)/div;
}
/* Rodada 4 de balanceamento (20/11/2026) — Força guardada defende: cada ponto de Força que o dono NÃO usou em ordens
   de ataque soma defensePerReserveForce (1) à defesa, repartido pelas regiões como a defesa das Obras (÷ raiz do nº de
   regiões). A Força reservada em ordens não conta. Enquanto as ordens se resolvem, vale a Força livre do início da
   resolução (garrisonSnapshot), para a ordem de resolução não mudar a defesa de ninguém. */
let garrisonSnapshot=null;
export function reserveForce(s,civ){if(!civ)return 0;const v=garrisonSnapshot&&garrisonSnapshot.s===s&&civ.id in garrisonSnapshot.f?garrisonSnapshot.f[civ.id]:civ.military;return Math.max(0,Number(v)||0)}
function reserveDefense(s,civ,m){const k=m.defensePerReserveForce||0;return k>0?k*reserveForce(s,civ):0}
// Partes da defesa de uma região com dono, já repartidas (para a folha da região): base, Obras, Força guardada e terreno.
export function defenseParts(s,idx,cfg){
 const o=s.owners[idx],m=cfg.military,total=territoryDefense(s,idx,cfg),terrain=terrainEffectsOn(s)&&o!=="neutral"?terrainDefenseBonus(s,idx):0;
 const civ=o==="neutral"?null:getCiv(s,o);if(!civ)return {base:total,works:0,reserve:0,terrain:0,total};
 const split=m.defenseSplitExponent||0,div=split>0?Math.pow(Math.max(1,countTerritories(s,o)),split):1;
 const works=((m.defensePerInfraRevenue||0)*(civ.lastRevenue?.infrastructure||0)+(m.defensePerTechProgress||0)*(civ.techProgress||0))/div;
 return {base:m.defenseOwned,works,reserve:reserveDefense(s,civ,m)/div,terrain,total};
}
// Tecnologia reforça o ATAQUE: o custo de cada ataque divide-se por 1 + techAttackMax × P/(P + techAttackHalf),
// com P = progresso tecnológico do atacante (retornos decrescentes; teto = techAttackMax). 0 desliga.
export function techAttackFactor(s,owner,cfg){
 const m=cfg.military,max=Math.max(0,m.techAttackMax||0),half=Math.max(0,m.techAttackHalf||0),P=Math.max(0,getCiv(s,owner)?.techProgress||0);
 if(!(max>0)||!(P>0))return 1;return 1+max*(half>0?P/(P+half):1);
}
// Desconto tecnológico do atacante como fração do custo (0,2 = custo 20% menor).
export function techAttackDiscount(s,owner,cfg){return 1-1/techAttackFactor(s,owner,cfg)}
// Custo base de um ataque (antes do multiplicador de ordens extra): custo cheio com o desconto tecnológico do atacante.
export function attackNeed(s,idx,owner,cfg){return fullAttackCost(s,idx,cfg)/techAttackFactor(s,owner,cfg)}
// Custo cheio de um ataque, sem o desconto da Ciência: conquista + defesa do alvo; com terrenos com efeitos,
// × o custo de ataque do terreno (Pântano +20%, só se a região tem dono).
export function fullAttackCost(s,idx,cfg){const c=cfg.military.conquestCost+territoryDefense(s,idx,cfg);return terrainEffectsOn(s)?c*terrainAttackFactor(s,idx):c}
/* Saque: ao conquistar um território de outra civilização, o vencedor leva uma parte da infraestrutura
   ainda ativa e da tecnologia do derrotado (pillageInvestShare × 1/territórios, até pillageMaxShare = 20%; antes da
   rodada 4 de balanceamento, até metade) e um espólio em tesouro de pillageRevenueEras eras da receita daquele
   território. Torna a guerra uma forma de crescer. */
export function pillage(s,victimId,owner,cfg){
 const m=cfg.military,victim=getCiv(s,victimId),civ=getCiv(s,owner),T=countTerritories(s,victimId);
 if(!victim||!civ||T<1)return null;const f=Math.min(m.pillageMaxShare??0.2,(m.pillageInvestShare||0)/T);let infra=0,tech=0;
 // Mapas maiores (2–4): a Ciência saqueada divide-se por k^techPillageMapExponent (k = regiões/24; padrão 0,25: ÷1,19 no
 // 2×, ÷1,41 no 4×).
 // Um império com muitas regiões perdia 20% de toda a Ciência por região tomada; as Obras continuam como antes.
 const k=mapAreaFactor(s),fTech=k>1?f/Math.pow(k,m.techPillageMapExponent??1):f;
 if(f>0){const mine=new Map(),add=[];
  for(const inv of s.investments)if(inv.owner===owner)mine.set(inv.type+"|"+inv.origin+"|"+inv.mode,inv);
  for(const inv of s.investments){
   if(inv.owner!==victimId)continue;
   if(inv.type==="infrastructure"){const p=inv.params;if(s.era-inv.origin-effectiveDelay("infrastructure",p.delay,inv.mode)+1>p.duration)continue}
   else if(inv.type!=="technology")continue;
   // Junta o saque a um investimento do vencedor com a mesma origem para não multiplicar registos.
   const key=inv.type+"|"+inv.origin+"|"+inv.mode;let n=mine.get(key);
   if(!n){n={...inv,params:{...inv.params},owner,amount:0,cumReturn:0,id:s.nextInvestmentId++};if(n.progress!=null)n.progress=0;mine.set(key,n);add.push(n)}
   const fi=inv.type==="technology"?fTech:f,moved=inv.amount*fi;n.amount+=moved;inv.amount-=moved;if(inv.type==="infrastructure")infra+=moved;
   if(inv.progress!=null){const mp=inv.progress*fi;n.progress+=mp;inv.progress-=mp;tech+=mp}
  }
  for(const n of add)s.investments.push(n);
 }
 const gold=(m.pillageRevenueEras||0)*(victim.lastRevenue?.total||0)/T;civ.treasury+=gold;
 return {infra,tech,gold};
}
export function attackTerritory(s,idx,owner,cfg,automatic=false){
 const civ=getCiv(s,owner);if(!civ||!civ.active)return {ok:false,reason:"Civilização inexistente ou inativa."};
 if(idx<0||idx>=s.owners.length||s.owners[idx]===owner||!adjacentOwned(s,idx,owner))return {ok:false,reason:"Alvo não é adjacente ou já pertence ao atacante."};
 const targetOwner=s.owners[idx],need=attackNeed(s,idx,owner,cfg);
 if(civ.military+1e-9<need)return {ok:false,reason:`Poder insuficiente: precisa de ${fmtCore(need)} pontos.`};
 // Mesma regra de consumo para sucesso e falha; defesa + custo de conquista são comprometidos.
 // A semente inclui o índice do atacante para que duas civilizações não partilhem o mesmo sorteio.
 const r=rand(s.rngSeed+idx+s.era*37+civ.index*7919)();let win=r<0.82;
 // Tutorial: resultado fixado para o próximo ataque desta civilização.
 if(s.forcedAttack&&s.forcedAttack.owner===owner){win=!!s.forcedAttack.win;s.forcedAttack=null}
 civ.military=Math.max(0,civ.military-need*(win?cfg.military.winCost:cfg.military.lossCost));
 const isPlayer=owner==="player";
 if(win){
  const loot=targetOwner!=="neutral"?pillage(s,targetOwner,owner,cfg):null;
  s.owners[idx]=owner;civ.attacks.wins++;if(targetOwner==="neutral")civ.attacks.neutralConquests++;else civ.attacks.enemyConquests++;
  if(isPlayer){s.attacks.playerWins++;if(targetOwner==="neutral")s.attacks.neutralConquests++;else s.attacks.enemyConquests++}else s.attacks.aiWins++;
  addLog(s,`${isPlayer?"✅ Ataque bem-sucedido":"⚔️ "+civ.name+" conquistou"}: território ${idx+1} (${targetOwner==="neutral"?"neutro":"de "+ownerLabel(s,targetOwner).replace(/^Seu$/,"Jogador")})${loot&&(loot.gold+loot.infra+loot.tech)>0?` — saque: ${fmtCore(loot.gold)} u. de tesouro, ${fmtCore(loot.infra)} u. de infraestrutura`+(loot.tech>0?`, ${fmtCore(loot.tech)} de progresso tecnológico`:""):""}.`);
  return {ok:true,win:true,spent:need};
 }
 civ.attacks.losses++;if(isPlayer)s.attacks.playerLosses++;else s.attacks.aiLosses++;
 addLog(s,`${isPlayer?"❌ Ataque malsucedido":"🛡️ Ataque de "+civ.name+" repelido"}: território ${idx+1}; ${fmtCore(need)} pontos comprometidos.`);return {ok:true,win:false,spent:need};
}
/* Ordens simultâneas: durante a era cada civilização dá no máximo UMA ordem de ataque; o poder militar
   necessário fica reservado. No fim da era as ordens resolvem-se juntas, por território, numa ordem sorteada:
   • se várias civilizações miram o mesmo território há uma BATALHA: vence a de maior força
     (poder militar + battleTechWeight × progresso tecnológico); as outras perdem o poder reservado;
   • se o alvo mudou de dono entretanto, o ataque segue contra o novo dono quando o poder chega;
   • se já não é possível atacar (perdeu o vizinho, poder insuficiente), a ordem cai e o poder volta. */
// Custo de cada ordem adicional na mesma era: k-ésima ordem extra custa ×(1 + passo × k) (passo 1: 2.ª ×2, 3.ª ×3).
// Mapas maiores (state.mapSize 2–4): o passo divide-se pelo fator de área k = regiões/24 no 1×1 (2.ª ordem ×1,5 no 2×,
// ×1,25 no 4×) e por √k com 2+ rivais (×1,71 no 2×, ×1,5 no 4×). Sem isto, a expansão pelas regiões livres ficava lenta
// para o tamanho do mapa, o contacto só vinha por volta da era 30 e as economias que se acumulam (Equilibrado/Científico)
// ganhavam quase sempre no 1×1 (86–90%). Com 2+ rivais o √k basta (÷k deixava o Agressivo forte demais).
// s é opcional: sem estado (ou no mapa de sempre) o passo é o da configuração.
export function orderStep(cfg,s){const k=mapAreaFactor(s),step=cfg.military.extraOrderCostStep||0;if(k===1)return step;return step/(s.civs?.length>2?Math.sqrt(k):k)}
export function orderCostMultiplier(cfg,k,s){return 1+orderStep(cfg,s)*k}
export function orderAttack(s,idx,owner,cfg){
 const civ=getCiv(s,owner);if(!civ||!civ.active)return {ok:false,reason:"Civilização inexistente ou inativa."};
 s.orders??=[];
 const max=cfg.military.maxOrdersPerEra||Infinity;let mine=s.orders.filter(o=>o.owner===owner);
 if(mine.some(o=>o.idx===idx))return {ok:false,reason:"Já há uma ordem para este território."};
 // Com 1 ordem por era, uma nova ordem substitui a anterior.
 let replaced=null;if(mine.length>=max){if(max!==1)return {ok:false,reason:`Máximo de ${max} ordens por era.`};replaced=mine[0];civ.military+=replaced.need;s.orders=s.orders.filter(o=>o!==replaced);mine=[]}
 const undo=()=>{if(replaced){civ.military-=replaced.need;s.orders.push(replaced)}};
 if(idx<0||idx>=s.owners.length||s.owners[idx]===owner||!adjacentOwned(s,idx,owner)){undo();return {ok:false,reason:"Alvo não é adjacente ou já pertence ao atacante."}}
 const base=attackNeed(s,idx,owner,cfg),mult=orderCostMultiplier(cfg,mine.length,s),need=base*mult;
 if(civ.military+1e-9<need){undo();return {ok:false,reason:`Poder insuficiente: precisa de ${fmtCore(need)} pontos${mult>1?` (${mine.length+1}.º ataque da era, custo ×${fmtCore(mult,1)})`:""}.`}}
 const power=civ.military+(cfg.military.battleTechWeight||0)*(civ.techProgress||0);
 civ.military-=need;s.orders.push({idx,owner,need,base,mult,step:orderStep(cfg,s),power,era:s.era,target:s.owners[idx]});
 return {ok:true,queued:true,need,mult};
}
// Cancela a ordem (do território idx, ou a última) e recalcula o custo das restantes, que podem ficar mais baratas.
export function cancelOrder(s,owner,idx){
 const mine=(s.orders||[]).filter(x=>x.owner===owner),o=idx==null?mine.at(-1):mine.find(x=>x.idx===idx);if(!o)return false;
 const c=getCiv(s,owner);if(c)c.military+=o.need;s.orders=s.orders.filter(x=>x!==o);
 s.orders.filter(x=>x.owner===owner).forEach((x,k)=>{const m=1+(x.step||0)*k,n=(x.base??x.need)*m;if(c)c.military+=x.need-n;x.mult=m;x.need=n});
 return true;
}
export function resolveOrders(s,cfg,era){
 const q=s.orders||[];s.orders=[];if(!q.length)return [];
 // Força guardada (defesa): a Força livre de cada um ANTES de devolver as reservas fica fixa durante a resolução.
 garrisonSnapshot={s,f:Object.fromEntries(s.civs.map(c=>[c.id,c.military]))};
 try{return resolveQueue(s,cfg,era,q)}finally{garrisonSnapshot=null}
}
function resolveQueue(s,cfg,era,q){
 for(const o of q){const c=getCiv(s,o.owner);if(c)c.military+=o.need}   // devolve a reserva; o ataque real volta a cobrar
 const groups={};for(const o of q)(groups[o.idx]??=[]).push(o);
 const keys=Object.keys(groups),rng=rand(s.rngSeed+era*101+7);
 for(let i=keys.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[keys[i],keys[j]]=[keys[j],keys[i]]}
 const name=id=>id==="player"?"Você":getCiv(s,id)?.name||id,events=[];
 for(const k of keys){
  const all=groups[k],idx=Number(k);let g=all.filter(o=>getCiv(s,o.owner)?.active&&s.owners[idx]!==o.owner&&adjacentOwned(s,idx,o.owner));
  for(const o of all)if(!g.includes(o)){addLog(s,`↩️ Ordem de ${name(o.owner)} contra o território ${idx+1} cancelada (já não é possível atacar); poder devolvido.`);events.push({type:"cancel",owner:o.owner,idx})}
  if(!g.length)continue;
  if(g.length>1){
   g.sort((a,b)=>b.power-a.power||(rng()-.5));
   for(const l of g.slice(1)){const c=getCiv(s,l.owner);c.military=Math.max(0,c.military-l.need*cfg.military.lossCost);addLog(s,`⚔️ Batalha pelo território ${idx+1}: ${name(g[0].owner)} venceu ${name(l.owner)} (força ${fmtCore(g[0].power,0)} × ${fmtCore(l.power,0)}); ${name(l.owner)} perdeu ${fmtCore(l.need)} pontos.`);events.push({type:"battleLost",owner:l.owner,winner:g[0].owner,idx})}
   g=[g[0]];
  }
  const o=g[0],c=getCiv(s,o.owner),base=attackNeed(s,idx,o.owner,cfg),need=base*(o.mult||1),now=s.owners[idx];
  if(c.military+1e-9<need){addLog(s,`↩️ Ordem de ${name(o.owner)} contra o território ${idx+1} cancelada: o alvo mudou de dono e a defesa subiu para ${fmtCore(need)}; poder devolvido.`);events.push({type:"cancel",owner:o.owner,idx});continue}
  if(now!==o.target)events.push({type:"retarget",owner:o.owner,idx,from:o.target,to:now});
  const r=attackTerritory(s,idx,o.owner,cfg,true);
  // Ataque adicional da era: paga também o custo extra (ganhe ou perca).
  if((o.mult||1)>1)c.military=Math.max(0,c.military-((o.mult||1)-1)*base);
  events.push({type:r.win?"win":"loss",owner:o.owner,idx,from:now});
 }
 return events;
}
