// Gravação da partida: monta o save, valida e migra saves antigos (formatos 3 e 4), põe de lado saves danificados.
// Usa o armazenamento assíncrono (src/platform/storage.js). Avisa a interface pelo gancho saveStatus.
import {runHook} from "./hooks.js";
import {gameMode,configApplied,state,opponentChoices,currentDifficulty,aiConfigBase} from "./session.js";
import {SUPPORTED_VERSIONS,MAX_AI,normalizeConfig,DIFFICULTIES,validAiBase,pickAiDifficulty,DEFAULTS} from "../core/config.js";
import {storage} from "../platform/storage.js";

/* ── Guardar a partida no aparelho ──
   Cada versão tem a sua chave: a do jogador (index.html) e a de desenvolvimento (dev.html), para os testes e os
   laboratórios nunca estragarem a partida do jogador. A chave antiga (LEGACY_SAVE_KEY), partilhada pelas duas
   versões antes da separação, é movida para a do jogador ao abrir a versão do jogador (migrateLegacySaveKey). */
export const SAVE_KEYS={player:"imperios-jogador-partida",dev:"imperios-dev-partida"},LEGACY_SAVE_KEY="imperios-completo-partida";
export let SAVE_KEY=SAVE_KEYS.player;
export let SAVE_CORRUPT_KEY=SAVE_KEY+"-corrompido";
// Escolhe a chave da versão ("player" ou "dev"); chamada no arranque, antes de ler o save.
export function useSaveSlot(slot){SAVE_KEY=SAVE_KEYS[slot]||SAVE_KEYS.player;SAVE_CORRUPT_KEY=SAVE_KEY+"-corrompido";return SAVE_KEY}
// Partida guardada na chave antiga e ainda nada na nova: copia-a para a nova e só depois apaga a antiga.
// Devolve true se moveu. Se a cópia falhar, a chave antiga fica como estava (nada se perde).
export async function migrateLegacySaveKey(){
 try{
  if(await storage.get(SAVE_KEY)!==null)return false;
  const old=await storage.get(LEGACY_SAVE_KEY);if(old===null)return false;
  await storage.set(SAVE_KEY,old);await storage.remove(LEGACY_SAVE_KEY);return true;
 }catch(e){return false}
}
// Grava a partida. Se o navegador recusar (espaço cheio, armazenamento bloqueado), avisa o jogador
// com uma mensagem visível em vez de falhar em silêncio; o aviso some na próxima gravação bem-sucedida.
// Devolve uma promessa: true se gravou, false se falhou (o aviso já foi mostrado).
export let saveFailed=false;
// Texto do save (o que fica guardado no aparelho): partida, configuração e escolhas atuais.
export function serializeGame(){return JSON.stringify({v:1,savedAt:Date.now(),gameMode,config:configApplied,state,opponentChoices,difficulty:currentDifficulty,aiBase:aiConfigBase})}
export function saveGame(){
 let w;try{w=storage.set(SAVE_KEY,serializeGame())}catch(e){w=Promise.reject(e)}
 return w.then(()=>{if(saveFailed){saveFailed=false;runHook("saveStatus",null)}return true},e=>{saveFailed=true;runHook("saveStatus",e);return false});
}
// Valida a estrutura de um estado salvo antes de o usar. Devolve null se estiver bem, ou o motivo.
export function validateSavedState(st){
 const isInt=Number.isInteger,fin=Number.isFinite,obj=v=>!!v&&typeof v==="object"&&!Array.isArray(v),arr=Array.isArray;
 if(!obj(st))return "estado ausente";
 if(st.formatVersion!==undefined&&!SUPPORTED_VERSIONS.includes(st.formatVersion))return "versão do formato não suportada: "+st.formatVersion;
 if(!arr(st.civs)||st.civs.length<2||st.civs.length>MAX_AI+1)return "lista de civilizações inválida";
 const ids=new Set();
 for(const c of st.civs){
  if(!obj(c)||typeof c.id!=="string"||!c.id||c.id==="neutral"||ids.has(c.id))return "civilização sem identificador válido";ids.add(c.id);
  if(typeof c.name!=="string")return "civilização sem nome";
  if(!fin(c.treasury)||!fin(c.military))return "tesouro/poder militar inválido ("+c.id+")";
  for(const k of ["color","chartColor"])if(c[k]!==undefined&&typeof c[k]!=="string")return "cor inválida";
  for(const k of ["invested","attacks","lastRevenue"])if(c[k]!==undefined&&!obj(c[k]))return "dados da civilização inválidos";
 }
 if(st.civs[0].id!=="player")return "o jogador não é a primeira civilização";
 if(!arr(st.owners)||st.owners.length<4||st.owners.length>30)return "mapa inválido";
 if(st.owners.some(o=>o!=="neutral"&&!ids.has(o)))return "território com dono desconhecido";
 if(!isInt(st.era)||st.era<0||!isInt(st.maxEras)||st.maxEras<1)return "era inválida";
 for(const k of ["investments","history","timeline","log"])if(!arr(st[k]))return "lista "+k+" ausente";
 if(st.orders!==undefined&&!arr(st.orders))return "ordens inválidas";
 for(const inv of st.investments)if(!obj(inv)||!["military","infrastructure","technology"].includes(inv.type)||!ids.has(inv.owner)||!isInt(inv.origin)||!fin(inv.amount)||!obj(inv.params))return "investimento inválido";
 for(const o of st.orders||[])if(!obj(o)||!ids.has(o.owner)||!isInt(o.idx)||o.idx<0||o.idx>=st.owners.length)return "ordem inválida";
 for(const e of st.log)if(!obj(e)||!fin(e.era)||typeof e.text!=="string")return "registo de eventos inválido";
 for(const r of st.history)if(!obj(r)||!fin(r.era))return "histórico inválido";
 for(const e of st.timeline)if(!obj(e)||!fin(e.era)||!arr(e.civs))return "linha do tempo inválida";
 if(st.result!=null&&(!obj(st.result)||!arr(st.result.winners)))return "resultado inválido";
 if(st.pending!=null&&!obj(st.pending))return "era em curso inválida";
 if(st.tutorial!=null&&!obj(st.tutorial))return "tutorial inválido";
 return null;
}
// Converte um estado salvo de formatos antigos (3, 4) para o atual. Não muda nenhum valor usado pelas regras.
export function migrateSavedState(st){
 if(!st||typeof st!=="object"||!Array.isArray(st.investments))return st;
 const v=st.formatVersion;if(v!==undefined&&!SUPPORTED_VERSIONS.includes(v))return st;
 if(v===undefined||v<5){
  for(const inv of st.investments){if(!inv||typeof inv!=="object")continue;delete inv.returns;
   if(inv.type==="military"&&inv.params&&typeof inv.params==="object")inv.params={delay:inv.params.delay}}
  st.formatVersion=5;
 }
 return st;
}
// Lê o save: {status:"none"} (não há), {status:"ok",raw,game} ou {status:"invalid",raw,reason}.
export async function readSavedGame(){
 let raw=null;try{raw=await storage.get(SAVE_KEY)}catch(e){return {status:"none"}}
 return parseSavedGame(raw);
}
// Interpreta o texto de um save (sem ler o armazenamento): mesmo resultado que readSavedGame.
export function parseSavedGame(raw){
 if(!raw)return {status:"none"};
 try{const o=JSON.parse(raw);
  if(!o||typeof o!=="object"||o.v!==1)return {status:"invalid",raw,reason:"formato desconhecido"};
  const why=validateSavedState(migrateSavedState(o.state));if(why)return {status:"invalid",raw,reason:why};
  const config=normalizeConfig(o.config),difficulty=DIFFICULTIES[o.difficulty]?o.difficulty:null;
  // Saves antigos não têm aiBase: com "Configurações" os valores salvos são a base; com outra dificuldade, os padrões.
  const aiBase=validAiBase(o.aiBase)||(difficulty===null||difficulty==="config"?pickAiDifficulty(config):pickAiDifficulty(DEFAULTS));
  return {status:"ok",raw,game:{config,state:o.state,gameMode:o.gameMode==="fast"?"fast":"slow",opponentChoices:Array.isArray(o.opponentChoices)?o.opponentChoices:null,difficulty,aiBase}};
 }catch(e){return {status:"invalid",raw,reason:e.message||String(e)}}
}
export async function loadSavedGame(){const r=await readSavedGame();return r.status==="ok"?r.game:null}
// Save que não pode ser usado: guarda uma cópia noutra chave (para análise) e tira-o do caminho,
// para o jogo não voltar a quebrar sempre que for aberto.
export function quarantineSave(raw){storage.set(SAVE_CORRUPT_KEY,raw).catch(()=>{});storage.remove(SAVE_KEY).catch(()=>{})}
// Únicas formas de outros módulos substituírem estas variáveis (um módulo não pode reatribuir o que importa).
export function setSaveFailed(v){saveFailed=v;return v}
