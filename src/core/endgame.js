// Fim de partida: maioria territorial, eliminação, supremacia (ICE), pontuação final e descrição do resultado.
import {countTerritories} from "./map.js";
import {DEFAULT_REFERENCES,refAt} from "./references.js";
import {addLog,getCiv} from "./state.js";
import {clamp,clone} from "./util.js";

/* ─────────────── Etapa 3: condições de fim de partida ───────────────
   Uma única implementação central, chamada por processEra depois de TODAS as ações da era
   (receitas, investimentos, combates e alterações territoriais). Ordem da avaliação:
   1) eliminação imediata de quem ficou sem territórios (definitiva);
   2) condições de vitória avaliadas em conjunto: eliminação de todos os adversários,
      maioria territorial e supremacia (ICE) — sem prioridade entre elas;
   3) se ninguém venceu e a era é a última: pontuação final por recursos.
   Uma civilização com vários motivos = uma vitória com todos os motivos;
   civilizações diferentes ao mesmo tempo = empate. */
export const END_REASON_NAMES={territorial:"maioria territorial",elimination:"eliminação dos adversários",supremacy:"supremacia",score:"pontuação final por recursos",allEliminated:"todas as civilizações eliminadas"};
export const SCORE_DIMS=[["military","scoreWMilitary","scoreCapMilitary"],["infrastructure","scoreWInfrastructure","scoreCapInfrastructure"],["technology","scoreWTechnology","scoreCapTechnology"],["treasury","scoreWTreasury","scoreCapTreasury"],["territories","scoreWTerritory","scoreCapTerritory"]];
export const refsFor=(cfg,set)=>cfg.references?.[set]||DEFAULT_REFERENCES[set];
// 3.1 — mínimo de territórios: ⌈p × T⌉ (tolerância numérica para p×T inteiro, ex.: 0,8×25).
/* Duração "Sem limite" (21/11/2026, Nova partida → Personalizar → Duração): a partida termina por domínio, eliminação ou
   supremacia; o teto de segurança (100 eras) decide por pontos. A supremacia começa a contar na era 15 (a mesma era de
   uma partida padrão de 30 eras), em vez de metade do limite (50). Gravado na partida (state.unlimited). */
export const UNLIMITED={maxEras:100,supremacyFromEra:15};
// Teto de segurança do Sem limite por tamanho do mapa (config.map.mapSize): 100 no Original, +25 por tamanho acima
// (125, 150, 175). Nos mapas maiores as partidas duram mais; com 100 algumas (4×, 3–5 rivais) chegavam ao teto.
export function unlimitedMaxEras(mapSize=1){const k=[1,2,3,4].includes(Number(mapSize))?Number(mapSize):1;return UNLIMITED.maxEras+25*(k-1)}
// Rivais recomendados (mínimo) por tamanho do mapa. Só uma recomendação para a interface mostrar: o jogador escolhe.
// Com 2+ rivais nos mapas maiores reagir à situação rende muito mais (+17 a +35 pontos) e o 4× com 1–2 rivais passa
// de 95–100 ordens de ataque por partida (ver docs/decisoes.md).
export const RECOMMENDED_RIVALS=Object.freeze({1:1,2:2,3:2,4:3});
export function recommendedRivals(mapSize=1){return RECOMMENDED_RIVALS[Number(mapSize)]??1}
// Primeira era em que a supremacia pode contar.
export const unlimitedMaxErasOf=s=>unlimitedMaxEras(s?.mapSize);
export function supremacyMinEra(s,cfg){return s?.unlimited?UNLIMITED.supremacyFromEra:Math.ceil((cfg.endgame.supremacyMinEraShare||0)*s.maxEras)}
/* Domínio com escolha (21/11/2026): só nas partidas do jogador humano (state.dominion, criado por app/session.js;
   laboratórios, IAs e saves antigos não o têm e encerram na hora, como antes). Quando o JOGADOR chega a 70% antes da
   última era e nada mais decide a era, a partida pára (sem abrir a era seguinte) com state.dominion.ask = era, à espera
   de "Vencer agora" ou "Continuar até a era N" (resolveDominion). Continuando, a pergunta só volta se o jogador cair
   abaixo de 70% e voltar a subir; no limite de eras, quem tiver 70% vence por domínio (regra de sempre).
   Rival a 70%: vence na hora. Sem limite: o jogador também vence na hora (não há fim para onde continuar). */
