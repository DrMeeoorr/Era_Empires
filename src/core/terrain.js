// Terrenos do mapa (Campina, Floresta, Colinas, Montanha, Deserto, Pântano, Tundra). Por enquanto são só
// visuais: nenhuma regra do jogo os lê. Sem DOM.
// Dois tipos de mapa: "padrao" (tabela fixa, cada região tem sempre o mesmo terreno) e "sorteado" (novo a cada
// partida). O sorteio usa um gerador próprio com a sua semente (guardada no save); nunca usa o sorteio das
// batalhas (rng.js), por isso não muda nenhum resultado do jogo nem a impressão digital.
import {MAP_COLS} from "./config.js";

export const TERRAINS=["campina","floresta","colinas","montanha","deserto","pantano","tundra"];
export const TERRAIN_NAMES={campina:"Campina",floresta:"Floresta",colinas:"Colinas",montanha:"Montanha",deserto:"Deserto",pantano:"Pântano",tundra:"Tundra"};
export const TERRAIN_HINTS={campina:"Campos abertos",floresta:"Mata fechada",colinas:"Morros redondos",montanha:"Picos e rochas",deserto:"Dunas e salinas",pantano:"Charco e juncos",tundra:"Gelo e neve"};
// Mapa padrão (aprovado em 20/11/2026), na ordem das regiões: Arvela, Brumas, Cardo… Zênite.
export const DEFAULT_TERRAIN=Object.freeze(["campina","pantano","campina","colinas","campina","tundra","floresta","deserto","campina","colinas","tundra","floresta","pantano","floresta","colinas","montanha","montanha","deserto","pantano","campina","campina","floresta","montanha","campina"]);
export const MAP_TYPES=["padrao","sorteado"];
// Regras do sorteio: quantidade de cada terreno (mín.–máx.); a Campina tem também pelo menos 1 por império.
export const TERRAIN_LIMITS={campina:[5,8],floresta:[3,5],colinas:[2,5],montanha:[2,4],deserto:[1,3],pantano:[2,4],tundra:[1,3]};
const BASE_COUNT={campina:6,floresta:4,colinas:4,montanha:3,deserto:2,pantano:3,tundra:2};
const NEUTRAL=new Set(["campina","floresta","colinas"]);
export const TERRAIN_MAX_TRIES=200;

