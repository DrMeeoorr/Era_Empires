// Uma era: início (receita, liberação militar), fim (investimentos, IAs, ordens, fim de partida) e simulação.
import {aiDecide} from "../ai/decide.js";
import {releaseMilitaryInvestments,invest,collectRevenue,allocateStrategy,activeTechBenefit} from "./economy.js";
import {describeResult,evaluateEndOfEra} from "./endgame.js";
import {countTerritories,eligibleTargets} from "./map.js";
import {resolveOrders,orderAttack,attackTerritory} from "./military.js";
import {P,A,aiCivs,newState} from "./state.js";
import {clone} from "./util.js";

/* Uma era tem duas fases, com o mesmo motor para todas as civilizações:
   beginEra  → avança a era, liberta pontos militares e recebe as receitas de TODAS as
               civilizações (antes de qualquer ação, para que a ordem não altere receitas);
   finishEra → decisões e ataques (jogador primeiro, depois as IAs), estatísticas, registo
               e avaliação do fim de partida.
   Entre as duas fases o jogador humano já vê a receita da era no orçamento e decide com a
   mesma informação que as IAs. processEra = beginEra + finishEra (simulações e testes). */
export function beginEra(s,cfg,opts={}){
 if(s.stopped)throw Error("Simulação interrompida por limite numérico.");
 if(s.result)throw Error("A partida já terminou: "+describeResult(s,s.result));
 if(s.pending)throw Error("A era "+s.pending.era+" já está aberta.");
 const era=s.era+1;if(!Number.isSafeInteger(era))throw Error("Limite seguro de eras do JavaScript atingido.");
 const aiOn=cfg.military.aiEnabled&&opts.ai!==false;
 const eraInvested=Object.fromEntries(s.civs.map(c=>[c.id,{military:0,infrastructure:0,technology:0}]));
 // Compatibilidade: uma alocação passada a processEra antes da era 1 é investimento inicial
 // (era 0). O jogo atual já não usa isto: o jogador decide dentro da era, como as IAs.
 const initialAllocation=s.era===0&&!!opts.playerAllocation;
 if(initialAllocation){const a=opts.playerAllocation;invest(s,"military",a.military,cfg);invest(s,"infrastructure",a.infrastructure,cfg);invest(s,"technology",a.technology,cfg);Object.assign(eraInvested.player,a)}
 s.era=era;
 // Desgaste do exército: pontos não usados na era anterior perdem uma fração (militar = curto prazo).
 if(cfg.military.decayRate>0)for(const civ of s.civs)civ.military*=1-cfg.military.decayRate;
 releaseMilitaryInvestments(s,era);
 const revenue={};
 for(const civ of s.civs){
  if(!civ.active)continue;
  if(civ.index>0&&!aiOn){revenue[civ.id]={normal:0,infra:0,tech:0,total:0,infraBy:[]};continue}
  revenue[civ.id]=collectRevenue(s,civ,era,cfg);
 }
 s.pending={era,revenue,eraInvested,initialAllocation,aiOn};
 return s.pending;
}
export function processEra(s,cfg,opts={}){
 if(!s.pending)beginEra(s,cfg,opts);
 return finishEra(s,cfg,opts);
}
export function finishEra(s,cfg,opts={}){
 if(s.result)throw Error("A partida já terminou: "+describeResult(s,s.result));
 if(!s.pending)throw Error("Não há era aberta para concluir.");
 const {era,revenue,eraInvested,initialAllocation,aiOn}=s.pending,player=P(s);
 const pr=revenue.player||{normal:0,infra:0,tech:0,total:0,infraBy:[]},preInvestBudget=player.treasury;
 if(opts.autoStrategy&&player.active)Object.assign(eraInvested.player,allocateStrategy(s,cfg,opts.autoStrategy,opts.custom||[34,33,33]));
 else if(opts.playerAllocation&&!initialAllocation&&player.active){const a=opts.playerAllocation;invest(s,"military",a.military,cfg);invest(s,"infrastructure",a.infrastructure,cfg);invest(s,"technology",a.technology,cfg);Object.assign(eraInvested.player,a)}
 releaseMilitaryInvestments(s,era);
 // Estratégias automáticas testam ativamente o retorno territorial do investimento militar.
 let playerAction="Sem ataque automático";const decisions={};
 // Lugar do jogador controlado por IA (simulações 100% IA): usa exatamente a mesma decisão das IAs.
 if(player.controller==="ai"&&player.active&&!opts.autoStrategy&&!opts.playerAllocation){decisions.player=aiDecide(s,player,cfg,era);eraInvested.player=decisions.player.investment;playerAction=decisions.player.action}
 if(opts.autoStrategy&&player.active){const targets=eligibleTargets(s,"player");if(targets.length){targets.sort((a,b)=>a.i-b.i);const t=targets[0],ar=cfg.military.simultaneousOrders?orderAttack(s,t.i,"player",cfg):attackTerritory(s,t.i,"player",cfg,true);if(ar.ok)playerAction=ar.queued?`Ordem de ataque ao território ${t.i+1}`:ar.win?`Conquistou território ${t.i+1}`:`Ataque ao território ${t.i+1} falhou`;}}
 for(const civ of aiCivs(s)){
  if(!civ.active)continue;
  if(!aiOn){decisions[civ.id]={style:civ.profile||cfg.military.aiStyle||"adaptive",action:"IA desativada",investment:{military:0,infrastructure:0,technology:0},budgetInvested:0};continue}
  decisions[civ.id]=aiDecide(s,civ,cfg,era);eraInvested[civ.id]=decisions[civ.id].investment;
 }
 // Ordens simultâneas: todos os ataques da era resolvem-se agora, juntos.
 s.lastOrderEvents=resolveOrders(s,cfg,era);
 for(const civ of s.civs){
  const terr=countTerritories(s,civ.id),rev=revenue[civ.id];
  if(rev)civ.infraTotal+=rev.infra;
  civ.techProgress=s.investments.reduce((a,i)=>a+(i.owner===civ.id&&i.type==="technology"?i.progress:0),0);
  civ.techActive=activeTechBenefit(s,era,cfg,civ.id);
  civ.maxTerritories=Math.max(civ.maxTerritories||terr,terr);civ.territoryYears=(civ.territoryYears||0)+terr;
 }
 // Histórico por era de TODAS as civilizações (base para ICE, eliminação e laboratórios).
 // dims = valores das dimensões decididos: militar = pontos disponíveis; infraestrutura =
 // receita de infraestrutura na era; tecnologia = progresso acumulado; tesouraria = saldo;
 // receita = média da receita total nas últimas 3 eras (ou nas disponíveis), usada no ICE financeiro.
 const playerDriver=opts.autoStrategy?"strategy:"+opts.autoStrategy:player.controller==="ai"?"ai:"+(decisions.player?.style||player.profile||cfg.military.aiStyle):"human";
 const prevEras=s.timeline.slice(-2);
 const entry={era,civs:s.civs.map((c,k)=>{const rev=revenue[c.id]||{normal:0,infra:0,tech:0,total:0},terr=countTerritories(s,c.id),revWindow=[...prevEras.map(e=>e.civs[k]?.revenue.total||0),rev.total];return {
  id:c.id,name:c.name,active:c.active,driver:c.index===0?playerDriver:"ai:"+(decisions[c.id]?.style||c.profile||cfg.military.aiStyle),
  territories:terr,territoryShare:terr/s.owners.length,treasury:c.treasury,military:c.military,
  revenue:{normal:rev.normal,infrastructure:rev.infra,technology:rev.tech,total:rev.total},
  invested:{...eraInvested[c.id]},investedTotal:{...c.invested},techProgress:c.techProgress,techActive:c.techActive,
  attacks:{...c.attacks},action:c.index===0?playerAction:decisions[c.id]?.action||"",
  dims:{military:c.military,infrastructure:rev.infra,technology:c.techProgress,treasury:c.treasury,revenue:revWindow.reduce((a,b)=>a+b,0)/revWindow.length,territories:terr}}})};
 s.pending=null;
 // Fim da era: avaliação central das condições de encerramento (usa o estado definitivo da era).
 evaluateEndOfEra(s,cfg,era,entry,s.endRules);
 entry.civs.forEach((r,k)=>{r.active=s.civs[k].active});
 s.timeline.push(entry);
 const ai=A(s),aiDec=decisions[ai?.id]||{action:"IA desativada",investment:{military:0,infrastructure:0,technology:0},budgetInvested:0,style:cfg.military.aiStyle||"adaptive"},aiRev=revenue[ai?.id]||{normal:0,infra:0,tech:0,total:0};
 const playerTerritories=countTerritories(s,"player");
 // Linha de histórico do ponto de vista do jogador (mantida para os painéis atuais).
 const row={era,normal:pr.normal,infra:pr.infra,tech:pr.tech,total:pr.total,budgetBefore:preInvestBudget,budget:player.treasury,military:player.military,aiMilitary:ai?.military||0,
  territories:playerTerritories,aiTerritories:ai?countTerritories(s,ai.id):0,rivalTerritories:aiCivs(s).reduce((a,c)=>a+countTerritories(s,c.id),0),playerAction,attacksTotal:clone(s.attacks),
  investments:opts.playerAllocation?clone(opts.playerAllocation):opts.autoStrategy?{strategy:opts.autoStrategy}:null,
  aiInvestment:aiDec.investment,aiRevenue:{normal:aiRev.normal,infrastructure:aiRev.infra,technology:aiRev.tech,total:aiRev.total},aiTreasury:ai?.treasury||0,infraBy:pr.infraBy,
  infraInvested:opts.playerAllocation?.infrastructure||0,techInvested:opts.playerAllocation?.technology||0,militaryInvested:opts.playerAllocation?.military||0,
  aiAction:aiDec.action,aiActions:aiCivs(s).map(c=>decisions[c.id]?.action).filter(Boolean),aiStyle:aiDec.style,aiBudgetInvested:aiDec.budgetInvested,
  attacks:s.log.filter(x=>x.era===era).map(x=>x.text),cumRevenue:0,cumInfra:0,cumTech:0,end:entry.end};
 const prev=s.history[s.history.length-1];row.cumRevenue=(prev?.cumRevenue||0)+pr.total;row.cumInfra=(prev?.cumInfra||0)+pr.infra;row.cumTech=(prev?.cumTech||0)+pr.tech;
 s.history.push(row);s.lastEraProcessed=era;
 if(s.history.length>2e6){s.stopped=true;throw Error("Histórico próximo do limite prático. Exporte os dados e reinicie uma nova sessão.")}
 return row;
}
// mode é parâmetro explícito da simulação; nunca é lido de variáveis globais.
export function simulate(strategy,eras,cfg,initialState=null,custom=[34,33,33],progressCb=null,mode="slow"){
 let s=initialState?clone(initialState):newState(cfg,{mode});
 for(let i=0;i<eras;i++){if(s.stopped||s.result)break;processEra(s,cfg,{autoStrategy:strategy,custom});if(progressCb&&i%100===0)progressCb(i+1,eras)}
 return s;
}