export function dominionAsking(s){return !!(s&&!s.result&&s.dominion&&typeof s.dominion==="object"&&Number.isInteger(s.dominion.ask))}
export function territorialMinimum(total,pct){return Math.max(1,Math.ceil(pct*total-1e-9))}
// Base de cálculo: todos os territórios existentes (próprios, de rivais e neutros).
// Ainda não existem territórios destruídos/disputados no MVP; quando existirem, o
// denominador será owners.filter(existente).length e os disputados contam como neutros.
export function territoryBase(s){return s.owners.length}
export function territorialCheck(s,cfg,candidates){
 const total=territoryBase(s),min=territorialMinimum(total,cfg.endgame.territoryPct);
 return {total,min,winners:candidates.filter(c=>countTerritories(s,c.id)>=min).map(c=>c.id)};
}
// 5.4 — normalização logarítmica do ICE com piso mínimo depois da normalização.
export function iceNorm(x,ref,floor){if(!Number.isFinite(x)||!(ref>0))return NaN;return Math.max(floor,Math.log1p(Math.max(0,x))/Math.log1p(ref))}
// 5.2/5.3 — ICE = M^wM · I^wI · T^wT · F^wF · Terr^wTerr ; F = N(tesouraria)^0,4 · N(receita média)^0,6.
// A dimensão territorial foi acrescentada no balanceamento (o ganho do militar são os territórios).
// Devolve null quando falta informação (dados ausentes ou referência inválida): ICE não calculável.
export function computeICE(dims,era,cfg,refs=refsFor(cfg,"ice")){
 if(!dims||!refs)return null;const g=cfg.endgame,f=g.iceFloor,n=d=>iceNorm(dims[d],refAt(refs,d,era),f);
 const M=n("military"),I=n("infrastructure"),T=n("technology"),Nt=n("treasury"),Nr=n("revenue"),Tr=(g.iceWTerritory??0)>0?n("territories"):1; // peso 0: dimensão ignorada (dados não exigidos)
 if(![M,I,T,Nt,Nr,Tr].every(Number.isFinite))return null;
 const F=Math.pow(Nt,g.financeTreasuryWeight)*Math.pow(Nr,1-g.financeTreasuryWeight);
 const ice=Math.pow(M,g.iceWMilitary)*Math.pow(I,g.iceWInfrastructure)*Math.pow(T,g.iceWTechnology)*Math.pow(F,g.iceWFinance)*Math.pow(Tr,g.iceWTerritory??0);
 return Number.isFinite(ice)?{ice,parts:{military:M,infrastructure:I,technology:T,finance:F,territories:Tr}}:null;
}
export function iceMinimumAt(cfg,era){const arr=cfg.endgame.iceMinByEra;return Array.isArray(arr)&&arr.length?Number(arr[clamp(era,1,arr.length)-1]):cfg.endgame.iceMinAbsolute}
/* 5.6–5.10 — supremacia. ices: [{id, ice|null}] das civilizações ativas.
   - algum ICE não calculável → avaliação suspensa (sequência preservada, sem incrementar);
   - empate na liderança dentro da margem → sem líder único, sequência reiniciada;
   - condição: 2º ≤ limite × líder E líder ≥ ICE mínimo da era; líder diferente = nova contagem;
   - vitória quando a sequência atinge o número configurado de eras consecutivas. */
