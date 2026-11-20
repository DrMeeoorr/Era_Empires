// Desafios e medalhas (20/11/2026): 12 medalhas só de honra (nenhuma muda regras, números ou IAs).
// Sem DOM: os critérios leem só o estado da partida, por isso os testes podem montar estados e chamá-los.
// As medalhas conquistadas ficam guardadas no aparelho (src/platform/storage.js), numa chave por versão
// (jogador / desenvolvimento), separada do save da partida; dados danificados são ignorados (começa do zero).
import {DIFFICULTIES} from "../core/config.js";
import {countTerritories} from "../core/map.js";
import {P,aiCivs} from "../core/state.js";
import {mapTypeOf,terrainEffectsOn} from "../core/terrain.js";
import {storage} from "../platform/storage.js";

// Era limite da medalha Relâmpago e números da Muralha e do Sobrevivente (só para as medalhas; não são regras).
export const MEDAL_RULES={flashEra:18,wallHolds:3,survivorHigh:5,survivorLow:2,tideRivals:3};
const R=MEDAL_RULES;
/* Lista final (ordem da tela Medalhas). when: "tutorial" (fim do tutorial), "era" (pode sair a meio da partida,
   no resumo da era) ou "end" (no fim da partida, na tela de resultado). test(s,track) → true se o critério foi cumprido. */
const won=s=>!!s.result&&s.result.type==="victory"&&s.result.winners[0]==="player";
const why=s=>s.result?.reasons?.player||[];
const inv=s=>P(s).invested||{};
export const MEDALS=[
 {id:"passos",name:"Primeiros passos",goal:"Termine o tutorial até o último passo.",when:"tutorial",test:s=>!!s.tutorial?.done&&!s.tutorial?.skipped},
 {id:"coroa",name:"Primeira coroa",goal:"Vença uma partida.",when:"end",test:won},
 {id:"muralha",name:"Muralha",goal:`Repila ${R.wallHolds} ataques de rivais às suas regiões na mesma partida.`,when:"era",test:(s,t)=>(t?.held||0)>=R.wallHolds},
 {id:"construtor",name:"Construtor",goal:"Vença tendo investido mais em Obras do que em Militar e em Ciência.",when:"end",test:s=>won(s)&&(inv(s).infrastructure||0)>(inv(s).military||0)&&(inv(s).infrastructure||0)>(inv(s).technology||0)},
 {id:"sabio",name:"Sábio",goal:"Vença tendo investido mais em Ciência do que em Militar e em Obras.",when:"end",test:s=>won(s)&&(inv(s).technology||0)>(inv(s).military||0)&&(inv(s).technology||0)>(inv(s).infrastructure||0)},
 {id:"diplomata",name:"Diplomata",goal:"Vença sem tomar nenhuma região de um rival (só regiões livres).",when:"end",test:s=>won(s)&&(P(s).attacks?.enemyConquests||0)===0},
 {id:"relampago",name:"Relâmpago",goal:`Vença por domínio do mapa ou eliminação até a era ${R.flashEra}.`,when:"end",test:s=>won(s)&&s.result.era<=R.flashEra&&why(s).some(x=>x==="territorial"||x==="elimination")},
 {id:"hegemonia",name:"Hegemonia",goal:"Vença por supremacia (grande vantagem por várias eras seguidas).",when:"end",test:s=>won(s)&&why(s).includes("supremacy")},
 {id:"mare",name:"Contra a maré",goal:`Vença no Difícil ou no Lendário com ${R.tideRivals} rivais ou mais.`,when:"end",test:s=>won(s)&&(s.difficulty==="dificil"||s.difficulty==="hardcore")&&aiCivs(s).length>=R.tideRivals},
 {id:"explorador",name:"Explorador",goal:"Vença num mapa sorteado.",when:"end",test:s=>won(s)&&mapTypeOf(s)==="sorteado"},
 {id:"terra",name:"Terra natal",goal:"Vença com terrenos com efeito.",when:"end",test:s=>won(s)&&terrainEffectsOn(s)},
 {id:"sobrevivente",name:"Sobrevivente",goal:`Tenha ${R.survivorHigh} regiões, caia para ${R.survivorLow} ou menos e volte a ter ${R.survivorHigh}.`,when:"era",test:s=>survivorDone(s)},
];
export const MEDAL_BY_ID=Object.fromEntries(MEDALS.map(m=>[m.id,m]));
// Sobrevivente: pela linha do tempo (regiões do jogador no fim de cada era).
export function survivorDone(s){
 let high=false,low=false;
 for(const e of s.timeline||[]){const n=e.civs?.[0]?.territories;if(!Number.isFinite(n))continue;
  if(!high){if(n>=R.survivorHigh)high=true;continue}
  if(!low){if(n<=R.survivorLow)low=true;continue}
  if(n>=R.survivorHigh)return true}
 return false;
}
// Partidas que podem dar medalhas: não é o tutorial (só dá "Primeiros passos"), a dificuldade é uma das do jogador
// (não "Configurações"), os laboratórios não avançaram a partida e o lugar do jogador é humano.
export function medalsAllowed(s){
 return !!s&&!s.tutorial&&!!DIFFICULTIES[s.difficulty]&&s.difficulty!=="config"&&!s.ui?.labs&&P(s)?.controller==="human";
}
// Registo da partida (vai no save, em state.ui; o motor nunca o lê): defesas que seguraram e medalhas da partida.
export function medalTrack(s){
 if(!s.ui||typeof s.ui!=="object")s.ui={skipIdleWarning:false};
 let t=s.ui.medals;if(!t||typeof t!=="object"||Array.isArray(t))t=s.ui.medals={v:1,held:0,got:{}};
 if(!Number.isFinite(t.held))t.held=0;if(!t.got||typeof t.got!=="object"||Array.isArray(t.got))t.got={};
 return t;
}
// Depois de cada era concluída pelo jogador: conta os ataques de rivais repelidos em regiões que eram suas antes
// da era e continuam suas (o mesmo critério do "sua defesa segurou" do resumo). beforeOwners: dono de cada região
// antes de concluir a era.
export function trackEra(s,beforeOwners,era){
 const t=medalTrack(s);if(!Array.isArray(beforeOwners))return t;
 for(const e of s.log||[]){if(e.era!==era)continue;const m=/^🛡️ Ataque de (.+?) repelido: território (\d+)/.exec(e.text||"");if(!m)continue;const i=+m[2]-1;
  if(beforeOwners[i]==="player"&&s.owners[i]==="player")t.held++}
 return t;
}
// Critérios cumpridos agora (ids). phase: "era" (só as que podem sair a meio), "end" (todas menos o tutorial)
// ou "tutorial".
export function metMedals(s,phase="end"){
 if(phase==="tutorial")return s?.tutorial&&MEDAL_BY_ID.passos.test(s)?["passos"]:[];
 if(!medalsAllowed(s))return [];
 const t=medalTrack(s);
 return MEDALS.filter(m=>m.when!=="tutorial"&&(phase==="end"?true:m.when==="era")&&m.test(s,t)).map(m=>m.id);
}

