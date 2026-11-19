// Partidas completas só entre IAs (laboratórios e impressão digital): lugares, sementes, duração fixa e runMatch.
import {processEra} from "./era.js";
import {newState} from "./state.js";
import {clone} from "./util.js";

/* ─────────────── Etapa 2: simulação de duração fixa (Modo A) e calibração ───────────────
   Todas as civilizações são controladas por IA. A partida corre sempre o número pedido de
   eras: nenhuma condição de fim interrompe a simulação. Os resultados alimentam a
   calibração das referências por era (mediana de todas as civilizações em cada era). */
// Rotação de perfis por lugar: em cada partida o lugar k recebe profiles[(g+k) % n].
// Com um número de partidas múltiplo de n, cada perfil ocupa cada lugar o mesmo número de vezes.
export function seatProfiles(profiles,civCount,game){return Array.from({length:civCount},(_,k)=>profiles[(game+k)%profiles.length])}
export function fixedGameSeed(baseSeed,game){return (Number(baseSeed)+game*104729)>>>0}
// Executa UMA partida de duração fixa e devolve só o histórico compacto (dimensões por era).
export function runFixedGame(cfg,{eras,mode="slow",profiles,civCount,seed,game=0}){
 const c=clone(cfg);c.simulation.seed=seed;c.military.aiEnabled=true;c.map.aiCount=civCount-1;
 const seats=seatProfiles(profiles,civCount,game);
 const s=newState(c,{mode,profiles:seats,allAI:true});
 for(let e=0;e<eras;e++){if(s.stopped)break;processEra(s,c,{})}
 return {kind:"fixed",game,seed,mode:s.mode,eras:s.era,seats,
  timeline:s.timeline.map(e=>({era:e.era,civs:e.civs.map((r,k)=>({id:r.id,profile:seats[k],territories:r.territories,ice:r.ice??null,dims:{...r.dims}}))}))};
}
// Modo B — partida com encerramento automático, todas as civilizações controladas por IA.
export function runMatch(cfg,{maxEras=cfg.endgame.maxEras,mode="slow",profiles,civCount,seed,game=0}){
 const c=clone(cfg);c.simulation.seed=seed;c.military.aiEnabled=true;c.map.aiCount=civCount-1;c.endgame.maxEras=maxEras;
 const seats=seatProfiles(profiles,civCount,game),s=newState(c,{mode,profiles:seats,allAI:true,endRules:true});
 while(!s.result&&!s.stopped&&s.era<maxEras+c.endgame.supremacyEras+1)processEra(s,c,{});
 return {kind:"auto",game,seed,mode:s.mode,seats,eras:s.era,result:s.result,state:s};
}