export function evaluateSupremacy(prev,ices,era,cfg){
 const g=cfg.endgame,base={leader:prev?.leader??null,streak:prev?.streak??0};
 if(ices.length<2)return {...base,status:"notApplicable",achieved:false};
 if(ices.some(x=>!x||x.ice===null||!Number.isFinite(x.ice)))return {...base,status:"suspended",achieved:false};
 const sorted=[...ices].sort((a,b)=>b.ice-a.ice),lead=sorted[0],second=sorted[1];
 if(lead.ice<=0||lead.ice-second.ice<=g.leaderTieMargin*lead.ice)return {leader:null,streak:0,status:"tiedLeadership",achieved:false,second:second.ice,leaderIce:lead.ice};
 const ratio=second.ice/lead.ice,minAbs=iceMinimumAt(cfg,era),ok=ratio<=g.supremacyRelative+1e-12&&lead.ice>=minAbs;
 if(!ok)return {leader:lead.id,streak:0,status:ratio>g.supremacyRelative?"gapTooSmall":"belowMinimum",achieved:false,ratio,leaderIce:lead.ice,minAbs};
 const streak=(base.leader===lead.id?base.streak:0)+1;
 return {leader:lead.id,streak,status:"counting",achieved:streak>=g.supremacyEras,ratio,leaderIce:lead.ice,minAbs};
}
// 6 — pontuação final: média aritmética ponderada das dimensões normalizadas e limitadas.
// rows: [{id, dims}] das civilizações ativas no fim da última era. Zero = 0 (sem piso).
export function scoreNorm(x,ref,method){if(!(x>0))return 0;if(!(ref>0))return NaN;return method==="linear"?x/ref:Math.log1p(x)/Math.log1p(ref)}
export function finalScores(rows,era,cfg,refs=refsFor(cfg,"score")){
 const g=cfg.endgame;
 return rows.map(r=>{const parts={};let total=0;for(const [d,wk,ck] of SCORE_DIMS){// Territórios contam de forma proporcional (o dobro de territórios = o dobro dos pontos nesta área);
  // a escala logarítmica comprimia a diferença e quem dominava o mapa podia perder por pontos.
  const v=Math.min(g[ck],scoreNorm(r.dims[d],refAt(refs,d,era),d==="territories"&&g.scoreTerritoryProportional!==false?"linear":g.scoreNormalization));parts[d]=v;total+=g[wk]*v}return {id:r.id,score:total,parts}});
}
export function scoreWinners(scores,margin){if(!scores.length)return [];const max=Math.max(...scores.map(s=>s.score));if(!Number.isFinite(max))return [];return scores.filter(s=>s.score>=max*(1-margin)-1e-12).map(s=>s.id)}
// Monta o resultado a partir de {civId: [motivos]}.
export function buildResult(era,reasonsById,extra={}){
 const winners=Object.keys(reasonsById);
 return {era,type:winners.length===1?"victory":"draw",winners,reasons:reasonsById,...extra};
}
/* Avaliação central do fim da era. apply=false (duração fixa): calcula e regista tudo
   (ICE, sequência, condições que seriam atingidas) mas não elimina nem encerra. */