/* ── Medalhas guardadas no aparelho ── */
export const MEDAL_KEYS={player:"imperios-jogador-medalhas",dev:"imperios-dev-medalhas"};
export let MEDAL_KEY=MEDAL_KEYS.player;
// {id: {era, at, diff}} das medalhas já conquistadas (em qualquer partida).
export let earnedMedals={};
export function useMedalSlot(slot){MEDAL_KEY=MEDAL_KEYS[slot]||MEDAL_KEYS.player;return MEDAL_KEY}
// Lê o texto guardado; qualquer problema (JSON inválido, formato estranho, medalha desconhecida) é ignorado.
export function parseMedals(raw){
 const out={};if(typeof raw!=="string"||!raw)return out;
 let o;try{o=JSON.parse(raw)}catch(e){return out}
 if(!o||typeof o!=="object"||o.v!==1||!o.earned||typeof o.earned!=="object"||Array.isArray(o.earned))return out;
 for(const [id,v] of Object.entries(o.earned)){if(!MEDAL_BY_ID[id])continue;const r=v&&typeof v==="object"?v:{};
  out[id]={era:Number.isFinite(r.era)?r.era:null,at:Number.isFinite(r.at)?r.at:null,diff:typeof r.diff==="string"&&DIFFICULTIES[r.diff]?r.diff:null}}
 return out;
}
export async function loadMedals(){let raw=null;try{raw=await storage.get(MEDAL_KEY)}catch(e){raw=null}earnedMedals=parseMedals(raw);return earnedMedals}
export function serializeMedals(){return JSON.stringify({v:1,earned:earnedMedals})}
export function saveMedals(){let w;try{w=storage.set(MEDAL_KEY,serializeMedals())}catch(e){w=Promise.reject(e)}return w.then(()=>true,()=>false)}
// Dá as medalhas cumpridas agora. Devolve as NOVAS desta partida: [{id,first}] (first = primeira vez no aparelho).
// Cada medalha só é anunciada uma vez por partida (state.ui.medals.got) e só é "nova" uma vez no aparelho.
export function awardMedals(s,phase="end"){
 const ids=metMedals(s,phase);if(!ids.length)return [];
 const t=medalTrack(s),out=[];let changed=false;
 for(const id of ids){
  if(t.got[id]!=null)continue;
  const first=!earnedMedals[id];t.got[id]={era:s.era,first};out.push({id,first});
  if(first){earnedMedals[id]={era:s.result?.era??s.era,at:Date.now(),diff:DIFFICULTIES[s.difficulty]?s.difficulty:null};changed=true}
 }
 if(changed)saveMedals();
 return out;
}
// Medalhas desta partida, na ordem da lista: [{id,first}].
export function matchMedals(s){const g=s?.ui?.medals?.got;if(!g||typeof g!=="object")return [];return MEDALS.filter(m=>g[m.id]!=null).map(m=>({id:m.id,first:!!g[m.id].first}))}
export const earnedCount=()=>MEDALS.filter(m=>earnedMedals[m.id]).length;
// Únicas formas de outros módulos substituírem estas variáveis (um módulo não pode reatribuir o que importa).
export function setEarnedMedals(v){earnedMedals=v&&typeof v==="object"?v:{};return earnedMedals}
// Laboratórios (só no dev.html): a partida avançada ou reconfigurada por eles deixa de valer medalhas.
export function markLabGame(s){if(s){if(!s.ui||typeof s.ui!=="object")s.ui={skipIdleWarning:false};s.ui.labs=true}}
