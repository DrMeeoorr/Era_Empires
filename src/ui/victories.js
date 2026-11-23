// Tipos de vitória que o jogador escolhe antes da partida (config.endgame.victories = {dominion, supremacy, discovery,
// wonder}; padrão tudo ligado = jogo de sempre). Eliminação e pontos no fim valem sempre. Grande Descoberta e Maravilha
// só existem nos mapas 2×–4×. Só leitura: as regras são do motor; aqui a interface decide o que mostrar.
// Lê o motor de forma defensiva (activeVictories / victoryTypes, quando existirem); sem eles, usa a configuração.
import {state,configApplied} from "../app/session.js";
import * as CORE_CONFIG from "../core/config.js";
import * as CORE_ENDGAME from "../core/endgame.js";

export const VICTORY_KEYS=["dominion","supremacy","discovery","wonder"];
export const VICTORY_NAMES={dominion:"Domínio",supremacy:"Supremacia",discovery:"Grande Descoberta",wonder:"Maravilha da Humanidade"};
export const VICTORY_SHORT={dominion:"Domínio",supremacy:"Supremacia",discovery:"Descoberta",wonder:"Maravilha"};
// Só nos mapas maiores (2×–4×).
export const BIG_ONLY=new Set(["discovery","wonder"]);
export const victoryAvailable=(id,mapSize)=>!BIG_ONLY.has(id)||Number(mapSize)>1;
const coreFn=name=>[CORE_ENDGAME,CORE_CONFIG].map(m=>m[name]).find(f=>typeof f==="function")||null;

// Escolhas de uma configuração (o que o jogador marcou), sem olhar o tamanho do mapa.
export function victoriesOfConfig(cfg){
 const v=cfg?.endgame?.victories,out={};
 for(const k of VICTORY_KEYS)out[k]=!(v&&typeof v==="object"&&v[k]===false);
 if(cfg?.endgame?.supremacyEnabled===false)out.supremacy=false;   // saves antigos do modo Conquista (sem supremacia)
 return out;
}
// A vitória vale nesta partida? (motor primeiro; senão a configuração da partida + as regras ativas no estado)
export function victoryOn(id,s=state){
 const f=coreFn("activeVictories");
 if(f&&s){try{const a=f(s,configApplied);
  if(Array.isArray(a))return a.includes(id);
  if(a instanceof Set)return a.has(id);
  if(a&&typeof a==="object"&&id in a)return !!a[id];
 }catch(_){}}
 const c=victoriesOfConfig(configApplied);
 if(id==="discovery")return c.discovery&&!!s&&!!CORE_ENDGAME.greatDiscoveryActive?.(s);
 if(id==="wonder")return c.wonder&&!!s&&!!CORE_ENDGAME.wonderActive?.(s);
 return !!c[id];
}
// Desligáveis ligadas num tamanho de mapa (Personalizar).
export const effectiveVictories=(v,mapSize)=>VICTORY_KEYS.filter(k=>v[k]&&victoryAvailable(k,mapSize));
// Mostra/esconde elementos marcados com data-victory-only="dominion" etc. (Como jogar e regras completas) conforme a
// partida atual. Sem partida (ou no Original para Descoberta/Maravilha), tudo continua visível como texto de regra.
export function applyVictoryVisibility(s=state){
 document.querySelectorAll("[data-victory-only]").forEach(el=>{const id=el.dataset.victoryOnly;
  // As regras de Descoberta/Maravilha continuam visíveis como informação geral quando a partida é no Original.
  const hide=!!s&&(BIG_ONLY.has(id)?(Number(s.mapSize)>1&&!victoryOn(id,s)):!victoryOn(id,s));
  el.hidden=hide});
}