export function evaluateEndOfEra(s,cfg,era,entry,apply=true){
 const g=cfg.endgame,out={eliminated:[],wouldEliminate:[],territorial:null,supremacy:null,result:null};
 // 1) Eliminação imediata e definitiva (decisões 2 e 7).
 for(const civ of s.civs)if(civ.active&&countTerritories(s,civ.id)===0){if(apply){civ.active=false;civ.eliminatedEra=era;out.eliminated.push(civ.id);addLog(s,`☠️ ${civ.name} perdeu o último território e foi eliminada.`)}else out.wouldEliminate.push(civ.id)}
 const active=s.civs.filter(c=>c.active&&!(!apply&&out.wouldEliminate.includes(c.id)));
 const rowOf=id=>entry.civs.find(r=>r.id===id);
 // ICE de todas as civilizações (registado sempre, mesmo quando não decide nada).
 const ices=active.map(c=>{const r=computeICE(rowOf(c.id)?.dims,era,cfg);const row=rowOf(c.id);if(row){row.ice=r?r.ice:null;row.iceParts=r?r.parts:null}return {id:c.id,ice:r?r.ice:null}});
 const reasons={},add=(id,why)=>{(reasons[id]??=[]).includes(why)||reasons[id].push(why)};
 // 2a) Todas eliminadas na mesma era → empate geral.
 if(apply&&active.length===0){out.result={era,type:"draw",winners:[],reasons:{},allEliminated:true};}
 else{
  // 2b) Eliminação de todos os adversários.
  if(s.civs.length>1&&active.length===1)add(active[0].id,"elimination");
  // 2c) Maioria territorial.
  out.territorial=territorialCheck(s,cfg,active);
  const dom=apply&&s.dominion&&typeof s.dominion==="object"&&getCiv(s,"player")?.controller!=="ai"?s.dominion:null,playerDom=out.territorial.winners.includes("player");
  if(dom&&!playerDom)dom.declined=false;   // caiu abaixo de 70%: se voltar a subir, pergunta de novo
  const choose=!!dom&&playerDom&&!s.unlimited&&era<s.maxEras;   // o domínio do jogador espera pela escolha
  out.territorial.winners.forEach(id=>{if(!(choose&&id==="player"))add(id,"territorial")});
  // 2d) Supremacia (só faz sentido com 2+ ativas; com 1 a vitória por eliminação é imediata).
  // Supremacia só na fase final: a sequência só conta a partir de uma fração do limite de eras e
  // quando restam poucos territórios livres (neutros). Fora disso: "notYet", sequência a zero.
  const neutralShare=countTerritories(s,"neutral")/territoryBase(s),minEra=supremacyMinEra(s,cfg);
  // Modo Conquista: supremacia desligada; só a maioria territorial, a eliminação ou a pontuação na última era decidem.
  out.supremacy=g.supremacyEnabled===false?{leader:null,streak:0,status:"off",achieved:false}:(era<minEra||neutralShare>(g.supremacyMaxNeutralShare??1)+1e-12)?{leader:null,streak:0,status:"notYet",achieved:false,minEra,neutralShare}:evaluateSupremacy(s.supremacy,ices,era,cfg);
  if(out.supremacy.achieved)add(out.supremacy.leader,"supremacy");
  if(apply){
   s.supremacy={leader:out.supremacy.leader,streak:out.supremacy.streak,status:out.supremacy.status};
   // Domínio do jogador antes da última era: se outra condição decide a era, conta junto (como antes); senão pergunta
   // (uma vez por subida a 70%) ou, se ele já decidiu continuar, a partida segue.
   if(choose){if(Object.keys(reasons).length)add("player","territorial");else if(!dom.declined){dom.ask=era;out.dominionAsk=true}}
   if(Object.keys(reasons).length)out.result=buildResult(era,reasons,dom?.continued&&reasons.player?.includes("territorial")?{dominionKept:true}:{});
   // 3) Limite de eras: só decide se nenhuma condição de vitória ocorreu (decisão 8).
   else if(era>=s.maxEras){
    const extending=g.extendForSupremacy&&s.supremacy.streak>0&&era<s.maxEras+g.supremacyEras;
    if(!extending){
     const scores=finalScores(active.map(c=>({id:c.id,dims:rowOf(c.id).dims})),era,cfg),ws=scoreWinners(scores,g.scoreTieMargin);
     out.result=buildResult(era,Object.fromEntries(ws.map(id=>[id,["score"]])),{scores});
    }else out.extended=true;
   }
  }else s.supremacy={leader:out.supremacy.leader,streak:out.supremacy.streak,status:out.supremacy.status};
 }
 if(out.result){s.result=out.result;addLog(s,"🏁 "+describeResult(s,out.result))}
 entry.end={eliminated:out.eliminated,wouldEliminate:out.wouldEliminate,territorialMin:out.territorial?.min??null,territorialWinners:out.territorial?.winners||[],
  supremacy:out.supremacy?{leader:out.supremacy.leader,streak:out.supremacy.streak,status:out.supremacy.status,ratio:out.supremacy.ratio??null}:null,
  result:out.result?clone(out.result):null,extended:!!out.extended,...(out.dominionAsk?{dominionAsk:true}:{})};
 return out;
}
// Resposta do jogador à pergunta do domínio. win=true: vitória por domínio na era da pergunta (como era antes);
// win=false: a partida segue até ao limite (quem abre a era seguinte é a sessão). Devolve false se não havia pergunta.
export function resolveDominion(s,win){
 if(!dominionAsking(s))return false;const d=s.dominion,era=d.ask;d.ask=null;
 if(win){
  const r=buildResult(era,{player:["territorial"]});s.result=r;addLog(s,"🏁 "+describeResult(s,r));
  for(const e of [s.timeline.at(-1),s.history.at(-1)])if(e&&e.era===era&&e.end){e.end.result=clone(r);delete e.end.dominionAsk}
 }else{d.declined=true;d.continued=true;addLog(s,`👑 Domínio do mapa: Jogador decidiu continuar até a era ${s.maxEras}.`)}
 return true;
}
export function describeResult(s,r){
 if(!r)return "";const nm=id=>getCiv(s,id)?.id==="player"?"Jogador":getCiv(s,id)?.name||id;
 if(r.allEliminated)return `Era ${r.era}: empate geral — todas as civilizações foram eliminadas.`;
 const why=id=>(r.reasons[id]||[]).map(x=>END_REASON_NAMES[x]).join(" + ");
 if(r.type==="victory")return `Era ${r.era}: vitória de ${nm(r.winners[0])} por ${why(r.winners[0])}${r.dominionKept?" (mantida até a última era)":""}.`;
 return `Era ${r.era}: empate entre ${r.winners.map(id=>`${nm(id)} (${why(id)})`).join(", ")}.`;
}