// Gerador próprio dos terrenos: a semente passa por uma mistura de bits (sementes vizinhas, como seed e seed+1,
// dão mapas bem diferentes) e depois por um gerador congruencial simples.
function mixSeed(x){x=(x>>>0)^(x>>>16);x=Math.imul(x,0x7feb352d);x^=x>>>15;x=Math.imul(x,0x846ca68b);x^=x>>>16;return x>>>0}
function terrainRng(seed){let s=mixSeed(seed)||1;return()=>(s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296}
function gridNeighbors(i,n,cols){const r=Math.floor(i/cols),c=i%cols,a=[];if(c>0)a.push(i-1);if(c<cols-1&&i+1<n)a.push(i+1);if(r>0)a.push(i-cols);if(i+cols<n)a.push(i+cols);return a}
const rowsOf=(n,cols)=>Math.ceil(n/cols);

// Problemas de um mapa sorteado (lista vazia = cumpre todas as regras). Usado pelo sorteio e pelos testes.
export function terrainProblems(list,starts=[],cols=MAP_COLS){
 const n=list.length,rows=rowsOf(n,cols),out=[],count={};
 for(const t of TERRAINS)count[t]=0;
 for(const t of list){if(!(t in count)){out.push("terreno desconhecido: "+t);continue}count[t]++}
 for(const t of TERRAINS){const [lo,hi]=TERRAIN_LIMITS[t],min=t==="campina"?Math.max(lo,starts.length):lo;if(count[t]<min||count[t]>hi)out.push(`${t}: ${count[t]} (devia ser ${min}–${hi})`)}
 list.forEach((t,i)=>{const r=Math.floor(i/cols);
  if(t==="tundra"&&r>=rows/2)out.push(`tundra fora do norte (região ${i+1})`);
  if(t==="deserto"&&r<rows/2)out.push(`deserto fora do sul (região ${i+1})`)});
 for(const s of starts){
  if(list[s]!=="campina")out.push(`região inicial ${s+1} não é Campina`);
  const nb=gridNeighbors(s,n,cols);
  if(nb.filter(j=>NEUTRAL.has(list[j])).length<2)out.push(`região inicial ${s+1} com menos de 2 vizinhas de Campina/Floresta/Colinas`);
  if(nb.filter(j=>list[j]==="montanha").length>1)out.push(`região inicial ${s+1} com mais de 1 vizinha de Montanha`);
 }
 return out;
}
// Uma tentativa de sorteio com uma semente: quantidades variam um pouco, terrenos nascem em manchas.
function rollOnce(seed,starts,n,cols){
 const rnd=terrainRng(seed),pick=a=>a[Math.floor(rnd()*a.length)],rows=rowsOf(n,cols),N={...BASE_COUNT},minOf=t=>t==="campina"?Math.max(TERRAIN_LIMITS[t][0],starts.length):TERRAIN_LIMITS[t][0];
 for(let k=0;k<2;k++){const a=pick(TERRAINS.filter(t=>N[t]>minOf(t))),b=pick(TERRAINS.filter(t=>t!==a&&N[t]<TERRAIN_LIMITS[t][1]));N[a]--;N[b]++}
 const t=Array(n).fill(null);for(const s of starts)t[s]="campina";
 const okRow=(i,k)=>{const r=Math.floor(i/cols);return k==="tundra"?r<rows/2:k==="deserto"?r>=rows/2:true};
 // Vizinhança justa já na colocação: perto de uma região inicial só entra terreno difícil se ela ainda ficar
 // com 2 vizinhas de Campina/Floresta/Colinas e no máximo 1 de Montanha (os neutros são colocados por último).
 const fair=(i,k)=>NEUTRAL.has(k)||gridNeighbors(i,n,cols).every(s=>{if(!starts.includes(s))return true;const nb=gridNeighbors(s,n,cols);
  return nb.length-(nb.filter(j=>t[j]&&!NEUTRAL.has(t[j])).length+1)>=2&&!(k==="montanha"&&nb.some(j=>t[j]==="montanha"))});
 const free=(i,k)=>t[i]===null&&okRow(i,k)&&fair(i,k);
 for(const k of ["montanha","tundra","deserto","pantano","floresta","colinas"]){let left=N[k];const cl=[];
  while(left>0){let cand=cl.flatMap(i=>gridNeighbors(i,n,cols)).filter(i=>free(i,k));if(!cand.length||rnd()<.25)cand=[...Array(n).keys()].filter(i=>free(i,k));if(!cand.length)break;const i=pick(cand);t[i]=k;cl.push(i);left--}}
 for(let i=0;i<n;i++)if(t[i]===null)t[i]="campina";
 return t;
}
// Sorteia os terrenos: tenta a semente, depois a seguinte (seed+1, seed+2…) até cumprir todas as regras.
// Devolve {list, tries}. Se nada servir (não acontece no mapa 6×4), usa o mapa padrão.
export function rollTerrain(seed,starts=[],n=DEFAULT_TERRAIN.length,cols=MAP_COLS){
 for(let k=0;k<TERRAIN_MAX_TRIES;k++){const list=rollOnce(((seed>>>0)+k)>>>0,starts,n,cols);if(!terrainProblems(list,starts,cols).length)return {list,tries:k+1}}
 return {list:defaultTerrain(n),tries:0};
}
export function defaultTerrain(n=DEFAULT_TERRAIN.length){return Array.from({length:n},(_,i)=>DEFAULT_TERRAIN[i%DEFAULT_TERRAIN.length])}
// Terrenos de uma partida nova: {type, seed, list}. starts = regiões iniciais dos impérios.
export function makeMapTerrain(type,seed,starts,n=DEFAULT_TERRAIN.length){
 if(type!=="sorteado")return {type:"padrao",seed:null,list:defaultTerrain(n)};
 const s=seed>>>0;return {type:"sorteado",seed:s,list:rollTerrain(s,starts,n).list};
}
// Terreno de cada região de um estado (saves antigos ou dados estranhos: mapa padrão). Só devolve nomes conhecidos.
export function terrainOf(s){
 const n=s?.owners?.length||DEFAULT_TERRAIN.length,l=s?.terrain?.list;
 if(Array.isArray(l)&&l.length===n&&l.every(t=>TERRAINS.includes(t)))return l;
 return defaultTerrain(n);
}
export const mapTypeOf=s=>s?.terrain?.type==="sorteado"&&Array.isArray(s.terrain.list)?"sorteado":"padrao";
