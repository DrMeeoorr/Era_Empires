// Mapa: posições iniciais, vizinhança (grelha de mapColsFor(n) colunas: 6 no mapa de sempre, 8/10/12 nos maiores), alvos possíveis e contagem de territórios.
import {mapColsFor} from "./config.js";

/* ─────────────── Civilizações ───────────────
   O estado guarda uma lista de civilizações (2 a 1+MAX_AI). A primeira é sempre o
   jogador ("player"); as seguintes são IAs ("ai", "ai2", "ai3", ...). Os ids são os
   mesmos valores usados em state.owners, ao lado de "neutral". */
export function civIds(aiCount){const ids=["player"];for(let k=1;k<=aiCount;k++)ids.push(k===1?"ai":"ai"+k);return ids}
// cols: colunas da grade (6 no mapa de sempre; ver mapColsFor para os mapas maiores).
export function gridDist(a,b,cols=6){const ra=Math.floor(a/cols),ca=a%cols,rb=Math.floor(b/cols),cb=b%cols;return Math.abs(ra-rb)+Math.abs(ca-cb)}
// Posições iniciais determinísticas: jogador no primeiro território, 1ª IA no último
// (como no MVP original) e as restantes o mais afastadas possível das já escolhidas.
// Mapa de 24 regiões (6×4): ordem fixa START_ORDER_24 (rodada de balanceamento de 20/11/2026). Antes a 4.ª posição
// era Pedral, no centro, espremida por todos (4–11% de vitória com 4–6 impérios); agora as 5 primeiras ficam na borda.
// Posição inicial aleatória (rng): o jogador começa num território sorteado e cada civilização seguinte
// fica no território mais afastado das já colocadas (mesma regra), com empates sorteados.
// Arvela, Zênite, Esmera, Torva, Musgo, Ombral (2 e 3 impérios: as mesmas de antes).
export const START_ORDER_24=Object.freeze([0,23,4,18,11,13]);
/* Mapas maiores (2×/3×/4×) com 4–6 impérios: posições escolhidas, perto da borda e espalhadas, medidas em partidas só de
   IAs com as posições rodadas entre os lugares (22/11/2026). Com a regra "o mais afastado possível" um império ficava no
   centro e vencia 2–6% (justo: 17–25%); diferença entre a melhor e a pior posição 26–45 pontos → 7–24.
   Com 1–3 impérios (e no mapa de 24) a regra é a de sempre. */
export const START_ORDERS_BIG=Object.freeze({
 48:Object.freeze({4:[3,23,44,24],5:[11,22,37,34,17],6:[10,12,22,37,35,25]}),
 70:Object.freeze({4:[12,18,57,51],5:[14,28,57,52,21],6:[12,16,28,57,53,41]}),
 96:Object.freeze({4:[5,47,90,48],5:[17,34,81,75,25],6:[15,20,58,80,75,37]}),
});
export function startPositions(n,count,rng=null){
 const cols=mapColsFor(n),dist=(a,b)=>gridDist(a,b,cols);
 if(rng){const pos=[Math.floor(rng()*n)];
  while(pos.length<count){let bestD=-1,cands=[];for(let i=0;i<n;i++){if(pos.includes(i))continue;const d=Math.min(...pos.map(p=>dist(i,p)));if(d>bestD){bestD=d;cands=[i]}else if(d===bestD)cands.push(i)}pos.push(cands[Math.floor(rng()*cands.length)])}
  return pos}
 if(n===24&&count<=START_ORDER_24.length)return START_ORDER_24.slice(0,count);
 if(START_ORDERS_BIG[n]?.[count])return START_ORDERS_BIG[n][count].slice();
 const pos=[0];if(count>1)pos.push(n-1);
 while(pos.length<count){let best=-1,bestD=-1;for(let i=0;i<n;i++){if(pos.includes(i))continue;const d=Math.min(...pos.map(p=>dist(i,p)));if(d>bestD){best=i;bestD=d}}pos.push(best)}
 return pos;
}
// Semente das posições aleatórias: deriva da semente da simulação (SEED) e de opts.startSeed (0 nos
// laboratórios e testes, logo reprodutível; sorteado e guardado em cada nova partida do jogo).
export function startSeedFor(cfg,startSeed=0){return ((Number(cfg.simulation.seed)>>>0)^(Number(startSeed)>>>0)^0x5bd1e995)>>>0}
export const countTerritories=(s,id)=>s.owners.reduce((a,o)=>a+(o===id?1:0),0);
// Vizinhas na grade de n regiões (colunas: mapColsFor(n) — 6 no mapa de sempre).
export function neighbors(i,n){let cols=mapColsFor(n),r=Math.floor(i/cols),c=i%cols,a=[];if(c>0)a.push(i-1);if(c<cols-1&&i+1<n)a.push(i+1);if(r>0)a.push(i-cols);if(i+cols<n)a.push(i+cols);return a}
export function adjacentOwned(s,idx,owner){return neighbors(idx,s.owners.length).some(j=>s.owners[j]===owner)}
export function eligibleTargets(s,owner="player"){return s.owners.map((o,i)=>({o,i})).filter(x=>x.o!==owner&&adjacentOwned(s,x.i,owner))}
