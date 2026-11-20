// Terrenos do mapa (Campina, Floresta, Colinas, Montanha, Deserto, Pântano, Tundra). Sem DOM.
// Opção da partida "Terrenos": Só visual (padrão; nenhuma regra os lê, o jogo é o de antes byte a byte) ou
// Com efeitos (state.terrainEffects===true; ver TERRAIN_EFFECTS no fim do ficheiro).
// Dois tipos de mapa: "padrao" (tabela fixa, cada região tem sempre o mesmo terreno) e "sorteado" (novo a cada
// partida). O sorteio usa um gerador próprio com a sua semente (guardada no save); nunca usa o sorteio das
// batalhas (rng.js), por isso não muda nenhum resultado do jogo nem a impressão digital.
import {MAP_COLS} from "./config.js";

export const TERRAINS=["campina","floresta","colinas","montanha","deserto","pantano","tundra"];
export const TERRAIN_NAMES={campina:"Campina",floresta:"Floresta",colinas:"Colinas",montanha:"Montanha",deserto:"Deserto",pantano:"Pântano",tundra:"Tundra"};
export const TERRAIN_HINTS={campina:"Campos abertos",floresta:"Mata fechada",colinas:"Morros redondos",montanha:"Picos e rochas",deserto:"Dunas e salinas",pantano:"Charco e juncos",tundra:"Gelo e neve"};
// Mapa padrão (aprovado em 20/11/2026), na ordem das regiões: Arvela, Brumas, Cardo… Zênite.
// Rodada de balanceamento (20/11/2026): Jaspe ↔ Rochedo (Jaspe Montanha, Rochedo Colinas). Com efeitos, as 3 Montanhas
// (−10% Ciência) ficavam todas do lado de Zênite e Arvela vencia 61% no 1×1 só de IAs; com a troca, ~50%.
export const DEFAULT_TERRAIN=Object.freeze(["campina","pantano","campina","colinas","campina","tundra","floresta","deserto","campina","montanha","tundra","floresta","pantano","floresta","colinas","montanha","colinas","deserto","pantano","campina","campina","floresta","montanha","campina"]);
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

/* ── Efeitos do terreno (opção "Com efeitos", 20/11/2026) ──
   Só valem quando a partida tem state.terrainEffects===true; desligado, nenhuma função abaixo muda um número.
   Cada terreno tem 2 vantagens e 1 desvantagem:
   • income: multiplica o ouro que a região rende (1,2 = +20%; 0,8 = −20%);
   • defense: pontos somados à defesa da região (nunca abaixo de 0);
   • attack: multiplica o custo de quem ataca a região (1,2 = +20%);
   • obras / forca / ciencia: % somada à receita de Obras, aos pontos de Força dos novos investimentos militares e
     à receita de Ciência do império, por cada região desse terreno que ele tem (0,1 = +10% por região).
   defense e attack protegem só quem ocupa: uma região livre custa o normal.
   A região inicial de cada império conta como Campina (ouro, defesa e Obras), mesmo que o mapa desenhe outro terreno. */
export const TERRAIN_EFFECTS=Object.freeze({
 campina:Object.freeze({income:1.2,obras:0.05,defense:-2}),
 floresta:Object.freeze({obras:0.1,defense:2,income:0.8}),
 colinas:Object.freeze({forca:0.1,defense:2,income:0.8}),
 montanha:Object.freeze({defense:4,income:1.2,ciencia:-0.1}),
 deserto:Object.freeze({ciencia:0.1,income:1.2,defense:-2}),
 pantano:Object.freeze({ciencia:0.2,attack:1.2,income:0.8}),
 tundra:Object.freeze({ciencia:0.15,defense:2,income:0.8}),
});
export const START_TERRAIN="campina";
// Liga/desliga dos efeitos numa partida. Saves antigos não têm o campo: Só visual.
export const terrainEffectsOn=s=>s?.terrainEffects===true;
// Regiões iniciais dos impérios guardadas na partida (state.terrain.starts). Dados estranhos: nenhuma.
export function terrainStartsOf(s){const a=s?.terrain?.starts,n=s?.owners?.length||0;return Array.isArray(a)?a.filter(i=>Number.isInteger(i)&&i>=0&&i<n):[]}
// Terreno que vale para as regras na região i (a região inicial conta como Campina).
export function ruleTerrain(s,i){return terrainStartsOf(s).includes(i)?START_TERRAIN:terrainOf(s)[i]}
const fx=(s,i)=>TERRAIN_EFFECTS[ruleTerrain(s,i)]||{};
// Multiplicador do ouro da região i (1 com os efeitos desligados).
export function terrainIncomeFactor(s,i){return terrainEffectsOn(s)?fx(s,i).income??1:1}
// Pontos de defesa do terreno da região i (0 desligado ou se a região está livre).
export function terrainDefenseBonus(s,i){return terrainEffectsOn(s)&&s.owners[i]!=="neutral"?fx(s,i).defense||0:0}
// Multiplicador do custo de ataque contra a região i (1 desligado ou se a região está livre).
export function terrainAttackFactor(s,i){return terrainEffectsOn(s)&&s.owners[i]!=="neutral"?fx(s,i).attack??1:1}
// Soma do bônus por área ("obras", "forca" ou "ciencia") das regiões de um dono (0 desligado).
export function terrainAreaBonus(s,owner,key){if(!terrainEffectsOn(s))return 0;let b=0;s.owners.forEach((o,i)=>{if(o===owner)b+=fx(s,i)[key]||0});return b}
// Liga os efeitos num estado novo, guardando as regiões iniciais (laboratórios, testes e partidas novas).
export function enableTerrainEffects(s){s.terrainEffects=true;s.terrain={...(s.terrain||{type:"padrao",seed:null,list:terrainOf(s)}),starts:s.owners.map((o,i)=>o==="neutral"?-1:i).filter(i=>i>=0)};return s}
// Textos curtos de cada terreno para o jogador: 2 vantagens e 1 desvantagem.
export const TERRAIN_EFFECT_TEXT=Object.freeze({
 campina:["+20% ouro","+5% Obras","−2 defesa"],
 floresta:["+10% Obras","+2 defesa","−20% ouro"],
 colinas:["+10% Força","+2 defesa","−20% ouro"],
 montanha:["+4 defesa","+20% ouro","−10% Ciência"],
 deserto:["+10% Ciência","+20% ouro","−2 defesa"],
 pantano:["+20% Ciência","atacar custa +20%","−20% ouro"],
 tundra:["+15% Ciência","+2 defesa","−20% ouro"],
});
