// Motor dos laboratórios (sem DOM): partidas só entre IAs em registo compacto, resultados, indicadores e lotes.
import {LAB_PROFILE_NAME,AI_PROFILE_NAMES} from "../ai/profiles.js";
import {finalScores} from "../core/endgame.js";
import {processEra} from "../core/era.js";
import {seatProfiles,fixedGameSeed} from "../core/match.js";
import {quantile} from "../core/references.js";
import {newState} from "../core/state.js";
import {clone} from "../core/util.js";

/* ═══════════════ Etapa 4: laboratórios ═══════════════ */

/* ── Registo comum de partidas (usado pelos laboratórios 2 e 3) ──
   Cada partida guarda: identificação (cenário, semente, modo, tipo), perfis por lugar,
   resultado, pontuação final calculada na última era e, por era e por civilização, um
   vetor compacto com territórios, estado, ICE, dimensões, receita, investimentos e combates. */
export const RC={T:0,ACT:1,ICE:2,MIL:3,INF:4,TEC:5,TRE:6,RAVG:7,REV:8,IM:9,II:10,IT:11,W:12,L:13,NC:14,EC:15,RINF:16};
export const RC_NAMES=["territories","active","ice","military","infrastructure","technology","treasury","revenue_avg3","revenue","invested_military","invested_infrastructure","invested_technology","attack_wins_total","attack_losses_total","neutral_conquests_total","enemy_conquests_total","infrastructure_revenue"];
export function runGame(cfg,{kind="auto",eras=30,mode="slow",profiles,civCount,seed,game=0,scenario=null}){
 const c=clone(cfg);c.simulation.seed=seed;c.military.aiEnabled=true;c.map.aiCount=civCount-1;
 const seats=seatProfiles(profiles,civCount,game),s=newState(c,{mode,profiles:seats,allAI:true,endRules:kind==="auto"});
 const cap=kind==="auto"?c.endgame.maxEras+(c.endgame.extendForSupremacy?c.endgame.supremacyEras:0):eras;
 while(s.era<cap&&!s.result&&!s.stopped)processEra(s,c,{});
 const last=s.timeline.at(-1);
 const scores=last?finalScores(s.civs.map((civ,k)=>({id:civ.id,dims:last.civs[k].dims})),s.era,c):[];
 return {kind,scenario,game,seed,mode:s.mode,seats,ids:s.civs.map(x=>x.id),eras:s.era,territories:s.owners.length,
  supremacyEras:c.endgame.supremacyEras,territoryPct:c.endgame.territoryPct,
  result:s.result?clone(s.result):null,
  finalScores:scores.map((x,k)=>s.civs[k].active?x.score:0),
  rows:s.timeline.map(e=>({era:e.era,sup:e.end?.supremacy?{leader:e.end.supremacy.leader,streak:e.end.supremacy.streak,status:e.end.supremacy.status,ratio:e.end.supremacy.ratio}:null,
   tmin:e.end?.territorialMin??null,civs:e.civs.map(r=>[r.territories,r.active?1:0,r.ice??null,r.dims.military,r.dims.infrastructure,r.dims.technology,r.dims.treasury,r.dims.revenue,r.revenue.total,r.invested.military,r.invested.infrastructure,r.invested.technology,r.attacks.wins,r.attacks.losses,r.attacks.neutralConquests,r.attacks.enemyConquests,r.revenue.infrastructure])}))};
}
// Desfecho de uma partida. No Modo B vem do resultado; no Modo A (duração fixa) é o desfecho
// que teria ocorrido: primeira era em que alguma condição de vitória se verificou.
export function gameOutcome(rec){
 if(rec.kind==="auto"){const r=rec.result;if(!r)return {ended:false};return {ended:true,era:r.era,type:r.type,winners:r.winners.map(id=>rec.ids.indexOf(id)),reasons:Object.fromEntries(Object.entries(r.reasons).map(([id,v])=>[rec.ids.indexOf(id),v])),allEliminated:!!r.allEliminated}}
 for(const row of rec.rows){
  const reasons={},add=(k,w)=>((reasons[k]??=[]).push(w));
  const alive=row.civs.map((c,k)=>c[RC.T]>0?k:-1).filter(k=>k>=0);
  if(alive.length===1)add(alive[0],"elimination");
  if(row.tmin)row.civs.forEach((c,k)=>{if(c[RC.T]>=row.tmin)add(k,"territorial")});
  if(row.sup?.leader&&row.sup.streak>=rec.supremacyEras)add(rec.ids.indexOf(row.sup.leader),"supremacy");
  const ws=Object.keys(reasons).map(Number);
  if(ws.length)return {ended:true,would:true,era:row.era,type:ws.length===1?"victory":"draw",winners:ws,reasons};
 }
 return {ended:false};
}
export const OUTCOME_KEYS=[["supremacy","Supremacia","#b49aff"],["territorial","Maioria territorial","#56d6a1"],["elimination","Eliminação","#ff737b"],["score","Pontuação final","#62a8ff"],["draw","Empate","#9fb0c7"],["none","Sem encerramento","#3a4c66"]];
export const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;
export const median=a=>{if(!a.length)return NaN;const s=[...a].sort((x,y)=>x-y);return quantile(s,.5)};
// Indicadores de um conjunto de partidas (um cenário).
export function summarizeRecords(recs){
 const n=recs.length,out={games:n,kind:recs[0]?.kind,outcomes:Object.fromEntries(OUTCOME_KEYS.map(([k])=>[k,0])),reasonMentions:{supremacy:0,territorial:0,elimination:0,score:0},
  endEras:[],winnerTerrShare:[],thresholdEra:[],streaksStarted:0,streaksInterrupted:0,supremacyEra:[],ratioByEra:[],terrPerCiv:[],durationHist:{},unusedShare:[],maxEra:0};
 for(const rec of recs){
  const o=gameOutcome(rec);out.maxEra=Math.max(out.maxEra,rec.eras);
  if(!o.ended)out.outcomes.none++;
  else{
   if(o.type==="draw")out.outcomes.draw++;
   else{const rs=o.reasons[o.winners[0]]||[];const key=["supremacy","territorial","elimination","score"].find(k=>rs.includes(k));out.outcomes[key]++;
    const last=rec.rows.find(r=>r.era===o.era)||rec.rows.at(-1);out.winnerTerrShare.push(last.civs[o.winners[0]][RC.T]/rec.territories)}
   const mentioned=new Set();for(const w of o.winners)for(const r of o.reasons[w]||[])mentioned.add(r);for(const r of mentioned)out.reasonMentions[r]=(out.reasonMentions[r]||0)+1;
   out.endEras.push(o.era);out.durationHist[o.era]=(out.durationHist[o.era]||0)+1;
   if(o.winners.some(w=>(o.reasons[w]||[]).includes("supremacy")))out.supremacyEra.push(o.era);
  }
  let prev=0,th=null;
  for(const row of rec.rows){
   const st=row.sup?.streak||0;if(st===1)out.streaksStarted++;if(prev>0&&st<=prev&&prev<rec.supremacyEras&&!(st===prev+1))out.streaksInterrupted++;prev=st;
   if(row.sup?.ratio!=null){(out.ratioByEra[row.era]??=[]).push(row.sup.ratio)}
   if(th===null&&row.tmin&&row.civs.some(c=>c[RC.T]>=row.tmin))th=row.era;
   for(const c of row.civs){const avail=c[RC.TRE]+c[RC.IM]+c[RC.II]+c[RC.IT];if(c[RC.ACT]&&avail>0)out.unusedShare.push(c[RC.TRE]/avail)}
  }
  if(th!==null)out.thresholdEra.push(th);
  const last=rec.rows.at(-1);if(last)for(const c of last.civs)out.terrPerCiv.push(c[RC.T]);
 }
 out.pct=k=>n?100*out.outcomes[k]/n:0;
 out.ratioMean=out.ratioByEra.map(a=>a?mean(a):null);
 return out;
}
// Resultados por perfil: cada lugar ocupado por um perfil conta como uma observação.
export function profileStats(recs){
 const by={};
 for(const rec of recs){
  const o=gameOutcome(rec),last=rec.rows.at(-1);if(!last)continue;
  rec.seats.forEach((p,k)=>{
   const a=by[p]??={profile:p,seats:0,wins:0,draws:0,losses:0,scores:[],winEras:[],types:{},inv:[0,0,0],combats:0,wonCombats:0,conquests:0,neutral:0,enemy:0,revenueCum:0,infraRevCum:0,infraInvCum:0,finalTreasury:[],finalIce:[],finalTerr:[],eliminated:0,idleSeats:0,milShareByEra:[],byEra:[]};
   a.seats++;
   if(o.ended&&o.winners.includes(k)){if(o.type==="victory"){a.wins++;a.winEras.push(o.era);for(const r of o.reasons[k]||[])a.types[r]=(a.types[r]||0)+1}else a.draws++}else a.losses++;
   a.scores.push(rec.finalScores[k]??0);
   let idleRun=0,idle=false;
   rec.rows.forEach((row,ei)=>{const c=row.civs[k],inv=c[RC.IM]+c[RC.II]+c[RC.IT];a.inv[0]+=c[RC.IM];a.inv[1]+=c[RC.II];a.inv[2]+=c[RC.IT];a.revenueCum+=c[RC.REV];a.infraRevCum+=c[RC.RINF];a.infraInvCum+=c[RC.II];
    if(inv>0)a.milShareByEra.push(c[RC.IM]/inv);
    const avail=c[RC.TRE]+inv;if(c[RC.ACT]&&avail>0&&c[RC.TRE]/avail>.5){idleRun++;if(idleRun>=3)idle=true}else idleRun=0;
    const b=a.byEra[ei]??={n:0,military:0,infrastructure:0,technology:0,treasury:0,revenue:0,territories:0,ice:0,iceN:0};b.n++;b.military+=c[RC.MIL];b.infrastructure+=c[RC.INF];b.technology+=c[RC.TEC];b.treasury+=c[RC.TRE];b.revenue+=c[RC.REV];b.territories+=c[RC.T];if(c[RC.ICE]!=null){b.ice+=c[RC.ICE];b.iceN++}});
   const lc=last.civs[k];a.combats+=lc[RC.W]+lc[RC.L];a.wonCombats+=lc[RC.W];a.conquests+=lc[RC.W];a.neutral+=lc[RC.NC];a.enemy+=lc[RC.EC];
   a.finalTreasury.push(lc[RC.TRE]);if(lc[RC.ICE]!=null)a.finalIce.push(lc[RC.ICE]);a.finalTerr.push(lc[RC.T]);if(!lc[RC.ACT])a.eliminated++;if(idle)a.idleSeats++;
  });
 }
 return Object.values(by).map(a=>{const invT=a.inv[0]+a.inv[1]+a.inv[2]||1,erasN=a.byEra.reduce((x,b)=>x+b.n,0)||1;return {...a,
  winRate:a.wins/a.seats,drawRate:a.draws/a.seats,meanScore:mean(a.scores),meanWinEra:mean(a.winEras),shares:a.inv.map(v=>v/invT),
  combatsPerGame:a.combats/a.seats,successRate:a.combats?a.wonCombats/a.combats:NaN,conquestsPerGame:a.conquests/a.seats,
  infraConversion:a.infraInvCum?a.infraRevCum/a.infraInvCum:NaN,meanFinalIce:mean(a.finalIce),meanFinalTerr:mean(a.finalTerr),meanFinalTreasury:mean(a.finalTreasury),
  revenuePerGame:a.revenueCum/a.seats,eliminatedRate:a.eliminated/a.seats,idleRate:a.idleSeats/a.seats,
  milShareStd:Math.sqrt(mean(a.milShareByEra.map(v=>(v-mean(a.milShareByEra))**2)))}});
}
// Consolidado = média simples entre perfis (cada perfil com o mesmo peso).
export function consolidateProfiles(stats,keys){return Object.fromEntries(keys.map(k=>[k,mean(stats.map(s=>s[k]).filter(Number.isFinite))]))}
export const profileName=p=>LAB_PROFILE_NAME[p]||AI_PROFILE_NAMES[p]||p;
// Executa uma lista de tarefas de partidas em lotes assíncronos, com progresso e cancelamento.
export async function runGameJobs(jobs,onProgress,shouldCancel,roundSize=1){
 const done=[],start=Date.now();
 for(let i=0;i<jobs.length;i+=roundSize){
  if(shouldCancel())break;
  const round=jobs.slice(i,i+roundSize).map(j=>runGame(j.cfg,j.opts));done.push(...round);
  if(done.length%Math.max(roundSize,4)<roundSize||i+roundSize>=jobs.length){onProgress(done.length,jobs.length,Date.now()-start);await new Promise(r=>setTimeout(r,0))}
 }
 return done;
}
// Construtor único de tarefas: os laboratórios 2 e 3 geram as mesmas partidas para as mesmas
// sementes, configuração e perfis (partida g → semente g, rotação de perfis g).
export function buildJobs(cfg,opts,{scenario=null,mode=opts.mode}={}){return Array.from({length:opts.games},(_,g)=>({cfg,opts:{kind:opts.kind,eras:opts.eras,mode,profiles:opts.profiles,civCount:opts.civCount,seed:fixedGameSeed(opts.baseSeed,g),game:g,scenario}}))}
// Estimativa de memória: cada linha guarda um vetor de 17 números por civilização e era.
export function estimateRows(opts,scenarios,cfgs){const eras=opts.kind==="fixed"?opts.eras:Math.max(...cfgs.map(c=>c.endgame.maxEras+(c.endgame.extendForSupremacy?c.endgame.supremacyEras:0)));return opts.games*scenarios*eras*opts.civCount}
export const ROW_WARN=3e6;
