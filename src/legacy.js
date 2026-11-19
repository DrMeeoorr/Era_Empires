// Impérios — código do jogo que ainda não foi dividido em módulos (interface, sessão, gravação e laboratórios).
// Os passos 9 e 10 da reorganização dividem este ficheiro em src/ui, src/app, src/platform e src/labs.
import * as legacyNs from "./legacy.js";
import * as coreNs from "./core/index.js";
import * as aiNs from "./ai/index.js";
import {exposeGlobals} from "./app/debug.js";
import {aiDecide} from "./ai/decide.js";
import {LAB_PROFILES,LAB_PROFILE_NAME,AI_PROFILE_NAMES} from "./ai/profiles.js";
import {DEFAULTS,pickAiDifficulty,DIFFICULTIES,AI_DIFF_FIELDS,SUPPORTED_VERSIONS,MAX_AI,normalizeConfig,validAiBase,effectiveDelay,VERSION,SCORE_WEIGHT_KEYS,CIV_COLORS} from "./core/config.js";
import {infraReturn,techReturn,invest,makeInvestment} from "./core/economy.js";
import {territorialMinimum,territoryBase,finalScores,describeResult,evaluateEndOfEra,evaluateSupremacy,computeICE,scoreWinners,END_REASON_NAMES} from "./core/endgame.js";
import {beginEra,finishEra,simulate,processEra} from "./core/era.js";
import {countTerritories,eligibleTargets,adjacentOwned} from "./core/map.js";
import {runFixedGame,fixedGameSeed,seatProfiles,runMatch} from "./core/match.js";
import {territoryDefense,orderCostMultiplier,attackTerritory,cancelOrder,orderAttack,pillage,resolveOrders} from "./core/military.js";
import {regionName,RIVAL_NAMES,civSym,civName} from "./core/names.js";
import {REF_DIMS,calibrateReferences,REF_SETS,validateReferences,refAt,DEFAULT_REFERENCE_VALUES,quantile} from "./core/references.js";
import {rand} from "./core/rng.js";
import {newState,P,aiCivs,getCiv,addLog,A} from "./core/state.js";
import {clone,clamp,safeNum} from "./core/util.js";
export let configDefault=clone(DEFAULTS), configEdited=clone(DEFAULTS), configApplied=clone(DEFAULTS);
export let state, busy=false,cancelRequested=false, selectedTerritory=null, compareResults=[],lastStrategyResult=null,scenarioLoaded=null;
// Modo escolhido na interface para a PRÓXIMA partida. O motor nunca lê esta variável:
// cada estado guarda o seu próprio modo (state.mode) e cada investimento guarda inv.mode.
export let gameMode="slow";
export const COMPARE_COLORS=["#f4bd50","#56d6a1","#b49aff","#62a8ff","#ff737b","#e88a43","#72d0df","#d9a4c7"];
export const $=id=>document.getElementById(id);
/* ── Ganchos: avisam outras partes da interface (relatório, tutorial) sem substituir funções ──
   afterEra(era,row): depois de cada era jogada pelo jogador · afterRender(): depois de renderAll ·
   beforeConclude(): antes de concluir a era (devolver false impede) · continueGame / returnHome: tela inicial ·
   configChanged(): a configuração aplicada mudou (os laboratórios atualizam o editor) · viewShown(view): aba mostrada. */
export const hooks={afterEra:[],afterRender:[],beforeConclude:[],continueGame:[],returnHome:[],configChanged:[],viewShown:[]};
export const onHook=(name,fn)=>{hooks[name].push(fn)};
export const runHook=(name,...args)=>{for(const fn of hooks[name])fn(...args)};
/* ── Armazenamento (único lugar que usa localStorage) ──
   Interface assíncrona: get(key) → texto ou null, set(key,texto), remove(key); todas devolvem promessas.
   Hoje usa o localStorage do navegador; no app Android basta trocar por @capacitor/preferences
   (Preferences.get/set/remove) sem mexer no resto do jogo. Com o localStorage a gravação acontece já na
   chamada (antes de a promessa resolver), por isso a ordem das gravações é sempre a das chamadas. */
export const storage={
 async get(key){return localStorage.getItem(key)},
 async set(key,value){localStorage.setItem(key,String(value))},
 async remove(key){localStorage.removeItem(key)},
};
// true com ?dev=1: mostra laboratórios, testes e exportação (ver o <script> no <head>).
export const DEV_MODE=typeof document!=="undefined"&&!document.documentElement.classList.contains("player-build");
// Texto vindo do estado salvo ou de ficheiros importados (nomes, registo, cenários) entra no HTML sempre escapado.
export const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[ch]);
// Cores usadas em style=: só "#rgb"/"#rrggbb"/"#rrggbbaa"; qualquer outra coisa vira cinzento.
export const cssColor=c=>typeof c==="string"&&/^#[0-9a-fA-F]{3,8}$/.test(c)?c:"#888888";
export const fmt=(n,d=1)=>Number.isFinite(n)?n.toLocaleString("pt-BR",{maximumFractionDigits:d,minimumFractionDigits:0}):"—";
// Ouro: "142,5 de ouro" em frases; "142,5 🪙" onde o espaço é curto (cartões, barra de baixo).
export const money=n=>fmt(n,2)+" de ouro";
export const goldShort=n=>fmt(n,2)+" 🪙";
// Exibição (pt-BR) dos textos guardados pelo motor (registo de eventos, motivos de recusa, resultado):
// o texto guardado não muda — só a forma como aparece ao jogador. Números passam a 1.234,5;
// "u." vira ouro, "pontos"/"poder" militar vira Força, infraestrutura → obras, tecnologia → ciência.
export const UI_TEXT_RULES=[
 [/(\d)[   ](?=\d{3}(?!\d))/g,"$1."],
 [/\b(\d)(\d{3})(?=(?:,\d+)?\s(?:u\.|pontos))/g,"$1.$2"],
 [/Poder insuficiente: precisa de ([\d.,]+) pontos/g,"Força insuficiente: você precisa de $1 de Força"],
 [/([\d.,]+) u\. de tesouro/g,"$1 de ouro"],
 [/([\d.,]+) u\. de infraestrutura/g,"$1 de ouro em Obras"],
 [/([\d.,]+) de progresso tecnológico/g,"$1 de Ciência"],
 [/([\d.,]+) u\./g,"$1 de ouro"],
 [/([\d.,]+) pontos comprometidos/g,"$1 de Força gastos"],
 [/perdeu ([\d.,]+) pontos/g,"perdeu $1 de Força"],
 [/\(força ([\d.,]+) × ([\d.,]+)\)/g,"(Força $1 × $2)"],
 [/já não é possível atacar/g,"não é mais possível atacar"],
 [/poder devolvido/g,"Força devolvida"],
 [/acumulando poder militar/g,"acumulando Força"],
 [/Alvo não é adjacente ou já pertence ao atacante\./g,"Esse território não faz fronteira com o seu ou já é seu."],
 [/\(de Jogador\)/g,"(seu)"],[/\(neutro\)/g,"(livre)"],
 [/vitória de Jogador por/g,"você venceu por"],[/\bJogador\b/g,"você"],
 [/Ordem de Você contra/g,"Sua ordem contra"],[/venceu Você/g,"venceu você"],[/pontuação final por recursos/g,"pontuação final"],
 [/eliminação dos adversários/g,"eliminação dos rivais"],
 // "território 9" → nome da região (Ivara). Os rivais têm nomes masculinos (o Rubro, o Ocre...).
 [/\bpelo território (\d+)/g,(m,n)=>"por "+regionName(n-1)],
 [/\b(ao|o) território (\d+)/g,(m,p,n)=>(p==="ao"?"a ":"")+regionName(n-1)],
 [/\b[Tt]erritório (\d+)/g,(m,n)=>regionName(n-1)],
 [/e foi eliminada\./g,"e foi eliminado."]
];
export const uiText=t=>UI_TEXT_RULES.reduce((s,[re,to])=>s.replace(re,to),String(t??""));
// Campos de investimento: mostram vírgula decimal (formato do Brasil) e aceitam "12,5", "12.5" e "1.250" (milhar).
export const fmtInput=v=>String(Math.round(v*100)/100).replace(".",",");
export function parseAmount(raw){let t=String(raw??"").trim().replace(/\s/g,"");if(t.includes(","))t=t.replace(/\./g,"").replace(",",".");else if(/^\d{1,3}(\.\d{3})+$/.test(t))t=t.replace(/\./g,"");const v=Number(t);return Number.isFinite(v)?v:0}
export function makeSnapshot(){return {config:clone(configApplied),state:clone(state)}}
// Gera as partidas em lotes (async) para não bloquear a interface; pode ser cancelado
// e preserva as partidas já concluídas.
export async function runFixedDurationBatch(cfg,opts,onProgress=()=>{},shouldCancel=()=>false){
 const {games,eras,mode,profiles,civCount,baseSeed,batchSize=5}=opts,results=[],start=Date.now();
 for(let g=0;g<games;g++){
  if(shouldCancel())break;
  results.push(runFixedGame(cfg,{eras,mode,profiles,civCount,seed:fixedGameSeed(baseSeed,g),game:g}));
  if((g+1)%batchSize===0||g===games-1){onProgress(results.length,games,Date.now()-start);await new Promise(r=>setTimeout(r,0))}
 }
 return results;
}
// Resumo por perfil na última era (média simples de cada lugar ocupado pelo perfil).
export function fixedProfileSummary(games){
 const acc={};for(const g of games){const last=g.timeline.at(-1);if(!last)continue;for(const r of last.civs){const a=acc[r.profile]??={n:0,territories:0,military:0,infrastructure:0,technology:0,treasury:0,revenue:0};a.n++;a.territories+=r.territories;for(const [d] of REF_DIMS)a[d]+=r.dims[d]}}
 return Object.entries(acc).map(([profile,a])=>({profile,n:a.n,territories:a.territories/a.n,...Object.fromEntries(REF_DIMS.map(([d])=>[d,a[d]/a.n]))}));
}
// Versão do jogador: começa no "Médio"; "Configurações" (valores dos laboratórios) só existe com ?dev=1.
// Saves antigos com dificuldade "config" continuam a abrir e a jogar normalmente.
export const DEFAULT_DIFFICULTY=DEV_MODE?"config":"medio";
export let currentDifficulty=DEFAULT_DIFFICULTY;
export let aiConfigBase=pickAiDifficulty(DEFAULTS);
// Chamada quando a configuração é aplicada nos laboratórios: com a dificuldade "Configurações" ativa, os valores aplicados passam a ser a base.
export function rememberAiBase(cfg){if(currentDifficulty==="config")aiConfigBase=pickAiDifficulty(cfg)}
export function applyDifficulty(key){const d=DIFFICULTIES[key];if(!d)return;
 if(key==="config"){for(const [g,k] of AI_DIFF_FIELDS)configApplied[g][k]=aiConfigBase[g+"."+k];return}
 configApplied.economy.aiIncomeMultiplier=d.aiIncomeMultiplier;configApplied.economy.aiIncomeMultiplier1v1=d.aiIncomeMultiplier1v1??-1;configApplied.military.aiAggression=d.aiAggression;configApplied.military.aiTarget=d.aiTarget}
/* ── Adversários: estilo escolhido por IA ou sorteado ── */
export const OPPONENT_OPTIONS=[["random","🎲 Aleatório (revelado no fim)"],["config","⚙ Definido nas Configurações"],["reference","Equilibrado — divide igualmente"],["military","Militar — exército forte"],["aggressive","Agressivo — expande e ataca muito"],["technologist","Científico — aposta na Ciência, longo prazo"],["economist","Construtor — aposta em Obras"],["adaptive","Adaptativo — reage à situação"]];
// Na versão completa o padrão segue o perfil definido nas Configurações (comportamento anterior).
// Na versão do jogador o padrão é "Adaptativa" (o mesmo estilo que "Definido nas Configurações" usa por padrão).
export const DEFAULT_OPPONENT=DEV_MODE?"config":"adaptive";
export let opponentChoices=[DEFAULT_OPPONENT,DEFAULT_OPPONENT,DEFAULT_OPPONENT];
// Opções mostradas ao jogador: sem "Definido nas Configurações" fora do ?dev=1.
export const visibleOpponentOptions=()=>DEV_MODE?OPPONENT_OPTIONS:OPPONENT_OPTIONS.filter(([v])=>v!=="config");
// Resolve as escolhas no início de cada partida: "Aleatório" sorteia um perfil novo a cada partida e fica oculto até ao fim.
export function resolveOpponents(n){return Array.from({length:n},(_,i)=>{const c=opponentChoices[i]||"random";if(c==="random")return {profile:LAB_PROFILES[Math.floor(Math.random()*LAB_PROFILES.length)][0],hidden:true};if(c==="config")return {profile:null,hidden:false};return {profile:c,hidden:false}})}
// Uma partida começa já com a era 1 aberta: receitas recebidas, à espera da decisão do jogador.
export function newGame(){const n=configApplied.map.aiCount||1,opp=resolveOpponents(n);const s=newState(configApplied,{mode:gameMode,endRules:!!configApplied.endgame.enabled,profiles:[null,...opp.map(o=>o.profile)]});opp.forEach((o,i)=>{if(s.civs[i+1]){s.civs[i+1].hiddenProfile=o.hidden;s.civs[i+1].name=RIVAL_NAMES[i]||s.civs[i+1].name}});s.difficulty=currentDifficulty;beginEra(s,configApplied);s.ui={skipIdleWarning:false};return s}
export function profileOf(c){return c.profile||configApplied.military.aiStyle||"adaptive"}
// Nomes de estilo mostrados ao jogador (os laboratórios continuam a usar LAB_PROFILE_NAME).
export const PLAYER_PROFILE_NAME={reference:"Equilibrado",military:"Militar",aggressive:"Agressivo",technologist:"Científico",economist:"Construtor",adaptive:"Adaptativo"};
export const playerProfileName=p=>PLAYER_PROFILE_NAME[p]||LAB_PROFILE_NAME[p]||p;
export function profileLabel(c,reveal=false){if(c.id==="player")return "";if(c.hiddenProfile&&!reveal&&!state.result)return "estilo oculto";return playerProfileName(profileOf(c))}
// Conclui a era aberta e, se a partida continuar, abre a seguinte.
export function playEra(allocation){const era=state.era,row=finishEra(state,configApplied,{playerAllocation:allocation});if(!state.result)beginEra(state,configApplied);saveGame();runHook("afterEra",era,row);return row}
/* ── Guardar a partida no navegador ── */
export const SAVE_KEY="imperios-completo-partida", SAVE_CORRUPT_KEY=SAVE_KEY+"-corrompido";
// Grava a partida. Se o navegador recusar (espaço cheio, armazenamento bloqueado), avisa o jogador
// com uma mensagem visível em vez de falhar em silêncio; o aviso some na próxima gravação bem-sucedida.
// Devolve uma promessa: true se gravou, false se falhou (o aviso já foi mostrado).
export let saveFailed=false;
export function saveGame(){
 let w;try{w=storage.set(SAVE_KEY,JSON.stringify({v:1,savedAt:Date.now(),gameMode,config:configApplied,state,opponentChoices,difficulty:currentDifficulty,aiBase:aiConfigBase}))}catch(e){w=Promise.reject(e)}
 return w.then(()=>{if(saveFailed){saveFailed=false;showSaveWarning(null)}return true},e=>{saveFailed=true;showSaveWarning(e);return false});
}
export function showSaveWarning(err){
 if(typeof document==="undefined")return;let el=document.getElementById("saveWarning");
 if(!err){if(el)el.hidden=true;return}
 if(!el){el=document.createElement("div");el.id="saveWarning";el.className="save-warning";el.setAttribute("role","alert");document.body.appendChild(el)}
 const full=err&&(err.name==="QuotaExceededError"||err.code===22);
 el.innerHTML=`<span>⚠ <strong>Não foi possível salvar a partida.</strong> ${full?"O espaço de armazenamento do navegador está cheio.":"O navegador bloqueou o armazenamento."} Se você fechar o jogo agora, pode perder o progresso desde o último salvamento.</span><button type="button" aria-label="Fechar aviso">✕</button>`;
 el.querySelector("button").onclick=()=>{el.hidden=true};el.hidden=false;
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
// savedRaw: o texto do save carregado ao abrir o jogo (para pôr de lado se falhar ao desenhar).
export let savedGameLoaded=false,saveProblem=null,savedRaw=null;
export function noticeBrokenSave(){setTimeout(()=>showModal(`<h2>Não foi possível continuar a partida salva</h2><p class="small muted">Os dados da partida salva neste aparelho estão danificados ou são de uma versão incompatível. Uma nova partida foi iniciada, e uma cópia dos dados antigos foi guardada separadamente.</p>`,[{label:"Entendi",cls:"primary"}]),350)}
// Primeiro desenho com um save carregado: se falhar, o save é posto de lado e começa uma partida nova.
export function renderSavedSafely(render){
 try{render()}catch(e){
  if(!savedGameLoaded)throw e;
  savedGameLoaded=false;try{quarantineSave(savedRaw||JSON.stringify({v:1,state}))}catch(_){}
  configApplied=clone(configDefault);configEdited=clone(configDefault);gameMode="slow";currentDifficulty=DEFAULT_DIFFICULTY;aiConfigBase=pickAiDifficulty(configDefault);applyDifficulty(currentDifficulty);opponentChoices=[DEFAULT_OPPONENT,DEFAULT_OPPONENT,DEFAULT_OPPONENT];selectedTerritory=null;state=newGame();
  if(!saveProblem){saveProblem="erro ao desenhar: "+(e.message||e);noticeBrokenSave()}
  render();
 }
}
// Nome do jogador/rival com o símbolo (★ ▲ ● ◆ ■ ✚) na cor do mapa: não depende só da cor.
export const civSymHtml=c=>`<span class="csym" style="color:${cssColor(c.color)}" aria-hidden="true">${civSym(c)}</span>`;
export const civLabel=c=>`${civSymHtml(c)} ${escapeHtml(civName(c))}`;
/* ── Barra de recursos (topo) ── */
// Números curtos para a barra: sem casas decimais a partir de 100.
export const hudNum=v=>fmt(v,Math.abs(v)>=100?0:1);
export function renderMetrics(){
 const s=state,me=P(s),r=s.pending?.revenue?.player||s.history.at(-1)||{normal:0,infra:0,tech:0,total:0},g=configApplied.endgame,min=territorialMinimum(territoryBase(s),g.territoryPct),mine=countTerritories(s,"player");
 const pct=clamp(100*s.era/Math.max(1,s.maxEras),0,100);
 $("statEra").innerHTML=`<div class="hud-era-t"><span>Era</span><span class="of"><b>${escapeHtml(s.era)}</b>/${escapeHtml(s.maxEras)}</span></div><div class="hud-prog" role="progressbar" aria-label="Eras jogadas" aria-valuemin="0" aria-valuemax="${escapeHtml(s.maxEras)}" aria-valuenow="${escapeHtml(s.era)}"><span style="width:${pct}%"></span></div>`;
 $("statGold").innerHTML=`<span class="hud-ico gold-ico" aria-hidden="true">$</span><span class="hud-v"><b>${hudNum(me.treasury)} <small>ouro</small></b><span class="k"><span class="green">+${hudNum(r.total)}</span>/era</span></span>`;
 $("statGold").title=`Ouro para investir agora (já com o ouro desta era). Esta era rendeu ${money(r.total)}: territórios ${fmt(r.normal,1)} · Obras ${fmt(r.infra,1)} · Ciência ${fmt(r.tech,1)}.`;
 $("statForce").innerHTML=`<span class="hud-ico force-ico" aria-hidden="true">⚔</span><span class="hud-v"><b>${fmt(me.military,1)}</b><span class="k">Força</span></span>`;
 $("statForce").title="Força para atacar (perde 20% por era se não for usada).";
 $("statTerr").innerHTML=`<span class="hud-ico terr-ico" aria-hidden="true">⚑</span><span class="hud-v"><b>${mine}<small>/${min}</small></b><span class="k">terras</span></span>`;
 $("statTerr").setAttribute("aria-label",`Terras: ${mine} de ${min} para a maioria${mine>=min?" (maioria atingida)":""}. Abrir placar e condições de vitória`);
 const lv=liveScores(),pill=$("scorePill"),meS=lv?.find(x=>x.id==="player");
 if(!lv){pill.innerHTML=`<span aria-hidden="true">🏆</span> <span class="gap none">—</span>`;pill.setAttribute("aria-label","Placar: aparece no fim da 1.ª era. Abrir placar e condições de vitória")}
 else if(!meS){pill.innerHTML=`<span aria-hidden="true">🏆</span> <span class="gap down">fora</span>`;pill.setAttribute("aria-label","Placar: você foi eliminado. Abrir placar")}
 else{const pos=lv.indexOf(meS)+1,lead=lv[0],d=pos===1?(lv[1]?PTS(meS.score)-PTS(lv[1].score):0):PTS(lead.score)-PTS(meS.score);
  pill.innerHTML=`<span aria-hidden="true">🏆</span> ${pos}.º <span class="gap ${pos===1?"up":"down"}">${pos===1?"+":"−"}${d}</span>`;
  pill.setAttribute("aria-label",`Placar: você está em ${pos}.º${pos===1?(lv[1]?`, ${d} pontos à frente`:""):`, ${d} pontos atrás de ${lead.name}`}. Abrir placar e condições de vitória`)}
 $("matchInfo").textContent=`${s.maxEras} eras · ${DIFFICULTIES[s.difficulty]?.name||"Médio"} · modo ${s.mode==="fast"?"rápido":"lento"}${g.supremacyEnabled===false?" · Conquista":""} · ${mine} terras suas, ${countTerritories(s,"neutral")} livres.`;
 // Placar completo (folha "Placar e vitória"): posição, pontos, diferença para o líder e variação na última era.
 const strip=$("scoreStrip");
 if(!lv){strip.innerHTML=`<p class="muted small">O placar aparece no fim da 1.ª era.</p>`;return}
  const top=PTS(lv[0].score),prev=state.timeline.length>1?(()=>{const e=state.timeline.at(-2);const sc=finalScores(e.civs.map(r=>({id:r.id,dims:r.dims})),e.era,configApplied);const m={};e.civs.forEach((r,k)=>m[r.id]=PTS(sc[k].score));return m})():{};
  strip.innerHTML=`<p class="small muted" style="margin:0">Pontos = pontuação final se a partida acabasse agora: territórios valem 40%; Força, Obras, Ciência e ouro guardado, 15% cada. 1000 pontos = desempenho de referência.</p>`+lv.map((x,i)=>{const p=PTS(x.score),d=prev[x.id]!=null?p-prev[x.id]:null;
   return `<div class="score-row ${x.id==="player"?"me":""}" style="--c:${cssColor(x.civ?.chartColor)}"><span class="pos">${i+1}.º</span><span>${x.civ?civLabel(x.civ):escapeHtml(x.name)}${x.civ&&x.id!=="player"?` <span class="muted small">· ${escapeHtml(profileLabel(x.civ))}</span>`:""}</span><span class="pts"><strong>${p}</strong>${i>0?` <span class="gap">−${top-p}</span>`:""}${d?` <span class="trend ${d>0?"up":"down"}">${d>0?"↑":"↓"}${Math.abs(d)}</span>`:""}</span></div>`}).join("")
}
/* ── Mapa e painel do alvo ── */
/* Ajusta cada nome de região ao seu quadrado: a largura das letras muda com a fonte de cada
   celular. Primeiro reduz a fonte (até 8,5 px), depois aperta o espaço entre letras. */
export function fitRegionNames(){
 const MIN=8.5;
 document.querySelectorAll("[data-territory] .rname").forEach(n=>{
  n.style.fontSize="";n.style.letterSpacing="";
  const cell=n.closest("[data-territory]"),cs=getComputedStyle(cell);
  const room=cell.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
  if(!(room>0)||n.scrollWidth<=room)return;
  const base=parseFloat(getComputedStyle(n).fontSize);
  const size=Math.max(MIN,Math.floor(base*room/n.scrollWidth*10)/10);
  n.style.fontSize=size+"px";
  for(let ls=-.04;n.scrollWidth>room&&ls>=-.1;ls-=.02)n.style.letterSpacing=ls.toFixed(2)+"em";
 });
}
// Legenda mais larga que a tela: marca para esmaecer a borda (indica que rola para o lado).
export function markLegend(){const l=$("mapLegend");if(!l)return;const upd=()=>l.classList.toggle("more",l.scrollWidth>l.clientWidth+1&&l.scrollLeft+l.clientWidth<l.scrollWidth-2);upd();if(!l.dataset.mk){l.dataset.mk=1;l.addEventListener("scroll",upd,{passive:true})}}
export function renderMap(){
 const targets=eligibleTargets(state,"player");
 $("map").innerHTML=state.owners.map((o,i)=>{const civ=o==="neutral"?null:getCiv(state,o),cls=o==="player"?"player":civ?"ai":"",style=civ&&o!=="player"?` style="background:${cssColor(civ.color)}55;border-color:${cssColor(civ.color)}"`:"",target=targets.some(t=>t.i===i)&&P(state).active&&!state.result,sel=selectedTerritory===i;
  return `<button class="territory ${cls} ${target?"target":""} ${sel?"selected":""}" data-territory="${i}" aria-label="${escapeHtml(regionName(i))}, região ${i+1}, ${o==="neutral"?"livre":o==="player"?"sua":"de "+escapeHtml(civName(civ))}${target?", alvo possível":""}"${style}><span class="rname">${escapeHtml(regionName(i))}</span><span class="who"><span class="tnum">${i+1}</span>${civ?`<span class="csym">${civSym(civ)}</span>`:""}</span>${target?`<span class="def gold">Def. ${fmt(territoryDefense(state,i,configApplied),0)}</span>`:""}</button>`}).join("");
 $("mapLegend").innerHTML=`<span>${civLabel(P(state))}</span>`+aiCivs(state).map(c=>`<span>${civLabel(c)}<span class="muted lg-style"> · ${escapeHtml(profileLabel(c))}</span>${c.active?"":" (eliminado)"}</span>`).join("")+`<span><i class="dot sq" style="background:#1a2940;border:1px solid #64758e"></i>Livre</span><span><i class="dot sq" style="border:2px solid #f4bd50"></i>Pode atacar</span>`;
 document.querySelectorAll("[data-territory]").forEach(b=>b.addEventListener("click",()=>{const i=Number(b.dataset.territory);selectedTerritory=i;renderMap();openSheet("attackSheet",()=>document.querySelector(`[data-territory="${i}"]`))}));
 fitRegionNames();markLegend();
 renderAttack();renderEvents();
 if(simOrders())myOrders().forEach((o,k)=>{const cell=document.querySelector(`[data-territory="${o.idx}"]`);if(cell){cell.classList.add("ordered");cell.insertAdjacentHTML("beforeend",`<span class="order-tag">${myOrders().length>1?"⚔ "+(k+1)+".ª":"⚔ ordem"}</span>`)}});
}
// Folha de ataque: região + dono, 3 números (Custo, Sua força, Chance), botão com o motivo quando não dá,
// atalho "Investir em Militar" e a explicação longa atrás de "Por quê?".
export const ATTACK_CHANCE="82%";
export const infoTip=(html,label="Por quê?")=>`<details class="tgt-info"><summary><span aria-hidden="true">ⓘ</span> O ataque acontece no fim da era. <u>${label}</u></summary><div>${html}</div></details>`;
export const targetNums=(cost,have)=>`<div class="tgt-nums"><div class="tgt-num"><span>Custo</span> <b>${fmt(cost,1)}</b></div><div class="tgt-num"><span>Sua força</span> <b class="${have+1e-9>=cost?"ok":"red"}">${fmt(have,1)}</b></div><div class="tgt-num"><span>Chance</span> <b>${ATTACK_CHANCE}</b></div></div>`;
// Região no painel do alvo: nome + número pequeno (o mesmo do mapa).
export const regionHtml=t=>`<strong>${escapeHtml(regionName(t))}</strong> <span class="muted small">${t+1}</span>`;
export const tgtTitle=html=>`<h2 class="tgt-title" id="attackTitle">${html}</h2>`;
export const setAttackBtn=(btn,text,enabled,{cancel=false,invest=false}={})=>{btn.textContent=text;btn.disabled=!enabled;btn.classList.toggle("cancel",cancel);const inv=$("attackInvest");if(inv)inv.hidden=!invest};
// Ordens simultâneas: a ordem fica marcada no mapa e o resultado sai no relatório do fim da era.
export const simOrders=()=>!!configApplied.military.simultaneousOrders,myOrders=()=>(state.orders||[]).filter(o=>o.owner==="player"),myOrder=t=>myOrders().find(o=>o.idx===t);
// Painel do alvo com ordens simultâneas (configuração padrão): a ordem é resolvida no fim da era.
export function renderOrderAttack(){
 const t=selectedTerritory,m=configApplied.military,btn=$("attack"),mil=P(state).military,ords=myOrders(),ord=t!==null?myOrder(t):null,next=orderCostMultiplier(configApplied,ords.length),maxO=m.maxOrdersPerEra||Infinity;
 setAttackBtn(btn,"Escolha um alvo",false);
 if(t===null&&isSheetOpen("attackSheet"))closeSheet();
 if(state.result||!P(state).active){setAttackBtn(btn,state.result?"Partida terminada":"Sem ataques",false);$("mapStatus").innerHTML=tgtTitle(t===null?"Mapa":regionHtml(t))+`<p class="tgt-sub">${state.result?"A partida terminou.":"Você foi eliminado e não pode mais atacar."}</p>`;return}
 const ordTxt=ords.length?`<p class="tgt-orders">⚔ Ordens desta era: ${ords.map(o=>`${escapeHtml(regionName(o.idx))} (${fmt(o.need,1)}${o.mult>1?`, ×${fmt(o.mult,1)}`:""})`).join(" · ")}</p>`:"";
 const costTxt=maxO===1?"":ords.length?` O próximo ataque desta era custa ×${fmt(next,1)}.`:" Você pode dar várias ordens por era; cada ataque a mais custa mais (2.º ×2, 3.º ×3…).";
 const howOrders=`As ordens de todos são resolvidas juntas no fim da era: se um rival atacar o mesmo território, há <strong>batalha</strong> (vence quem tiver mais Força, somada à Ciência); depois, ${ATTACK_CHANCE} de chance de conquistar. A Força é gasta mesmo se o ataque falhar.`;
 if(t===null){$("mapStatus").innerHTML=`${tgtTitle("Escolha um alvo")}${ordTxt}<p class="tgt-sub">Toque em um território com <span class="gold">contorno dourado</span> para atacar. Força livre: <strong>${fmt(mil,1)}</strong>.</p>${infoTip(`Cada ataque custa, em Força, a defesa do alvo + ${fmt(m.conquestCost,0)} de conquista.${costTxt} ${howOrders}`)}`;return}
 if(ord){setAttackBtn(btn,"Cancelar ordem",true,{cancel:true});$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ordem dada`)}${ordTxt}<p class="tgt-sub">${fmt(ord.need,1)} de Força reservada. Cancelar devolve a Força${ords.length>1?" e recalcula o custo das outras ordens":""}.</p>${infoTip(`A ordem é resolvida quando você concluir a era, junto com as dos rivais. ${howOrders}`)}`;return}
 const owner=state.owners[t];
 if(owner==="player"){setAttackBtn(btn,"Território seu",false);$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · seu`)}${ordTxt}<p class="tgt-sub">Defesa ${fmt(territoryDefense(state,t,configApplied),1)}. Obras e Ciência reforçam a defesa.</p>`;return}
 if(!adjacentOwned(state,t,"player")){setAttackBtn(btn,"Fora do alcance",false);$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ${owner==="neutral"?"livre":"de "+civLabel(getCiv(state,owner))}`)}${ordTxt}<p class="tgt-sub">Não faz fronteira com o seu império. Escolha um com contorno dourado.</p>`;return}
 const replacing=maxO===1&&ords.length,mult=replacing?1:next,def=territoryDefense(state,t,configApplied),base=m.conquestCost+def,need=base*mult,civ=owner==="neutral"?null:getCiv(state,owner),avail=mil+(replacing?ords[0].need:0);
 if(!replacing&&ords.length>=maxO){setAttackBtn(btn,`Máximo de ${maxO} ordens`,false);$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ${civ?"de "+civLabel(civ):"livre"}`)}${ordTxt}<p class="tgt-sub">Você já deu o máximo de ${maxO} ordens nesta era.</p>`;return}
 const ok=avail+1e-9>=need;setAttackBtn(btn,ok?`${replacing?"Trocar ordem":"Atacar"} · usa ${fmt(need,1)} de Força`:`Faltam ${fmt(need-avail,1)} de Força`,ok,{invest:!ok&&mult<=1});
 $("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ${civ?"de "+civLabel(civ):"livre"}`)}${mult>1?`<p class="tgt-sub">${ords.length+1}.º ataque desta era: custo ×${fmt(mult,1)}</p>`:""}${ordTxt}${targetNums(need,avail)}${infoTip(`Custo = defesa ${fmt(def,1)} + conquista ${fmt(m.conquestCost,0)} = ${fmt(base,1)}${mult>1?` × ${fmt(mult,1)} (${ords.length+1}.º ataque da era)`:""} = ${fmt(need,1)} de Força.${ok?"":mult>1?" Ataques a mais na mesma era custam mais.":" Invista em Militar: a Força chega na era seguinte."} ${howOrders}`)}`;
}
export function renderAttack(){
 if(simOrders())return renderOrderAttack();
 const t=selectedTerritory,m=configApplied.military,btn=$("attack"),mil=P(state).military;
 setAttackBtn(btn,"Escolha um alvo",false);
 if(t===null&&isSheetOpen("attackSheet"))closeSheet();
 if(state.result||!P(state).active){setAttackBtn(btn,state.result?"Partida terminada":"Sem ataques",false);$("mapStatus").innerHTML=tgtTitle(t===null?"Mapa":regionHtml(t))+`<p class="tgt-sub">${state.result?"A partida terminou.":"Você foi eliminado e não pode mais atacar."}</p>`;return}
 if(t===null){$("mapStatus").innerHTML=`${tgtTitle("Escolha um alvo")}<p class="tgt-sub">Toque em um território com <span class="gold">contorno dourado</span> para atacar. Força: <strong>${fmt(mil,1)}</strong>.</p>`;return}
 const owner=state.owners[t];
 if(owner==="player"){setAttackBtn(btn,"Território seu",false);$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · seu`)}<p class="tgt-sub">Defesa ${fmt(territoryDefense(state,t,configApplied),1)}. Obras e Ciência reforçam a defesa.</p>`;return}
 if(!adjacentOwned(state,t,"player")){setAttackBtn(btn,"Fora do alcance",false);$("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ${owner==="neutral"?"livre":"de "+civLabel(getCiv(state,owner))}`)}<p class="tgt-sub">Não faz fronteira com o seu império. Escolha um com contorno dourado.</p>`;return}
 const def=territoryDefense(state,t,configApplied),need=m.conquestCost+def,civ=owner==="neutral"?null:getCiv(state,owner);
 const extra=civ?def-m.defenseOwned:0,defTxt=civ?`defesa ${fmt(m.defenseOwned,0)}${extra>0.05?` + ${fmt(extra,1)} de Obras/Ciência`:""}`:`defesa ${fmt(def,0)}`;
 const ok=mil+1e-9>=need;setAttackBtn(btn,ok?`Atacar · usa ${fmt(need,1)} de Força`:`Faltam ${fmt(need-mil,1)} de Força`,ok,{invest:!ok});
 $("mapStatus").innerHTML=`${tgtTitle(`${regionHtml(t)} · ${civ?"de "+civLabel(civ):"livre"}`)}${targetNums(need,mil)}${infoTip(`Custo = ${defTxt} + conquista ${fmt(m.conquestCost,0)} = ${fmt(need,1)} de Força. Vence em ${ATTACK_CHANCE} das vezes; a Força é gasta mesmo se o ataque falhar.${ok?"":" Invista em Militar: a Força chega na era seguinte."}`)}`;
}
// Botão "Atacar" do painel do alvo (ataque imediato quando as ordens simultâneas estão desligadas).
export function attackSelected(){
 if(simOrders())return orderSelected();
 if(selectedTerritory===null)return;
 const t=selectedTerritory,r=attackTerritory(state,t,"player",configApplied);selectedTerritory=null;closeSheet({focus:false});saveGame();renderAll();const msg=r.ok?(r.win?`<span class="green"><strong>Você conquistou ${escapeHtml(regionName(t))}!</strong></span>`:`<span class="red"><strong>O ataque a ${escapeHtml(regionName(t))} falhou</strong></span>; a Força foi gasta.`):escapeHtml(uiText(r.reason));$("mapStatus").innerHTML=msg;showToast(msg,!(r.ok&&r.win))
}
// Botão do painel com ordens simultâneas: dá ou cancela a ordem contra o território escolhido.
export function orderSelected(){
 if(selectedTerritory===null)return;const t=selectedTerritory,ord=myOrder(t);let msg,bad=false;
 if(ord){cancelOrder(state,"player",t);msg=`Ordem contra ${escapeHtml(regionName(t))} cancelada; Força devolvida.`}
 else{const r=orderAttack(state,t,"player",configApplied);bad=!r.ok;msg=r.ok?`<span class="gold"><strong>⚔ Ordem dada:</strong></span> atacar ${escapeHtml(regionName(t))} no fim da era (${fmt(r.need,1)} de Força reservada${r.mult>1?`, ${myOrders().length}.º ataque ×${fmt(r.mult,1)}`:""}).`:escapeHtml(uiText(r.reason))}
 selectedTerritory=null;closeSheet({focus:false});saveGame();renderAll();$("mapStatus").innerHTML=msg;showToast(msg,bad)}
export function renderEvents(){
 if(!$("lastEvents"))return;
 const ev=state.log.filter(x=>/ataque|conquist|repelid|falhou|eliminad|🏁/i.test(x.text)).slice(0,3);
 $("lastEvents").innerHTML=ev.length?ev.map(e=>`<div><span class="muted">Era ${escapeHtml(e.era)}</span> · ${escapeHtml(uiText(e.text))}</div>`).join(""):"";
}
/* ── Investimentos: botões, planos e valores ── */
export const AREAS=[["mil","military"],["infra","infrastructure"],["tech","technology"]];
export const PLANS={balanced:[34,33,33],attack:[65,25,10],economy:[20,65,15],tech:[20,20,60],clear:[0,0,0]};
export const round2=v=>Math.floor(v*100+1e-6)/100;
// Resto: o que falta, arredondado ao cêntimo mais próximo sem passar do disponível.
export const restOf=avail=>{const r=Math.round(avail*100)/100;return r>avail+1e-9?r-0.01:r};
export function readAlloc(){return AREAS.map(([k])=>Math.max(0,parseAmount($(k+"Spend").value)))}
export function setAlloc(vals){AREAS.forEach(([k],i)=>{$(k+"Spend").value=fmtInput(vals[i])});renderAllocation()}
export function applyPlan(name){const b=P(state).treasury,w=PLANS[name];const a=round2(b*w[0]/100),i=round2(b*w[1]/100),t=name==="clear"?0:Math.max(0,restOf(b-a-i));setAlloc([a,i,t])}
export function stepArea(idx,dir){const b=P(state).treasury,v=readAlloc(),others=v.reduce((s,x,j)=>s+(j===idx?0:x),0),step=Math.max(1,round2(b*0.1));v[idx]=clamp(round2(v[idx]+dir*step),0,round2(Math.max(0,b-others)));setAlloc(v)}
export function restArea(idx){const b=P(state).treasury,v=readAlloc(),others=v.reduce((s,x,j)=>s+(j===idx?0:x),0);v[idx]=restOf(Math.max(0,b-others));setAlloc(v)}
export function renderAllocation(statusMessage=null){
 const vals=readAlloc(),sum=vals.reduce((a,b)=>a+b,0),b=P(state).treasury,left=Math.max(0,b-sum),c=configApplied;
 const shownLeft=left<0.01?0:left,ended=!!state.result,over=sum>b+1e-8;
 $("actionLeft").classList.toggle("hidden",ended);$("actionEnded").classList.toggle("hidden",!ended);
 if(!ended)$("actionLeft").innerHTML=statusMessage?escapeHtml(statusMessage):over?"O total passa do ouro disponível":shownLeft===0?`<span aria-hidden="true">✓</span> tudo investido`:`sobram <strong>${fmt(shownLeft,2)}</strong> de ouro`;
 $("advance").classList.toggle("done-all",!ended&&shownLeft===0&&!over&&!statusMessage);
 AREAS.forEach(([k],i)=>{$(k+"Bar").style.width=(b>0?clamp(100*vals[i]/b,0,100):0)+"%";$(k+"Fine").textContent=fmt(vals[i],2)});
 $("allocationStatus").className="status"+(statusMessage||over?" error":"");$("allocationStatus").textContent=statusMessage||(over?"O total ultrapassa o orçamento.":left<0.01?"Orçamento todo investido.":`Por investir: ${money(left)} (fica guardado para a próxima era).`);
 const milGain=vals[0]*c.military.pointsPerInvestment,infraGain=vals[1]*c.infrastructure.initialReturn,techGain=vals[2]*c.technology.progressPerInvestment*c.technology.benefitPerProgress,techEra=state.era+effectiveDelay("technology",c.technology.delay,state.mode);
 $("milForecast").textContent=`+${fmt(milGain,1)} de Força na próxima era. Curto prazo: a Força não usada perde 20% por era.`;
 $("infraForecast").textContent=`Rende cerca de ${money(infraGain)} por era a partir da próxima, crescendo até a 4.ª era e depois acabando.`;
 $("techForecast").textContent=`Rende ${money(techGain)} por era, para sempre, a partir da era ${techEra}.`;
 $("milPrev").innerHTML=vals[0]>0?`<span class="gold">+${fmt(milGain,1)}</span> de Força`:"curto prazo";
 $("infraPrev").innerHTML=vals[1]>0?`<span class="green">+${fmt(infraGain,2)}</span>/era`:"médio prazo";
 $("techPrev").innerHTML=vals[2]>0?`<span class="purple">+${fmt(techGain,2)}</span>/era<span class="wide"> · era ${techEra}</span>`:"longo prazo";
 $("advTitle").textContent=ended?"Jogar de novo →":`Concluir era ${state.era}`;
 $("advance").setAttribute("aria-label",ended?"Jogar de novo":`Concluir era ${state.era}: ${$("actionLeft").textContent.trim()}`);
 $("advance").disabled=busy||(!ended&&over);
 document.querySelectorAll("#investCard button, #investCard input, #fineSheet button, #plans button").forEach(el=>{if(!el.matches("[data-open]"))el.disabled=ended||!P(state).active});
}
/* ── Gráficos ── */
export function svgLine(canvas,series,opts={}){
 const ctx=canvas.getContext("2d"),dpr=window.devicePixelRatio||1,w=canvas.clientWidth||300,h=canvas.clientHeight||220;if(!w)return;canvas.width=w*dpr;canvas.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
 const pad={l:38,r:10,t:14,b:26},pw=w-pad.l-pad.r,ph=h-pad.t-pad.b;ctx.strokeStyle="#293951";ctx.fillStyle="#9fb0c7";ctx.font="10px system-ui";ctx.lineWidth=1;
 const all=series.flatMap(s=>s.data.map(p=>p.y)).filter(Number.isFinite),max=Math.max(opts.minMax??1,...all),min=Math.min(0,...all),range=max-min||1;
 for(let i=0;i<=4;i++){let y=pad.t+ph*i/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText(fmt(max-(max-min)*i/4,range<5?2:0),2,y+3)}
 const n=Math.max(1,...series.map(s=>s.data.length));
 if(opts.markX){const x=pad.l+(n<=1?0:(opts.markX-1)/(n-1))*pw;ctx.save();ctx.strokeStyle="#f4bd50";ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x,pad.t);ctx.lineTo(x,pad.t+ph);ctx.stroke();ctx.restore()}
 series.forEach(s=>{ctx.strokeStyle=s.color;ctx.lineWidth=2;ctx.beginPath();let started=false;s.data.forEach((p,i)=>{let x=pad.l+(n<=1?0:i/(n-1))*pw,y=pad.t+ph-(p.y-min)/range*ph;if(!Number.isFinite(y))return;if(!started){ctx.moveTo(x,y);started=true}else ctx.lineTo(x,y)});ctx.stroke()});
 ctx.fillStyle="#9fb0c7";ctx.textAlign="center";ctx.fillText("Era",pad.l+pw/2,h-5);if(n>1){ctx.fillText("1",pad.l,h-5);ctx.fillText(String(n),w-pad.r-4,h-5)}ctx.textAlign="start";
}
export function chartData(key){return state.history.map(r=>({x:r.era,y:r[key]||0}))}
export function renderCharts(){
 if(!$("details").open)return;
 const tl=state.timeline;svgLine($("revenueChart"),[{data:chartData("normal"),color:"#62a8ff"},{data:chartData("infra"),color:"#56d6a1"},{data:chartData("tech"),color:"#b49aff"}]);
 const perCiv=key=>state.civs.map((c,k)=>({color:c.chartColor,data:tl.map(e=>({x:e.era,y:e.civs[k]?.[key]||0}))}));
 svgLine($("territoryChart"),perCiv("territories"));svgLine($("militaryChart"),perCiv("military"));
 const legend=state.civs.map(c=>`<span style="--c:${cssColor(c.chartColor)}">${civLabel(c)}</span>`).join("");$("territoryLegend").innerHTML=legend;$("militaryLegend").innerHTML=legend;
}
export function renderHistory(){
 const h=state.history;$("historyCount").textContent=h.length;
 $("historyTable").innerHTML=h.slice(-150).reverse().map(r=>`<tr><td>${escapeHtml(r.era)}</td><td>${fmt(r.total,2)}</td><td>${fmt(r.militaryInvested||0,2)}</td><td>${fmt(r.infraInvested||0,2)}</td><td>${fmt(r.techInvested||0,2)}</td><td>${fmt(r.budget,2)}</td><td>${escapeHtml(r.territories)}</td><td>${fmt(r.military,1)}</td></tr>`).join("");
 const last=state.pending?.revenue?.player||h.at(-1),tot=Math.max(1,last?.total||0);
 $("revenueBreakdown").innerHTML=[["Territórios",last?.normal||0,"#62a8ff","blue"],["Obras",last?.infra||0,"#56d6a1","green"],["Ciência",last?.tech||0,"#b49aff","purple"]].map(([n,v,c,cl])=>`<div class="row between" style="margin-top:6px"><span class="muted">${n}</span><strong class="${cl}">${money(v)}</strong></div><div class="bar"><span style="width:${100*v/tot}%;background:${c}"></span></div>`).join("");
}
export function renderForecast(){
 const era=state.era;let infra=[],tech=[];
 for(let t=1;t<=12;t++){let e=era+t,ir=0,tr=0;for(const inv of state.investments){if(inv.owner!=="player")continue;if(inv.type==="infrastructure")ir+=infraReturn(inv,e-inv.origin);if(inv.type==="technology")tr+=techReturn(state,inv,e)}infra.push(ir);tech.push(tr)}
 $("forecast").innerHTML=`<div class="log-item"><strong class="gold">Militar</strong><p class="small muted">Força disponível: ${fmt(P(state).military,1)}. Perde 20% por era se não for usada.</p></div><div class="log-item"><strong class="green">Obras</strong><p class="small muted">Na próxima era: ${money(infra[0]||0)}; daqui a 5 eras: ${money(infra[4]||0)}</p></div><div class="log-item"><strong class="purple">Ciência</strong><p class="small muted">Na próxima era: ${money(tech[0]||0)}; daqui a 5 eras: ${money(tech[4]||0)} (sem contar o bônus sobre todo o ouro da era).</p></div><div class="small muted">Só investimentos já feitos.</div>`;
}
export function renderNotifications(){const events=state.log.filter(x=>/ataque|conquist|repelid|falhou|eliminad/i.test(x.text)).slice(0,30);$("notificationCount").textContent=events.length;$("notifications").innerHTML=events.length?events.map(e=>`<div class="log-item"><strong>Era ${escapeHtml(e.era)}</strong> · ${escapeHtml(uiText(e.text))}</div>`).join(""):'<div class="small muted">Ainda não houve ataques.</div>'}
/* ── Condições de vitória e fim de partida ── */
// Relatório da era: ataques, batalhas, conquistas e saques revelados um a um.
export function showEraReport(era){
 if(state.ui?.skipReport)return;
 const ev=state.log.filter(x=>x.era===era&&/conquist|repelid|batalha|ordem de|ataque|eliminad|saque/i.test(x.text)&&!/ordenou/i.test(x.text)).reverse();
 if(!ev.length)return;
 const mine=x=>/você|Você|Jogador|bem-sucedido|malsucedido|Seu/.test(x.text)||/de Jogador|\(de você\)/.test(x.text);
 showModal(`<h2>Relatório da era ${escapeHtml(era)}</h2><p class="small muted">As ordens de todos foram resolvidas juntas, em ordem sorteada.</p><div class="report">${ev.map((e,i)=>`<div class="report-line ${mine(e)?"mine":""}" style="animation-delay:${0.25+i*0.45}s">${escapeHtml(uiText(e.text))}</div>`).join("")}</div><label class="small" style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="skipReport"> Não mostrar relatórios nesta partida</label>`,
  [{label:"Continuar",cls:"primary",onClick:()=>{if($("skipReport")?.checked){state.ui.skipReport=true;saveGame()}}}]);
}
export function renderVictory(){
 const s=state,cfg=configApplied,g=cfg.endgame;
 const last=s.timeline.at(-1),min=territorialMinimum(territoryBase(s),g.territoryPct),left=Math.max(0,s.maxEras-s.era+(s.pending?1:0));
 $("victoryPill").textContent=s.result?"Partida encerrada":`${left===1?"Última era":`Faltam ${left} eras`}`;
 const bar=(v,max,c)=>`<div class="bar" style="margin:3px 0 8px"><span style="width:${clamp(100*v/Math.max(1e-9,max),0,100)}%;background:${cssColor(c)}"></span></div>`;
 const terr=s.civs.map(c=>{const t=countTerritories(s,c.id);return `<div class="row between small"><span>${civLabel(c)}${c.id!=="player"?` <span class="muted">· ${escapeHtml(profileLabel(c))}</span>`:""}${c.active?"":' <span class="red">· eliminado</span>'}</span><strong>${t} / ${min}</strong></div>${bar(t,min,c.chartColor)}`}).join("");
 const sup=s.supremacy||{},row=id=>last?.civs.find(r=>r.id===id),ices=s.civs.filter(c=>c.active).map(c=>({c,ice:row(c.id)?.ice})).sort((a,b)=>(b.ice??-1)-(a.ice??-1));
 const statusTxt={off:"Desativada neste modo (Conquista).",none:"Ainda não avaliada.",suspended:"Suspensa nesta era.",tiedLeadership:"Sem líder claro.",gapTooSmall:`O 2.º ainda tem mais de ${fmt(100*g.supremacyRelative,0)}% do índice do líder.`,belowMinimum:"O líder ainda não é forte o suficiente.",counting:"Condição cumprida nesta era.",notYet:`Só conta a partir da era ${Math.ceil(g.supremacyMinEraShare*s.maxEras)} e com no máximo ${Math.floor(g.supremacyMaxNeutralShare*territoryBase(s)+1e-9)} territórios livres (agora ${countTerritories(s,"neutral")}).`,notApplicable:"—"}[sup.status]||"";
 const iceRows=ices.map(({c,ice})=>`<div class="row between small"><span>${civLabel(c)}${sup.leader===c.id?' <span class="gold">· líder</span>':""}</span><strong>${ice==null?"—":fmt(ice,2)}</strong></div>`).join("");
 $("victoryPanel").innerHTML=`<h3>Maioria territorial: ${min} de ${territoryBase(s)}</h3>${terr}
 <h3>Supremacia: liderar com folga ${g.supremacyEras} eras seguidas</h3>${iceRows||'<div class="small muted">Calculada a partir do fim da 1.ª era.</div>'}
 <div class="small" style="margin-top:6px">Sequência: <strong class="gold">${sup.streak||0} / ${g.supremacyEras}</strong>${sup.leader?` (${sup.leader==="player"?"você":escapeHtml(civName(getCiv(s,sup.leader)))})`:""}. <span class="muted">${statusTxt}</span></div>
 <h3>Última era (${s.maxEras}): pontuação</h3><div class="small muted">Sem outra vitória, ganha a maior pontuação. Territórios valem ${fmt(100*g.scoreWTerritory,0)}%; Força, Obras, Ciência e ouro guardado dividem o resto.</div>${(()=>{const lv=liveScores();if(!lv)return "";const mx=Math.max(...lv.map(x=>x.score));return `<div class="small muted" style="margin:6px 0 2px">Se a partida acabasse agora:</div>`+lv.map((x,i)=>`<div class="row between small"><span>${x.civ?civLabel(x.civ):escapeHtml(x.name)}${i===0?' <span class="gold">· 1.º</span>':""}</span><strong>${PTS(x.score)} pts</strong></div>${bar(x.score,mx,x.civ?.chartColor||"#888")}`).join("")})()}`;
 renderResult();
}
export const PTS=x=>Math.round(1000*x);   // pontos mostrados ao jogador (1000 = desempenho de referência)
// Placar atual: pontuação final calculada com os dados do fim da última era (civilizações ativas).
export function liveScores(){const e=state.timeline.at(-1);if(!e)return null;const act=e.civs.filter(r=>r.active!==false&&getCiv(state,r.id)?.active);if(!act.length)return null;
 return finalScores(act.map(r=>({id:r.id,dims:r.dims})),e.era,configApplied).map(x=>({...x,name:x.id==="player"?"você":civName(getCiv(state,x.id))||x.id,civ:getCiv(state,x.id)})).sort((a,b)=>b.score-a.score)}
// Pontuação de cada civilização ao longo da partida (mesma fórmula da pontuação final).
export function scoreSeries(){return state.timeline.map(e=>{const rows=e.civs.map(r=>({id:r.id,dims:r.dims}));const sc=finalScores(rows,e.era,configApplied);return e.civs.map((r,k)=>r.active?sc[k].score:0)})}
export function advantageEra(winnerIdx,series){let lastNotLead=0;series.forEach((row,i)=>{const max=Math.max(...row);if(row[winnerIdx]<max-1e-9)lastNotLead=i+1});return lastNotLead+1}
export function renderResult(){
 const s=state,b=$("resultBanner"),r=s.result;
 if(!r){if(!P(s).active){b.className="notice error";b.innerHTML=`<strong>Você foi eliminado na era ${escapeHtml(P(s).eliminatedEra)}.</strong> A partida continua entre os rivais; você pode concluir as eras para ver o final.`}else{b.className="hidden";b.innerHTML=""}return}
 const won=r.type==="victory"&&r.winners[0]==="player",drawn=r.type==="draw"&&r.winners.includes("player");
 const series=scoreSeries(),wIdx=r.type==="victory"?s.civs.findIndex(c=>c.id===r.winners[0]):-1,advEra=wIdx>=0?advantageEra(wIdx,series):null;
 const advTxt=wIdx>=0?(advEra>r.era?"":`${wIdx===0?"Você assumiu":escapeHtml(civName(s.civs[wIdx]))+" assumiu"} a liderança da pontuação na era ${advEra} e não a perdeu mais.`):"";
 const scoreTable=r.scores?`<div class="tablewrap" style="margin-top:8px"><table><thead><tr><th>Civilização</th><th>Pontuação</th><th>Força</th><th>Obras</th><th>Ciência</th><th>Ouro</th><th>Territórios</th></tr></thead><tbody>${[...r.scores].sort((a,b)=>b.score-a.score).map(x=>`<tr><td>${getCiv(s,x.id)?civLabel(getCiv(s,x.id)):escapeHtml(x.id)}</td><td><strong>${PTS(x.score)}</strong></td>${["military","infrastructure","technology","treasury","territories"].map(d=>`<td>${fmt(100*(x.parts[d]??0),0)}%</td>`).join("")}</tr>`).join("")}</tbody></table></div>`:"";
 const legend=s.civs.map(c=>`<span style="--c:${c.chartColor}">${civLabel(c)}</span>`).join("");
 b.className="notice "+(won?"success":drawn?"":"error");
 b.innerHTML=`<strong style="font-size:17px">${won?"🏆 Vitória!":drawn?"🤝 Empate":"Derrota"}</strong> · ${escapeHtml(uiText(describeResult(s,r)))} <span class="pill">${DIFFICULTIES[s.difficulty]?.name||"Médio"}</span>${advTxt?`<div style="margin-top:4px">${advTxt}</div>`:""}<div style="margin-top:4px">Estilos dos rivais: ${aiCivs(s).map(c=>`${civSymHtml(c)} <strong>${escapeHtml(civName(c))}</strong> jogou como ${escapeHtml(profileLabel(c,true))}${c.hiddenProfile?" (sorteado)":""}`).join(" · ")}.</div>
 <div class="grid two" style="margin-top:10px"><section><div class="small muted">Pontuação ao longo da partida${advEra&&advEra<=r.era?" (linha tracejada: início da vantagem)":""}</div><canvas id="endScoreChart" class="chart" style="height:180px"></canvas><div class="chart-legend">${legend}</div></section><section><div class="small muted">Territórios por era</div><canvas id="endTerrChart" class="chart" style="height:180px"></canvas><div class="chart-legend">${legend}</div></section></div>${scoreTable}
 <div class="actions" style="margin-top:10px"><button id="newGameAfterEnd" class="primary">Jogar de novo (mesmas escolhas)</button><button id="changeSettingsAfterEnd">Mudar escolhas</button></div>`;
 svgLine($("endScoreChart"),s.civs.map((c,k)=>({color:c.chartColor,data:series.map((row,i)=>({x:i+1,y:PTS(row[k])}))})),{markX:advEra&&advEra<=r.era?advEra:null});
 svgLine($("endTerrChart"),s.civs.map((c,k)=>({color:c.chartColor,data:s.timeline.map(e=>({x:e.era,y:e.civs[k].territories}))})));
 $("newGameAfterEnd").onclick=startNewGame;$("changeSettingsAfterEnd").onclick=()=>window.openSetup&&window.openSetup(true);
}
/* ── Aviso de orçamento parado ── */
export function showModal(html,buttons){
 $("modalRoot").innerHTML=`<div class="modal-back" role="dialog" aria-modal="true"><div class="modal">${html}<div class="actions" style="margin-top:14px">${buttons.map((b,i)=>`<button data-mb="${i}" class="${b.cls||""}">${b.label}</button>`).join("")}</div></div></div>`;
 buttons.forEach((b,i)=>$("modalRoot").querySelector(`[data-mb="${i}"]`).onclick=()=>{const keep=b.onClick?.();if(keep!==true)$("modalRoot").innerHTML=""});
 $("modalRoot").querySelector('[data-mb="0"]').focus();
}
export function concludeEra(){
 if(hooks.beforeConclude.some(fn=>fn()===false))return;
 if(state.result){startNewGame();return}
 const vals=readAlloc(),sum=vals.reduce((a,b)=>a+b,0),b=P(state).treasury,left=b-sum;
 if(sum>b+1e-8){renderAllocation("O total ultrapassa o orçamento.");return}
 const go=()=>{const tst=$("toast");if(tst)tst.hidden=true;const alloc={military:vals[0],infrastructure:vals[1],technology:vals[2]};playEra(alloc);AREAS.forEach(([k])=>$(k+"Spend").value=0);selectedTerritory=null;renderAll();window.scrollTo({top:0,behavior:"smooth"})};
 if(P(state).active&&!state.ui?.skipIdleWarning&&left>=Math.max(0.5,b*0.01)){
  showModal(`<h2>Você ainda tem ${money(left)} para investir</h2><p class="small muted">O saldo fica guardado para as próximas eras e conta para a vitória, mas não rende nada nem defende o império.</p><label class="small" style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="skipIdle"> Não perguntar de novo nesta partida</label>`,
   [{label:"Voltar e investir",cls:"primary",onClick:()=>{if($("skipIdle").checked){state.ui.skipIdleWarning=true;saveGame()}}},{label:"Concluir mesmo assim",onClick:()=>{if($("skipIdle").checked)state.ui.skipIdleWarning=true;go()}}]);
  return;
 }
 go();
}
// O tutorial joga com Fácil/1 IA/30 eras/modo lento, mas guarda as escolhas anteriores do jogador em
// state.tutorial.prevSetup; a próxima partida nova (Jogar de novo, Reiniciar...) volta a elas.
export function tutorialPrevSetup(){const p=state?.tutorial?.prevSetup;return p&&typeof p==="object"?p:null}
export function restoreSetupAfterTutorial(){
 const p=tutorialPrevSetup();if(!p)return;delete state.tutorial.prevSetup;
 try{const c=clone(configApplied),diff=DIFFICULTIES[p.difficulty]?p.difficulty:DEFAULT_DIFFICULTY;
  c.map.aiCount=p.ai;c.endgame.maxEras=p.eras;c.endgame.supremacyEnabled=p.supremacy!==false;const n=normalizeConfig(c);
  configApplied=n;gameMode=p.mode==="fast"?"fast":"slow";currentDifficulty=diff;applyDifficulty(diff);runHook("configChanged");
 }catch(e){}
}
export function startNewGame(){restoreSetupAfterTutorial();state=newGame();selectedTerritory=null;saveGame();renderAll();window.scrollTo({top:0})}
export function renderAll(){if(!state.ui)state.ui={skipIdleWarning:false};updateFit();renderMetrics();renderMap();renderAllocation();renderForecast();renderHistory();renderNotifications();renderVictory();renderCharts();runHook("afterRender")}
export function setStatus(id,msg,cls=""){const el=$(id);el.className="status "+cls;el.textContent=msg}
// captureDownloads(fn): os próximos download(...) vão para fn(name,text,type) em vez de gerar um ficheiro
// (usado pelos testes internos); devolve a função que desliga a captura.
export let downloadCapture=null;
export function captureDownloads(fn){downloadCapture=fn;return ()=>{if(downloadCapture===fn)downloadCapture=null}}
export function download(name,text,type="application/json"){if(downloadCapture)return downloadCapture(name,text,type);const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export function exportHistory(){download(`imperios-partida-era${state.era}.json`,JSON.stringify({formatVersion:VERSION,exportedAt:new Date().toISOString(),gameMode,config:configApplied,state},null,2))}
export const PARAM_OPTIONS={aiTarget:[["neutralFirst","Priorizar neutros"],["cheapest","Alvo mais barato (estratega)"],["playerFirst","Atacar o jogador primeiro"],["weakest","Menor índice do mapa"],["strongest","Maior índice do mapa"]],aiStyle:[["adaptive","Adaptativa"],["reference","Equilibrado"],["aggressive","Agressivo"],["military","Militar"],["economist","Infraestrutura"],["technologist","Tecnológico"],["custom","Percentuais personalizados"]],accumulation:[["total","Progresso total acumulado"],["individual","Investimentos individuais"]],scoreNormalization:[["log","Logarítmica"],["linear","Linear"]]};
export function paramInput(group,key,label,unit,desc){
 const val=configEdited[group][key],isBool=typeof val==="boolean",isString=typeof val==="string";
 return `<div class="param"><label>${label} <span class="muted">(${unit})</span><br><span class="small">${desc}</span></label>${isBool?`<input type="checkbox" data-param="${group}.${key}" ${val?"checked":""}>`:isString?`<select data-param="${group}.${key}">${(PARAM_OPTIONS[key]||[]).map(([v,t])=>`<option value="${v}" ${val===v?"selected":""}>${t}</option>`).join("")}</select>`:`<input type="number" data-param="${group}.${key}" value="${val}" step="${["precision","delay","duration","peakEra","territories","initialPlayer","initialAI","aiCount","blockSize","seed","maxEras","supremacyEras"].includes(key)?1:"any"}" min="0">`}</div>`;
}
export const PARAM_GROUPS=[
 ["Economia geral","economy",[
 ["initialBudget","Orçamento inicial","unidades","Saldo no início de uma partida."],["baseIncome","Receita base por território","u./era","Receita normal de cada território."],["incomeGrowth","Crescimento da receita normal","fração/era","0 = receita constante; 0,02 = +2% por era."],["precision","Precisão dos cálculos","casas decimais","Arredondamento usado na alocação, não na receita."],["carry","Acumular saldo entre eras","sim/não","O saldo não gasto permanece disponível."],["fastModeReturnMultiplier","Multiplicador de retorno no modo rápido","×","Escala proporcionalmente os retornos de novos investimentos do jogador e da IA no modo rápido; 1 = mesmos valores do modo lento, 0,5 = metade, 2 = dobro. Aplica-se a militar, infraestrutura e tecnologia. Não altera o modo lento."],["aiIncomeMultiplier","Multiplicador de receita das IAs","×","Dificuldade: 0,7 = Muito fácil, 0,9 = Fácil, 1 = Médio/Difícil, 1,05 = Hardcore. Só em partidas com jogador humano; os laboratórios ignoram-no."],["adminCostPerTerritory","Custo administrativo por território","u./era","Cada território além do primeiro reduz a receita de todos os territórios neste valor (0 desliga)."]]],
 ["Militar","military",[["pointsPerInvestment","Pontos por unidade investida","pontos/u.","Poder militar gerado."],["delay","Atraso militar","eras","Mínimo 1: pontos disponíveis na era seguinte."],["conquestCost","Custo de conquista","pontos","Custo adicional por ataque."],["defenseNeutral","Defesa de território neutro","pontos","Defesa aplicada ao conquistar territórios sem domínio; somada ao custo de conquista."],["defenseOwned","Defesa de território dominado","pontos","Defesa aplicada ao atacar territórios controlados pelo jogador ou pela IA."],["winCost","Consumo em ataque bem-sucedido","multiplicador","Fração do custo comprometido consumida."],["lossCost","Consumo em ataque malsucedido","multiplicador","Fração do custo comprometido consumida."],["aiMilitary","Orçamento IA para militar","%","Percentual relativo à soma dos pesos."],["aiInfrastructure","Orçamento IA para infraestrutura","%","Percentual relativo à soma dos pesos."],["aiTechnology","Orçamento IA para tecnologia","%","Percentual relativo à soma dos pesos; usado no perfil personalizado."],["aiStyle","Perfil de decisão da IA","perfil","Militar: prioriza força; Agressivo: militar + economia; Infraestrutura: economia; Tecnológico: tecnologia; Equilibrado: política estável e conservadora; Adaptativa: reage a ameaças e maturidade; Personalizada: usa os pesos abaixo."],["aiAggression","Agressividade militar da IA","%","Chance de tentar atacar em cada era quando possui poder e alvo."],["aiReserve","Reserva de tesouro da IA","%","Percentual da receita/tesouro que a IA guarda sem investir nesta era."],["aiEnabled","Ativar adversário IA","sim/não","Desative para testar economia isolada."],["aiTarget","Critério de alvo da IA","regra","Ordem determinística de escolha de alvos."],["decayRate","Desgaste do exército","fração/era","Pontos militares não usados perdem esta fração no início da era seguinte (0 desliga)."],["defensePerInfraRevenue","Fortificações por infraestrutura","defesa por u.","Defesa extra de cada território próprio por unidade de receita de infraestrutura do dono (0,1 = +1 por cada 10 u.)."],["defensePerTechProgress","Defesa por tecnologia","defesa por progresso","Defesa extra de cada território próprio por ponto de progresso tecnológico do dono (0,05 = +1 por cada 20)."],["defenseSplitExponent","Repartição da defesa econômica","expoente","A defesa vinda da infraestrutura e da tecnologia divide-se por (territórios ^ expoente). 0 = sem repartição; 0,5 = raiz quadrada; 1 = divisão total."],["simultaneousOrders","Ordens simultâneas","sim/não","Ligado: cada civilização dá uma ordem de ataque por era e todas se resolvem juntas no fim da era (disputas viram batalhas). Desligado: ataques imediatos."],["maxOrdersPerEra","Ordens de ataque por era","ordens (0 = sem limite)","Quantas ordens de ataque cada civilização pode dar na mesma era."],["extraOrderCostStep","Custo das ordens adicionais","+ por ordem","Cada ordem adicional na mesma era custa ×(1 + este valor × n): com 1, a 2.ª custa o dobro e a 3.ª o triplo."],["battleTechWeight","Tecnologia na força de batalha","por ponto de progresso","Força numa disputa pelo mesmo território = poder militar + este peso × progresso tecnológico."],["pillageInvestShare","Saque de investimentos","× parte do território","Ao conquistar um território de outra civilização, o vencedor leva esta multiplicação de 1/territórios do derrotado (até 50%) da infraestrutura ativa e da tecnologia dele. 0 = sem saque."],["pillageRevenueEras","Espólio em tesouro","eras de receita","O vencedor recebe em tesouro esta quantidade de eras da receita do território conquistado."]]],
 ["Infraestrutura","infrastructure",[["delay","Atraso de retorno","eras","Primeira era em que o retorno pode ocorrer."],["initialReturn","Retorno inicial por unidade","fração/era","Multiplicado pelo investimento."],["peakEra","Idade até o pico","eras","Cresce até essa idade; 1 desativa a fase de crescimento."],["growthRate","Crescimento até o pico","fração/era","Crescimento composto por idade."],["declineRate","Redução após o pico","fração/era","Redução geométrica por era."],["duration","Duração do retorno","eras","Após essa idade, o retorno termina."],["residual","Retorno residual mínimo","fração/era","0 desativa piso residual; aplica-se durante a duração."]]],
 ["Tecnologia","technology",[["progressPerInvestment","Progresso por unidade","progresso/u.","Converte investimento em progresso."],["delay","Atraso tecnológico","eras","Primeiro benefício após o atraso."],["benefitPerProgress","Benefício por progresso","u./era/progresso","Benefício recorrente de cada investimento."],["maxBenefit","Limite de benefício","u./era","0 significa sem limite."],["accumulation","Acumulação","regra","Os investimentos ativados somam benefícios individuais."],["revenueBonusPerProgress","Bônus de receita por progresso","fração/progresso","Bônus permanente sobre toda a receita por ponto de progresso já ativo (0,001 = +1% por cada 10)."],["revenueBonusCap","Teto do bônus tecnológico","fração","Bônus máximo sobre a receita (1 = +100%). Evita crescimento explosivo."]]],
 ["Mapa e simulação","map",[["territories","Número de territórios","territórios","Mapa retangular simplificado, máximo 30."],["initialPlayer","Territórios iniciais do jogador","territórios","MVP começa com um território do jogador."],["initialAI","Territórios iniciais da IA","territórios","MVP começa com um território da IA."],["aiCount","Número de civilizações IA","IAs (1–5)","Quantidade de adversários controlados por IA. Requer reiniciar a partida."]]],
 ["Fim de partida","endgame",[["enabled","Ativar condições de fim no jogo","sim/não","Vitória territorial, eliminação, supremacia e limite de eras. Vale para novas partidas."],["supremacyEnabled","Vitória por supremacia","sim/não","Desligada no modo Conquista: só a maioria territorial, a eliminação ou a pontuação na última era decidem."],["maxEras","Limite máximo de eras","eras (10–150)","Ao atingir o limite sem outra vitória, decide a pontuação final por recursos."],["territoryPct","Maioria territorial","fração","0,8 = 80% de todos os territórios existentes, arredondado para cima."],
  ["supremacyRelative","Limite relativo da supremacia","fração","O 2º maior ICE tem de ser ≤ esta fração do ICE do líder (0,1 = 10%)."],["supremacyEras","Eras consecutivas","eras","Duração da condição de supremacia para vencer."],["supremacyMinEraShare","Supremacia: fração mínima do limite de eras","fração","A sequência só conta a partir desta fração do limite (0,5 = metade; 0 desliga)."],["supremacyMaxNeutralShare","Supremacia: territórios livres máximos","fração","A sequência só conta com no máximo esta fração do mapa neutra (0,25 = 6 de 24; 1 desliga)."],["leaderTieMargin","Margem de empate na liderança","fração","Diferença relativa abaixo da qual não há líder único."],["iceMinAbsolute","ICE absoluto mínimo","ICE","O líder precisa de ICE ≥ este valor (lista por era opcional via JSON: iceMinByEra)."],["iceFloor","Piso mínimo do ICE","normalizado","Aplicado a cada dimensão depois da normalização."],
  ["iceWMilitary","Peso militar no ICE","fração","Os cinco pesos do ICE somam 1."],["iceWInfrastructure","Peso infraestrutura no ICE","fração",""],["iceWTechnology","Peso tecnologia no ICE","fração",""],["iceWFinance","Peso financeiro no ICE","fração",""],["iceWTerritory","Peso territorial no ICE","fração","Territórios controlados (normalizados pela referência da era)."],["financeTreasuryWeight","Tesouraria na dimensão financeira","fração","O restante é a receita média das últimas 3 eras."],
  ["scoreTerritoryProportional","Territórios proporcionais na pontuação","sim/não","Ligado: o dobro de territórios dá o dobro dos pontos nessa área. Desligado: escala logarítmica, como as outras áreas."],["scoreWMilitary","Peso militar na pontuação final","fração","Os cinco pesos da pontuação somam 1."],["scoreWInfrastructure","Peso infraestrutura na pontuação","fração",""],["scoreWTechnology","Peso tecnologia na pontuação","fração",""],["scoreWTreasury","Peso tesouraria na pontuação","fração",""],["scoreWTerritory","Peso territórios na pontuação","fração",""],["scoreNormalization","Normalização da pontuação","método","Logarítmica (padrão) ou linear."],
  ["scoreCapMilitary","Limite militar","normalizado","1,5 = 150% da referência."],["scoreCapInfrastructure","Limite infraestrutura","normalizado",""],["scoreCapTechnology","Limite tecnologia","normalizado",""],["scoreCapTreasury","Limite tesouraria","normalizado",""],["scoreCapTerritory","Limite territórios","normalizado",""],["scoreTieMargin","Margem de empate na pontuação","fração","0,01 = empate até 1% abaixo da maior pontuação."],["extendForSupremacy","Prolongar para completar supremacia (experimental)","sim/não","Se houver sequência ativa no limite, a partida continua até completá-la ou interrompê-la."]]],
 ["Desempenho","simulation",[["blockSize","Tamanho do bloco","eras/bloco","Parâmetro de processamento em blocos."],["seed","Semente aleatória","inteiro","Mantém os testes reprodutíveis."]]]
];
export function renderParams(){
 const groups=PARAM_GROUPS;
 $("params").innerHTML=groups.map(([title,g,items])=>`<h3>${title}</h3><div class="param-grid">${items.map(p=>paramInput(g,...p)).join("")}</div>`).join("");
 document.querySelectorAll("[data-param]").forEach(el=>el.addEventListener("change",()=>{const [g,k]=el.dataset.param.split(".");let v;try{v=paramValue(el)}catch(e){el.setAttribute("aria-invalid","true");setStatus("labStatus",e.message,"error");return}el.removeAttribute("aria-invalid");configEdited[g][k]=v;$("configState").textContent="Edição pendente";}));
}
// Valor de um campo das Configurações. Campo numérico vazio ou inválido é recusado (Number("") seria 0).
export function paramValue(el){
 if(el.type==="checkbox")return el.checked;
 if(el.type!=="number")return el.value;
 const raw=String(el.value).trim(),n=Number(raw);
 if(raw===""||!Number.isFinite(n)){const [g,k]=el.dataset.param.split("."),grp=PARAM_GROUPS.find(x=>x[1]===g),item=grp&&grp[2].find(x=>x[0]===k);throw Error(`Campo “${item?item[1]:el.dataset.param}” vazio ou inválido: escreva um número. Nada foi alterado.`)}
 return n;
}
// Lê todos os campos; se algum for inválido, lança erro sem alterar configEdited.
export function readParams(){const next=clone(configEdited);document.querySelectorAll("[data-param]").forEach(el=>{const [g,k]=el.dataset.param.split(".");next[g][k]=paramValue(el)});const c=normalizeConfig(next);configEdited=next;return c}
export function applyConfig(){
 const c=readParams();rememberAiBase(c);if($("recalcExisting").checked){configApplied=clone(c);state=newGame();selectedTerritory=null;addLog(state,"Partida reiniciada com recálculo explícito.");}
 else configApplied=clone(c);
 configEdited=clone(c);renderParams();renderAll();$("configState").textContent="Configuração aplicada";setStatus("labStatus",$("recalcExisting").checked?"Configuração aplicada e partida reiniciada.":"Configuração aplicada. Investimentos existentes mantêm seus parâmetros originais.","success");
}
export function loadJsonFile(file,kind){
 const reader=new FileReader();reader.onload=()=>{try{const obj=JSON.parse(reader.result);if(kind==="config"){const c=normalizeConfig(obj.config||obj);configEdited=clone(c);renderParams();setStatus("labStatus","Configuração validada e carregada na área de edição. Clique em Aplicar configurações para usar.","success")}else{if(!SUPPORTED_VERSIONS.includes(obj.formatVersion))throw Error("Versão de cenário não suportada.");const c=normalizeConfig(obj.config);if(!obj.initial||!Number.isInteger(obj.eras)||obj.eras<1)throw Error("Cenário incompleto.");scenarioLoaded=obj;configEdited=clone(c);renderParams();$("scenarioName").value=obj.name||"Cenário importado";$("scenarioEras").value=obj.eras;setStatus("scenarioStatus","Cenário validado. Execute-o ou salve-o novamente.","success")}}catch(e){setStatus(kind==="config"?"labStatus":"scenarioStatus","Importação recusada: "+e.message,"error")}};reader.readAsText(file)}
export function strategyName(s){return ({military:"Militar",aggressive:"Militar agressiva",infrastructure:"Infraestrutura",technology:"Tecnologia",techFirst:"Tecnologia primeiro",growth:"Crescimento",balanced:"Equilibrada",custom:"Personalizada"})[s]||s}
export function runStrategy(strategy,eras){
 eras=safeNum(eras,1,1e7);if(!Number.isSafeInteger(eras))throw Error("Informe um número inteiro de eras.");
 const cfg=clone(configApplied),s=simulate(strategy,eras,cfg,null,[Number($("customMil").value),Number($("customInfra").value),Number($("customTech").value)],null,gameMode);
 lastStrategyResult={strategy,eras,state:s};const r=s.history[s.history.length-1]||{};
 $("strategyResult").innerHTML=`<div class="notice success"><strong>${strategyName(strategy)}</strong> após ${eras} eras: saldo ${money(P(s).treasury)}, receita acumulada ${money(r.cumRevenue||0)}, territórios ${s.owners.filter(o=>o==="player").length}, poder militar ${fmt(P(s).military,1)}.</div>`;
 setStatus("strategyStatus","Simulação concluída sem alterar a partida atual.","success");return s;
}
export async function runLong(n,opts={}){
 if(busy)return;busy=true;cancelRequested=false;$("cancelAdvance").disabled=false;$("advance").disabled=true;let done=0;const start=performance.now();
 try{while(done<n&&!cancelRequested&&!state.result){const batch=Math.min(configApplied.simulation.blockSize,n-done);for(let i=0;i<batch&&!state.result;i++){playEra({military:0,infrastructure:0,technology:0});done++}$("advanceProgress").style.width=(100*done/n)+"%";setStatus("advanceStatus",`Processadas ${fmt(done,0)} de ${fmt(n,0)} eras · era atual ${state.era} · ${fmt(performance.now()-start,0)} ms`);renderMetrics();await new Promise(r=>setTimeout(r,0))}
 renderAll();setStatus("advanceStatus",cancelRequested?`Cancelado após ${done} eras concluídas. O histórico foi preservado.`:state.result?`Partida encerrada após ${done} eras: ${describeResult(state,state.result)}`:`Concluído: ${done} eras processadas. Era atual: ${state.era}.`,"success");
 }catch(e){renderAll();setStatus("advanceStatus","Simulação interrompida: "+e.message,"error")}finally{busy=false;$("cancelAdvance").disabled=true;$("advance").disabled=false}
}
export async function compareStrategies(){
 const selected=[...document.querySelectorAll('#compareChecks input:checked')].map(x=>x.value);if(selected.length<2){setStatus("compareStatus","Selecione pelo menos duas estratégias.","error");return}
 const eras=safeNum($("compareEras").value,1,1e6);if(!Number.isSafeInteger(eras))throw Error("Quantidade de eras deve ser inteira.");
 let custom=[34,33,33];const raw=$("compareCustom").value.split(/[\/;, ]+/).filter(Boolean).map(Number);if(raw.length===3&&raw.every(v=>Number.isFinite(v)&&v>=0))custom=raw;
 compareResults=[];$("compareTable").innerHTML="";setStatus("compareStatus","Executando simulações independentes com expansão territorial ativa...");await new Promise(r=>setTimeout(r,0));
 for(let i=0;i<selected.length;i++){
  const strategy=selected[i],cfg=clone(configApplied);cfg.military.aiEnabled=$("compareAI").checked;cfg.military.aiTarget=$("compareTarget").value;
  const s=simulate(strategy,eras,cfg,null,custom,null,gameMode),last=s.history[s.history.length-1]||{},a=s.attacks||{};
  const rec={strategy,state:s,summary:{lastRevenue:last.total||0,cumRevenue:last.cumRevenue||0,budget:P(s).treasury,military:P(s).military,territories:s.owners.filter(o=>o==="player").length,maxTerritories:P(s).maxTerritories||1,territoryYears:P(s).territoryYears||0,militaryEfficiency:((a.playerWins||0)+(a.playerLosses||0))?100*(a.playerWins||0)/((a.playerWins||0)+(a.playerLosses||0)):0,neutralConquests:a.neutralConquests||0,enemyConquests:a.enemyConquests||0,attackWins:a.playerWins||0,attackLosses:a.playerLosses||0,aiWins:a.aiWins||0,invested:P(s).invested,infra:P(s).infraTotal,tech:s.history.reduce((z,r)=>z+r.tech,0),milEfficiency:(a.neutralConquests||0)+(a.enemyConquests||0),firstInfra:s.investments.find(x=>x.owner==="player"&&x.type==="infrastructure")?.origin+cfg.infrastructure.delay||"—",firstTech:s.investments.find(x=>x.owner==="player"&&x.type==="technology")?.origin+cfg.technology.delay||"—"} };
  compareResults.push(rec);const q=rec.summary;
  $("compareTable").innerHTML+=`<tr><td><strong>${strategyName(strategy)}</strong></td><td>${money(q.lastRevenue)}</td><td>${money(q.cumRevenue)}</td><td>${money(q.budget)}</td><td>${fmt(q.military,1)}</td><td>${q.territories}</td><td>${q.maxTerritories}</td><td>${q.territoryYears}</td><td>${fmt(q.militaryEfficiency,1)}%</td><td>${q.neutralConquests}</td><td>${q.enemyConquests}</td><td>${q.attackWins}</td><td>${q.attackLosses}</td><td>${money(q.invested.military)}</td><td>${money(q.invested.infrastructure)}</td><td>${money(q.invested.technology)}</td><td>${money(q.infra)}</td><td>${money(q.tech)}</td><td>${q.firstInfra}</td><td>${q.firstTech}</td></tr>`;
  setStatus("compareStatus",`Concluídas ${i+1}/${selected.length}: ${strategyName(strategy)}.`);await new Promise(r=>setTimeout(r,0));
 }
 const draw=(canvas,key,acc=false)=>svgLine($(canvas),compareResults.map((r,i)=>({color:COMPARE_COLORS[i%COMPARE_COLORS.length],data:r.state.history.map(h=>({x:h.era,y:acc?h.cumRevenue:key==="budget"?h.budget:key==="territories"?h.territories:key==="military"?h.military:h.total}))})));
 draw("compareRevenue","revenue");draw("compareAccum","revenue",true);draw("compareTerritory","territories");draw("compareBalance","budget");svgLine($("compareAttacks"),compareResults.map((r,i)=>({color:COMPARE_COLORS[i%COMPARE_COLORS.length],data:r.state.history.map(h=>({x:h.era,y:(h.attacksTotal?.playerWins||0)}))})));
 $("compareLegend").innerHTML=compareResults.map((r,i)=>`<span style="--c:${COMPARE_COLORS[i%COMPARE_COLORS.length]}">${strategyName(r.strategy)}</span>`).join("");
 setStatus("compareStatus",`${compareResults.length} estratégias comparadas em ${eras} eras. Métricas territoriais incluem máximo de territórios, conquistas neutras/inimigas e ataques ganhos/perdidos. IA ${$("compareAI").checked?"ativada":"desativada"}. Partida principal preservada.`,"success");
}
export function scenarioPreset(kind){
 const c=clone(DEFAULTS);
 if(kind==="fast"){c.military.pointsPerInvestment=.22;c.military.conquestCost=3;c.military.defenseNeutral=2;c.military.defenseOwned=5;c.military.delay=1;c.infrastructure.delay=1;c.infrastructure.duration=6;c.technology.delay=6}
 if(kind==="balanced"){c.military.pointsPerInvestment=.12;c.military.conquestCost=8;c.military.defenseNeutral=3;c.military.defenseOwned=8;c.infrastructure.initialReturn=.12;c.infrastructure.peakEra=3;c.infrastructure.declineRate=.16;c.technology.delay=4}
 if(kind==="long"){c.military.pointsPerInvestment=.08;c.infrastructure.delay=3;c.infrastructure.duration=30;c.infrastructure.peakEra=8;c.infrastructure.growthRate=.12;c.infrastructure.declineRate=.08;c.technology.delay=7;c.technology.benefitPerProgress=.13}
 configEdited=clone(c);renderParams();setStatus("scenarioStatus",`Cenário "${kind}" carregado na edição. Aplique a configuração ou exporte como cenário.`,"success");
 scenarioLoaded={formatVersion:VERSION,name:kind,config:c,initial:newState(c),eras:Number($("scenarioEras").value)||50,strategy:"balanced"};
}
export function scenarioObject(){return {formatVersion:VERSION,name:$("scenarioName").value||"Meu cenário",config:normalizeConfig(configEdited),initial:newState(normalizeConfig(configEdited)),eras:safeNum($("scenarioEras").value,1,1e7),strategy:"balanced"}}
export function renderScenarioResult(s,name){const r=s.history[s.history.length-1]||{};$("scenarioResult").innerHTML=`<div class="notice success">${escapeHtml(name)}: ${s.era} eras, saldo ${money(P(s).treasury)}, receita acumulada ${money(r.cumRevenue||0)}, ${s.owners.filter(o=>o==="player").length} territórios e poder militar ${fmt(P(s).military,1)}.</div>`}
export let aiValidationResults=[],balanceLabResults=[];
export function profileExpectedWeights(profile,cfg){
 if(profile==="reference")return [34,33,33];if(profile==="military")return [65,25,10];if(profile==="aggressive")return [68,22,10];if(profile==="economist")return [20,65,15];if(profile==="technologist")return [20,20,60];if(profile==="custom")return [cfg.military.aiMilitary,cfg.military.aiInfrastructure,cfg.military.aiTechnology];return null;
}
export function aiProbe(profile,threatened,seed){
 const cfg=clone(configApplied);cfg.simulation.seed=seed;cfg.military.aiStyle=profile;cfg.military.aiAggression=0;cfg.military.aiReserve=0;cfg.military.aiEnabled=true;
 const s=newState(cfg,{mode:gameMode});s.owners=Array(cfg.map.territories).fill("neutral");s.owners[0]="player";s.owners[22]="ai";s.owners[23]="ai";if(threatened)s.owners[16]="player";
 processEra(s,cfg,{playerAllocation:{military:0,infrastructure:0,technology:0}});
 const r=s.history.at(-1),sum=r.aiBudgetInvested||0;
 return {military:sum?r.aiInvestment.military/sum:0,infrastructure:sum?r.aiInvestment.infrastructure/sum:0,technology:sum?r.aiInvestment.technology/sum:0,investment:sum};
}
export function runAiControlProbe(profile,aggression,seed){
 const cfg=clone(configApplied);cfg.simulation.seed=seed;cfg.military.aiStyle=profile;cfg.military.aiAggression=aggression;cfg.military.aiReserve=0;cfg.military.aiEnabled=true;cfg.military.aiTarget="neutralFirst";
 const s=newState(cfg,{mode:gameMode});s.owners[22]="ai";A(s).military=100;
 processEra(s,cfg,{playerAllocation:{military:0,infrastructure:0,technology:0}});
 return {attacks:s.attacks.aiWins+s.attacks.aiLosses,action:s.history.at(-1).aiAction,valid:Number.isFinite(A(s).treasury)&&A(s).treasury>=0};
}
export function pct(pass,total){return total?100*pass/total:0}
export async function runAiValidation(){
 if(busy)return;const profiles=[...document.querySelectorAll('#aiValidationProfiles input:checked')].map(x=>x.value);if(!profiles.length)throw Error("Selecione ao menos um perfil.");
 const runs=safeNum($("aiValidationRuns").value,3,100),eras=safeNum($("aiValidationEras").value,5,100);if(!Number.isInteger(runs)||!Number.isInteger(eras))throw Error("Sementes e eras devem ser números inteiros.");
 busy=true;$("runAiValidation").disabled=true;aiValidationResults=[];$("aiValidationTable").innerHTML="";$("aiValidationDetails").innerHTML="";$("aiValidationProgress").style.width="0%";
 const total=profiles.length,details=[];
 try{
  for(let pi=0;pi<profiles.length;pi++){
   const profile=profiles[pi],cfg=clone(configApplied);cfg.military.aiStyle=profile;cfg.military.aiEnabled=true;cfg.military.aiAggression=55;cfg.military.aiReserve=0;
   let financePass=0,financeTotal=0,attackControlPass=0,attackControlTotal=0,investShares=[0,0,0],investCount=0,completed=0,invalid=0;
   for(let k=0;k<runs;k++){
    const c=clone(cfg);c.simulation.seed=(Number(configApplied.simulation.seed)+k*7919+pi*104729)>>>0;const s=newState(c,{mode:gameMode});
    try{for(let e=0;e<eras;e++){const treasuryBefore=A(s).treasury;processEra(s,c,{playerAllocation:e===0?{military:0,infrastructure:0,technology:0}:undefined});const row=s.history.at(-1);financeTotal++;const available=treasuryBefore+(row.aiRevenue?.total||0);if(Number.isFinite(A(s).treasury)&&A(s).treasury>=-1e-8&&Number.isFinite(row.aiBudgetInvested)&&row.aiBudgetInvested<=available+1e-6&&Math.abs(A(s).treasury-(available-row.aiBudgetInvested))<1e-5)financePass++;const inv=row.aiInvestment||{},sum=inv.military+inv.infrastructure+inv.technology;if(sum>0){investShares[0]+=inv.military/sum;investShares[1]+=inv.infrastructure/sum;investShares[2]+=inv.technology/sum;investCount++}}completed++;}catch(e){invalid++;details.push(`${AI_PROFILE_NAMES[profile]} · semente ${c.simulation.seed}: ${e.message}`)}
    const noAttack=runAiControlProbe(profile,0,c.simulation.seed+17),mustAttack=runAiControlProbe(profile,100,c.simulation.seed+31);attackControlTotal+=2;if(noAttack.attacks===0&&mustAttack.attacks>0&&mustAttack.valid)attackControlPass+=2;
   }
   const actual=investShares.map(v=>investCount?v/investCount:0),expected=profileExpectedWeights(profile,cfg);let profileScore=null;
   if(expected){const es=expected.reduce((a,b)=>a+Math.max(0,b),0)||1,dist=actual.reduce((a,v,i)=>a+Math.abs(v-Math.max(0,expected[i])/es),0)/2;profileScore=clamp(100*(1-dist),0,100)}
   let adaptation=null;if(profile==="adaptive"){const safe=aiProbe(profile,false,cfg.simulation.seed+777),threat=aiProbe(profile,true,cfg.simulation.seed+777);adaptation=clamp(50+(threat.military-safe.military)*100,0,100);details.push(`${AI_PROFILE_NAMES[profile]}: parcela militar em segurança ${fmt(safe.military*100,1)}% → sob ameaça ${fmt(threat.military*100,1)}%.`);if(threat.military<=safe.military+0.02)details.push(`${AI_PROFILE_NAMES[profile]}: a participação militar não aumentou claramente sob ameaça.`)}
   const finance=pct(financePass,financeTotal),attack=pct(attackControlPass,attackControlTotal);let weighted=finance*.35+attack*.15,weightTotal=50;if(profileScore!==null){weighted+=profileScore*.35;weightTotal+=35}if(adaptation!==null){weighted+=adaptation*.15;weightTotal+=15}const overall=weighted*100/weightTotal;
   const rec={profile,name:AI_PROFILE_NAMES[profile],finance,profileScore,adaptation,attack,overall,completed,invalid,shares:actual};aiValidationResults.push(rec);
   $("aiValidationTable").innerHTML+=`<tr><td><strong>${rec.name}</strong></td><td>${fmt(finance,1)}%</td><td>${profileScore===null?'N/A':fmt(profileScore,1)+'%'}</td><td>${adaptation===null?'N/A':fmt(adaptation,1)+'%'}</td><td>${fmt(attack,1)}%</td><td><strong>${fmt(overall,1)}%</strong></td></tr>`;
   $("aiValidationProgress").style.width=(100*(pi+1)/total)+"%";setStatus("aiValidationStatus",`Validando ${rec.name}: ${pi+1}/${total} perfis · ${completed}/${runs} execuções completas.`);await new Promise(r=>setTimeout(r,0));
  }
  const avg=aiValidationResults.reduce((a,r)=>a+r.overall,0)/aiValidationResults.length;
  $("aiValidationSummary").innerHTML=`<div class="notice ${avg>=80?'success':'notice'}"><strong>Conformidade média: ${fmt(avg,1)}%</strong> · ${aiValidationResults.reduce((a,r)=>a+r.completed,0)} execuções completas · ${aiValidationResults.reduce((a,r)=>a+r.invalid,0)} execuções com erro. Esta nota resume apenas os benchmarks implementados.</div>`;
  $("aiValidationDetails").innerHTML=details.length?`<div class="notice">${details.map(x=>`<div>${x}</div>`).join("")}</div>`:'<div class="notice success">Nenhuma anomalia adicional detectada pelos benchmarks executados.</div>';
  setStatus("aiValidationStatus","Validação concluída. Examine as dimensões individualmente; uma média alta não substitui revisão de decisões reais.","success");
 }finally{busy=false;$("runAiValidation").disabled=false}
}
export function exportAiValidation(){if(!aiValidationResults.length){setStatus("aiValidationStatus","Execute a validação antes de exportar.","error");return}const rows=[["profile","finance_pct","profile_alignment_pct","adaptation_pct","attack_control_pct","overall_pct","completed","invalid","military_share","infrastructure_share","technology_share"],...aiValidationResults.map(r=>[r.profile,r.finance,r.profileScore??"",r.adaptation??"",r.attack,r.overall,r.completed,r.invalid,...r.shares])];download("imperios-validacao-ias.csv",rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(";")).join("\n"),"text/csv;charset=utf-8")}
export function sideMetrics(s){const last=s.history.at(-1)||{},aiRevenue=s.history.reduce((a,r)=>a+(r.aiRevenue?.total||0),0),playerRevenue=s.history.reduce((a,r)=>a+(r.total||0),0);return {pTerr:s.owners.filter(o=>o==="player").length,aTerr:s.owners.filter(o=>o==="ai").length,pBudget:P(s).treasury,aBudget:A(s).treasury,pMil:P(s).military,aMil:A(s).military,pRevenue:playerRevenue,aRevenue:aiRevenue,pInvest:s.investments.filter(i=>i.owner==="player").reduce((a,i)=>a+i.amount,0),aInvest:s.investments.filter(i=>i.owner==="ai").reduce((a,i)=>a+i.amount,0),eras:s.era,valid:Number.isFinite(P(s).treasury)&&Number.isFinite(A(s).treasury)&&P(s).treasury>=-1e-8&&A(s).treasury>=-1e-8}}
export function share(a,b){return a+b>0?a/(a+b):.5}
export function matchupIndex(m){return 100*(share(m.pTerr,m.aTerr)+share(m.pBudget,m.aBudget)+share(m.pMil,m.aMil)+share(m.pRevenue,m.aRevenue))/4}
export async function runBalanceLab(){
 if(busy)return;const strategies=[...document.querySelectorAll('#balanceStrategies input:checked')].map(x=>x.value),profiles=[...document.querySelectorAll('#balanceProfiles input:checked')].map(x=>x.value);if(!strategies.length||!profiles.length)throw Error("Selecione ao menos uma estratégia e um perfil adversário.");
 const seeds=safeNum($("balanceSeeds").value,3,100),eras=safeNum($("balanceEras").value,5,300);if(!Number.isInteger(seeds)||!Number.isInteger(eras))throw Error("Sementes e eras devem ser inteiros.");
 const total=strategies.length*profiles.length*seeds;let done=0;busy=true;$("runBalanceLab").disabled=true;balanceLabResults=[];$("balanceTable").innerHTML="";$("balanceProgress").style.width="0%";
 try{
  for(const strategy of strategies)for(const profile of profiles){let aggregate={pTerr:0,aTerr:0,pBudget:0,aBudget:0,pMil:0,aMil:0,pRevenue:0,aRevenue:0,pInvest:0,aInvest:0},valid=0;
   for(let k=0;k<seeds;k++){
    const cfg=clone(configApplied);cfg.military.aiEnabled=true;cfg.military.aiStyle=profile;cfg.simulation.seed=(Number(configApplied.simulation.seed)+k*104729)>>>0;
    const s=simulate(strategy,eras,cfg,null,undefined,null,gameMode);const m=sideMetrics(s);if(m.valid){valid++;for(const key of Object.keys(aggregate))aggregate[key]+=m[key]}
    done++;$("balanceProgress").style.width=(100*done/total)+"%";
    if(done%4===0){setStatus("balanceStatus",`Executando confrontos: ${done}/${total} partidas · ${strategyName(strategy)} contra ${AI_PROFILE_NAMES[profile]}.`);await new Promise(r=>setTimeout(r,0))}
   }
   const avg={};for(const key of Object.keys(aggregate))avg[key]=valid?aggregate[key]/valid:0;const advantage=matchupIndex(avg);const rec={strategy,profile,name:AI_PROFILE_NAMES[profile],valid,total:seeds,advantage,...avg};balanceLabResults.push(rec);
   $("balanceTable").innerHTML+=`<tr><td><strong>${strategyName(strategy)}</strong></td><td>${rec.name}</td><td><strong>${fmt(advantage,1)}%</strong></td><td>${fmt(avg.pTerr,1)} / ${fmt(avg.aTerr,1)}</td><td>${money(avg.pBudget)} / ${money(avg.aBudget)}</td><td>${fmt(avg.pMil,1)} / ${fmt(avg.aMil,1)}</td><td>${money(avg.pRevenue)} / ${money(avg.aRevenue)}</td><td>${money(avg.pInvest)} / ${money(avg.aInvest)}</td><td>${valid}/${seeds}</td></tr>`;
  }
  const avgAdv=balanceLabResults.reduce((a,r)=>a+r.advantage,0)/balanceLabResults.length,invalid=balanceLabResults.reduce((a,r)=>a+r.total-r.valid,0);
  $("balanceSummary").innerHTML=`<div class="notice ${invalid===0?'success':'error'}"><strong>Índice médio de vantagem do jogador: ${fmt(avgAdv,1)}%</strong> · ${done} partidas executadas · ${invalid} partidas inválidas. 50% representa paridade nas quatro dimensões avaliadas.</div>`;
  setStatus("balanceStatus","Torneio concluído. Compare os confrontos e métricas individuais; o índice não representa taxa de vitória.","success");
 }finally{busy=false;$("runBalanceLab").disabled=false}
}
export function exportBalanceLab(){if(!balanceLabResults.length){setStatus("balanceStatus","Execute o torneio antes de exportar.","error");return}const rows=[["strategy","ai_profile","player_advantage_index","player_territories_avg","ai_territories_avg","player_treasury_avg","ai_treasury_avg","player_military_avg","ai_military_avg","player_cumulative_revenue_avg","ai_cumulative_revenue_avg","player_investment_avg","ai_investment_avg","valid_matches","requested_matches"],...balanceLabResults.map(r=>[r.strategy,r.profile,r.advantage,r.pTerr,r.aTerr,r.pBudget,r.aBudget,r.pMil,r.aMil,r.pRevenue,r.aRevenue,r.pInvest,r.aInvest,r.valid,r.total])];download("imperios-laboratorio-balanceamento.csv",rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(";")).join("\n"),"text/csv;charset=utf-8")}
/* ── Interface: duração fixa e referências ── */
export let fixedRun={games:[],calibration:null,opts:null},fixedCancel=false;
export function readFixedOpts(){
 const games=safeNum($("fixedGames").value,1,2000),eras=safeNum($("fixedEras").value,1,300),civCount=safeNum($("fixedCivs").value,2,1+MAX_AI),baseSeed=safeNum($("fixedSeed").value,0,4294967295);
 if(![games,eras,civCount,baseSeed].every(Number.isInteger))throw Error("Partidas, eras, civilizações e semente devem ser inteiros.");
 const profiles=[...document.querySelectorAll("#fixedProfiles input:checked")].map(x=>x.value);if(!profiles.length)throw Error("Selecione pelo menos um perfil.");
 if(civCount>configApplied.map.territories)throw Error("Mais civilizações do que territórios.");
 return {games,eras,civCount,baseSeed,profiles,mode:$("fixedMode").value==="fast"?"fast":"slow"};
}
export async function runFixedLab(){
 if(busy)return;const opts=readFixedOpts();busy=true;fixedCancel=false;fixedRun={games:[],calibration:null,opts};
 $("runFixed").disabled=true;$("cancelFixed").disabled=false;$("applyCalibration").disabled=true;$("fixedSummary").innerHTML="";$("fixedProgress").style.width="0%";
 try{
  const cfg=clone(configApplied);
  fixedRun.games=await runFixedDurationBatch(cfg,opts,(done,total,ms)=>{$("fixedProgress").style.width=(100*done/total)+"%";setStatus("fixedStatus",`A executar · ${done} de ${total} partidas (${fmt(100*done/total,0)}%) · ${fmt(ms/1000,1)} s`)},()=>fixedCancel);
  if(!fixedRun.games.length){setStatus("fixedStatus","Cancelado antes de concluir qualquer partida.","error");return}
  fixedRun.calibration=calibrateReferences(fixedRun.games,{seedBase:opts.baseSeed,mode:opts.mode,profiles:opts.profiles,civCount:opts.civCount,requestedGames:opts.games,date:new Date().toISOString()});
  renderFixedResults();$("applyCalibration").disabled=false;
  setStatus("fixedStatus",fixedCancel?`Cancelado: ${fixedRun.games.length} de ${opts.games} partidas concluídas e preservadas. A calibração usa apenas as concluídas.`:`Concluído: ${fixedRun.games.length} partidas × ${opts.eras} eras. Reveja as referências e clique em Aplicar.`,"success");
 }finally{busy=false;$("runFixed").disabled=false;$("cancelFixed").disabled=true}
}
export function renderFixedResults(){
 const cal=fixedRun.calibration;if(!cal)return;
 const warn=REF_DIMS.map(([d,name])=>{const n=cal.fallback[d].filter(Boolean).length,z=cal.stats[d].reduce((a,s)=>a+s.zeroShare,0)/cal.eras;return n||z>.25?`<div><strong>${name}</strong>: ${fmt(100*z,0)}% das observações são zero${n?`; mediana zero em ${n} de ${cal.eras} eras → referência de recurso (${d==="treasury"?"receita de referência da era":"média ou 1"})`:""}.</div>`:""}).join("");
 const prof=fixedProfileSummary(fixedRun.games);
 $("fixedSummary").innerHTML=`<div class="notice success"><strong>${cal.meta.games} partidas</strong> · ${cal.eras} eras · ${cal.meta.civCount} civilizações · modo ${cal.meta.mode==="fast"?"rápido":"lento"} · perfis: ${cal.meta.profiles.map(p=>LAB_PROFILE_NAME[p]).join(", ")}.</div>${warn?`<div class="notice">${warn}</div>`:""}
 <h3>Situação na última era, por perfil</h3><div class="tablewrap"><table><thead><tr><th>Perfil</th><th>Lugares</th><th>Territórios</th>${REF_DIMS.map(([,n])=>`<th>${n}</th>`).join("")}</tr></thead><tbody>${prof.map(r=>`<tr><td><strong>${LAB_PROFILE_NAME[r.profile]||r.profile}</strong></td><td>${r.n}</td><td>${fmt(r.territories,1)}</td>${REF_DIMS.map(([d])=>`<td>${fmt(r[d],1)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
 renderRefEditor();
}
export function currentRefTable(){return configApplied.references?.[$("refSet").value]||null}
export function renderRefEditor(){
 const set=$("refSet").value,t=currentRefTable(),cal=fixedRun.calibration;
 $("refHead").innerHTML=`<th>Era</th>${REF_DIMS.map(([,n,u])=>`<th>${n}<div class="small muted">${u}</div></th>`).join("")}${cal&&!t?"":""}`;
 if(!t){$("refTable").innerHTML=cal?cal.values.military.map((_,e)=>`<tr><td>${e+1}</td>${REF_DIMS.map(([d])=>`<td class="${cal.fallback[d][e]?"gold":""}" title="p25 ${fmt(cal.stats[d][e].p25,2)} · p75 ${fmt(cal.stats[d][e].p75,2)}">${fmt(cal.values[d][e],2)}${cal.fallback[d][e]?" *":""}</td>`).join("")}</tr>`).join(""):"";
  setStatus("refStatus",cal?"Pré-visualização da calibração (ainda não aplicada). * = mediana zero, valor de recurso.":"Ainda não há referências definidas. Execute as simulações e aplique a calibração, ou importe um JSON.");return}
 $("refTable").innerHTML=t.values.military.map((_,e)=>`<tr><td>${e+1}</td>${REF_DIMS.map(([d])=>`<td><input type="number" min="0" step="any" style="width:110px" data-ref="${d}.${e}" value="${+t.values[d][e].toFixed(4)}" class="${t.fallback?.[d]?.[e]?"gold":""}" title="${t.stats?`p25 ${fmt(t.stats[d][e].p25,2)} · p75 ${fmt(t.stats[d][e].p75,2)}`:""}"></td>`).join("")}</tr>`).join("");
 document.querySelectorAll("[data-ref]").forEach(el=>el.addEventListener("change",()=>{const [d,e]=el.dataset.ref.split("."),v=Number(el.value);if(!(Number.isFinite(v)&&v>0)){el.value=+t.values[d][e].toFixed(4);setStatus("refStatus","A referência tem de ser um número maior que zero.","error");return}t.values[d][+e]=v;t.edited=true;if(t.fallback?.[d])t.fallback[d][+e]=false;el.classList.remove("gold");configEdited.references=clone(configApplied.references);setStatus("refStatus",`Referência ${REF_SETS.find(x=>x[0]===set)[1]} · ${REF_DIMS.find(x=>x[0]===d)[1]} · era ${+e+1} ajustada manualmente.`,"success")}));
 setStatus("refStatus",`${REF_SETS.find(x=>x[0]===set)[1]}: ${t.eras} eras calibradas${t.meta?.games?` a partir de ${t.meta.games} partidas`:""}${t.edited?" · com ajustes manuais":""}. Depois da última era usa-se o último valor. Valores a dourado vieram de recurso (mediana zero).`);
}
export function applyCalibration(){
 const cal=fixedRun.calibration;if(!cal)throw Error("Execute as simulações primeiro.");
 configApplied.references={ice:clone(cal),score:clone(cal)};configApplied=normalizeConfig(configApplied);configEdited.references=clone(configApplied.references);
 renderRefEditor();setStatus("refStatus","Calibração aplicada aos dois conjuntos (ICE e pontuação final). Ajuste cada conjunto separadamente, se necessário.","success");
}
export function exportFixedCsv(){
 if(!fixedRun.games.length){setStatus("fixedStatus","Execute as simulações antes de exportar.","error");return}
 const rows=[["game","seed","mode","era","seat","civ_id","profile","territories",...REF_DIMS.map(([d])=>d)]];
 for(const g of fixedRun.games)for(const e of g.timeline)e.civs.forEach((r,k)=>rows.push([g.game,g.seed,g.mode,e.era,k,r.id,r.profile,r.territories,...REF_DIMS.map(([d])=>r.dims[d])]));
 download("imperios-duracao-fixa.csv",rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(";")).join("\n"),"text/csv;charset=utf-8");
}
export function exportRefs(){if(!configApplied.references){setStatus("refStatus","Não há referências para exportar.","error");return}download("imperios-referencias.json",JSON.stringify({formatVersion:VERSION,references:configApplied.references},null,2))}
export function importRefs(file){const reader=new FileReader();reader.onload=()=>{try{const obj=JSON.parse(reader.result),refs=validateReferences(obj.references||obj);if(!refs)throw Error("Ficheiro sem referências.");configApplied.references={...(configApplied.references||{}),...refs};configEdited.references=clone(configApplied.references);renderRefEditor();setStatus("refStatus","Referências importadas e validadas.","success")}catch(e){setStatus("refStatus","Importação recusada: "+e.message,"error")}};reader.readAsText(file)}
export function setupFixedLab(){
 $("fixedProfiles").innerHTML=LAB_PROFILES.map(([v,n])=>`<label><input type="checkbox" value="${v}" checked> ${n}</label>`).join("");
 $("fixedCivs").value=1+configApplied.map.aiCount;$("fixedSeed").value=configApplied.simulation.seed;
 $("runFixed").onclick=()=>runFixedLab().catch(e=>{busy=false;setStatus("fixedStatus",e.message,"error")});
 $("cancelFixed").onclick=()=>{fixedCancel=true;setStatus("fixedStatus","Cancelamento pedido; a concluir a partida em curso...")};
 $("applyCalibration").onclick=()=>{try{applyCalibration()}catch(e){setStatus("refStatus",e.message,"error")}};
 $("exportFixedCsv").onclick=exportFixedCsv;$("exportRefs").onclick=exportRefs;
 $("importRefsBtn").onclick=()=>$("refsFile").click();$("refsFile").onchange=e=>{if(e.target.files[0])importRefs(e.target.files[0]);e.target.value=""};
 $("refSet").onchange=renderRefEditor;renderRefEditor();
}
export function defineTests(){
 const list=[];const test=(name,fn,cat)=>list.push({name,fn,cat});
 test("Uma era gera valores finitos",()=>{let c=clone(DEFAULTS),s=newState(c);processEra(s,c,{playerAllocation:{military:0,infrastructure:0,technology:0}});if(!s.history[0]||!Number.isFinite(s.history[0].total))throw Error("Receita inválida")});
 test("Investimento inicial gera retorno no calendário previsto",()=>{let c=clone(DEFAULTS),s=newState(c);c.military.aiEnabled=false;processEra(s,c,{playerAllocation:{military:40,infrastructure:40,technology:40},ai:false});const row=s.history[0];if(row.infra<=0)throw Error("Infraestrutura inicial não gerou retorno na primeira era");if(P(s).military<=0)throw Error("Poder militar inicial não ficou disponível na primeira era");if(row.tech!==0)throw Error("Tecnologia gerou retorno antes do atraso");processEra(s,c,{playerAllocation:{military:0,infrastructure:0,technology:0},ai:false});if(s.history[1].infra<=0)throw Error("Retorno de infraestrutura não continuou após a primeira era")});
 test("Investimentos respeitam orçamento",()=>{let c=clone(DEFAULTS),s=newState(c);let failed=false;try{invest(s,"military",P(s).treasury+1,c)}catch(e){failed=true}if(!failed)throw Error("Investimento acima do saldo foi aceito")});
 test("Pontos militares têm atraso",()=>{let c=clone(DEFAULTS),s=newState(c);invest(s,"military",100,c);if(P(s).military>0)throw Error("Pontos liberados imediatamente");processEra(s,c,{ai:false});if(P(s).military<=0)throw Error("Pontos não foram liberados na era prevista")});
 test("Ataque impossível é recusado",()=>{let c=clone(DEFAULTS),s=newState(c);let res=attackTerritory(s,1,"player",c);if(res.ok)throw Error("Ataque inválido aceito")});
 test("Defesa muda conforme território neutro ou dominado",()=>{let c=clone(DEFAULTS);c.military.conquestCost=1;c.military.defenseNeutral=2;c.military.defenseOwned=9;let a=newState(c);P(a).military=3;let nt=eligibleTargets(a,"player").find(t=>t.o==="neutral");if(!nt)throw Error("Sem território neutro adjacente");let nr=attackTerritory(a,nt.i,"player",c);if(!nr.ok)throw Error("Território neutro deveria exigir 3 pontos");let b=newState(c);P(b).military=3;let et=eligibleTargets(b,"player")[0];if(!et)throw Error("Sem alvo adjacente");b.owners[et.i]="ai";let er=attackTerritory(b,et.i,"player",c);if(er.ok)throw Error("Território dominado aceitou ataque com defesa insuficiente")});
 test("Conquista respeita adjacência e aumenta territórios",()=>{let c=clone(DEFAULTS),s=newState(c);P(s).military=100;let before=s.owners.filter(o=>o==="player").length;let t=eligibleTargets(s,"player")[0];if(!t)throw Error("Sem alvo adjacente");let res=attackTerritory(s,t.i,"player",c);if(!res.ok)throw Error("Ataque não processado");if(res.win&&s.owners.filter(o=>o==="player").length!==before+1)throw Error("Propriedade não atualizada")});
 test("Investimento da IA não contamina métricas do jogador",()=>{let c=clone(DEFAULTS),s=newState(c);let before=P(s).invested.military;invest(s,"military",10,c,"ai");if(P(s).invested.military!==before)throw Error("Investimento da IA foi contabilizado como investimento do jogador")});
 test("Ataque bem-sucedido ou falho gera métricas de expansão",()=>{let c=clone(DEFAULTS),s=newState(c);P(s).military=100;let t=eligibleTargets(s,"player")[0];let r=attackTerritory(s,t.i,"player",c);if(!r.ok)throw Error("Ataque não foi processado");let total=s.attacks.playerWins+s.attacks.playerLosses;if(total!==1)throw Error("Ataque não contabilizado");if(r.win&&s.attacks.neutralConquests!==1)throw Error("Conquista neutra não contabilizada")});
 test("Simulação militar expande território e mede ataques",()=>{let c=clone(DEFAULTS);c.military.pointsPerInvestment=2;c.military.conquestCost=1;c.military.defenseNeutral=0;c.military.defenseOwned=0;c.military.aiEnabled=false;let s=simulate("aggressive",8,c);if(!s.attacks||typeof s.attacks.playerWins!=="number")throw Error("Métricas de ataque ausentes");if(s.history.some(h=>!Number.isFinite(h.territories)))throw Error("Histórico territorial inválido")});
 test("Infraestrutura respeita atraso e duração",()=>{let inv=makeInvestment("infrastructure",100,1,DEFAULTS);if(infraReturn(inv,0)!==0)throw Error("Retorno antes do atraso");if(infraReturn(inv,1)<=0)throw Error("Retorno não começou");inv.params.duration=2;if(infraReturn(inv,3)!==0)throw Error("Retorno após duração")});
 test("Tecnologia ativa na era correta sem duplicação",()=>{{let c=clone(DEFAULTS);c.technology.delay=4;let s=newState(c,{mode:"slow"}),inv=makeInvestment("technology",100,1,c,"player","slow");s.investments.push(inv);if(techReturn(s,inv,4)!==0)throw Error("Tecnologia ativou cedo");if(techReturn(s,inv,5)<=0)throw Error("Tecnologia não ativou na era 5 do modo lento");if(techReturn(s,inv,5)!==techReturn(s,inv,5))throw Error("Retorno inconsistente")}});
 test("Simulações independentes",()=>{let c=clone(DEFAULTS),cfg0=JSON.stringify(c),a=simulate("military",3,c);P(a).treasury=-1;a.history[0].total=-1;const b=simulate("military",3,c);if(JSON.stringify(c)!==cfg0)throw Error("Simulação alterou a configuração");if(P(b).treasury<0||b.history[0].total<0)throw Error("Estados compartilhados")});
 test("Exportação/importação preserva configuração",()=>{let c=normalizeConfig(JSON.parse(JSON.stringify(DEFAULTS)));if(JSON.stringify(c)!==JSON.stringify(DEFAULTS))throw Error("Parâmetro alterado")});
 test("Avanço múltiplo equivale ao individual",()=>{let c=clone(DEFAULTS),a=simulate("balanced",5,c),b=newState(c);for(let i=0;i<5;i++)processEra(b,c,{autoStrategy:"balanced"});if(Math.abs(P(a).treasury-P(b).treasury)>1e-6)throw Error("Saldos diferentes")});
 test("Reinício restaura estado",()=>{let c=clone(DEFAULTS),s=newState(c);processEra(s,c,{ai:false});s=newState(c);if(s.era!==0||P(s).treasury!==c.economy.initialBudget)throw Error("Estado inicial incorreto")});
 test("Simulação prolongada sem valores inválidos",()=>{let c=clone(DEFAULTS);c.military.aiEnabled=false;let s=simulate("balanced",100,c);if(!Number.isFinite(P(s).treasury)||P(s).treasury<0)throw Error("Saldo inválido")});

 test("Perfis da IA produzem decisões de investimento distintas",()=>{const profiles=["military","aggressive","economist","technologist","custom"];const allocations=profiles.map(style=>{let c=clone(DEFAULTS);c.military.aiStyle=style;c.military.aiMilitary=20;c.military.aiInfrastructure=30;c.military.aiTechnology=50;let s=newState(c);processEra(s,c,{playerAllocation:{military:0,infrastructure:0,technology:0}});const r=s.history.at(-1).aiInvestment;return [r.military,r.infrastructure,r.technology].map(v=>Math.round(v*1000)/1000).join("|")});if(new Set(allocations).size<4)throw Error("Os perfis não estão gerando distribuições suficientemente distintas: "+allocations.join("; "))});
 test("IA aproveita o tesouro sem ultrapassar o orçamento",()=>{let c=clone(DEFAULTS),s=newState(c);c.military.aiReserve=0;processEra(s,c,{playerAllocation:{military:0,infrastructure:0,technology:0}});const r=s.history.at(-1);if(!(r.aiBudgetInvested>0))throw Error("IA não investiu o tesouro disponível");if(r.aiBudgetInvested>r.aiRevenue.total+s.initialBudget+1e-8)throw Error("IA investiu acima dos recursos disponíveis")});
 test("JSON inválido não é aceito",()=>{let failed=false;try{normalizeConfig({economy:{}})}catch(e){failed=true}if(!failed)throw Error("Configuração inválida aceita")});
 test("Cancelamento preserva eras concluídas (primitiva)",()=>{let c=clone(DEFAULTS),s=newState(c);processEra(s,c,{ai:false});if(s.history.length!==1)throw Error("Histórico concluído perdido")});
 test("Fontes de receita somam total",()=>{let c=clone(DEFAULTS),s=simulate("balanced",4,c);for(const r of s.history)if(Math.abs(r.normal+r.infra+r.tech-r.total)>1e-7)throw Error("Soma de receita divergente")});
 test("IA mantém tesouro independente e recebe receita",()=>{let c=clone(DEFAULTS),s=newState(c);const before=A(s).treasury;processEra(s,c,{playerAllocation:{military:0,infrastructure:0,technology:0}});if(!Number.isFinite(A(s).treasury)||A(s).treasury<0||A(s).treasury===before)throw Error("Tesouro da IA não evoluiu independentemente")});
 test("Perfil de IA afeta alocação de investimento",()=>{let c=clone(DEFAULTS),a=newState(c),b=newState(c);c.military.aiStyle="military";processEra(a,c,{playerAllocation:{military:0,infrastructure:0,technology:0}});c.military.aiStyle="technologist";processEra(b,c,{playerAllocation:{military:0,infrastructure:0,technology:0}});let ma=a.investments.filter(x=>x.owner==="ai"&&x.type==="military").reduce((z,x)=>z+x.amount,0),mb=b.investments.filter(x=>x.owner==="ai"&&x.type==="military").reduce((z,x)=>z+x.amount,0);if(!(ma>mb))throw Error("Perfis não alteraram a alocação militar")});
 test("Modo rápido aplica multiplicador de retorno também à IA",()=>{{let c=clone(DEFAULTS);c.economy.fastModeReturnMultiplier=0.5;const slowM=makeInvestment("military",100,1,c,"ai","slow"),slowI=makeInvestment("infrastructure",100,1,c,"ai","slow"),slowT=makeInvestment("technology",100,1,c,"ai","slow");const fastM=makeInvestment("military",100,1,c,"ai","fast"),fastI=makeInvestment("infrastructure",100,1,c,"ai","fast"),fastT=makeInvestment("technology",100,1,c,"ai","fast");if(Math.abs(fastM.points/slowM.points-0.5)>1e-9)throw Error("Multiplicador militar não aplicado à IA");if(Math.abs(fastI.params.initialReturn/slowI.params.initialReturn-0.5)>1e-9||Math.abs(fastI.params.residual/slowI.params.residual-0.5)>1e-9)throw Error("Multiplicador de infraestrutura não aplicado à IA");if(Math.abs(fastT.params.benefitPerProgress/slowT.params.benefitPerProgress-0.5)>1e-9)throw Error("Multiplicador tecnológico não aplicado à IA")}});
 test("IA recebe multiplicador rápido nos investimentos reais",()=>{{const c=clone(DEFAULTS);c.economy.fastModeReturnMultiplier=0.4;c.military.aiEnabled=true;c.military.aiStyle="technologist";const slow=newState(c,{mode:"slow"}),fast=newState(c,{mode:"fast"});processEra(slow,c,{playerAllocation:{military:0,infrastructure:0,technology:0}});processEra(fast,c,{playerAllocation:{military:0,infrastructure:0,technology:0}});for(const type of ["military","infrastructure","technology"]){const a=slow.investments.find(i=>i.owner==="ai"&&i.type===type),b=fast.investments.find(i=>i.owner==="ai"&&i.type===type);if(!a||!b)throw Error("IA não criou investimento de "+type);const av=type==="military"?a.points:type==="infrastructure"?a.params.initialReturn:a.params.benefitPerProgress;const bv=type==="military"?b.points:type==="infrastructure"?b.params.initialReturn:b.params.benefitPerProgress;if(Math.abs(bv/av-0.4)>1e-9)throw Error("Multiplicador rápido não aplicado à IA em "+type)}}});
 test("Equilibrado mantém a divisão 34/33/33 com e sem ameaça",()=>{for(const th of [false,true]){const r=aiProbe("reference",th,12345);if(Math.abs(r.military-.34)>.005||Math.abs(r.infrastructure-.33)>.005||Math.abs(r.technology-.33)>.005)throw Error("Divisão "+[r.military,r.infrastructure,r.technology].map(v=>fmt(100*v,1)).join("/"))}});
 test("IA adaptativa reage à pressão territorial",()=>{const safe=aiProbe("adaptive",false,23456),threat=aiProbe("adaptive",true,23456);if(!(threat.military>safe.military+0.05))throw Error("A política adaptativa não aumentou o peso militar")});
 test("Decisões militares respeitam agressividade zero e cem",()=>{const quiet=runAiControlProbe("military",0,34567),active=runAiControlProbe("military",100,45678);if(quiet.attacks!==0)throw Error("A IA atacou com agressividade zero");if(active.attacks<1)throw Error("A IA não aproveitou uma oportunidade garantida")});

 // ── Etapa 1: infraestrutura comum (N civilizações, modo como parâmetro, histórico por era) ──
 const silent={playerAllocation:{military:0,infrastructure:0,technology:0}};
 test("Estado suporta várias civilizações com posições distintas",()=>{for(let n=1;n<=MAX_AI;n++){const c=clone(DEFAULTS);c.map.aiCount=n;const s=newState(c);if(s.civs.length!==n+1)throw Error(`aiCount=${n} gerou ${s.civs.length} civilizações`);const ids=new Set(s.civs.map(x=>x.id));if(ids.size!==n+1)throw Error("Ids repetidos");for(const civ of s.civs)if(countTerritories(s,civ.id)!==1)throw Error(`${civ.name} não começou com exatamente 1 território`);if(s.owners.some(o=>o!=="neutral"&&!ids.has(o)))throw Error("Território com dono desconhecido")}});
 test("Configuração 1×1 mantém posições do MVP original",()=>{const s=newState(clone(DEFAULTS));if(s.owners[0]!=="player"||s.owners[DEFAULTS.map.territories-1]!=="ai")throw Error("Posições iniciais alteradas")});
 test("Partida com 5 IAs corre sem valores inválidos",()=>{const c=clone(DEFAULTS);c.map.aiCount=5;const s=simulate("balanced",40,c);for(const civ of s.civs){if(!Number.isFinite(civ.treasury)||civ.treasury<0||!Number.isFinite(civ.military)||civ.military<0)throw Error(civ.name+" com valores inválidos")}if(s.owners.length!==c.map.territories)throw Error("Mapa corrompido")});
 test("Cada IA mantém tesouro e investimentos próprios",()=>{const c=clone(DEFAULTS);c.map.aiCount=3;const s=newState(c);processEra(s,c,silent);for(const civ of aiCivs(s)){const own=s.investments.filter(i=>i.owner===civ.id).reduce((a,i)=>a+i.amount,0);if(!(own>0))throw Error(civ.name+" não investiu");if(Math.abs(own-(civ.invested.military+civ.invested.infrastructure+civ.invested.technology))>1e-8)throw Error(civ.name+": investimento acumulado divergente")}if(P(s).invested.military!==0)throw Error("Investimentos das IAs contaminaram o jogador")});
 test("Todas as IAs recebem a mesma regra de receita",()=>{const c=clone(DEFAULTS);c.map.aiCount=3;const s=newState(c);processEra(s,c,silent);const rows=s.timeline[0].civs.slice(1);if(!rows.every(r=>Math.abs(r.revenue.normal-c.economy.baseIncome)<1e-9))throw Error("Receita territorial diferente entre IAs com 1 território")});
 test("IAs podem atacar outras IAs",()=>{const c=clone(DEFAULTS);c.map.aiCount=2;c.military.aiTarget="playerFirst";const s=newState(c);s.owners.fill("neutral");s.owners[0]="player";s.owners[12]="ai";s.owners[13]="ai2";A(s).military=100;let r={ok:false};for(let k=0;k<5&&!r.win;k++){s.era=k;r=attackTerritory(s,13,"ai",c)}if(!r.ok)throw Error("Ataque entre IAs recusado");if(r.win&&s.owners[13]!=="ai")throw Error("Conquista entre IAs não alterou o dono")});
 test("Ataques de civilizações diferentes usam sorteios diferentes",()=>{const c=clone(DEFAULTS);c.map.aiCount=2;let differ=false;for(let era=0;era<30&&!differ;era++){const rolls=[0,1,2].map(k=>rand(c.simulation.seed+5+era*37+k*7919)());if(new Set(rolls.map(r=>r<0.82)).size>1)differ=true}if(!differ)throw Error("Sorteios idênticos para todos os atacantes")});
 test("Modo é parâmetro do estado, não variável global",()=>{const saved=gameMode;try{gameMode="fast";const c=clone(DEFAULTS);c.military.aiEnabled=false;c.technology.delay=4;const slow=newState(c,{mode:"slow"});processEra(slow,c,{playerAllocation:{military:0,infrastructure:0,technology:50},ai:false});for(let i=0;i<2;i++)processEra(slow,c,{ai:false});if(slow.history.at(-1).tech!==0)throw Error("Estado lento usou atraso do modo rápido");gameMode="slow";const fast=newState(c,{mode:"fast"});processEra(fast,c,{playerAllocation:{military:0,infrastructure:0,technology:50},ai:false});for(let i=0;i<2;i++)processEra(fast,c,{ai:false});if(!(fast.history.at(-1).tech>0))throw Error("Estado rápido não usou o seu próprio atraso")}finally{gameMode=saved}});
 test("Simulações lenta e rápida podem correr lado a lado",()=>{const c=clone(DEFAULTS);c.economy.fastModeReturnMultiplier=1;const a=simulate("technology",10,c,null,undefined,null,"slow"),b=simulate("technology",10,c,null,undefined,null,"fast");if(a.mode!=="slow"||b.mode!=="fast")throw Error("Modo não registado no estado");if(!(b.history.reduce((z,r)=>z+r.tech,0)>a.history.reduce((z,r)=>z+r.tech,0)))throw Error("Modo rápido não antecipou retornos tecnológicos")});
 test("Histórico por era regista todas as civilizações",()=>{const c=clone(DEFAULTS);c.map.aiCount=3;const s=simulate("balanced",6,c);if(s.timeline.length!==6)throw Error("Número de eras no histórico incorreto");for(const e of s.timeline){if(e.civs.length!==4)throw Error("Era "+e.era+" sem todas as civilizações");for(const r of e.civs){for(const k of ["military","infrastructure","technology","treasury"])if(!Number.isFinite(r.dims[k]))throw Error(`Dimensão ${k} inválida`);if(Math.abs(r.revenue.normal+r.revenue.infrastructure+r.revenue.technology-r.revenue.total)>1e-7)throw Error("Receita por civilização não soma o total")}}const sumTerr=s.timeline.at(-1).civs.reduce((a,r)=>a+r.territories,0)+countTerritories(s,"neutral");if(sumTerr!==c.map.territories)throw Error("Territórios no histórico não somam o mapa")});
 test("Dimensões seguem as definições acordadas",()=>{const c=clone(DEFAULTS);const s=simulate("balanced",8,c);const e=s.timeline.at(-1),r=e.civs[0];if(r.dims.military!==P(s).military)throw Error("Militar ≠ pontos disponíveis");if(Math.abs(r.dims.infrastructure-s.history.at(-1).infra)>1e-9)throw Error("Infraestrutura ≠ receita de infraestrutura da era");if(Math.abs(r.dims.technology-P(s).techProgress)>1e-9)throw Error("Tecnologia ≠ progresso acumulado");if(r.dims.treasury!==P(s).treasury)throw Error("Tesouraria ≠ saldo")});
 test("Progresso tecnológico do jogador não inclui a IA",()=>{const c=clone(DEFAULTS);c.military.aiStyle="technologist";const s=newState(c);processEra(s,c,silent);if(P(s).techProgress!==0)throw Error("Progresso da IA contado para o jogador");if(!(A(s).techProgress>0))throw Error("IA tecnológica sem progresso")});
 test("Mesma semente e configuração reproduzem a partida",()=>{const c=clone(DEFAULTS);c.map.aiCount=3;const a=simulate("aggressive",25,c),b=simulate("aggressive",25,c);if(JSON.stringify(a.timeline)!==JSON.stringify(b.timeline)||JSON.stringify(a.investments)!==JSON.stringify(b.investments))throw Error("Resultados diferentes com a mesma semente")});
 test("Configuração v3 sem parâmetros novos é aceite",()=>{const old=clone(DEFAULTS);delete old.map.aiCount;const c=normalizeConfig(old);if(c.map.aiCount!==1)throw Error("aiCount não recebeu o valor padrão")});
 test("Número de IAs fora do limite é recusado",()=>{for(const v of [0,MAX_AI+1,1.5]){const c=clone(DEFAULTS);c.map.aiCount=v;let failed=false;try{normalizeConfig(c)}catch(e){failed=true}if(!failed)throw Error("aiCount="+v+" aceite")}});

 // ── Etapa 2: duração fixa e calibração de referências ──
 const allProfiles=LAB_PROFILES.map(x=>x[0]);
 test("Lugar do jogador pode ser controlado por IA",()=>{const c=clone(DEFAULTS);const s=newState(c,{allAI:true,profiles:["economist","military"]});processEra(s,c,{});if(P(s).controller!=="ai")throw Error("Jogador não ficou sob controlo da IA");if(!(P(s).invested.infrastructure>P(s).invested.military))throw Error("Perfil Infraestrutura não aplicado ao lugar do jogador");if(!s.timeline[0].civs[0].driver.startsWith("ai:economist"))throw Error("Histórico não regista o perfil do lugar do jogador")});
 test("Partida de duração fixa corre todas as eras",()=>{const g=runFixedGame(clone(DEFAULTS),{eras:25,mode:"slow",profiles:allProfiles,civCount:3,seed:99,game:0});if(g.kind!=="fixed")throw Error("Tipo de simulação não identificado");if(g.timeline.length!==25||g.eras!==25)throw Error("A partida não correu as 25 eras");if(g.timeline.some(e=>e.civs.length!==3))throw Error("Civilizações em falta no histórico")});
 test("Duração fixa é reprodutível pela semente",()=>{const o={eras:15,mode:"fast",profiles:allProfiles,civCount:4,seed:1234,game:2},a=runFixedGame(clone(DEFAULTS),o),b=runFixedGame(clone(DEFAULTS),o);if(JSON.stringify(a)!==JSON.stringify(b))throw Error("Mesma semente produziu resultados diferentes")});
 test("Duração fixa não altera a configuração nem a partida atual",()=>{const before=JSON.stringify(configApplied),era=state.era;runFixedGame(configApplied,{eras:5,mode:"slow",profiles:allProfiles,civCount:2,seed:7,game:0});if(JSON.stringify(configApplied)!==before||state.era!==era)throw Error("Simulação isolada alterou o estado global")});
 test("Perfis rodam de forma equilibrada pelos lugares",()=>{const civs=3,n=allProfiles.length,count={};for(let g=0;g<n*2;g++)seatProfiles(allProfiles,civs,g).forEach((p,k)=>{count[p+"@"+k]=(count[p+"@"+k]||0)+1});const vals=Object.values(count);if(Object.keys(count).length!==n*civs||vals.some(v=>v!==2))throw Error("Rotação desequilibrada: "+JSON.stringify(count))});
 test("Receita média usa as últimas 3 eras disponíveis",()=>{const s=simulate("balanced",5,clone(DEFAULTS));const tot=k=>s.timeline[k].civs[0].revenue.total;if(Math.abs(s.timeline[0].civs[0].dims.revenue-tot(0))>1e-9)throw Error("Era 1 deveria usar só a própria receita");if(Math.abs(s.timeline[1].civs[0].dims.revenue-(tot(0)+tot(1))/2)>1e-9)throw Error("Era 2 deveria usar duas eras");if(Math.abs(s.timeline[4].civs[0].dims.revenue-(tot(2)+tot(3)+tot(4))/3)>1e-9)throw Error("Era 5 deveria usar as eras 3 a 5")});
 test("Calibração usa a mediana por era e dimensão",()=>{const mk=v=>({id:"x",profile:"reference",territories:1,dims:{military:v,infrastructure:v*2,technology:v*3,treasury:v,revenue:v}});const games=[[1,4],[2,5],[9,6]].map((vs,g)=>({timeline:vs.map((v,e)=>({era:e+1,civs:[mk(v)]}))}));const cal=calibrateReferences(games);if(cal.values.military[0]!==2||cal.values.military[1]!==5||cal.values.technology[0]!==6)throw Error("Mediana incorreta: "+JSON.stringify(cal.values.military))});
 test("Mediana zero recebe referência de recurso positiva e marcada",()=>{const mk=v=>({id:"x",profile:"reference",territories:1,dims:{military:v,infrastructure:1,technology:1,treasury:0,revenue:40}});const games=[0,0,6].map(v=>({timeline:[{era:1,civs:[mk(v)]}]}));const cal=calibrateReferences(games);if(cal.values.military[0]!==2||cal.fallback.military[0]!=="mean")throw Error("Recurso pela média não aplicado");if(cal.values.treasury[0]!==40||cal.fallback.treasury[0]!=="revenue")throw Error("Tesouraria com mediana zero não usou a receita de referência");const g2=[0,0].map(v=>({timeline:[{era:1,civs:[mk(v)]}]}));if(calibrateReferences(g2).values.military[0]!==1)throw Error("Recurso 1 não aplicado quando tudo é zero")});
 test("Calibração real gera referências válidas para todas as eras",()=>{const games=Array.from({length:6},(_,g)=>runFixedGame(clone(DEFAULTS),{eras:12,mode:"slow",profiles:allProfiles,civCount:2,seed:fixedGameSeed(5,g),game:g}));const cal=calibrateReferences(games);if(cal.eras!==12)throw Error("Número de eras calibradas incorreto");if(!validateReferences({ice:cal,score:cal}))throw Error("Calibração não passou na validação")});
 test("Referência depois da última era usa o último valor",()=>{const t={values:{military:[1,2,3]}};if(refAt(t,"military",1)!==1||refAt(t,"military",3)!==3||refAt(t,"military",40)!==3)throw Error("refAt incorreto")});
 test("Configuração guarda e valida referências",()=>{const t={values:Object.fromEntries(REF_DIMS.map(([d])=>[d,[1,2]]))};const c=clone(DEFAULTS);c.references={ice:t,score:t};const n=normalizeConfig(JSON.parse(JSON.stringify(c)));if(n.references?.score?.values.revenue[1]!==2)throw Error("Referências perdidas na exportação/importação");for(const bad of [[0,1],[-1,1],["x",1]]){const b=clone(c);b.references.ice={values:{...t.values,military:bad}};let failed=false;try{normalizeConfig(b)}catch(e){failed=true}if(!failed)throw Error("Referência inválida aceite: "+bad)}const u=clone(c);u.references.ice={values:{...t.values,military:[1,2,3]}};let f2=false;try{normalizeConfig(u)}catch(e){f2=true}if(!f2)throw Error("Dimensões com tamanhos diferentes aceites")});

 // ── Etapa 3: fim de partida (secção 11 da especificação) ──
 // Os testes da secção 11 fixam os valores da especificação original (80%, 10%, 4 dimensões a 25%) para não
 // dependerem dos padrões ajustados; os padrões atuais têm um teste próprio.
 const EG=(over={},terr=24,civs=2)=>{const c=clone(DEFAULTS);Object.assign(c.endgame,{territoryPct:.8,supremacyRelative:.1,iceMinAbsolute:1,supremacyMinEraShare:0,supremacyMaxNeutralShare:1,iceWMilitary:.25,iceWInfrastructure:.25,iceWTechnology:.25,iceWFinance:.25,iceWTerritory:0,scoreWMilitary:.25,scoreWInfrastructure:.25,scoreWTechnology:.25,scoreWTreasury:.25,scoreWTerritory:0},over);c.map.territories=terr;c.map.aiCount=civs-1;const t={values:Object.fromEntries(REF_DIMS.map(([d])=>[d,[10,10,10,10,10]]))};c.references={ice:t,score:t};return c};
 const ST=(c,owners)=>{const s=newState(c,{endRules:true});if(owners)s.owners=owners;return s};
 const OW=(n,spec)=>{const o=Array(n).fill("neutral");let i=0;for(const [id,k] of spec)for(let j=0;j<k;j++)o[i++]=id;return o};
 const D=v=>({military:v,infrastructure:v,technology:v,treasury:v,revenue:v});
 const EN=(s,era,dims={})=>({era,civs:s.civs.map(c=>({id:c.id,dims:dims[c.id]||D(3)}))});
 const END=(s,c,era=1,dims)=>{s.era=era;return evaluateEndOfEra(s,c,era,EN(s,era,dims),true)};
 const SUP=(prev,ices,c,era=3)=>evaluateSupremacy(prev,ices.map((v,i)=>({id:"c"+i,ice:v})),era,c);
 // 11.1 Vitória territorial
 test("[T1] Vitória ao atingir exatamente o mínimo de territórios",()=>{const c=EG({},23),s=ST(c,OW(23,[["player",19],["ai",1]]));const o=END(s,c);if(o.result?.type!=="victory"||o.result.winners[0]!=="player"||!o.result.reasons.player.includes("territorial"))throw Error("19 de 23 deveria vencer")});
 test("[T2] Não vence abaixo do mínimo",()=>{const c=EG({},23),s=ST(c,OW(23,[["player",18],["ai",1]]));if(END(s,c).result)throw Error("18 de 23 não deveria vencer")});
 test("[T3] Arredondamento sempre para cima",()=>{if(territorialMinimum(23,.8)!==19||territorialMinimum(25,.8)!==20||territorialMinimum(10,.75)!==8||territorialMinimum(24,.6)!==15)throw Error("Mínimos incorretos")});
 test("[T4] Territórios neutros entram na base de cálculo",()=>{const c=EG({},24),s=ST(c,OW(24,[["player",19],["ai",1]]));const o=END(s,c);if(o.territorial.total!==24||o.territorial.min!==20||o.result)throw Error("A base deve incluir os 4 neutros (mínimo 20)")});
 test("[T5] Empate entre civilizações acima do percentual",()=>{const c=EG({territoryPct:.4},10),s=ST(c,OW(10,[["player",4],["ai",4]]));const o=END(s,c);if(o.result?.type!=="draw"||o.result.winners.length!==2)throw Error("Duas civilizações com 40% deveriam empatar")});
 test("[T6] Perda de território durante a era impede a vitória",()=>{let checked=false;for(let seed=1;seed<60&&!checked;seed++){const c=EG({},24);c.simulation.seed=seed;c.military.aiAggression=100;c.military.aiTarget="playerFirst";c.military.aiStyle="military";const o=OW(24,[["player",20]]);o[23]="ai";o[20]="neutral";o[19]="neutral";o[22]="neutral";o[17]="neutral";o[21]="ai";const s=ST(c,o);A(s).military=500;const before=countTerritories(s,"player");processEra(s,c,{playerAllocation:{military:0,infrastructure:0,technology:0}});if(countTerritories(s,"player")<before){checked=true;if(s.result)throw Error("Vitória com território perdido durante a era")}}if(!checked)throw Error("Cenário de perda não reproduzido")});
 test("[T7] Conquista durante a era conta na avaliação final",()=>{let checked=false;for(let seed=1;seed<60&&!checked;seed++){const c=EG({},24);c.simulation.seed=seed;c.military.aiAggression=0;const s=ST(c,OW(24,[["player",19]]));s.owners[23]="ai";P(s).military=200;processEra(s,c,{autoStrategy:"military"});if(countTerritories(s,"player")===20){checked=true;if(!s.result?.reasons?.player?.includes("territorial"))throw Error("Conquista na própria era não deu a vitória")}}if(!checked)throw Error("Cenário de conquista não reproduzido")});
 // 11.2 Eliminação
 test("[E1] Sem territórios = eliminação imediata no fim da era",()=>{const c=EG({},24,3),s=ST(c,OW(24,[["player",2],["ai",2]]));const o=END(s,c,4);const z=getCiv(s,"ai2");if(z.active||z.eliminatedEra!==4||!o.eliminated.includes("ai2"))throw Error("IA 2 sem territórios não foi eliminada")});
 test("[E2] Eliminação é definitiva",()=>{const c=EG({},24,3),s=ST(c,OW(24,[["player",2],["ai",2]]));END(s,c,1);s.owners[10]="ai2";END(s,c,2);if(getCiv(s,"ai2").active)throw Error("Civilização eliminada regressou");s.owners[10]="neutral";processEra(s,c,{playerAllocation:{military:0,infrastructure:0,technology:0}});if(s.timeline.at(-1).civs[2].revenue.total!==0||s.investments.some(i=>i.owner==="ai2"))throw Error("Eliminada continuou a receber ou investir")});
 test("[E3] Eliminar todos os adversários = vitória por eliminação",()=>{const c=EG({},24,3),s=ST(c,OW(24,[["player",3]]));const o=END(s,c);if(o.result?.type!=="victory"||!o.result.reasons.player.includes("elimination"))throw Error("Vitória por eliminação não registada")});
 test("[E4] Todas eliminadas na mesma era = empate geral",()=>{const c=EG({},24,3),s=ST(c,OW(24,[]));const o=END(s,c);if(o.result?.type!=="draw"||!o.result.allEliminated)throw Error("Empate geral não registado")});
 test("[E5] Eliminação + maioria = uma vitória com dois motivos",()=>{const c=EG({},24),s=ST(c,OW(24,[["player",24]]));const r=END(s,c).result;if(r.type!=="victory"||r.winners.length!==1||!["elimination","territorial"].every(x=>r.reasons.player.includes(x)))throw Error("Motivos incompletos: "+JSON.stringify(r.reasons))});
 // 11.3 Supremacia
 test("[S1] Vitória ao completar as eras consecutivas",()=>{const c=EG();let p=null;for(let e=1;e<=5;e++){p=SUP(p,[1,.05],c);if(e<5&&p.achieved)throw Error("Venceu antes da 5ª era");}if(!p.achieved||p.streak!==5)throw Error("Não venceu na 5ª era")});
 test("[S2] Relação acima do limite reinicia a sequência",()=>{const c=EG();let p=null;for(let e=0;e<3;e++)p=SUP(p,[1,.05],c);p=SUP(p,[1,.2],c);if(p.streak!==0||p.status!=="gapTooSmall")throw Error("Não reiniciou");p=SUP(p,[1,.05],c);if(p.streak!==1)throw Error("Não recomeçou do zero")});
 test("[S3] Mudança de líder reinicia a contagem",()=>{const c=EG();let p=null;for(let e=0;e<3;e++)p=SUP(p,[1,.05],c);p=SUP(p,[.05,1],c);if(p.leader!=="c1"||p.streak!==1)throw Error("Novo líder herdou a sequência")});
 test("[S4] Empate na liderança reinicia",()=>{const c=EG();let p=SUP(null,[1,.05],c);p=SUP(p,[1,.995],c);if(p.leader!==null||p.streak!==0||p.status!=="tiedLeadership")throw Error("Empate na liderança não tratado")});
 test("[S5] ICE não calculável suspende e preserva a sequência",()=>{const c=EG();let p=null;for(let e=0;e<3;e++)p=SUP(p,[1,.05],c);p=SUP(p,[1,null],c);if(p.status!=="suspended"||p.streak!==3)throw Error("Sequência não preservada na suspensão");p=SUP(p,[1,.05],c);if(p.streak!==4)throw Error("Não retomou a contagem")});
 test("[S6] ICE absoluto mínimo por era é aplicado",()=>{const c=EG({iceMinAbsolute:1});let p=SUP(null,[.8,.05],c);if(p.streak!==0||p.status!=="belowMinimum")throw Error("Mínimo absoluto ignorado");const c2=EG();c2.endgame.iceMinByEra=[0,0,5];const c3=normalizeConfig(c2);if(SUP(null,[.8,.05],c3,1).streak!==1||SUP(null,[.8,.05],c3,3).streak!==0)throw Error("Mínimo por era ignorado")});
 test("[S7] Compara com o segundo maior ICE entre todos",()=>{const c=EG();const p=SUP(null,[1,.05,.5],c);if(p.streak!==0||Math.abs(p.ratio-.5)>1e-12)throw Error("Não usou o segundo maior ICE")});
 test("[S8] Queda do ICE do líder não interrompe se a condição se mantém",()=>{const c=EG({iceMinAbsolute:.5});let p=SUP(null,[1,.05],c);p=SUP(p,[.7,.05],c);if(p.streak!==2)throw Error("Queda do ICE interrompeu")});
 test("[S9] Fórmula do ICE: média geométrica ponderada com piso",()=>{const c=EG(),t=c.references.ice;const a=computeICE(D(10),1,c,t);if(Math.abs(a.ice-1)>1e-12)throw Error("Valores iguais à referência deveriam dar ICE 1");const b=computeICE({...D(10),military:0},1,c,t);if(Math.abs(b.ice-Math.pow(.05,.25))>1e-12)throw Error("Piso não aplicado");if(computeICE({...D(10),technology:NaN},1,c,t)!==null)throw Error("Dados em falta deveriam tornar o ICE não calculável")});
 test("[S10] Supremacia é independente da vitória territorial",()=>{const c=EG(),s=ST(c,OW(24,[["player",20],["ai",1]]));s.supremacy={leader:"player",streak:4,status:"counting"};const r=END(s,c,6,{player:D(10),ai:D(0)}).result;if(r.type!=="victory"||!["territorial","supremacy"].every(x=>r.reasons.player.includes(x)))throw Error("Deveria registar os dois motivos para o mesmo vencedor")});
 // 11.4 Pontuação final
 test("[F1] Média aritmética ponderada",()=>{const c=EG(),sc=finalScores([{id:"a",dims:{military:10,infrastructure:0,technology:0,treasury:0}}],1,c);if(Math.abs(sc[0].score-.25)>1e-12)throw Error("Esperado 0,25")});
 test("[F2] Normalização linear",()=>{const c=EG({scoreNormalization:"linear"}),sc=finalScores([{id:"a",dims:{military:5,infrastructure:0,technology:0,treasury:0}}],1,c);if(Math.abs(sc[0].parts.military-.5)>1e-12)throw Error("Linear incorreta")});
 test("[F3] Normalização logarítmica",()=>{const c=EG(),sc=finalScores([{id:"a",dims:{military:5,infrastructure:0,technology:0,treasury:0}}],1,c);if(Math.abs(sc[0].parts.military-Math.log(6)/Math.log(11))>1e-12)throw Error("Logarítmica incorreta")});
 test("[F4] Limite máximo de 150% por dimensão",()=>{const c=EG({scoreNormalization:"linear"}),sc=finalScores([{id:"a",dims:{military:1000,infrastructure:0,technology:0,treasury:0}}],1,c);if(sc[0].parts.military!==1.5||Math.abs(sc[0].score-.375)>1e-12)throw Error("Limite não aplicado")});
 test("[F5] Dimensão zero vale zero e as outras contam",()=>{const c=EG(),sc=finalScores([{id:"a",dims:{military:0,infrastructure:10,technology:10,treasury:10}}],1,c);if(sc[0].parts.military!==0||Math.abs(sc[0].score-.75)>1e-12)throw Error("Zero tratado incorretamente")});
 test("[F6] Civilizações eliminadas ficam fora da classificação",()=>{const c=EG({maxEras:10},24,3),s=ST(c,OW(24,[["player",2],["ai",2]]));const r=END(s,c,10).result;if(!r?.scores||r.scores.some(x=>x.id==="ai2")||r.scores.length!==2)throw Error("Eliminada incluída na pontuação")});
 test("[F7] Usa só os valores da última era e só o saldo da tesouraria",()=>{const c=EG();c.references.score={values:Object.fromEntries(REF_DIMS.map(([d])=>[d,[10,100]]))};const a=finalScores([{id:"a",dims:{military:10,infrastructure:0,technology:0,treasury:0,revenue:1e9}}],2,c)[0];if(Math.abs(a.parts.military-Math.log(11)/Math.log(101))>1e-12)throw Error("Não usou a referência da última era");if(a.parts.treasury!==0)throw Error("Receita contaminou a tesouraria")});
 test("[F8] Empate dentro da margem de 1%",()=>{const w=scoreWinners([{id:"a",score:1},{id:"b",score:.995},{id:"c",score:.98}],.01);if(w.join()!=="a,b")throw Error("Margem incorreta: "+w)});
 test("[F9] Empate com três ou mais civilizações",()=>{const w=scoreWinners([{id:"a",score:1},{id:"b",score:.999},{id:"c",score:.991},{id:"d",score:.5}],.01);if(w.length!==3)throw Error("Empate triplo não detetado")});
 // 11.5 Encerramento geral
 test("[G1] Vitórias simultâneas de civilizações diferentes = empate",()=>{const c=EG({territoryPct:.4},10),s=ST(c,OW(10,[["player",4],["ai",1]]));s.supremacy={leader:"ai",streak:4,status:"counting"};const r=END(s,c,6,{player:D(0),ai:D(10)}).result;if(r.type!=="draw"||!r.reasons.player.includes("territorial")||!r.reasons.ai.includes("supremacy"))throw Error("Deveria ser empate com motivos distintos")});
 test("[G2] Encerramento obrigatório no limite de eras",()=>{const m=runMatch(EG({maxEras:10,territoryPct:1}),{mode:"slow",profiles:["economist"],civCount:2,seed:3});if(!m.result||m.result.era>10)throw Error("Não encerrou até à era 10");if(m.result.era===10&&!m.result.scores&&!Object.values(m.result.reasons).flat().some(x=>x!=="score"))throw Error("Encerramento sem pontuação")});
 test("[G3] Vitória na era-limite prevalece sobre a pontuação",()=>{const c=EG({maxEras:10}),s=ST(c,OW(24,[["player",20],["ai",1]]));s.maxEras=10;const r=END(s,c,10).result;if(r.reasons.player[0]!=="territorial"||r.scores)throw Error("A pontuação substituiu a vitória territorial")});
 test("[G4] Funciona nos modos lento e rápido",()=>{for(const mode of ["slow","fast"]){const m=runMatch(EG({maxEras:15}),{mode,profiles:["aggressive","adaptive"],civCount:2,seed:11});if(!m.result||m.state.mode!==mode)throw Error("Modo "+mode+" sem resultado")}});
 test("[G5] Duração fixa não encerra, mas regista as condições",()=>{const c=EG({maxEras:10});const s=simulate("military",20,c);if(s.era!==20||s.result)throw Error("Simulação fixa foi interrompida");if(!s.timeline.every(e=>e.end))throw Error("Condições não registadas");const g=runFixedGame(c,{eras:20,profiles:["military","economist"],civCount:2,seed:5});if(g.timeline.length!==20)throw Error("Partida fixa interrompida")});
 test("[G6] Partida encerrada não aceita novas eras",()=>{const c=EG(),s=ST(c,OW(24,[["player",24]]));END(s,c);let failed=false;try{processEra(s,c,{})}catch(e){failed=true}if(!failed)throw Error("processEra aceitou era depois do fim")});
 test("[G7] Configuração de fim de partida é validada",()=>{for(const bad of [{maxEras:9},{maxEras:151},{iceWMilitary:.5},{scoreWTreasury:0},{scoreNormalization:"x"}]){const c=clone(DEFAULTS);Object.assign(c.endgame,bad);let failed=false;try{normalizeConfig(c)}catch(e){failed=true}if(!failed)throw Error("Aceitou "+JSON.stringify(bad))}});
 test("[G8] Extensão experimental espera pela sequência de supremacia",()=>{const c=EG({maxEras:10,extendForSupremacy:true}),s=ST(c,OW(24,[["player",3],["ai",3]]));s.maxEras=10;s.supremacy={leader:"player",streak:2,status:"counting"};const o=END(s,c,10,{player:D(10),ai:D(0)});if(o.result||!o.extended)throw Error("Não prolongou com sequência ativa")});
 test("[E6] Jogador eliminado: a partida continua entre as restantes",()=>{const c=EG({},24,3),s=ST(c,OW(24,[["ai",2],["ai2",2]]));END(s,c,1);if(P(s).active)throw Error("Jogador sem territórios não foi eliminado");s.era=1;processEra(s,c,{playerAllocation:{military:0,infrastructure:0,technology:0}});if(s.result)throw Error("Partida terminou com 2 IAs ativas");if(s.history.at(-1).total!==0)throw Error("Jogador eliminado recebeu receita")});
 // ── Ajustes pós-etapa 3 ──
 test("[A1] Padrões ajustados: maioria 70%, supremacia 0,70 e ICE mínimo 0,5",()=>{if(DEFAULTS.endgame.territoryPct!==.7||DEFAULTS.endgame.supremacyRelative!==.7||DEFAULTS.endgame.iceMinAbsolute!==.5)throw Error("Padrões não atualizados");if(territorialMinimum(24,DEFAULTS.endgame.territoryPct)!==17)throw Error("Mínimo com 70% de 24 deveria ser 17")});
 test("[A2] Jogador vê a receita da era antes de decidir",()=>{const c=clone(DEFAULTS),s=newState(c,{endRules:true});const before=P(s).treasury;beginEra(s,c);if(Math.abs(P(s).treasury-(before+c.economy.baseIncome))>1e-9)throw Error("Receita da era não entrou no orçamento antes da decisão");finishEra(s,c,{playerAllocation:{military:P(s).treasury,infrastructure:0,technology:0}});if(P(s).treasury!==0)throw Error("Não conseguiu investir a receita da própria era")});
 test("[A3] Jogador e IA decidem com a mesma informação",()=>{const c=clone(DEFAULTS),s=newState(c);beginEra(s,c);const p=P(s).treasury,a=A(s).treasury;if(Math.abs(p-a)>1e-9)throw Error("Orçamentos diferentes na mesma posição: "+p+" vs "+a)});
 test("[A4] Era aberta + conclusão equivale a processEra",()=>{const c=clone(DEFAULTS),a=newState(c),b=newState(c);for(let i=0;i<8;i++){processEra(a,c,{autoStrategy:"balanced"});beginEra(b,c);finishEra(b,c,{autoStrategy:"balanced"})}if(JSON.stringify(a.timeline)!==JSON.stringify(b.timeline))throw Error("Fases separadas divergem de processEra")});
 test("[A5] Não é possível abrir a mesma era duas vezes",()=>{const c=clone(DEFAULTS),s=newState(c);beginEra(s,c);let failed=false;try{beginEra(s,c)}catch(e){failed=true}if(!failed)throw Error("Era aberta duas vezes (receita duplicada)")});
 test("[A6] Ataque do jogador durante a era aberta é resolvido nessa era",()=>{const c=clone(DEFAULTS),s=newState(c,{endRules:true});beginEra(s,c);P(s).military=100;const t=eligibleTargets(s,"player")[0];attackTerritory(s,t.i,"player",c);finishEra(s,c,{playerAllocation:{military:0,infrastructure:0,technology:0}});if(s.timeline[0].civs[0].attacks.wins+s.timeline[0].civs[0].attacks.losses!==1)throw Error("Ataque não registado na era 1")});

 // ── Etapa 4: laboratórios ──
 const LP=LAB_PROFILES.map(x=>x[0]);
 test("Identificadores dos testes são únicos e estáveis",()=>{const reg=testRegistry(),ids=reg.map(t=>t.id);if(new Set(ids).size!==ids.length)throw Error("IDs repetidos");if(stableCode("abc")!==stableCode("abc")||stableCode("abc")===stableCode("abd"))throw Error("Código derivado do nome não é determinístico");if(reg.some(t=>!TEST_CATS.some(([c])=>c===t.cat)))throw Error("Teste sem categoria válida")},"INF");
 test("Partida do Modo B termina com resultado e Modo A corre as eras pedidas",()=>{const c=clone(DEFAULTS);c.endgame.maxEras=12;const b=runGame(c,{kind:"auto",profiles:LP,civCount:2,seed:3});if(!b.result||b.eras>12)throw Error("Modo B sem resultado até ao limite");const a=runGame(c,{kind:"fixed",eras:20,profiles:LP,civCount:2,seed:3});if(a.result||a.rows.length!==20)throw Error("Modo A interrompido ou com resultado")},"INF");
 test("Cenários iguais com as mesmas sementes dão partidas idênticas",()=>{const c=clone(DEFAULTS),o={kind:"auto",profiles:LP,civCount:3,seed:fixedGameSeed(5,2),game:2};const a=runGame(c,o),b=runGame(scenarioConfig(c,{}),o);if(JSON.stringify(a.rows)!==JSON.stringify(b.rows)||JSON.stringify(a.result)!==JSON.stringify(b.result))throw Error("Mesmas condições produziram partidas diferentes")},"INF");
 test("Modo A identifica a primeira condição que teria ocorrido",()=>{const mk=(t,streak)=>({era:0,sup:{leader:"ai",streak},tmin:17,civs:[[t[0],1],[t[1],1]]});const rec={kind:"fixed",ids:["player","ai"],seats:["military","economist"],supremacyEras:5,rows:[mk([3,3],0),mk([10,4],0),mk([17,2],0),mk([18,1],0)].map((r,i)=>({...r,era:i+1}))};const o=gameOutcome(rec);if(!o.would||o.era!==3||o.winners.join()!=="0"||!o.reasons[0].includes("territorial"))throw Error("Desfecho hipotético incorreto: "+JSON.stringify(o))},"INF");
 test("Indicadores contam cada partida uma vez, mesmo com vários motivos",()=>{const c=clone(DEFAULTS),recs=[1,2,3,4,5,6].map(g=>runGame(c,{kind:"auto",profiles:LP,civCount:2,seed:fixedGameSeed(11,g),game:g}));recs[0].result={era:9,type:"victory",winners:["player"],reasons:{player:["territorial","elimination"]}};const m=summarizeRecords(recs);const total=Object.values(m.outcomes).reduce((a,b)=>a+b,0);if(total!==recs.length)throw Error(`Desfechos somam ${total} em vez de ${recs.length}`);if(m.reasonMentions.elimination<1||m.reasonMentions.territorial<1)throw Error("Motivos múltiplos não registados")},"INF");
 test("Consolidado é a média simples entre perfis",()=>{const st=[{winRate:.6},{winRate:.2},{winRate:.1}];if(Math.abs(consolidateProfiles(st,["winRate"]).winRate-.3)>1e-12)throw Error("Consolidado não é a média simples")},"INF");
 test("Resultados por perfil somam os lugares jogados",()=>{const c=clone(DEFAULTS),recs=[0,1,2,3,4,5].map(g=>runGame(c,{kind:"auto",profiles:LP,civCount:2,seed:fixedGameSeed(13,g),game:g}));const st=profileStats(recs);if(st.reduce((a,s)=>a+s.seats,0)!==12)throw Error("Lugares não somam 12");for(const s of st){if(s.wins+s.draws+s.losses!==s.seats)throw Error(s.profile+": vitórias+empates+derrotas ≠ lugares");if(Math.abs(s.shares.reduce((a,b)=>a+b,0)-1)>1e-9)throw Error("Parcelas de investimento não somam 100%")}},"INF");
 test("Cenários com parâmetros inválidos são recusados",()=>{let failed=false;try{scenarioConfig(DEFAULTS,{"endgame.iceWMilitary":.9})}catch(e){failed=true}if(!failed)throw Error("Pesos do ICE a somar ≠ 1 aceites");const d=paramCatalog().find(x=>x.id==="endgame.territoryPct");if(parseParamValue(d,"0,65")!==.65)throw Error("Vírgula decimal não aceite")},"INF");
 test("Diagnóstico deteta perfis com comportamento semelhante",()=>{const base={seats:10,winRate:.5,shares:[.4,.4,.2],combatsPerGame:5,conquestsPerGame:3,successRate:.8,infraConversion:2,idleRate:0,eliminatedRate:0,milShareStd:.1};const d=profileDiagnostics([{...base,profile:"military"},{...base,profile:"aggressive",shares:[.42,.39,.19]}],{kind:"auto",mode:"slow"});if(!d.some(([w])=>w.includes("×")))throw Error("Semelhança não detetada")},"INF");

 // ── Etapa 5: integração e validação ──
 test("Lento e rápido dão resultados idênticos com regras equivalentes",()=>{const slow=clone(DEFAULTS),fast=clone(DEFAULTS);fast.economy.fastModeReturnMultiplier=1;slow.economy.fastModeReturnMultiplier=1;fast.military.delay=slow.military.delay+1;fast.infrastructure.delay=slow.infrastructure.delay+1;fast.technology.delay=slow.technology.delay+2;const o={kind:"auto",profiles:LAB_PROFILES.map(x=>x[0]),civCount:3,seed:4242,game:1};const a=runGame(slow,{...o,mode:"slow"}),b=runGame(fast,{...o,mode:"fast"});if(JSON.stringify(a.rows)!==JSON.stringify(b.rows))throw Error("Com atrasos equivalentes (rápido = lento + redução do modo) as partidas divergem");if(JSON.stringify(a.result)!==JSON.stringify(b.result))throw Error("Resultados finais diferentes")},"INF");

 test("Infraestrutura no modo rápido usa o atraso reduzido",()=>{const c=clone(DEFAULTS);c.infrastructure.delay=2;const s=makeInvestment("infrastructure",100,0,c,"player","slow"),f=makeInvestment("infrastructure",100,0,c,"player","fast");if(infraReturn(s,1)!==0)throw Error("Lento devolveu antes do atraso de 2 eras");if(!(infraReturn(f,1)>0))throw Error("Rápido não antecipou o retorno (atraso efetivo 1)")},"ECO");
 test("Laboratórios 2 e 3 geram as mesmas partidas para as mesmas condições",()=>{const opts={kind:"auto",games:4,eras:30,civCount:3,baseSeed:77,mode:"slow",profiles:LAB_PROFILES.map(x=>x[0])};const a=buildJobs(clone(DEFAULTS),opts,{scenario:"Base"}).map(j=>runGame(j.cfg,j.opts)),b=buildJobs(clone(DEFAULTS),opts).map(j=>runGame(j.cfg,j.opts));a.forEach((r,i)=>{if(JSON.stringify(r.rows)!==JSON.stringify(b[i].rows)||JSON.stringify(r.result)!==JSON.stringify(b[i].result))throw Error("Partida "+i+" diferente entre laboratórios")})},"INF");
 test("Experiência completa é reproduzível",()=>{const opts={kind:"auto",games:6,eras:30,civCount:2,baseSeed:91,mode:"fast",profiles:LAB_PROFILES.map(x=>x[0])};const run=()=>{const recs=buildJobs(clone(DEFAULTS),opts).map(j=>runGame(j.cfg,j.opts)),m=summarizeRecords(recs);return JSON.stringify({m,p:profileStats(recs)})};if(run()!==run())throw Error("Mesma experiência produziu indicadores diferentes")},"INF");
 test("Exportações CSV têm o número esperado de linhas",()=>{const saved=expState.results;let out=null;const stop=captureDownloads((name,text)=>{out=text.split("\n")});try{const opts={kind:"auto",games:3,eras:30,civCount:3,baseSeed:5,mode:"slow",profiles:["military","economist","adaptive"]};const recs=buildJobs(clone(DEFAULTS),opts,{scenario:"X"}).map(j=>runGame(j.cfg,j.opts));expState.results={opts,scenarios:[{name:"X",values:{},cfg:clone(DEFAULTS),mode:"slow",recs,sum:summarizeRecords(recs)}]};
  exportExp("games");if(out.length!==1+3*3)throw Error(`CSV de partidas com ${out.length} linhas (esperado 10)`);exportExp("eras");const exp=1+recs.reduce((a,r)=>a+r.rows.length*3,0);if(out.length!==exp)throw Error(`CSV por era com ${out.length} linhas (esperado ${exp})`);exportExp("summary");if(out.length!==2)throw Error("CSV de resumo deveria ter 2 linhas")}finally{expState.results=saved;stop()}},"INF");
 test("Desempenho: uma partida de 30 eras com 4 civilizações em menos de 200 ms",()=>{const t=performance.now();for(let g=0;g<5;g++)runGame(clone(DEFAULTS),{kind:"fixed",eras:30,profiles:LAB_PROFILES.map(x=>x[0]),civCount:4,seed:g});const ms=(performance.now()-t)/5;if(ms>200)throw Error(`Média de ${fmt(ms,0)} ms por partida`)},"INF");

 // ── Balanceamento: novas mecânicas ──
 test("Custo administrativo reduz a receita de todos os territórios",()=>{const c=clone(DEFAULTS);c.military.aiEnabled=false;c.economy.adminCostPerTerritory=1;const s=newState(c);for(let i=1;i<=4;i++)s.owners[i]="player";beginEra(s,c,{ai:false});const n=5;if(Math.abs(s.pending.revenue.player.normal-n*(22-(n-1)))>1e-9)throw Error("Receita territorial "+s.pending.revenue.player.normal+" ≠ "+n*(22-(n-1)));const c0=clone(c);c0.economy.adminCostPerTerritory=0;const s0=newState(c0);for(let i=1;i<=4;i++)s0.owners[i]="player";beginEra(s0,c0,{ai:false});if(s0.pending.revenue.player.normal!==n*22)throw Error("Com custo 0 deveria ser a regra antiga")},"ECO");
 test("Receita por território nunca fica negativa",()=>{const c=clone(DEFAULTS);c.military.aiEnabled=false;c.economy.adminCostPerTerritory=5;const s=newState(c);for(let i=1;i<10;i++)s.owners[i]="player";beginEra(s,c,{ai:false});if(s.pending.revenue.player.normal!==0)throw Error("Receita negativa ou incorreta")},"ECO");
 test("Exército não usado perde a fração configurada por era",()=>{const c=clone(DEFAULTS);c.military.aiEnabled=false;c.military.decayRate=.2;const s=newState(c);P(s).military=100;beginEra(s,c,{ai:false});if(Math.abs(P(s).military-80)>1e-9)throw Error("Esperado 80, obtido "+P(s).military);const c0=clone(c);c0.military.decayRate=0;const s0=newState(c0);P(s0).military=100;beginEra(s0,c0,{ai:false});if(P(s0).military!==100)throw Error("Com desgaste 0 os pontos deveriam manter-se")},"MIL");
 test("Pontos recém-libertados não sofrem desgaste na própria era",()=>{const c=clone(DEFAULTS);c.military.aiEnabled=false;const s=newState(c);beginEra(s,c,{ai:false});finishEra(s,c,{playerAllocation:{military:100,infrastructure:0,technology:0},ai:false});beginEra(s,c,{ai:false});if(Math.abs(P(s).military-100*c.military.pointsPerInvestment)>1e-9)throw Error("Pontos novos foram desgastados")},"MIL");
 test("Bônus tecnológico usa só o progresso ativo e respeita o teto",()=>{const c=clone(DEFAULTS);c.military.aiEnabled=false;const s=newState(c);s.investments.push({...makeInvestment("technology",1000,0,c,"player","slow"),id:99});beginEra(s,c,{ai:false});if(s.pending.revenue.player.tech!==0)throw Error("Bônus antes do atraso");for(let e=0;e<3;e++){finishEra(s,c,{ai:false});beginEra(s,c,{ai:false})}const r=s.pending.revenue.player,base=r.normal+r.infra+1000*.2*c.technology.benefitPerProgress,expected=1000*.2*c.technology.benefitPerProgress+Math.min(c.technology.revenueBonusCap,c.technology.revenueBonusPerProgress*200)*base;if(Math.abs(r.tech-expected)>1e-6)throw Error(`Tecnologia ${r.tech} ≠ ${expected}`)},"TEC");
 test("Simulação longa com bônus tecnológico não explode",()=>{const c=clone(DEFAULTS);c.military.aiStyle="technologist";const s=simulate("technology",150,c);if(s.stopped||!Number.isFinite(P(s).treasury))throw Error("Crescimento explosivo")},"TEC");
 test("Defesa cresce com a infraestrutura e a tecnologia do dono",()=>{const c=clone(DEFAULTS),s=newState(c);const ai=A(s),idx=s.owners.indexOf("ai"),base=territoryDefense(s,idx,c);ai.lastRevenue={...ai.lastRevenue,infrastructure:50};ai.techProgress=40;const d=territoryDefense(s,idx,c);if(Math.abs(d-(base+50*c.military.defensePerInfraRevenue+40*c.military.defensePerTechProgress))>1e-9)throw Error("Defesa "+d);if(territoryDefense(s,5,c)!==c.military.defenseNeutral)throw Error("Neutro não deve receber bónus")},"MIL");
 test("Defesa econômica reparte-se pela raiz quadrada dos territórios",()=>{const c=clone(DEFAULTS),s=newState(c);const ai=A(s);let added=0;for(let i=0;i<s.owners.length&&added<3;i++)if(s.owners[i]==="neutral"){s.owners[i]=ai.id;added++}
  const T=countTerritories(s,ai.id),idx=s.owners.indexOf(ai.id);ai.lastRevenue={...ai.lastRevenue,infrastructure:100};ai.techProgress=0;const d=territoryDefense(s,idx,c),exp=c.military.defenseOwned+100*c.military.defensePerInfraRevenue/Math.sqrt(T);
  if(T!==4||Math.abs(d-exp)>1e-9)throw Error("Defesa "+d+" esperada "+exp)},"MIL");
 test("Saque transfere infraestrutura, tecnologia e espólio em tesouro",()=>{const c=clone(DEFAULTS),s=newState(c);const ai=A(s),pl=P(s);ai.treasury=1000;invest(s,"infrastructure",100,c,ai.id);invest(s,"technology",60,c,ai.id);ai.lastRevenue={...ai.lastRevenue,total:40};
  const T=countTerritories(s,ai.id),f=Math.min(.5,c.military.pillageInvestShare/T),tr0=pl.treasury,r=pillage(s,ai.id,pl.id,c);
  const sum=(o,ty,k)=>s.investments.filter(i=>i.owner===o&&i.type===ty).reduce((a,i)=>a+i[k],0);
  if(Math.abs(sum(pl.id,"infrastructure","amount")-100*f)>1e-9||Math.abs(sum(ai.id,"infrastructure","amount")-100*(1-f))>1e-9)throw Error("Infraestrutura mal transferida");
  if(Math.abs(sum(pl.id,"technology","progress")+sum(ai.id,"technology","progress")-60*c.technology.progressPerInvestment)>1e-9||!(r.tech>0))throw Error("Progresso tecnológico não se conserva");
  if(Math.abs(pl.treasury-tr0-c.military.pillageRevenueEras*40/T)>1e-9)throw Error("Espólio "+(pl.treasury-tr0))},"MIL");
 test("Ataque usa a defesa reforçada",()=>{const c=clone(DEFAULTS);c.military.conquestCost=0;const s=newState(c);s.owners[1]="ai";A(s).techProgress=100;P(s).military=c.military.defenseOwned+1;const r=attackTerritory(s,1,"player",c);if(r.ok)throw Error("Ataque passou ignorando a defesa tecnológica")},"MIL");

 test("Ordens simultâneas: a ordem reserva o poder e só se resolve no fim da era",()=>{const c=clone(DEFAULTS),s=newState(c);beginEra(s,c);const pl=P(s),idx=eligibleTargets(s,"player").find(x=>x.o==="neutral").i;pl.military=50;const r=orderAttack(s,idx,"player",c);
  if(!r.ok||!r.queued||s.owners[idx]!=="neutral"||Math.abs(pl.military-(50-r.need))>1e-9)throw Error("Ordem não reservou o poder");s.forcedAttack={owner:"player",win:true};finishEra(s,c,{playerAllocation:{military:0,infrastructure:0,technology:0}});if(s.owners[idx]!=="player")throw Error("Ordem não resolvida no fim da era")},"MIL");
 test("Ordens simultâneas: batalha pelo mesmo território e cancelamento devolvem o certo",()=>{const c=clone(DEFAULTS),s=newState(c);beginEra(s,c);s.owners=s.owners.map(()=>"neutral");s.owners[7]="player";s.owners[9]=A(s).id;const pl=P(s),ai=A(s);pl.military=50;ai.military=20;pl.techProgress=0;ai.techProgress=0;
  const a=orderAttack(s,8,"player",c),b=orderAttack(s,8,ai.id,c);if(!a.ok||!b.ok)throw Error("Ordens recusadas");s.forcedAttack={owner:"player",win:true};const ev=resolveOrders(s,c,s.era);
  if(s.owners[8]!=="player"||!ev.some(e=>e.type==="battleLost"&&e.owner===ai.id))throw Error("Batalha mal resolvida");if(Math.abs(ai.military-(20-b.need))>1e-9)throw Error("Perdedor deveria perder o poder reservado: "+ai.military);
  pl.military=30;const o=orderAttack(s,6,"player",c);cancelOrder(s,"player",6);if(Math.abs(pl.military-30)>1e-9||s.orders.length)throw Error("Cancelamento não devolveu o poder")},"MIL");
 test("Ordens múltiplas: cada ataque adicional custa mais e cancelar recalcula",()=>{const c=clone(DEFAULTS),s=newState(c);beginEra(s,c);s.owners=s.owners.map(()=>"neutral");s.owners[7]="player";const pl=P(s);pl.military=100;
  const a=orderAttack(s,6,"player",c),b=orderAttack(s,8,"player",c),d=orderAttack(s,13,"player",c);if(!a.ok||!b.ok||!d.ok)throw Error("Ordens recusadas");
  const base=c.military.conquestCost+c.military.defenseNeutral;if(Math.abs(a.need-base)>1e-9||Math.abs(b.need-2*base)>1e-9||Math.abs(d.need-3*base)>1e-9)throw Error("Custos "+[a.need,b.need,d.need]);
  if(Math.abs(pl.military-(100-6*base))>1e-9)throw Error("Reserva errada");cancelOrder(s,"player",6);const o=s.orders.filter(x=>x.owner==="player");
  if(o.length!==2||Math.abs(o[0].need-base)>1e-9||Math.abs(o[1].need-2*base)>1e-9||Math.abs(pl.military-(100-3*base))>1e-9)throw Error("Cancelar não recalculou: "+o.map(x=>x.need)+" / "+pl.military);
  for(const x of [8,13])s.forcedAttack=null;s.forcedAttack={owner:"player",win:true};const mil0=pl.military;resolveOrders(s,c,s.era);if(pl.military>mil0+3*base+1e-9)throw Error("Custo extra não cobrado")},"MIL");
 test("Tutorial: ataque com resultado fixado e IA que evita o jogador",()=>{const c=clone(DEFAULTS),s=newState(c);const pl=P(s),idx=eligibleTargets(s,"player")[0].i;pl.military=100;s.forcedAttack={owner:"player",win:false};const r=attackTerritory(s,idx,"player",c);if(!r.ok||r.win||s.forcedAttack)throw Error("Resultado não fixado");
  const s2=newState(c);s2.owners=s2.owners.map(()=>"neutral");s2.owners[7]="player";s2.owners[8]=A(s2).id;A(s2).military=1e6;s2.aiAvoid={player:true,idx:[9,2,14]};beginEra(s2,c);aiDecide(s2,A(s2),c);if(s2.owners[7]!=="player"||s2.owners[9]!=="neutral")throw Error("A IA atacou um alvo protegido")},"IA");
 test("Territórios contam de forma proporcional na pontuação",()=>{const c=clone(DEFAULTS);const t={values:Object.fromEntries(REF_DIMS.map(([d])=>[d,[10]]))};const base={military:10,infrastructure:10,technology:10,treasury:10,revenue:10};const s=finalScores([{id:"a",dims:{...base,territories:10}},{id:"b",dims:{...base,territories:5}}],1,c,t);if(Math.abs(s[0].parts.territories-1)>1e-9||Math.abs(s[1].parts.territories-.5)>1e-9)throw Error("Partes "+s[0].parts.territories+" / "+s[1].parts.territories);c.endgame.scoreTerritoryProportional=false;const l=finalScores([{id:"b",dims:{...base,territories:5}}],1,c,t);if(!(l[0].parts.territories>.5))throw Error("Desligado deveria usar a escala logarítmica")},"PON");
 test("Territórios são a 5ª dimensão da pontuação e do ICE",()=>{const c=clone(DEFAULTS);if(Math.abs(SCORE_WEIGHT_KEYS.reduce((a,k)=>a+c.endgame[k],0)-1)>1e-9||c.endgame.scoreWTerritory!==.4||c.endgame.iceWTerritory!==.2)throw Error("Pesos padrão incorretos");const t={values:Object.fromEntries(REF_DIMS.map(([d])=>[d,[10]]))};const base={military:10,infrastructure:10,technology:10,treasury:10,revenue:10};const a=finalScores([{id:"a",dims:{...base,territories:10}},{id:"b",dims:{...base,territories:2}}],1,c,t);if(!(a[0].score>a[1].score))throw Error("Mais territórios não aumentou a pontuação");if(Math.abs(a[0].score-1)>1e-9)throw Error("Tudo na referência deveria dar 100%");const i1=computeICE({...base,territories:10},1,c,t),i2=computeICE({...base,territories:2},1,c,t);if(!(i1.ice>i2.ice))throw Error("Mais territórios não aumentou o ICE")},"PON");
 test("Configuração antiga de 4 pesos continua válida",()=>{const c=clone(DEFAULTS);for(const k of ["iceWMilitary","iceWInfrastructure","iceWTechnology","iceWFinance","scoreWMilitary","scoreWInfrastructure","scoreWTechnology","scoreWTreasury"])c.endgame[k]=.25;delete c.endgame.iceWTerritory;delete c.endgame.scoreWTerritory;const n=normalizeConfig(c);if(n.endgame.iceWTerritory!==0||n.endgame.scoreWTerritory!==0)throw Error("Peso territorial deveria ficar 0")},"INF");
 test("Referências antigas sem territórios são completadas",()=>{const old={values:Object.fromEntries(REF_DIMS.filter(([d])=>d!=="territories").map(([d])=>[d,[1,2,3]]))};const v=validateReferences({ice:old});if(!v.ice.values.territories||v.ice.values.territories.length!==3)throw Error("Dimensão territorial não completada")},"INF");

 test("Supremacia só conta na fase final e com poucos territórios livres",()=>{const c=clone(DEFAULTS);c.references={ice:{values:Object.fromEntries(REF_DIMS.map(([d])=>[d,[10]]))},score:{values:Object.fromEntries(REF_DIMS.map(([d])=>[d,[10]]))}};const mk=(owners,era)=>{const s=newState(c,{endRules:true});s.owners=owners;s.era=era;return s};const dims={player:{military:10,infrastructure:10,technology:10,treasury:10,revenue:10,territories:10},ai:{military:0,infrastructure:0,technology:0,treasury:0,revenue:0,territories:1}};const ent=(s,era)=>({era,civs:s.civs.map(x=>({id:x.id,dims:dims[x.id]}))});
  const o1=Array(24).fill("neutral");o1[0]="player";o1[23]="ai";let s=mk(o1,6);let r=evaluateEndOfEra(s,c,6,ent(s,6),true);if(r.supremacy.status!=="notYet")throw Error("Contou cedo com o mapa livre");
  const o2=Array(24).fill("player");o2[23]="ai";o2[22]="neutral";s=mk(o2,10);r=evaluateEndOfEra(s,c,10,ent(s,10),true);if(r.supremacy.status!=="notYet")throw Error("Contou antes da metade do limite");
  s=mk(o2.slice(),15);r=evaluateEndOfEra(s,c,15,ent(s,15),true);if(r.supremacy.status!=="counting")throw Error("Não contou na fase final com o mapa ocupado: "+r.supremacy.status);
  const o3=Array(24).fill("neutral");for(let i=0;i<15;i++)o3[i]="player";o3[23]="ai";s=mk(o3,20);r=evaluateEndOfEra(s,c,20,ent(s,20),true);if(r.supremacy.status!=="notYet")throw Error("Contou com 8 territórios livres")},"SUP");

 // ── Dificuldade ──
 test("Multiplicador de receita só afeta IAs em partidas com jogador humano",()=>{const c=clone(DEFAULTS);c.economy.aiIncomeMultiplier=1.5;const s=newState(c);beginEra(s,c);if(s.pending.revenue.player.total!==22)throw Error("Jogador afetado");if(Math.abs(s.pending.revenue.ai.total-33)>1e-9)throw Error("IA sem multiplicador: "+s.pending.revenue.ai.total);const l=newState(c,{allAI:true});beginEra(l,c);if(l.pending.revenue.ai.total!==22)throw Error("Laboratório (todas IA) não deveria aplicar o multiplicador")},"IA");
 test("IA estratega escolhe o alvo mais barato e prefere o jogador no empate",()=>{const c=clone(DEFAULTS);c.military.aiTarget="cheapest";c.military.aiAggression=100;c.military.aiStyle="military";const s=newState(c);s.owners.fill("neutral");s.owners[7]="ai";s.owners[13]="player";A(s).military=50;A(s).treasury=0;s.era=1;processEra(s,c,{ai:true,playerAllocation:{military:0,infrastructure:0,technology:0}});const conq=s.log.find(x=>/IA conquistou|IA atacou/.test(x.text));if(!conq)throw Error("IA não atacou");if(!/território (1|2|7|9|8|14) /.test(conq.text+" "))throw Error("Alvo inesperado: "+conq.text)},"IA");
 test("Modo Conquista: supremacia desligada nunca dá vitória",()=>{const c=clone(DEFAULTS);c.endgame.supremacyEnabled=false;c.endgame.maxEras=150;const n=normalizeConfig(c);if(n.endgame.maxEras!==150||n.endgame.supremacyEnabled!==false)throw Error("Configuração não aceite");
  const r=runGame(n,{kind:"auto",profiles:LAB_PROFILES.map(x=>x[0]),civCount:4,seed:11});const o=gameOutcome(r);if(o.type==="supremacy"||(r.result&&r.result.reasons&&Object.values(r.result.reasons).flat().includes("supremacy")))throw Error("Houve supremacia");if(!o.ended)throw Error("Partida não terminou")},"SUP");
 test("Referências padrão cobrem 150 eras",()=>{for(const [d] of REF_DIMS){const a=DEFAULT_REFERENCE_VALUES[d];if(!a||a.length<150||!a.every(Number.isFinite))throw Error(d)}},"SUP");
 test("Predefinições de dificuldade aplicam os valores certos",()=>{const saved=clone(configApplied);try{for(const [k,v] of [["muitofacil",[.7,75,"neutralFirst"]],["facil",[.92,75,"neutralFirst"]],["medio",[1.03,75,"neutralFirst"]],["dificil",[1,100,"cheapest"]],["hardcore",[1.03,100,"cheapest"]]]){applyDifficulty(k);const got=[configApplied.economy.aiIncomeMultiplier,configApplied.military.aiAggression,configApplied.military.aiTarget];if(JSON.stringify(got)!==JSON.stringify(v))throw Error(k+": "+JSON.stringify(got))}normalizeConfig(configApplied)}finally{configApplied=saved}},"IA");
 return list;
}
export const TEST_CAT_BY_NAME={"Uma era gera valores finitos": "ECO", "Investimento inicial gera retorno no calendário previsto": "ECO", "Investimentos respeitam orçamento": "ECO", "Infraestrutura respeita atraso e duração": "ECO", "Avanço múltiplo equivale ao individual": "ECO", "Reinício restaura estado": "ECO", "Simulação prolongada sem valores inválidos": "ECO", "Fontes de receita somam total": "ECO", "IA mantém tesouro independente e recebe receita": "ECO", "Modo rápido aplica multiplicador de retorno também à IA": "ECO", "IA recebe multiplicador rápido nos investimentos reais": "ECO", "Cada IA mantém tesouro e investimentos próprios": "ECO", "Todas as IAs recebem a mesma regra de receita": "ECO", "[A2] Jogador vê a receita da era antes de decidir": "ECO", "[A3] Jogador e IA decidem com a mesma informação": "ECO", "[A4] Era aberta + conclusão equivale a processEra": "ECO", "[A5] Não é possível abrir a mesma era duas vezes": "ECO", "Tecnologia ativa na era correta sem duplicação": "TEC", "Progresso tecnológico do jogador não inclui a IA": "TEC", "Pontos militares têm atraso": "MIL", "Ataque impossível é recusado": "MIL", "Defesa muda conforme território neutro ou dominado": "MIL", "Conquista respeita adjacência e aumenta territórios": "MIL", "Ataque bem-sucedido ou falho gera métricas de expansão": "MIL", "Simulação militar expande território e mede ataques": "MIL", "IAs podem atacar outras IAs": "MIL", "Ataques de civilizações diferentes usam sorteios diferentes": "MIL", "[A6] Ataque do jogador durante a era aberta é resolvido nessa era": "MIL", "Investimento da IA não contamina métricas do jogador": "IA", "Perfis da IA produzem decisões de investimento distintas": "IA", "IA aproveita o tesouro sem ultrapassar o orçamento": "IA", "Perfil de IA afeta alocação de investimento": "IA", "IA de referência aumenta prioridade militar sob ameaça": "IA", "IA adaptativa reage à pressão territorial": "IA", "Decisões militares respeitam agressividade zero e cem": "IA", "Lugar do jogador pode ser controlado por IA": "IA", "Simulações independentes": "INF", "Exportação/importação preserva configuração": "INF", "JSON inválido não é aceito": "INF", "Cancelamento preserva eras concluídas (primitiva)": "INF", "Estado suporta várias civilizações com posições distintas": "INF", "Configuração 1×1 mantém posições do MVP original": "INF", "Partida com 5 IAs corre sem valores inválidos": "INF", "Modo é parâmetro do estado, não variável global": "INF", "Simulações lenta e rápida podem correr lado a lado": "INF", "Histórico por era regista todas as civilizações": "INF", "Dimensões seguem as definições acordadas": "INF", "Mesma semente e configuração reproduzem a partida": "INF", "Configuração v3 sem parâmetros novos é aceite": "INF", "Número de IAs fora do limite é recusado": "INF", "Partida de duração fixa corre todas as eras": "INF", "Duração fixa é reprodutível pela semente": "INF", "Duração fixa não altera a configuração nem a partida atual": "INF", "Perfis rodam de forma equilibrada pelos lugares": "INF", "Receita média usa as últimas 3 eras disponíveis": "INF", "Calibração usa a mediana por era e dimensão": "INF", "Mediana zero recebe referência de recurso positiva e marcada": "INF", "Calibração real gera referências válidas para todas as eras": "INF", "Referência depois da última era usa o último valor": "INF", "Configuração guarda e valida referências": "INF", "[T1] Vitória ao atingir exatamente o mínimo de territórios": "TER", "[T2] Não vence abaixo do mínimo": "TER", "[T3] Arredondamento sempre para cima": "TER", "[T4] Territórios neutros entram na base de cálculo": "TER", "[T5] Empate entre civilizações acima do percentual": "TER", "[T6] Perda de território durante a era impede a vitória": "TER", "[T7] Conquista durante a era conta na avaliação final": "TER", "[E1] Sem territórios = eliminação imediata no fim da era": "TER", "[E2] Eliminação é definitiva": "TER", "[E3] Eliminar todos os adversários = vitória por eliminação": "TER", "[E4] Todas eliminadas na mesma era = empate geral": "TER", "[E5] Eliminação + maioria = uma vitória com dois motivos": "TER", "[E6] Jogador eliminado: a partida continua entre as restantes": "TER", "[S1] Vitória ao completar as eras consecutivas": "SUP", "[S2] Relação acima do limite reinicia a sequência": "SUP", "[S3] Mudança de líder reinicia a contagem": "SUP", "[S4] Empate na liderança reinicia": "SUP", "[S5] ICE não calculável suspende e preserva a sequência": "SUP", "[S6] ICE absoluto mínimo por era é aplicado": "SUP", "[S7] Compara com o segundo maior ICE entre todos": "SUP", "[S8] Queda do ICE do líder não interrompe se a condição se mantém": "SUP", "[S9] Fórmula do ICE: média geométrica ponderada com piso": "SUP", "[S10] Supremacia é independente da vitória territorial": "SUP", "[F1] Média aritmética ponderada": "PON", "[F2] Normalização linear": "PON", "[F3] Normalização logarítmica": "PON", "[F4] Limite máximo de 150% por dimensão": "PON", "[F5] Dimensão zero vale zero e as outras contam": "PON", "[F6] Civilizações eliminadas ficam fora da classificação": "PON", "[F7] Usa só os valores da última era e só o saldo da tesouraria": "PON", "[F8] Empate dentro da margem de 1%": "PON", "[F9] Empate com três ou mais civilizações": "PON", "[G1] Vitórias simultâneas de civilizações diferentes = empate": "END", "[G2] Encerramento obrigatório no limite de eras": "END", "[G3] Vitória na era-limite prevalece sobre a pontuação": "END", "[G4] Funciona nos modos lento e rápido": "END", "[G5] Duração fixa não encerra, mas regista as condições": "END", "[G6] Partida encerrada não aceita novas eras": "END", "[G7] Configuração de fim de partida é validada": "END", "[G8] Extensão experimental espera pela sequência de supremacia": "END", "[A1] Padrões ajustados: maioria 70%, supremacia 0,70 e ICE mínimo 0,5": "END"};
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
export function csvDownload(name,rows){download(name,rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(";")).join("\n"),"text/csv;charset=utf-8")}
export function readSimOpts(prefix){
 const num=(id,min,max)=>{const v=safeNum($(prefix+id).value,min,max);if(!Number.isInteger(v))throw Error("Use números inteiros nas configurações da simulação.");return v};
 const profiles=[...document.querySelectorAll(`#${prefix}Profiles input:checked`)].map(x=>x.value);if(!profiles.length)throw Error("Selecione pelo menos um perfil.");
 return {kind:$(prefix+"Kind").value==="fixed"?"fixed":"auto",games:num("Games",1,5000),eras:num("Eras",1,300),civCount:num("Civs",2,1+MAX_AI),baseSeed:num("Seed",0,4294967295),mode:["fast","both"].includes($(prefix+"Mode").value)?$(prefix+"Mode").value:"slow",profiles};
}
export function profileChecks(containerId){$(containerId).innerHTML=LAB_PROFILES.map(([v,n])=>`<label><input type="checkbox" value="${v}" checked> ${n}</label>`).join("")}
/* ── Gráfico de barras agrupadas (canvas) ── */
export function barChart(canvas,labels,series,opts={}){
 const ctx=canvas.getContext("2d"),dpr=window.devicePixelRatio||1,w=canvas.clientWidth||300,h=canvas.clientHeight||220;canvas.width=w*dpr;canvas.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
 const pad={l:38,r:8,t:12,b:34},pw=w-pad.l-pad.r,ph=h-pad.t-pad.b,all=series.flatMap(s=>s.values).filter(Number.isFinite),max=opts.max??Math.max(1,...all);
 ctx.font="10px system-ui";ctx.strokeStyle="#293951";ctx.fillStyle="#9fb0c7";
 for(let i=0;i<=4;i++){const y=pad.t+ph*i/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText(fmt(max*(1-i/4),0)+(opts.unit||""),2,y+3)}
 const gw=pw/Math.max(1,labels.length),bw=Math.max(2,Math.min(26,(gw-8)/Math.max(1,series.length)));
 labels.forEach((lab,i)=>{const x0=pad.l+gw*i+(gw-bw*series.length)/2;series.forEach((s,k)=>{const v=s.values[i];if(!Number.isFinite(v))return;const bh=ph*clamp(v/max,0,1);ctx.fillStyle=s.color;ctx.fillRect(x0+k*bw,pad.t+ph-bh,bw-1,bh)});ctx.fillStyle="#9fb0c7";const t=String(lab);ctx.fillText(t.length>14?t.slice(0,13)+"…":t,pad.l+gw*i+2,h-pad.b+14)});
}
export const legendHtml=items=>items.map(([name,color])=>`<span style="--c:${cssColor(color)}">${escapeHtml(name)}</span>`).join("");
/* ═══════════════ Laboratório 1: testes funcionais ═══════════════ */
export const TEST_CATS=[["ECO","Economia"],["TEC","Tecnologia"],["MIL","Militar e territorial"],["IA","Inteligência artificial"],["SUP","Supremacia"],["TER","Vitória territorial e eliminação"],["PON","Pontuação final"],["END","Encerramento geral"],["INF","Infraestrutura comum e laboratórios"]];
// Identificador estável: categoria + código de 4 dígitos derivado do nome (FNV-1a).
// Não muda quando se acrescentam ou reordenam testes; só muda se o nome do teste mudar.
export function stableCode(str){let h=0x811c9dc5;for(const ch of str){h^=ch.codePointAt(0);h=Math.imul(h,0x01000193)>>>0}return (h&0xffff).toString(16).toUpperCase().padStart(4,"0")}
export let TEST_REGISTRY=null;
export function testRegistry(){
 if(TEST_REGISTRY)return TEST_REGISTRY;const seen=new Set();
 TEST_REGISTRY=defineTests().map(t=>{const cat=t.cat||TEST_CAT_BY_NAME[t.name]||"INF";let id=cat+"-"+stableCode(t.name);while(seen.has(id))id+="b";seen.add(id);return {...t,cat,id}});
 return TEST_REGISTRY;
}
export const ftResults=new Map();
export let ftHistory=[],ftLastRun=null;
export const FT_HISTORY_KEY="imperios-ft-history";
export async function loadFtHistory(){try{ftHistory=JSON.parse(await storage.get(FT_HISTORY_KEY)||"[]")}catch(e){ftHistory=[]}}
// Corre os testes internos escolhidos por filter, sem tocar na tela: guarda os resultados em ftResults e
// o resumo em ftHistory. Devolve {total,pass}. (A aba "Testes funcionais" usa runFtTests, que também a redesenha.)
export function executeTests(filter,label){
 const reg=testRegistry().filter(filter),t0=performance.now();
 for(const t of reg){const s=performance.now();let ok=true,msg="Resultado esperado obtido.";try{t.fn()}catch(e){ok=false;msg=e.message||String(e)}ftResults.set(t.id,{ok,msg,ms:performance.now()-s,at:Date.now()})}
 const pass=reg.filter(t=>ftResults.get(t.id).ok).length,ms=performance.now()-t0;
 ftHistory.unshift({at:new Date().toISOString(),label,total:reg.length,pass,fail:reg.length-pass,ms,failed:reg.filter(t=>!ftResults.get(t.id).ok).map(t=>t.id)});ftHistory=ftHistory.slice(0,20);
 storage.set(FT_HISTORY_KEY,JSON.stringify(ftHistory)).catch(()=>{});
 ftLastRun={filter,label};
 return {total:reg.length,pass};
}
// Corre os testes e, se a aba "Testes funcionais" estiver ligada (versão de desenvolvimento), mostra o resultado.
export let ftLabReady=false;
export function runFtTests(filter,label){const r=executeTests(filter,label);if(ftLabReady){$("ftRepeat").disabled=false;renderFtLab()}return r}
export function runTests(){return runFtTests(()=>true,"Todos os testes")}
export function renderFtLab(){
 const reg=testRegistry(),q=($("ftFilter")?.value||"").trim().toLowerCase(),onlyFail=$("ftOnlyFail")?.checked;
 const ran=reg.filter(t=>ftResults.has(t.id)),pass=ran.filter(t=>ftResults.get(t.id).ok).length,last=ftHistory[0];
 const perCat=TEST_CATS.map(([c,n])=>{const ts=reg.filter(t=>t.cat===c),r=ts.filter(t=>ftResults.has(t.id)),p=r.filter(t=>ftResults.get(t.id).ok).length;return {c,n,total:ts.length,ran:r.length,pass:p}});
 if(ran.length){const allOk=pass===ran.length;$("testSummary").className="notice "+(allOk?"success":"error");
  $("testSummary").innerHTML=`<strong>${pass}/${ran.length} testes aprovados.</strong> ${allOk?"Núcleo validado pelos testes incluídos.":"Revise as falhas listadas abaixo."} · Aprovação ${fmt(100*pass/ran.length,1)}% · ${reg.length-ran.length?`${reg.length-ran.length} por executar · `:""}${last?`última execução: ${last.label}, ${fmt(last.ms,0)} ms`:""}<pre class="small" style="margin:8px 0 0;white-space:pre-wrap;color:inherit">LABORATÓRIO DE TESTES FUNCIONAIS\nTotal de testes: ${ran.length}  Aprovados: ${pass}  Reprovados: ${ran.length-pass}\n${perCat.filter(x=>x.ran).map(x=>`${x.n.toUpperCase()}: ${x.pass}/${x.ran}`).join("\n")}\nEstado: ${allOk?"SEM FALHAS":"FALHAS DETETADAS"}</pre>`}
 $("ftCategories").innerHTML=perCat.map(x=>`<div class="card metric"><div class="label">${x.c} · ${x.n}</div><div class="value ${!x.ran?"":x.pass===x.ran?"green":"red"}" style="font-size:20px">${x.ran?`${x.pass}/${x.ran}`:`— /${x.total}`}</div><div class="foot"><button class="small" data-ft-cat="${x.c}" style="padding:4px 8px">Executar categoria</button></div></div>`).join("");
 const rows=reg.filter(t=>{const r=ftResults.get(t.id);if(onlyFail&&!(r&&!r.ok))return false;return !q||t.name.toLowerCase().includes(q)||t.id.toLowerCase().includes(q)});
 $("testResults").innerHTML=TEST_CATS.map(([c,n])=>{const ts=rows.filter(t=>t.cat===c);if(!ts.length)return "";return `<h3>${n}</h3>`+ts.map(t=>{const r=ftResults.get(t.id);return `<div class="test"><div style="min-width:0"><strong>${t.name}</strong> <span class="pill">${t.id}</span><div class="small muted">${r?(r.ok?r.msg:`<span class="red">Falha:</span> ${r.msg}`):"Ainda não executado."}${r?` · ${fmt(r.ms,1)} ms`:""}</div></div><div class="row" style="flex-wrap:nowrap"><span class="${r?(r.ok?"pass":"fail"):"muted"}">${r?(r.ok?"APROVADO":"REPROVADO"):"—"}</span><button class="small" data-ft-run="${t.id}" style="padding:4px 8px">${r?"Repetir":"Executar"}</button></div></div>`}).join("")}).join("")||'<div class="small muted">Nenhum teste corresponde ao filtro.</div>';
 $("ftHistory").innerHTML=ftHistory.length?`<div class="tablewrap"><table><thead><tr><th>Quando</th><th>Execução</th><th>Aprovados</th><th>Reprovados</th><th>Tempo</th><th>Falhas</th></tr></thead><tbody>${ftHistory.map(h=>`<tr><td>${new Date(h.at).toLocaleString("pt-BR")}</td><td>${h.label}</td><td>${h.pass}/${h.total}</td><td class="${h.fail?"red":""}">${h.fail}</td><td>${fmt(h.ms,0)} ms</td><td>${h.failed.join(", ")||"—"}</td></tr>`).join("")}</tbody></table></div>`:"Sem execuções registadas.";
 document.querySelectorAll("[data-ft-run]").forEach(b=>b.onclick=()=>{const id=b.dataset.ftRun;runFtTests(t=>t.id===id,"Teste "+id)});
 document.querySelectorAll("[data-ft-cat]").forEach(b=>b.onclick=()=>{const c=b.dataset.ftCat;runFtTests(t=>t.cat===c,"Categoria "+c)});
}
export function exportFtReport(){const reg=testRegistry();csvDownload("imperios-testes-funcionais.csv",[["id","category","name","status","ms","message"],...reg.map(t=>{const r=ftResults.get(t.id);return [t.id,t.cat,t.name,r?(r.ok?"pass":"fail"):"not_run",r?r.ms.toFixed(2):"",r?.msg||""]})])}
export function setupFtLab(){
 $("ftCategory").innerHTML=TEST_CATS.map(([c,n])=>`<option value="${c}">${c} · ${n}</option>`).join("");
 $("runCategory").onclick=()=>{const c=$("ftCategory").value;runFtTests(t=>t.cat===c,"Categoria "+c)};
 $("ftRepeat").onclick=()=>{if(ftLastRun)runFtTests(ftLastRun.filter,ftLastRun.label+" (repetição)")};
 $("ftFilter").oninput=renderFtLab;$("ftOnlyFail").onchange=renderFtLab;$("ftExport").onclick=exportFtReport;
 ftLabReady=true;if(ftLastRun)$("ftRepeat").disabled=false;renderFtLab();
}
/* ═══════════════ Laboratório 2: balanceamento ═══════════════ */
// Catálogo de parâmetros experimentais = parâmetros da configuração (exceto desempenho e nº de IAs).
export function paramCatalog(){
 const out=[];for(const [title,g,items] of PARAM_GROUPS){if(g==="simulation")continue;for(const [key,label] of items){if((g==="map"&&key==="aiCount")||(g==="endgame"&&key==="enabled"))continue;out.push({id:`${g}.${key}`,group:g,key,label:`${title} · ${label}`,type:typeof DEFAULTS[g][key]})}}
 return out;
}
export const SCENARIO_COLORS=["#f4bd50","#56d6a1","#b49aff","#62a8ff","#ff737b","#e88a43","#72d0df","#d9a4c7"];
export let expState={params:["endgame.supremacyRelative","endgame.territoryPct"],scenarios:[],results:null},expCancel=false;
export const getParam=(cfg,id)=>{const [g,k]=id.split(".");return cfg[g][k]};
export function scenarioConfig(base,values){const c=clone(base);for(const [id,v] of Object.entries(values)){const [g,k]=id.split(".");c[g][k]=v}return normalizeConfig(c)}
export function parseParamValue(def,raw){if(def.type==="boolean")return !!raw;if(def.type==="string")return String(raw);const v=Number(String(raw).trim().replace(",","."));if(!Number.isFinite(v))throw Error(`Valor inválido para ${def.label}: ${raw}`);return v}
export function renderExpTable(){
 const cat=paramCatalog(),defs=expState.params.map(id=>cat.find(c=>c.id===id)).filter(Boolean);
 $("expHead").innerHTML=`<th>Cenário</th>${defs.map(d=>`<th>${d.label}<button class="small" data-exp-delparam="${d.id}" title="Remover coluna" style="padding:1px 6px;margin-left:6px">×</button></th>`).join("")}<th></th>`;
 $("expBody").innerHTML=expState.scenarios.map((s,i)=>`<tr><td><span class="dot" style="background:${SCENARIO_COLORS[i%SCENARIO_COLORS.length]}"></span><input data-exp-name="${i}" value="${escapeHtml(s.name)}" style="width:230px"></td>${defs.map(d=>{const v=s.values[d.id]??getParam(configApplied,d.id);return `<td>${d.type==="boolean"?`<input type="checkbox" data-exp-cell="${i}|${d.id}" ${v?"checked":""}>`:d.type==="string"?`<select data-exp-cell="${i}|${d.id}">${(PARAM_OPTIONS[d.key]||[]).map(([o,t])=>`<option value="${o}" ${o===v?"selected":""}>${t}</option>`).join("")}</select>`:`<input type="number" step="any" data-exp-cell="${i}|${d.id}" value="${v}" style="width:100px">`}</td>`}).join("")}<td class="row" style="flex-wrap:nowrap"><button class="small" data-exp-dup="${i}" style="padding:4px 8px">Duplicar</button><button class="small danger" data-exp-del="${i}" style="padding:4px 8px" ${expState.scenarios.length<2?"disabled":""}>Remover</button></td></tr>`).join("");
 document.querySelectorAll("[data-exp-name]").forEach(el=>el.onchange=()=>{expState.scenarios[+el.dataset.expName].name=el.value||"Cenário"});
 document.querySelectorAll("[data-exp-cell]").forEach(el=>el.onchange=()=>{const [i,id]=el.dataset.expCell.split("|"),d=cat.find(c=>c.id===id);try{expState.scenarios[+i].values[id]=parseParamValue(d,el.type==="checkbox"?el.checked:el.value);setStatus("expStatus","Cenário atualizado.")}catch(e){setStatus("expStatus",e.message,"error")}});
 document.querySelectorAll("[data-exp-dup]").forEach(b=>b.onclick=()=>{const s=expState.scenarios[+b.dataset.expDup];expState.scenarios.splice(+b.dataset.expDup+1,0,{name:s.name+" (cópia)",values:clone(s.values)});renderExpTable()});
 document.querySelectorAll("[data-exp-del]").forEach(b=>b.onclick=()=>{expState.scenarios.splice(+b.dataset.expDel,1);renderExpTable()});
 document.querySelectorAll("[data-exp-delparam]").forEach(b=>b.onclick=()=>{const id=b.dataset.expDelparam;expState.params=expState.params.filter(p=>p!==id);expState.scenarios.forEach(s=>delete s.values[id]);renderExpTable()});
}
export function addExpParam(id){if(!expState.params.includes(id)){expState.params.push(id);expState.scenarios.forEach(s=>{if(s.values[id]===undefined)s.values[id]=getParam(configApplied,id)})}renderExpTable()}
export function generateVariations(){
 const id=$("expVaryParam").value,d=paramCatalog().find(c=>c.id===id),raw=$("expVaryValues").value.split(/[;|]+/).map(x=>x.trim()).filter(Boolean);
 if(!raw.length)throw Error("Indique os valores separados por ponto e vírgula.");
 const vals=raw.map(v=>parseParamValue(d,v));if(!expState.params.includes(id))expState.params.push(id);
 const base=expState.scenarios[0]?.values||{};
 expState.scenarios=vals.map(v=>({name:`${d.label.split(" · ")[1]} = ${typeof v==="number"?fmt(v,3):v}`,values:{...clone(base),[id]:v}}));
 expState.scenarios.forEach(s=>expState.params.forEach(p=>{if(s.values[p]===undefined)s.values[p]=getParam(configApplied,p)}));
 renderExpTable();setStatus("expStatus",`${vals.length} cenários gerados a partir de ${d.label}.`,"success");
}
export async function runExperiment(){
 if(busy)return;const opts=readSimOpts("exp");
 if(!expState.scenarios.length)throw Error("Crie pelo menos um cenário.");
 const modes=opts.mode==="both"?["slow","fast"]:[opts.mode],scen=[];
 expState.scenarios.forEach(s=>{let cfg;try{cfg=scenarioConfig(configApplied,s.values)}catch(e){throw Error(`Cenário "${s.name}": ${e.message}`)}
  for(const m of modes)scen.push({name:modes.length>1?`${s.name} · ${m==="fast"?"rápido":"lento"}`:s.name,values:clone(s.values),cfg,mode:m,color:SCENARIO_COLORS[scen.length%SCENARIO_COLORS.length]})});
 const est=estimateRows(opts,scen.length,scen.map(s=>s.cfg));if(est>ROW_WARN&&!confirm(`Esta experiência vai guardar cerca de ${fmt(est/1e6,1)} milhões de registos (civilização × era) em memória. Continuar?`))return;
 if(opts.civCount>configApplied.map.territories)throw Error("Mais civilizações do que territórios.");
 busy=true;expCancel=false;$("runExp").disabled=true;$("cancelExp").disabled=false;$("expProgress").style.width="0%";$("expResults").innerHTML="";$("expCharts").classList.add("hidden");
 // Mesmas sementes, perfis e condições em todos os cenários: a partida g de cada cenário usa a
 // semente g e a mesma rotação de perfis. As partidas são intercaladas por rodada para que um
 // cancelamento deixe todos os cenários com o mesmo número de partidas.
 const perScen=scen.map(s=>buildJobs(s.cfg,opts,{scenario:s.name,mode:s.mode})),jobs=[];for(let g=0;g<opts.games;g++)perScen.forEach(js=>jobs.push(js[g]));
 try{
  const recs=await runGameJobs(jobs,(d,t,ms)=>{$("expProgress").style.width=(100*d/t)+"%";setStatus("expStatus",`A executar · ${d} de ${t} partidas (${fmt(100*d/t,0)}%) · ${fmt(ms/1000,1)} s decorridos`)},()=>expCancel,scen.length);
  if(!recs.length){setStatus("expStatus","Cancelado antes de concluir qualquer rodada.","error");return}
  scen.forEach(s=>s.recs=[]);recs.forEach(r=>scen.find(s=>s.name===r.scenario).recs.push(r));
  expState.results={opts,scenarios:scen,at:new Date().toISOString()};
  renderExpResults();
  const per=scen[0].recs.length;setStatus("expStatus",expCancel?`Cancelado: ${per} partidas por cenário concluídas e preservadas (rodadas completas).`:`Concluído: ${scen.length} cenários × ${per} partidas (${opts.kind==="auto"?"encerramento automático":"duração fixa"}${modes.length>1?", lento e rápido":""}).`,"success");refreshValConfigOptions();
 }finally{busy=false;$("runExp").disabled=false;$("cancelExp").disabled=true}
}
export function renderExpResults(){
 const R=expState.results;if(!R)return;const fixed=R.opts.kind==="fixed";
 R.scenarios.forEach(s=>{s.sum=summarizeRecords(s.recs);s.prof=profileStats(s.recs)});
 const pc=v=>fmt(v,1)+"%";
 const head=`<tr><th>Cenário</th><th>Partidas</th>${fixed?"<th>Condição atingida</th>":""}<th>Supremacia</th><th>Territorial</th><th>Eliminação</th>${fixed?"":"<th>Pontuação</th>"}<th>Empates</th>${fixed?"<th>Sem condição</th>":""}<th>${fixed?"Era média da 1ª condição":"Era média"}</th><th>Mediana</th><th>Mín–máx</th><th>% territórios do vencedor</th><th>Era em que alguém atinge o mínimo territorial</th><th>Sequências iniciadas / partida</th><th>Interrompidas</th><th>Relação ICE média</th><th>Recursos não usados</th><th></th></tr>`;
 const rows=R.scenarios.map(s=>{const m=s.sum,ratios=m.ratioMean.filter(v=>v!=null);return `<tr><td><span class="dot" style="background:${cssColor(s.color)}"></span><strong>${escapeHtml(s.name)}</strong></td><td>${m.games}</td>${fixed?`<td>${pc(100-m.pct("none"))}</td>`:""}<td>${pc(m.pct("supremacy"))}</td><td>${pc(m.pct("territorial"))}</td><td>${pc(m.pct("elimination"))}</td>${fixed?"":`<td>${pc(m.pct("score"))}</td>`}<td>${pc(m.pct("draw"))}</td>${fixed?`<td>${pc(m.pct("none"))}</td>`:""}<td>${fmt(mean(m.endEras),1)}</td><td>${fmt(median(m.endEras),1)}</td><td>${m.endEras.length?`${Math.min(...m.endEras)}–${Math.max(...m.endEras)}`:"—"}</td><td>${m.winnerTerrShare.length?pc(100*mean(m.winnerTerrShare)):"—"}</td><td>${m.thresholdEra.length?`${fmt(mean(m.thresholdEra),1)} (${pc(100*m.thresholdEra.length/m.games)})`:"nunca"}</td><td>${fmt(m.streaksStarted/m.games,2)}</td><td>${m.streaksStarted?pc(100*m.streaksInterrupted/m.streaksStarted):"—"}</td><td>${ratios.length?fmt(mean(ratios),3):"—"}</td><td>${pc(100*mean(m.unusedShare))}</td><td><button class="small" data-exp-apply="${R.scenarios.indexOf(s)}" style="padding:4px 8px" title="Usar os parâmetros deste cenário no jogo e nos laboratórios">Aplicar à configuração</button></td></tr>`}).join("");
 const mentions=R.scenarios.map(s=>`${escapeHtml(s.name)}: ${Object.entries(s.sum.reasonMentions).filter(([,v])=>v).map(([k,v])=>`${END_REASON_NAMES[k]} ${v}`).join(", ")||"nenhum"}`).join(" · ");
 $("expResults").innerHTML=`<h3>Comparação entre cenários</h3><div class="notice small">${fixed?"<strong>Duração fixa:</strong> as condições não encerram a partida; as colunas mostram a primeira condição de vitória que <em>teria</em> ocorrido.":"Cada partida conta uma vez no seu desfecho (vitórias com vários motivos não são duplicadas)."} Motivos registados, contando todos os motivos dos vencedores: ${mentions}.</div><div class="tablewrap"><table><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
 document.querySelectorAll("[data-exp-apply]").forEach(b=>b.onclick=()=>applyScenarioToConfig(+b.dataset.expApply));
 const opts=R.scenarios.map((s,i)=>`<option value="${i}">${escapeHtml(s.name)}</option>`).join("");$("expResScenario").innerHTML=opts;$("expProfScenario").innerHTML=opts;
 $("expResProfile").innerHTML=`<option value="">Todos os perfis</option>`+R.opts.profiles.map(p=>`<option value="${p}">${profileName(p)}</option>`).join("");
 $("expCharts").classList.remove("hidden");renderExpProfileTable();redrawExpCharts();
}
// Integração: leva os parâmetros de um cenário para a configuração aplicada (jogo e laboratórios).
export function applyScenarioToConfig(i){
 const s=expState.results?.scenarios[i];if(!s)return;
 configApplied=normalizeConfig({...clone(s.cfg),references:configApplied.references});rememberAiBase(configApplied);configEdited=clone(configApplied);renderParams();renderAll();refreshValConfigOptions();
 setStatus("expStatus",`Parâmetros do cenário "${s.name}" aplicados à configuração. A partida em curso mantém os investimentos já feitos; reinicie-a para jogar só com as novas regras. Recomenda-se executar de novo os testes funcionais.`,"success");
}
export function renderExpProfileTable(){
 const R=expState.results;if(!R)return;const s=R.scenarios[+$("expProfScenario").value||0],st=s.prof,pc=v=>Number.isFinite(v)?fmt(100*v,1)+"%":"—";
 const cons=consolidateProfiles(st,["winRate","drawRate","meanScore","meanWinEra","meanFinalTerr","conquestsPerGame"]);
 const typeTxt=a=>Object.entries(a.types).map(([k,v])=>`${END_REASON_NAMES[k]} ${v}`).join(", ")||"—";
 $("expProfileTable").innerHTML=`<div class="tablewrap"><table><thead><tr><th>Perfil</th><th>Lugares</th><th>Taxa de vitória</th><th>Empates</th><th>Pontuação média</th><th>Era média de vitória</th><th>Tipos de vitória</th><th>Territórios finais</th><th>Conquistas / partida</th><th>Investimento M / I / T</th></tr></thead><tbody>${st.map(a=>`<tr><td><strong>${profileName(a.profile)}</strong></td><td>${a.seats}</td><td>${pc(a.winRate)}</td><td>${pc(a.drawRate)}</td><td>${fmt(100*a.meanScore,1)}</td><td>${fmt(a.meanWinEra,1)}</td><td>${typeTxt(a)}</td><td>${fmt(a.meanFinalTerr,1)}</td><td>${fmt(a.conquestsPerGame,1)}</td><td>${a.shares.map(v=>fmt(100*v,0)+"%").join(" / ")}</td></tr>`).join("")}<tr><td><strong>Consolidado</strong><div class="small muted">média simples entre perfis</div></td><td>—</td><td>${pc(cons.winRate)}</td><td>${pc(cons.drawRate)}</td><td>${fmt(100*cons.meanScore,1)}</td><td>${fmt(cons.meanWinEra,1)}</td><td>—</td><td>${fmt(cons.meanFinalTerr,1)}</td><td>${fmt(cons.conquestsPerGame,1)}</td><td>—</td></tr></tbody></table></div>`;
}
export function redrawExpCharts(){
 const R=expState.results;if(!R||$("expCharts").classList.contains("hidden"))return;
 const sc=R.scenarios,fixed=R.opts.kind==="fixed",keys=OUTCOME_KEYS.filter(([k])=>fixed?k!=="score":k!=="none"||sc.some(s=>s.sum.outcomes.none));
 barChart($("expChartTypes"),sc.map(s=>s.name.includes(" = ")?s.name.split(" = ").pop():s.name),keys.map(([k,n,c])=>({name:n,color:c,values:sc.map(s=>s.sum.pct(k))})),{max:100,unit:"%"});
 $("expLegendTypes").innerHTML=legendHtml(keys.map(([,n,c])=>[n,c]));
 const maxEra=Math.max(1,...sc.map(s=>s.sum.maxEra)),eraAxis=Array.from({length:maxEra},(_,i)=>i+1);
 svgLine($("expChartDuration"),sc.map(s=>({color:s.color,data:eraAxis.map(e=>({x:e,y:s.sum.durationHist[e]||0}))})));
 svgLine($("expChartIce"),sc.map(s=>({color:s.color,data:eraAxis.map(e=>({x:e,y:s.sum.ratioMean[e]??NaN}))})));
 const sl=legendHtml(sc.map(s=>[s.name,s.color]));$("expLegendScen1").innerHTML=sl;$("expLegendScen2").innerHTML=sl;
 const s0=sc[+$("expProfScenario").value||0];
 barChart($("expChartProfiles"),s0.prof.map(a=>profileName(a.profile)),[{name:"Taxa de vitória",color:"#f4bd50",values:s0.prof.map(a=>100*a.winRate)},{name:"Empates",color:"#9fb0c7",values:s0.prof.map(a=>100*a.drawRate)},{name:"Pontuação média",color:"#62a8ff",values:s0.prof.map(a=>100*a.meanScore)}]);
 $("expLegendProfiles").innerHTML=legendHtml([["Taxa de vitória (%)","#f4bd50"],["Empates (%)","#9fb0c7"],["Pontuação média (×100)","#62a8ff"]])+` <span class="muted">· ${escapeHtml(s0.name)}</span>`;
 const sr=sc[+$("expResScenario").value||0],pf=$("expResProfile").value,stats=profileStats(sr.recs).filter(a=>!pf||a.profile===pf);
 const series=[["military","#f4bd50"],["infrastructure","#56d6a1"],["technology","#b49aff"],["treasury","#62a8ff"],["revenue","#ff737b"]].map(([d,c])=>({color:c,data:eraAxis.map((e,i)=>{let sum=0,n=0;for(const a of stats){const b=a.byEra[i];if(b){sum+=b[d];n+=b.n}}return {x:e,y:n?sum/n:NaN}})}));
 svgLine($("expChartRes"),series);
}
export function exportExp(level){
 const R=expState.results;if(!R){setStatus("expStatus","Execute uma experiência antes de exportar.","error");return}
 const params=expState.params;
 if(level==="summary"){csvDownload("imperios-balanceamento-resumo.csv",[["scenario",...params,"games","mode","kind","pct_supremacy","pct_territorial","pct_elimination","pct_score","pct_draw","pct_no_end","mean_end_era","median_end_era","min_end_era","max_end_era","mean_winner_territory_share","streaks_started","streaks_interrupted","mean_ice_ratio","unused_resources_share"],...R.scenarios.map(s=>{const m=s.sum;return [s.name,...params.map(p=>s.values[p]??getParam(configApplied,p)),m.games,s.mode||R.opts.mode,R.opts.kind,...["supremacy","territorial","elimination","score","draw","none"].map(k=>m.pct(k).toFixed(2)),mean(m.endEras),median(m.endEras),m.endEras.length?Math.min(...m.endEras):"",m.endEras.length?Math.max(...m.endEras):"",mean(m.winnerTerrShare),m.streaksStarted,m.streaksInterrupted,mean(m.ratioMean.filter(v=>v!=null)),mean(m.unusedShare)]})]);return}
 if(level==="games"){const rows=[["scenario","game","seed","mode","kind","outcome","end_era","winners","winner_profiles","reasons","seat","civ_id","profile","final_score","final_territories","eliminated"]];
  for(const s of R.scenarios)for(const rec of s.recs){const o=gameOutcome(rec),last=rec.rows.at(-1);rec.seats.forEach((p,k)=>rows.push([s.name,rec.game,rec.seed,rec.mode,rec.kind,o.ended?(o.would?"would_"+o.type:o.type):"none",o.era??"",o.ended?o.winners.map(w=>rec.ids[w]).join("|"):"",o.ended?o.winners.map(w=>rec.seats[w]).join("|"):"",o.ended?o.winners.map(w=>rec.ids[w]+":"+(o.reasons[w]||[]).join("+")).join("|"):"",k,rec.ids[k],p,rec.finalScores[k],last?.civs[k][RC.T],last&&!last.civs[k][RC.ACT]?1:0]))}
  csvDownload("imperios-balanceamento-partidas.csv",rows);return}
 const rows=[["scenario","game","seed","era","seat","civ_id","profile",...RC_NAMES,"supremacy_leader","supremacy_streak","supremacy_status","supremacy_ratio"]];
 for(const s of R.scenarios)for(const rec of s.recs)for(const row of rec.rows)row.civs.forEach((c,k)=>rows.push([s.name,rec.game,rec.seed,row.era,k,rec.ids[k],rec.seats[k],...c,row.sup?.leader??"",row.sup?.streak??"",row.sup?.status??"",row.sup?.ratio??""]));
 csvDownload("imperios-balanceamento-historico.csv",rows);
}
export function setupExpLab(){
 profileChecks("expProfiles");$("expCivs").value=1+configApplied.map.aiCount;$("expSeed").value=configApplied.simulation.seed;
 const cat=paramCatalog(),opts=cat.map(c=>`<option value="${c.id}">${c.label}</option>`).join("");$("expParamPick").innerHTML=opts;$("expVaryParam").innerHTML=opts;$("expVaryParam").value="endgame.supremacyRelative";
 expState.scenarios=[{name:"Base",values:Object.fromEntries(expState.params.map(id=>[id,getParam(configApplied,id)]))}];renderExpTable();
 $("expGamesPreset").onchange=()=>{const v=$("expGamesPreset").value;if(v!=="custom")$("expGames").value=v;else $("expGames").focus()};
 $("expGames").oninput=()=>{$("expGamesPreset").value=["20","50","100"].includes($("expGames").value)?$("expGames").value:"custom"};
 $("expAddParam").onclick=()=>addExpParam($("expParamPick").value);
 $("expAddScenario").onclick=()=>{expState.scenarios.push({name:"Cenário "+(expState.scenarios.length+1),values:Object.fromEntries(expState.params.map(id=>[id,getParam(configApplied,id)]))});renderExpTable()};
 $("expVary").onclick=()=>{try{generateVariations()}catch(e){setStatus("expStatus",e.message,"error")}};
 $("runExp").onclick=()=>runExperiment().catch(e=>{busy=false;$("runExp").disabled=false;$("cancelExp").disabled=true;setStatus("expStatus",e.message,"error")});
 $("cancelExp").onclick=()=>{expCancel=true;setStatus("expStatus","Cancelamento pedido; a concluir a rodada em curso...")};
 $("exportExpSummary").onclick=()=>exportExp("summary");$("exportExpGames").onclick=()=>exportExp("games");$("exportExpEras").onclick=()=>exportExp("eras");
 $("expResScenario").onchange=redrawExpCharts;$("expResProfile").onchange=redrawExpCharts;$("expProfScenario").onchange=()=>{renderExpProfileTable();redrawExpCharts()};
}
/* ═══════════════ Laboratório 3: validação estratégica das IAs ═══════════════ */
export let valState={results:null},valCancel=false;
// Comportamento esperado de cada perfil (secção 5.4): verificação observável nos resultados.
export const PROFILE_EXPECTATIONS={
 reference:{text:"Distribuição relativamente equilibrada dos investimentos",check:(a)=>{const d=Math.max(...a.shares)-Math.min(...a.shares);return {ok:d<=.35,detail:`diferença entre maior e menor parcela: ${fmt(100*d,0)} p.p. (limite 35)`}}},
 military:{text:"Maior prioridade para capacidade militar",check:(a,all)=>{const top=all.every(b=>b===a||a.shares[0]>=b.shares[0]);return {ok:top&&a.shares[0]>=.5,detail:`parcela militar ${fmt(100*a.shares[0],0)}%${top?" (a maior)":" (não é a maior)"}`}}},
 aggressive:{text:"Maior frequência de expansão e combate",check:(a,all)=>{const others=all.filter(b=>b!==a),med=median(others.map(b=>b.combatsPerGame));return {ok:!others.length||a.combatsPerGame>=med*1.2,detail:`${fmt(a.combatsPerGame,1)} combates/partida vs mediana dos outros ${fmt(med,1)}`}}},
 technologist:{text:"Maior prioridade para tecnologia",check:(a,all)=>{const top=all.every(b=>b===a||a.shares[2]>=b.shares[2]);return {ok:top&&a.shares[2]>=.5,detail:`parcela tecnológica ${fmt(100*a.shares[2],0)}%${top?" (a maior)":" (não é a maior)"}`}}},
 economist:{text:"Maior prioridade para desenvolvimento económico",check:(a,all)=>{const top=all.every(b=>b===a||a.shares[1]>=b.shares[1]);return {ok:top&&a.shares[1]>=.5,detail:`parcela de infraestrutura ${fmt(100*a.shares[1],0)}%${top?" (a maior)":" (não é a maior)"}`}}},
 adaptive:{text:"Ajusta as prioridades à situação",check:(a)=>({ok:a.milShareStd>=.05,detail:`variação da parcela militar entre eras: desvio padrão ${fmt(100*a.milShareStd,1)} p.p. (mínimo 5)`})}
};
// Diagnóstico automático (secção 5.7): alertas para investigação, nunca alterações automáticas.
export function profileDiagnostics(stats,opts){
 const out=[],avg=k=>mean(stats.map(s=>s[k]).filter(Number.isFinite)),get=p=>stats.find(s=>s.profile===p);
 const t=get("technologist");if(t&&t.shares[2]<.4)out.push(["Tecnológico",`baixo investimento em tecnologia (${fmt(100*t.shares[2],0)}% do total).`]);
 const m=get("military");if(m&&m.shares[0]>=.5&&m.conquestsPerGame<avg("conquestsPerGame"))out.push(["Militar",`acumula força (parcela militar ${fmt(100*m.shares[0],0)}%) mas conquista menos do que a média (${fmt(m.conquestsPerGame,1)} vs ${fmt(avg("conquestsPerGame"),1)} por partida).`]);
 const e=get("economist");if(e&&Number.isFinite(e.infraConversion)&&e.infraConversion<1)out.push(["Infraestrutura",`a receita de infraestrutura acumulada é ${fmt(100*e.infraConversion,0)}% do investido em infraestrutura (não recupera o investimento no horizonte jogado).`]);
 const g=get("aggressive");if(g&&g.combatsPerGame>=avg("combatsPerGame")&&g.successRate<.6)out.push(["Agressivo",`inicia muitos combates (${fmt(g.combatsPerGame,1)}/partida) com baixa taxa de sucesso (${fmt(100*g.successRate,0)}%).`]);
 const r=get("reference");if(r&&Math.max(...r.shares)>.6)out.push(["Equilibrado",`concentra ${fmt(100*Math.max(...r.shares),0)}% dos recursos numa só dimensão.`]);
 for(const s of stats)if(s.idleRate>.1)out.push([profileName(s.profile),`deixa mais de metade dos recursos por usar durante 3+ eras seguidas em ${fmt(100*s.idleRate,0)}% das partidas.`]);
 for(const s of stats)if(s.seats>=4&&s.winRate===0&&opts.kind==="auto")out.push([profileName(s.profile),`não venceu nenhuma partida (${s.seats} lugares) — perfil possivelmente fraco demais.`]);
 for(const s of stats)if(s.eliminatedRate>.25)out.push([profileName(s.profile),`eliminado em ${fmt(100*s.eliminatedRate,0)}% das partidas.`]);
 // Perfis com comportamento excessivamente semelhante (distância entre parcelas de investimento).
 for(let i=0;i<stats.length;i++)for(let j=i+1;j<stats.length;j++){const a=stats[i],b=stats[j],d=a.shares.reduce((x,v,k)=>x+Math.abs(v-b.shares[k]),0)/2,dc=Math.abs(a.combatsPerGame-b.combatsPerGame)/Math.max(1,a.combatsPerGame,b.combatsPerGame);if(d<.1&&dc<.2)out.push([`${profileName(a.profile)} × ${profileName(b.profile)}`,`comportamento muito semelhante (diferença de investimento ${fmt(100*d,0)} p.p., combates ${fmt(100*dc,0)}%).`])}
 if(opts.mode==="fast")out.push(["Modo rápido","os multiplicadores do modo rápido são aplicados pelo motor a todos os investimentos das IAs (verificado nos testes funcionais ECO); este laboratório não mede o seu aproveitamento estratégico separadamente."]);
 return out;
}
export async function runValidation(){
 if(busy)return;const opts=readSimOpts("val");if(opts.civCount>configApplied.map.territories)throw Error("Mais civilizações do que territórios.");
 busy=true;valCancel=false;$("runVal").disabled=true;$("cancelVal").disabled=false;$("valProgress").style.width="0%";$("valResults").innerHTML="";$("valChartBox").classList.add("hidden");
 const src=valConfigSource(),cfg=clone(src.cfg);
 // Um cenário do balanceamento é validado na velocidade em que foi testado.
 if(src.mode){opts.mode=src.mode;$("valMode").value=src.mode}
 if(opts.mode==="both")throw Error("Escolha uma velocidade (lenta ou rápida).");
 const est=estimateRows(opts,1,[cfg]);if(est>ROW_WARN&&!confirm(`Esta validação vai guardar cerca de ${fmt(est/1e6,1)} milhões de registos em memória. Continuar?`)){busy=false;$("runVal").disabled=false;$("cancelVal").disabled=true;return}
 const jobs=buildJobs(cfg,opts,{scenario:src.name});
 try{
  const recs=await runGameJobs(jobs,(d,t,ms)=>{$("valProgress").style.width=(100*d/t)+"%";setStatus("valStatus",`A executar · ${d} de ${t} partidas (${fmt(100*d/t,0)}%) · ${fmt(ms/1000,1)} s decorridos`)},()=>valCancel,1);
  if(!recs.length){setStatus("valStatus","Cancelado antes de concluir qualquer partida.","error");return}
  valState.results={opts,recs,stats:profileStats(recs),source:src.name};renderValidation();
  setStatus("valStatus",valCancel?`Cancelado: ${recs.length} partidas concluídas e analisadas.`:`Concluído: ${recs.length} partidas analisadas.`,"success");
 }finally{busy=false;$("runVal").disabled=false;$("cancelVal").disabled=true}
}
export function renderValidation(){
 const V=valState.results;if(!V)return;const st=V.stats,pc=v=>Number.isFinite(v)?fmt(100*v,1)+"%":"—",auto=V.opts.kind==="auto";
 const keys=["winRate","drawRate","meanScore","combatsPerGame","successRate","conquestsPerGame","meanFinalTerr","meanFinalIce","revenuePerGame","meanFinalTreasury","infraConversion","eliminatedRate","idleRate"],cons=consolidateProfiles(st,keys);
 const unused=a=>{const recs=V.recs;let u=[];for(const rec of recs)rec.seats.forEach((p,k)=>{if(p!==a.profile)return;for(const row of rec.rows){const c=row.civs[k],av=c[RC.TRE]+c[RC.IM]+c[RC.II]+c[RC.IT];if(c[RC.ACT]&&av>0)u.push(c[RC.TRE]/av)}});return mean(u)};
 const row=a=>`<td>${a.seats??"—"}</td><td>${a.shares?a.shares.map(v=>fmt(100*v,0)+"%").join(" / "):"—"}</td><td>${fmt(a.revenuePerGame,0)}</td><td>${pc(a.unusedShare)}</td><td>${fmt(a.conquestsPerGame,1)}</td><td>${fmt(a.combatsPerGame,1)}</td><td>${pc(a.successRate)}</td><td>${fmt(a.meanFinalTerr,1)}</td><td>${fmt(a.meanFinalIce,3)}</td><td>${fmt(100*a.meanScore,1)}</td>${auto?`<td>${pc(a.winRate)}</td><td>${pc(a.drawRate)}</td>`:""}<td>${pc(a.infraConversion)}</td><td>${pc(a.eliminatedRate)}</td>`;
 st.forEach(a=>a.unusedShare=unused(a));cons.unusedShare=mean(st.map(a=>a.unusedShare));
 const table=`<h3>Indicadores por perfil (valores acumulados por partida)</h3><div class="tablewrap"><table><thead><tr><th>Perfil</th><th>Lugares</th><th>Investimento M / I / T</th><th>Receita acumulada</th><th>Recursos não usados</th><th>Territórios conquistados</th><th>Combates iniciados</th><th>Combates vencidos</th><th>Territórios finais</th><th>ICE final</th><th>Pontuação final</th>${auto?"<th>Taxa de vitória</th><th>Empates</th>":""}<th>Retorno infra / investido</th><th>Eliminado</th></tr></thead><tbody>${st.map(a=>`<tr><td><strong>${profileName(a.profile)}</strong></td>${row(a)}</tr>`).join("")}<tr><td><strong>Consolidado</strong><div class="small muted">média simples entre perfis</div></td>${row({...cons,seats:null,shares:null})}</tr></tbody></table></div>`;
 const ident=`<h3>Identidade estratégica</h3><div class="tablewrap"><table><thead><tr><th>Perfil</th><th>Comportamento esperado</th><th>Observado</th><th>Estado</th></tr></thead><tbody>${st.map(a=>{const ex=PROFILE_EXPECTATIONS[a.profile];if(!ex)return "";const r=ex.check(a,st);return `<tr><td><strong>${profileName(a.profile)}</strong></td><td>${ex.text}</td><td class="small">${r.detail}</td><td class="${r.ok?"pass":"fail"}">${r.ok?"COERENTE":"VERIFICAR"}</td></tr>`}).join("")}</tbody></table></div>`;
 const diags=profileDiagnostics(st,V.opts);
 const diagHtml=`<h3>Diagnóstico automático</h3><div class="notice ${diags.length?"":"success"}">${diags.length?diags.map(([who,msg])=>`<div>⚠ <strong>${who}</strong>: ${msg}</div>`).join(""):"Nenhum comportamento inadequado detetado pelos critérios implementados."}<div class="small muted" style="margin-top:6px">Os alertas são pistas para investigação; o laboratório não altera regras nem perfis.</div></div>`;
 $("valResults").innerHTML=`<div class="notice success small">Configuração: <strong>${escapeHtml(V.source)}</strong> · ${V.recs.length} partidas · ${V.opts.civCount} civilizações · modo ${V.opts.mode==="fast"?"rápido":"lento"} · ${V.opts.kind==="auto"?"encerramento automático":"duração fixa"} · mesmas sementes e rotação de perfis para todos.</div>`+diagHtml+ident+table;
 $("valChartPick").innerHTML=[["military","Militar (pontos)"],["infrastructure","Receita de infraestrutura"],["technology","Progresso tecnológico"],["treasury","Tesouraria"],["revenue","Receita total"],["territories","Territórios"],["ice","ICE"]].map(([v,t])=>`<option value="${v}">${t}</option>`).join("");
 $("valChartBox").classList.remove("hidden");drawValChart();
}
export function drawValChart(){
 const V=valState.results;if(!V)return;const key=$("valChartPick").value,maxE=Math.max(...V.stats.map(a=>a.byEra.length));
 svgLine($("valChart"),V.stats.map((a,i)=>({color:SCENARIO_COLORS[i%SCENARIO_COLORS.length],data:Array.from({length:maxE},(_,e)=>{const b=a.byEra[e];const y=!b?NaN:key==="ice"?(b.iceN?b.ice/b.iceN:NaN):b[key]/b.n;return {x:e+1,y}})})));
 $("valChartLegend").innerHTML=legendHtml(V.stats.map((a,i)=>[profileName(a.profile),SCENARIO_COLORS[i%SCENARIO_COLORS.length]]));
}
export function exportValidation(){
 const V=valState.results;if(!V){setStatus("valStatus","Execute a validação antes de exportar.","error");return}
 const rows=[["profile","seats","share_military","share_infrastructure","share_technology","revenue_per_game","unused_share","conquests_per_game","combats_per_game","combat_success","final_territories","final_ice","final_score","win_rate","draw_rate","infra_return_ratio","eliminated_rate","idle_rate","expectation_ok"]];
 for(const a of V.stats){const ex=PROFILE_EXPECTATIONS[a.profile]?.check(a,V.stats);rows.push([a.profile,a.seats,...a.shares,a.revenuePerGame,a.unusedShare,a.conquestsPerGame,a.combatsPerGame,a.successRate,a.meanFinalTerr,a.meanFinalIce,a.meanScore,a.winRate,a.drawRate,a.infraConversion,a.eliminatedRate,a.idleRate,ex?ex.ok:""])}
 rows.push([],["era","profile","military","infrastructure_revenue","technology","treasury","revenue","territories","ice"]);
 for(const a of V.stats)a.byEra.forEach((b,e)=>rows.push([e+1,a.profile,b.military/b.n,b.infrastructure/b.n,b.technology/b.n,b.treasury/b.n,b.revenue/b.n,b.territories/b.n,b.iceN?b.ice/b.iceN:""]));
 csvDownload("imperios-validacao-estrategica.csv",rows);
}
export function valConfigSource(){const v=$("valConfig").value;if(v.startsWith("exp:")){const s=expState.results?.scenarios[+v.slice(4)];if(s)return {name:"cenário "+s.name,cfg:s.cfg,mode:s.mode}}return {name:"configuração aplicada",cfg:configApplied,mode:null}}
export function refreshValConfigOptions(){const el=$("valConfig");if(!el)return;const cur=el.value;el.innerHTML='<option value="applied">Configuração aplicada</option>'+(expState.results?.scenarios||[]).map((s,i)=>`<option value="exp:${i}">Cenário: ${escapeHtml(s.name)}</option>`).join("");if([...el.options].some(o=>o.value===cur))el.value=cur}
export function setupValLab(){
 refreshValConfigOptions();
 profileChecks("valProfiles");$("valCivs").value=1+configApplied.map.aiCount;$("valSeed").value=configApplied.simulation.seed;
 $("runVal").onclick=()=>runValidation().catch(e=>{busy=false;$("runVal").disabled=false;$("cancelVal").disabled=true;setStatus("valStatus",e.message,"error")});
 $("cancelVal").onclick=()=>{valCancel=true;setStatus("valStatus","Cancelamento pedido...")};
 $("exportVal").onclick=exportValidation;$("valChartPick").onchange=drawValChart;
}
/* ── Folhas inferiores (bottom sheets): ataque, menu, placar, planos, ajuste fino, Como jogar e Detalhes ──
   Uma folha de cada vez. Fecham com toque fora, Esc, o botão ✕ e o botão voltar do navegador/Android
   (a folha aberta ocupa uma entrada do histórico). Enquanto há uma folha aberta, o resto da tela fica inerte
   e o foco fica preso dentro dela; ao fechar, o foco volta para quem a abriu. */
export const SHEET_HOOKS={
 attackSheet:{onClose:()=>{if(selectedTerritory!==null){selectedTerritory=null;renderMap()}}},
 details:{onOpen:()=>{renderForecast();renderHistory();renderNotifications();requestAnimationFrame(renderCharts)}},
 scoreSheet:{onOpen:()=>{renderMetrics();renderVictory()}},
};
export const FOCUSABLE='button:not([disabled]):not([hidden]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';
export let sheetOpen=null,sheetReturn=null,sheetHist=false,sheetIgnorePop=0;
export function isSheetOpen(id){return id?sheetOpen===id:!!sheetOpen}
export function setInertBehind(on){
 const keep=el=>el.classList.contains("sheet")||el.classList.contains("sheet-scrim");
 [...document.querySelectorAll(".wrap > *"),...document.querySelectorAll("#game > *")].forEach(el=>{if(el.id==="game"||keep(el))return;if(on)el.inert=true;else el.inert=false});
 const tut=$("tutBox");if(tut)tut.inert=on;
}
export function openSheet(id,opener){
 const el=$(id);if(!el||sheetOpen===id)return;
 if(sheetOpen)closeSheet({swap:true});
 else sheetReturn=opener||document.activeElement;
 sheetOpen=id;el.hidden=false;$("sheetScrim").hidden=false;setInertBehind(true);
 document.querySelectorAll(`[data-open="${id}"]`).forEach(b=>b.setAttribute("aria-expanded","true"));
 if(!sheetHist){try{history.pushState({imperiosSheet:id},"");sheetHist=true}catch(e){}}
 el.scrollTop=0;SHEET_HOOKS[id]?.onOpen?.();
 el.focus({preventScroll:true});
}
export function closeSheet({swap=false,fromPop=false,focus=true}={}){
 const id=sheetOpen;if(!id)return;sheetOpen=null;
 $(id).hidden=true;document.querySelectorAll(`[data-open="${id}"]`).forEach(b=>b.setAttribute("aria-expanded","false"));
 SHEET_HOOKS[id]?.onClose?.();
 if(swap)return;
 $("sheetScrim").hidden=true;setInertBehind(false);
 if(fromPop)sheetHist=false;
 else if(sheetHist){sheetHist=false;sheetIgnorePop++;try{history.back()}catch(e){sheetIgnorePop--}}
 let r=sheetReturn;sheetReturn=null;if(typeof r==="function")r=r();
 if(focus&&r&&r.isConnected&&r.offsetParent!==null)r.focus({preventScroll:true});
}
// .open nas folhas (como nos antigos <details> "Como jogar" e "Detalhes"): ler diz se está aberta, escrever abre/fecha.
document.querySelectorAll(".sheet").forEach(el=>Object.defineProperty(el,"open",{configurable:true,get(){return sheetOpen===el.id},set(v){if(v)openSheet(el.id);else if(sheetOpen===el.id)closeSheet()}}));
window.addEventListener("popstate",()=>{
 if(sheetIgnorePop>0){sheetIgnorePop--;if(sheetOpen&&!sheetHist){try{history.pushState({imperiosSheet:sheetOpen},"");sheetHist=true}catch(e){}}return}
 if(sheetOpen)closeSheet({fromPop:true});
});
document.addEventListener("click",e=>{
 const o=e.target.closest("[data-open]");if(o&&!o.disabled){e.preventDefault();openSheet(o.dataset.open,o);return}
 if(e.target.closest("[data-close]")||e.target.id==="sheetScrim")closeSheet();
});
document.addEventListener("keydown",e=>{
 if(!sheetOpen||$("modalRoot").firstChild)return;
 if(e.key==="Escape"){e.preventDefault();closeSheet();return}
 if(e.key!=="Tab")return;
 const el=$(sheetOpen),f=[...el.querySelectorAll(FOCUSABLE)].filter(x=>x.offsetParent!==null&&!x.closest("[hidden]"));if(!f.length){e.preventDefault();el.focus();return}
 const first=f[0],last=f.at(-1),a=document.activeElement;
 if(e.shiftKey&&(a===first||a===el||!el.contains(a))){e.preventDefault();last.focus()}
 else if(!e.shiftKey&&(a===last||!el.contains(a))){e.preventDefault();first.focus()}
});
// Aviso rápido no topo (ordem dada, ataque cancelado...): some sozinho ou com um toque.
export let toastTimer=null;
export function showToast(html,bad=false){
 let t=$("toast");if(!t){t=document.createElement("div");t.id="toast";t.className="toast";t.setAttribute("role","status");t.setAttribute("aria-live","polite");t.hidden=true;t.onclick=()=>{t.hidden=true};document.body.appendChild(t)}
 t.innerHTML=`<span>${html}</span>`;t.classList.toggle("bad",bad);t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{t.hidden=true},3500);
}
// Planos rápidos: chips na gaveta em telas altas; em telas baixas (≤ 700 px) ficam na folha "Planos ▾".
export const SHORT_SCREEN=matchMedia("(max-height:700px)");
export function placePlans(){const plans=$("plans"),slot=$(SHORT_SCREEN.matches?"plansSheetSlot":"plansInline");if(plans&&slot&&plans.parentElement!==slot)slot.appendChild(plans);if(!SHORT_SCREEN.matches&&sheetOpen==="planSheet")closeSheet({focus:false})}
SHORT_SCREEN.addEventListener?.("change",placePlans);
// Tela da era sem rolagem: só na versão do jogador, com a aba Jogo à vista e sem resultado (a tela de resultado
// ainda rola; Fase 3). Com ?dev=1 o cabeçalho e as abas ficam por cima e a página rola como antes.
export function updateFit(){const g=$("game");document.documentElement.classList.toggle("game-fit",!DEV_MODE&&!!g&&g.classList.contains("active")&&!state?.result);if(state?.result&&sheetOpen==="attackSheet")closeSheet({focus:false})}
// Mostra uma vista (Jogo ou, na versão de desenvolvimento, um laboratório) e marca a aba correspondente.
export function showView(view){
 document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.view===view));document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x.id===view));closeSheet({focus:false});updateFit();if(view==="game")fitRegionNames();runHook("viewShown",view);
}
/* ── Arranque, em partes: jogo, tela inicial, tutorial e (só com ?dev=1) laboratórios ── */
// Jogo: carrega o save (ou começa uma partida), desenha e liga os controles da tela da era.
export async function initGame(){
 const read=await readSavedGame(),saved=read.status==="ok"?read.game:null;
 if(read.status==="invalid"){quarantineSave(read.raw);saveProblem=read.reason;noticeBrokenSave()}
 if(saved&&!saved.state.result){configApplied=saved.config;gameMode=saved.gameMode;state=saved.state;if(saved.opponentChoices)opponentChoices=saved.opponentChoices;if(saved.difficulty)currentDifficulty=saved.difficulty;aiConfigBase=saved.aiBase;savedGameLoaded=true;savedRaw=read.raw}
 else if(saved){
  // Partida terminada: não é retomada, mas as escolhas do jogador (rivais, eras, dificuldade, modo, estilos)
  // continuam. Se a partida terminada era a do tutorial, voltam as escolhas de antes do tutorial.
  try{configApplied=saved.config;gameMode=saved.gameMode;if(saved.opponentChoices)opponentChoices=saved.opponentChoices;if(saved.difficulty)currentDifficulty=saved.difficulty;aiConfigBase=saved.aiBase;state=saved.state;restoreSetupAfterTutorial();state=newGame()}
  catch(e){configApplied=clone(configDefault);gameMode="slow";currentDifficulty=DEFAULT_DIFFICULTY;aiConfigBase=pickAiDifficulty(configDefault);applyDifficulty(currentDifficulty);opponentChoices=[DEFAULT_OPPONENT,DEFAULT_OPPONENT,DEFAULT_OPPONENT];state=newGame()}
 }
 else{applyDifficulty(currentDifficulty);state=newGame()}
 renderSavedSafely(renderAll);
 document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
 AREAS.forEach(([k],idx)=>{
  const input=$(k+"Spend");
  input.addEventListener("input",()=>{const v=readAlloc(),b=P(state).treasury,others=v.reduce((s,x,j)=>s+(j===idx?0:x),0),max=Math.max(0,b-others);if(v[idx]>max+1e-9){input.value=fmtInput(round2(max));renderAllocation("Ajustado ao máximo disponível.")}else renderAllocation()});
  input.addEventListener("focus",()=>{if(parseAmount(input.value)===0)input.select()});
  const ctrl=input.parentElement,fine=document.querySelector(`.fine-row[data-area="${k}"]`);
  input.addEventListener("keydown",e=>{if(e.key==="Enter")input.blur()});
  ctrl.querySelectorAll("[data-step]").forEach(b=>b.onclick=()=>stepArea(idx,Number(b.dataset.step)));
  fine.querySelector("[data-rest]").onclick=()=>restArea(idx);fine.querySelector("[data-zero]").onclick=()=>{const v=readAlloc();v[idx]=0;setAlloc(v)};
 });
 document.querySelectorAll("[data-plan]").forEach(b=>b.onclick=()=>{applyPlan(b.dataset.plan);if(sheetOpen==="planSheet")closeSheet({focus:false})});
 placePlans();
 // "Investir em Militar" (folha de ataque sem Força suficiente): fecha a folha e leva ao + do Militar.
 $("attackInvest").onclick=()=>{closeSheet({focus:false});const row=document.querySelector('[data-row="mil"]'),plus=document.querySelector('[data-area="mil"] [data-step="1"]');row.classList.remove("flash");void row.offsetWidth;row.classList.add("flash");plus.focus({preventScroll:true})};
 $("advance").onclick=concludeEra;
 $("attack").onclick=attackSelected;
 // Menu: a folha fecha antes da ação (o aviso de Reiniciar é um modal por cima do jogo).
 $("restart").onclick=()=>{closeSheet({focus:false});showModal(`<h2>Reiniciar a partida?</h2><p class="small muted">A partida atual será substituída por uma nova com as mesmas escolhas.</p>`,[{label:"Cancelar"},{label:"Reiniciar",cls:"danger",onClick:startNewGame}])};
 onHook("afterEra",era=>setTimeout(()=>showEraReport(era),60));
 window.addEventListener("resize",()=>{fitRegionNames();markLegend();renderCharts();placePlans();if(state.result)renderResult()});
}
// Laboratórios (versão de desenvolvimento): editor de configuração, testes funcionais, balanceamento, IAs.
export async function initLabs(){
 // Com os laboratórios, Início e Reiniciar ficam no cabeçalho (na versão do jogador estão no menu ☰).
 $("topActions").prepend($("returnHome"),$("restart"));
 renderParams();
 onHook("configChanged",()=>{configEdited=clone(configApplied);renderParams()});
 onHook("viewShown",view=>{if(view==="balanceLab")redrawExpCharts()});
 $("exportHistory").onclick=exportHistory;
 $("applyConfig").onclick=()=>{try{applyConfig()}catch(e){setStatus("labStatus",e.message,"error")}};
 $("restoreConfig").onclick=()=>{configEdited=clone(configDefault);renderParams();setStatus("labStatus","Padrões restaurados na área de edição; clique em Aplicar para usar.")};
 $("saveConfig").onclick=()=>{try{download("imperios-configuracao.json",JSON.stringify({formatVersion:VERSION,config:readParams()},null,2))}catch(e){setStatus("labStatus",e.message,"error")}};
 $("loadConfigBtn").onclick=()=>$("configFile").click();$("configFile").onchange=e=>{if(e.target.files[0])loadJsonFile(e.target.files[0],"config");e.target.value=""};
 $("restartWithConfig").onclick=()=>{try{configApplied=readParams();rememberAiBase(configApplied);configEdited=clone(configApplied);state=newGame();selectedTerritory=null;renderParams();renderAll();setStatus("labStatus","Nova partida iniciada com a configuração atual.","success")}catch(e){setStatus("labStatus",e.message,"error")}};
 document.querySelectorAll(".quick").forEach(b=>b.onclick=()=>runLong(Number(b.dataset.n)));
 $("customAdvance").onclick=()=>{try{const n=safeNum($("customEras").value,1,1e9);if(!Number.isSafeInteger(n))throw Error("Use um inteiro positivo.");runLong(n)}catch(e){setStatus("advanceStatus",e.message,"error")}};
 $("cancelAdvance").onclick=()=>{cancelRequested=true;setStatus("advanceStatus","Cancelamento solicitado; concluindo o bloco atual...")};
 document.querySelectorAll(".strategy").forEach(b=>b.onclick=()=>{try{runStrategy(b.dataset.strategy,$("strategyEras").value)}catch(e){setStatus("strategyStatus",e.message,"error")}});
 $("runCompare").onclick=()=>compareStrategies().catch(e=>setStatus("compareStatus",e.message,"error"));
 $("exportCompare").onclick=()=>{if(!compareResults.length){setStatus("compareStatus","Execute uma comparação primeiro.","error");return}const rows=[["strategy","era","revenue","cumulative_revenue","budget","military","territories","ai_territories","player_wins","player_losses","neutral_conquests","enemy_conquests","invested_military","invested_infrastructure","invested_technology"],...compareResults.flatMap(r=>r.state.history.map(h=>[r.strategy,h.era,h.total,h.cumRevenue,h.budget,h.military,h.territories,h.aiTerritories,h.attacksTotal?.playerWins||0,h.attacksTotal?.playerLosses||0,h.attacksTotal?.neutralConquests||0,h.attacksTotal?.enemyConquests||0,P(r.state).invested.military,P(r.state).invested.infrastructure,P(r.state).invested.technology]))];download("imperios-comparacao.csv",rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(";")).join("\n"),"text/csv;charset=utf-8")};
 document.querySelectorAll(".scenario").forEach(b=>b.onclick=()=>scenarioPreset(b.dataset.scenario));
 $("saveScenario").onclick=()=>{try{const o=scenarioObject();download("imperios-cenario.json",JSON.stringify(o,null,2));setStatus("scenarioStatus","Cenário exportado.","success")}catch(e){setStatus("scenarioStatus",e.message,"error")}};
 $("loadScenarioBtn").onclick=()=>$("scenarioFile").click();$("scenarioFile").onchange=e=>{if(e.target.files[0])loadJsonFile(e.target.files[0],"scenario");e.target.value=""};
 $("runScenario").onclick=()=>{try{const o=scenarioLoaded||scenarioObject(),c=normalizeConfig(o.config),s=simulate(o.strategy||"balanced",safeNum($("scenarioEras").value,1,1e7),c,null,undefined,null,gameMode);renderScenarioResult(s,o.name||$("scenarioName").value);setStatus("scenarioStatus","Cenário executado isoladamente; partida atual preservada.","success")}catch(e){setStatus("scenarioStatus",e.message,"error")}};
 $("runTests").onclick=runTests;
 $("runAiValidation").onclick=()=>runAiValidation().catch(e=>setStatus("aiValidationStatus",e.message,"error"));
 $("exportAiValidation").onclick=exportAiValidation;
 $("runBalanceLab").onclick=()=>runBalanceLab().catch(e=>setStatus("balanceStatus",e.message,"error"));
 $("exportBalanceLab").onclick=exportBalanceLab;
 setupFixedLab();
 await loadFtHistory();
 setupFtLab();setupExpLab();setupValLab();
 window.addEventListener("resize",()=>{redrawExpCharts();drawValChart()});
}
// Arranque: espera o save (armazenamento assíncrono) e só depois liga a tela inicial e o tutorial.
// Os laboratórios só são ligados na versão de desenvolvimento (?dev=1).
// window.__imperiosReady fica true quando tudo está pronto (os testes automáticos esperam por isso).
(async function boot(){
 await initGame();
 initHome();
 await initTutorial();
 if(DEV_MODE&&$("lab"))await initLabs();
 window.__imperiosReady=true;
})();
// Ações da tela inicial: o jogo existente permanece intacto por trás da proposta.
export function initHome(){
 const home=$("homeScreen");if(!home)return;const setup=$("setupScreen");
 // Abre a configuração com as escolhas atuais (também usada no fim da partida: "Mudar definições").
 // fromGame=true repõe as escolhas da partida atual; a partir da tela inicial mantém as escolhas em curso.
 // Escolhas atuais; durante/depois do tutorial, as que o jogador tinha antes de o começar.
 // Na versão do jogador, "Configurações" (de um save antigo) aparece como "Médio" na próxima partida.
 const shownDiff=d=>DIFFICULTIES[d]&&(DEV_MODE||d!=="config")?d:"medio";
 const currentChoice=()=>{const p=tutorialPrevSetup();if(p)return {mode:p.mode==="fast"?"fast":"slow",ai:clamp(Number(p.ai)|0,1,MAX_AI),eras:clamp(Number(p.eras)|0,10,150),conquest:p.supremacy===false,difficulty:shownDiff(DIFFICULTIES[p.difficulty]?p.difficulty:DEFAULT_DIFFICULTY)};
  return {mode:gameMode,ai:configApplied.map.aiCount||1,eras:configApplied.endgame.maxEras,conquest:configApplied.endgame.supremacyEnabled===false,difficulty:shownDiff(currentDifficulty)}};
 const openSetup=(fromGame=false)=>{if(fromGame===true)choice=currentChoice();sync();setup.hidden=false;setup.scrollTop=0};window.openSetup=openSetup;
 let choice=currentChoice();
 const renderProfiles=()=>{if(!DEV_MODE)opponentChoices=opponentChoices.map(v=>v==="config"?"adaptive":v);$("homeProfiles").innerHTML=Array.from({length:choice.ai},(_,i)=>`<div class="profile-row"><span>${civSymHtml({index:i+1,color:CIV_COLORS[i+1]})} ${RIVAL_NAMES[i]}</span><select data-prof="${i}" aria-label="Estilo de ${RIVAL_NAMES[i]}">${visibleOpponentOptions().map(([v,t])=>`<option value="${v}" ${opponentChoices[i]===v?"selected":""}>${t}</option>`).join("")}</select></div>`).join("")+(choice.ai>1?`<div class="chips"><button type="button" class="chip" id="allRandom">🎲 Todos aleatórios</button></div>`:"");document.querySelectorAll("[data-prof]").forEach(el=>el.onchange=()=>{opponentChoices[+el.dataset.prof]=el.value;sync()});const ar=$("allRandom");if(ar)ar.onclick=()=>{opponentChoices=opponentChoices.map(()=>"random");sync()}};
 const sync=()=>{
  $("modeSlow").classList.toggle("selected",choice.mode==="slow");$("modeFast").classList.toggle("selected",choice.mode==="fast");
  $("modeSlow").setAttribute("aria-pressed",String(choice.mode==="slow"));$("modeFast").setAttribute("aria-pressed",String(choice.mode==="fast"));
  document.querySelectorAll("#homeOpponents [data-ai]").forEach(b=>{b.classList.toggle("selected",Number(b.dataset.ai)===choice.ai);b.setAttribute("aria-pressed",String(Number(b.dataset.ai)===choice.ai))});
  document.querySelectorAll("#homeEraPresets [data-eras]").forEach(b=>b.classList.toggle("selected",Number(b.dataset.eras)===choice.eras));$("homeMaxEras").value=choice.eras;
  for(const [id,on] of [["homeClassic",!choice.conquest],["homeConquest",!!choice.conquest]]){$(id).classList.toggle("selected",on);$(id).setAttribute("aria-pressed",String(on))}
  $("homeVictoryDesc").textContent=choice.conquest?"Sem supremacia: vence quem conquistar 70% dos territórios ou eliminar os rivais; no limite de eras, decide a pontuação.":"Maioria territorial, eliminação ou supremacia (na fase final); no limite de eras, decide a pontuação.";
  renderProfiles();
  document.querySelectorAll("#homeDifficulty [data-diff]").forEach(b=>{const on=b.dataset.diff===choice.difficulty;b.classList.toggle("selected",on);b.setAttribute("aria-pressed",String(on))});$("homeDiffDesc").textContent=DIFFICULTIES[choice.difficulty]?.desc||"";
  const styleName=v=>v==="random"?"aleatório":v==="config"?"das Configurações":playerProfileName(v).toLowerCase();
  const styles=Array.from({length:choice.ai},(_,i)=>styleName(opponentChoices[i]||"random"));const uniq=[...new Set(styles)];
  $("setupSummary").innerHTML=`<strong>${choice.ai===1?"1 rival":choice.ai+" rivais"}</strong> ${uniq.length===1?(choice.ai===1?uniq[0]:(uniq[0]==="aleatório"?"aleatórios":uniq[0])):"("+styles.join(", ")+")"} · <strong>${DIFFICULTIES[choice.difficulty]?.name||""}</strong> · ${choice.eras} eras${choice.conquest?" · Conquista":""} · modo ${choice.mode==="fast"?"rápido":"lento"}`;
  const inProgress=state&&!state.result&&(state.era>1||state.history.length>0);
  $("homeContinue").classList.toggle("hidden",!inProgress);
  if(inProgress)$("homeContinue").textContent=`Continuar partida (era ${state.era} de ${state.maxEras})`;
 };
 document.querySelectorAll("#homeDifficulty [data-diff]").forEach(b=>b.onclick=()=>{choice.difficulty=b.dataset.diff;sync()});
 $("modeSlow").onclick=()=>{choice.mode="slow";sync()};$("modeFast").onclick=()=>{choice.mode="fast";sync()};
 document.querySelectorAll("#homeOpponents [data-ai]").forEach(b=>b.onclick=()=>{choice.ai=Number(b.dataset.ai);sync()});
 document.querySelectorAll("#homeEraPresets [data-eras]").forEach(b=>b.onclick=()=>{choice.eras=Number(b.dataset.eras);sync()});
 $("homeConquest").onclick=()=>{choice.conquest=true;sync()};$("homeClassic").onclick=()=>{choice.conquest=false;sync()};
 $("homeMaxEras").onchange=()=>{const v=Math.round(Number($("homeMaxEras").value));choice.eras=Number.isFinite(v)?clamp(v,10,150):30;sync()};
 const begin=()=>{restoreSetupAfterTutorial();gameMode=choice.mode;currentDifficulty=choice.difficulty;applyDifficulty(choice.difficulty);configApplied.map.aiCount=choice.ai;configApplied.endgame.maxEras=choice.eras;configApplied.endgame.supremacyEnabled=!choice.conquest;configApplied=normalizeConfig(configApplied);runHook("configChanged");startNewGame();home.hidden=true;setup.hidden=true;showView("game")};
 $("homeStart").onclick=()=>openSetup(false);
 $("setupBack").onclick=()=>{setup.hidden=true;sync();home.hidden=false};
 $("homeHowTo").onclick=()=>showModal(`<h2>Como jogar</h2>${$("howTo").querySelector(".grid").innerHTML}`,[{label:"Entendi",cls:"primary"}]);
 $("setupStart").onclick=()=>{
  const inProgress=state&&!state.result&&(state.era>1||state.history.length>0);
  if(inProgress)showModal(`<h2>Começar uma nova partida?</h2><p class="small muted">A partida em andamento (era ${state.era}) será substituída.</p>`,[{label:"Cancelar"},{label:"Nova partida",cls:"primary",onClick:begin}]);else begin();
 };
 const openTab=v=>{home.hidden=true;showView(v)};
 $("homeContinue").onclick=()=>{openTab("game");renderAll();runHook("continueGame")};
 $("homeCompare").onclick=()=>openTab("balanceLab");
 $("homeLab").onclick=()=>openTab("lab");
 $("returnHome").onclick=()=>{closeSheet({focus:false});choice=currentChoice();sync();home.hidden=false;home.scrollTop=0;runHook("returnHome")};
 sync();
}
/* ── Tutorial: partida guiada (1 IA, roteiro controlado; depois jogo livre no Fácil) ──
   O estado do tutorial vive em state.tutorial={step,waitEra,attackDone} e é guardado com a partida.
   Proteções do motor usadas só aqui: state.aiAvoid (a IA não ataca o jogador nem o território reservado)
   e state.forcedAttack (resultado do próximo ataque de uma civilização). */
export async function initTutorial(){
 const TUT_KEY="imperios-tutorial-oferecido",P_START=7,AI_START=9,TARGET=8;
 const needMil=()=>(configApplied.military.conquestCost+configApplied.military.defenseNeutral)/configApplied.military.pointsPerInvestment;
 // Em telas baixas (≤ 700 px) os planos rápidos ficam na folha "Planos ▾".
 const planCta=name=>SHORT_SCREEN.matches?`Toque em “Planos” e escolha “${name}”.`:`Toque no plano “${name}”.`;
 const STEPS=[
  {t:"Bem-vindo a Impérios",target:()=>$("mapCard"),html:()=>`${civLabel(P(state))} (verde) e o rival ${civLabel(A(state))} disputam <strong>24 territórios</strong>. Vence quem primeiro:<br>• dominar <strong>70% do mapa</strong> (17 territórios);<br>• ou liderar com folga durante 5 eras (<strong>supremacia</strong>, só na fase final);<br>• ou tiver <strong>mais pontos</strong> na última era.`},
  {t:"Ouro e receita",target:()=>$("metrics"),html:()=>`A cada era você recebe <strong>ouro</strong>: cada território rende, e as Obras e a Ciência somam mais. O <strong>ouro</strong> aqui no topo é o que você pode investir agora; o <strong>+/era</strong> mostra quanto entrou nesta era.`},
  {t:"Investir",target:()=>$("investCard"),action:true,html:()=>`Há três áreas:<br>⚔ <strong>Militar</strong>: <strong>Força</strong> para atacar já na próxima era (perde 20% por era).<br>▰ <strong>Obras</strong>: rendem ouro a médio prazo e depois acabam.<br>✦ <strong>Ciência</strong>: rende tarde, mas para sempre.<br>Para atacar na próxima era, invista ao menos ${fmt(needMil(),0)} de ouro em Militar.<br><br>👉 <strong>${planCta("Ataque")}</strong>`,done:()=>readAlloc()[0]+1e-9>=needMil()},
  {t:"Concluir a era",target:()=>$("advance"),action:true,html:()=>`Seus investimentos estão definidos. 👉 <strong>Toque em “Concluir era”.</strong> Os rivais jogam ao mesmo tempo e começa a era seguinte.`,done:()=>state.era>=2},
  {t:"Atacar",target:()=>$("mapCard"),action:true,enter:()=>{state.forcedAttack={owner:"player",win:true}},html:()=>`Os territórios com <span class="gold">contorno dourado</span> são vizinhos e podem ser atacados. O ataque custa <strong>${configApplied.military.conquestCost} + a defesa</strong> do alvo em Força (territórios livres têm defesa ${configApplied.military.defenseNeutral}) e vence em 82% das vezes. Você pode dar várias ordens por era, mas cada ataque a mais custa mais (2.º ×2, 3.º ×3).<br><br>👉 <strong>Toque em ${regionName(TARGET)} (${TARGET+1}) e depois em “Atacar”.</strong>`,done:()=>!!(state.orders||[]).find(o=>o.owner==="player")||countTerritories(state,"player")>=2},
  {t:"Resolver as ordens",target:()=>$("advance"),action:true,html:()=>`Os ataques não são imediatos: as ordens de <strong>todos</strong> são resolvidas juntas no fim da era, em ordem sorteada. Se dois atacarem o mesmo território, há <strong>batalha</strong> — vence quem tiver mais Força (somada à Ciência).<br><br>👉 <strong>Toque em “Concluir era”</strong> e veja o relatório.`,done:()=>countTerritories(state,"player")>=2},
  {t:"Conquista!",target:()=>$("statTerr"),html:()=>`Mais territórios = mais receita e mais pontos: <strong>territórios valem 40% da pontuação</strong>. Aqui, <strong>terras</strong> mostra quantos você tem e quantos precisa para a maioria.<br><br>Invista e conclua as próximas eras à vontade; o tutorial volta na <strong>era 4</strong>.`,after:()=>{state.tutorial.waitEra=4}},
  {t:"As Obras rendem",target:()=>$("statGold"),html:()=>`O <strong>+/era</strong> ao lado do ouro soma o que rendem os territórios, as Obras e a Ciência (veja cada parte em ☰ → Detalhes da partida). Cada investimento em Obras cresce até a 4.ª era e depois vai acabando — reinvista para manter o ouro entrando.<br><br>Continue; algo vai acontecer na <strong>era 5</strong>.`,after:()=>{state.tutorial.waitEra=5}},
  {t:"Você foi atacado!",target:()=>$("mapCard"),enter:()=>scriptedAttack(),html:()=>`${state.tutorial.attackIdx!=null?`O rival ${civLabel(A(state))} atacou ${escapeHtml(regionName(state.tutorial.attackIdx))} (${state.tutorial.attackIdx+1}), um território seu, e <strong>foi repelido</strong> desta vez (todo ataque tem 18% de chance de falhar).`:"Os rivais também atacam: quando tiverem Força suficiente, seus territórios vizinhos a eles viram alvos."}<br>• A <strong>defesa</strong> dos seus territórios cresce com suas Obras e sua Ciência — o atacante precisa pagar ${configApplied.military.conquestCost} + essa defesa.<br>• Quem conquista um território <strong>saqueia</strong> parte da economia do dono.<br>Guarde um pouco de Força e não deixe o ouro parado.`},
  {t:"Como saber quem está ganhando",target:()=>$("scorePill"),html:()=>`O <strong>🏆</strong> no topo mostra sua <strong>posição</strong> no placar e a diferença de <strong>pontos</strong> para o líder. Toque nele (ou em “terras”) para ver o placar completo e quanto falta para cada vitória.<br><br>Agora é com você: a partida continua no nível <strong>Fácil</strong>. Boa sorte! 🏆`,last:true}
 ];
 function scriptedAttack(){
  const tu=state.tutorial;if(tu.attackDone)return;tu.attackDone=true;
  const ai=A(state);if(!ai?.active)return;
  const mine=state.owners.map((o,i)=>o==="player"&&eligibleTargets(state,ai.id).some(t=>t.i===i)?i:-1).filter(i=>i>=0);if(!mine.length)return;
  const idx=mine[0];tu.attackIdx=idx;const need=configApplied.military.conquestCost+territoryDefense(state,idx,configApplied);
  ai.military=Math.max(ai.military,need);state.forcedAttack={owner:ai.id,win:false};state.aiAvoid=null;
  attackTerritory(state,idx,ai.id,configApplied,true);state.aiAvoid={player:true};saveGame();renderAll();
 }
 function startTutorial(){
  scrolledStep=-1;
  storage.set(TUT_KEY,"1").catch(()=>{});
  // Escolhas do jogador antes do tutorial (se já estiver num tutorial, mantém as originais).
  const prevSetup=tutorialPrevSetup()||{mode:gameMode,difficulty:currentDifficulty,ai:configApplied.map.aiCount||1,eras:configApplied.endgame.maxEras,supremacy:configApplied.endgame.supremacyEnabled!==false};
  gameMode="slow";currentDifficulty="facil";applyDifficulty("facil");configApplied.map.aiCount=1;configApplied.endgame.maxEras=30;configApplied.endgame.supremacyEnabled=true;configApplied=normalizeConfig(configApplied);
  // O rival do tutorial é sempre "Equilibrado" (definido abaixo em ai.profile); opponentChoices do jogador não muda.
  state=newGame();
  // Posições do tutorial: você no 8, a IA no 10, o território 9 livre entre os dois.
  state.owners=state.owners.map(()=> "neutral");state.owners[P_START]="player";state.owners[AI_START]=A(state).id;
  const ai=A(state);ai.profile="reference";ai.hiddenProfile=false;
  state.aiAvoid={player:true,idx:[TARGET]};state.tutorial={step:0,waitEra:0,attackDone:false,prevSetup};state.ui.skipIdleWarning=true;   // sem o aviso de saldo parado durante o tutorial

  selectedTerritory=null;saveGame();
  runHook("configChanged");
  $("homeScreen").hidden=true;if($("setupScreen"))$("setupScreen").hidden=true;
  showView("game");
  renderAll();window.scrollTo({top:0});enterStep();
 }
 window.startTutorial=startTutorial;
 const box=document.createElement("div");box.id="tutBox";box.className="tut-box";box.hidden=true;box.setAttribute("role","dialog");box.setAttribute("aria-live","polite");document.body.appendChild(box);
 let focused=null,scrolledStep=-1;
 const cur=()=>state?.tutorial&&!state.tutorial.done?state.tutorial:null;
 function clearFocus(){if(focused)focused.classList.remove("tut-focus");focused=null}
 function endTutorial(skipped){const tu=cur();if(!tu)return;tu.done=true;state.aiAvoid=null;state.forcedAttack=null;state.ui.skipIdleWarning=false;saveGame();clearFocus();box.hidden=true;renderAll();
  if(skipped)showModal(`<h2>Tutorial terminado</h2><p class="small muted">A partida continua normalmente no nível Fácil. Você pode rever o tutorial pela tela inicial (botão “Tutorial”) e as regras em “Como jogar”.</p>`,[{label:"Continuar",cls:"primary"}])}
 function enterStep(){const tu=cur();if(!tu)return;const st=STEPS[tu.step];if(st?.enter&&!tu["entered"+tu.step]){tu["entered"+tu.step]=true;st.enter();saveGame()}draw()}
 function draw(msg){
  const tu=cur();clearFocus();if(!tu||!$("homeScreen").hidden||state.result){box.hidden=true;return}
  if(tu.waitEra&&state.era<tu.waitEra){box.hidden=false;box.className="tut-box tut-mini";box.innerHTML=`<span>🎓 Tutorial: continue jogando — volta na era ${tu.waitEra}.</span><button type="button" data-tut="skip" class="tut-link">Sair</button>`;bind();return}
  const st=STEPS[tu.step];if(!st){endTutorial(false);return}
  const el=st.target();if(el){focused=el;el.classList.add("tut-focus");if(scrolledStep!==tu.step){scrolledStep=tu.step;const tall=el.getBoundingClientRect().height>innerHeight*0.55;el.scrollIntoView({block:tall?"start":"center",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})}}
  box.hidden=false;box.className="tut-box";
  // Em ecrãs largos, o balão fica do lado oposto ao elemento destacado para não o tapar.
  if(window.innerWidth>640&&el){const r=el.getBoundingClientRect(),right=r.left+r.width/2>window.innerWidth/2;box.style.left=right?"16px":"auto";box.style.right=right?"auto":"16px"}else{box.style.left="";box.style.right=""}
  // A instrução de ação (👉 ...) fica sempre visível por baixo do texto, que rola dentro do balão se for longo.
  const full=st.html(),k=full.indexOf("👉"),body=(k>=0?full.slice(0,k):full).replace(/(<br>\s*)+$/,""),cta=k>=0?full.slice(k):"";
  box.innerHTML=`<div class="tut-head"><span class="pill">Tutorial ${tu.step+1}/${STEPS.length}</span><button type="button" data-tut="skip" class="tut-link">Pular tutorial</button></div><h3>${st.t}</h3><div class="tut-text">${body}</div>${cta?`<div class="tut-cta">${cta}</div>`:""}${msg?`<div class="tut-warn">${msg}</div>`:""}${st.action&&cta?"":`<div class="tut-actions">${st.action?'<span class="small muted">Faça a ação indicada para continuar.</span>':`<button type="button" class="primary" data-tut="next">${st.last?"Terminar tutorial":"Próximo →"}</button>`}</div>`}`;
  bind();place();
 }
 // Telemóvel (≤ 640 px): o balão fica acima ou abaixo do elemento destacado, do lado com mais espaço,
 // e nunca por cima da barra fixa de baixo. Se o elemento ocupar a tela toda, o balão fica em baixo.
 const safeProbe=document.createElement("div");safeProbe.style.cssText="position:fixed;left:0;top:env(safe-area-inset-top,0px);width:0;height:0;visibility:hidden;pointer-events:none";document.body.appendChild(safeProbe);
 // Texto mais comprido que o balão: esbate o fim para mostrar que dá para rolar.
 const markMore=()=>{const tt=box.querySelector(".tut-text");box.classList.toggle("more",!!tt&&tt.scrollHeight>tt.clientHeight+2&&tt.scrollTop+tt.clientHeight<tt.scrollHeight-2)};
 box.addEventListener("scroll",markMore,true);
 function place(){requestAnimationFrame(markMore);
  const reset=()=>{box.style.top="";box.style.bottom="";box.style.maxHeight=""};
  if(box.hidden||box.classList.contains("tut-mini")||!focused||window.innerWidth>640){reset();return}
  const vh=innerHeight,gap=10,minH=170,r=focused.getBoundingClientRect(),bar=document.querySelector(".actionbar");
  const sTop=safeProbe.getBoundingClientRect().top+8,barTop=bar&&bar.offsetParent?Math.min(vh,bar.getBoundingClientRect().top):vh;
  const inBar=bar&&bar.contains(focused),limitBot=inBar?vh:barTop;
  const visTop=Math.max(sTop,r.top),visBot=Math.min(limitBot,r.bottom);
  const above=visTop-gap-sTop,below=inBar?-1:barTop-8-(visBot+gap);
  if(below>=minH&&below>=above){box.style.top=(visBot+gap)+"px";box.style.bottom="auto";box.style.maxHeight=below+"px";return}
  if(above>=minH){box.style.top="auto";box.style.bottom=(vh-visTop+gap)+"px";box.style.maxHeight=above+"px";return}
  // Sem espaço livre suficiente (elemento grande): balão em baixo, por cima da barra, ocupando no máximo 45% da tela.
  box.style.top="auto";box.style.bottom=(vh-barTop+8)+"px";box.style.maxHeight=Math.round(Math.min(vh*0.45,barTop-sTop-8))+"px";
 }
 let placeQueued=false;const queuePlace=()=>{if(placeQueued)return;placeQueued=true;requestAnimationFrame(()=>{placeQueued=false;place()})};
 window.addEventListener("scroll",queuePlace,{passive:true});window.addEventListener("resize",queuePlace);
 function bind(){box.querySelectorAll("[data-tut]").forEach(b=>b.onclick=()=>{
  if(b.dataset.tut==="skip"){endTutorial(true);return}
  const tu=cur(),st=STEPS[tu.step];st.after?.();if(st.last){endTutorial(false);return}tu.step++;saveGame();enterStep()})}
 // Avanço automático das etapas com ação e retoma depois das eras de espera.
 setInterval(()=>{const tu=cur();if(!tu||!$("homeScreen").hidden)return;
  if(tu.waitEra){if(state.era>=tu.waitEra){tu.waitEra=0;saveGame();enterStep()}return}
  const st=STEPS[tu.step];if(st?.action&&st.done()){tu.step++;saveGame();enterStep()}},250);
 // Durante as etapas de ação, não deixa concluir a era antes do tempo.
 onHook("beforeConclude",()=>{const tu=cur();
  if(tu&&!tu.waitEra&&tu.step<=2){draw("Primeiro coloque pelo menos "+fmt(needMil(),0)+" de ouro em Militar (plano “Ataque”).");return false}
  if(tu&&!tu.waitEra&&tu.step===4){draw("Primeiro dê a ordem de ataque a "+regionName(TARGET)+" ("+(TARGET+1)+").");return false}
 });
 // Depois de cada desenho completo, redesenha o balão por cima.
 onHook("afterRender",()=>{if(cur())setTimeout(()=>{if(focused||box.hidden===false)draw()},0)});
 // Tela inicial: botão e oferta na primeira visita.
 const how=$("homeHowTo");if(how){const b=document.createElement("button");b.type="button";b.className="home-secondary";b.id="homeTutorial";b.textContent="🎓 Tutorial";how.insertAdjacentElement("beforebegin",b);
  b.onclick=()=>{const inProg=state&&!state.result&&(state.era>1||state.history.length>0)&&!cur();if(inProg)showModal(`<h2>Começar o tutorial?</h2><p class="small muted">A partida em andamento (era ${state.era}) será substituída por uma partida guiada.</p>`,[{label:"Cancelar"},{label:"Começar tutorial",cls:"primary",onClick:startTutorial}]);else startTutorial()}}
 let offered=false;try{offered=!!await storage.get(TUT_KEY)}catch(e){offered=true}
 const fresh=!state||(!state.history.length&&state.era<=1);
 if(!offered&&fresh)setTimeout(()=>showModal(`<h2>Primeira vez em Impérios?</h2><p class="small muted">Uma partida guiada mostra, em poucos minutos, como investir, atacar, defender e vencer. Você pode sair quando quiser.</p>`,[{label:"Jogar o tutorial",cls:"primary",onClick:startTutorial},{label:"Agora não",onClick:()=>{storage.set(TUT_KEY,"1").catch(()=>{})}}]),300);
 if(cur())setTimeout(draw,0);
 // Ao voltar ao jogo a partir da tela inicial, mostra de novo o balão.
 onHook("continueGame",()=>setTimeout(draw,0));
 onHook("returnHome",()=>{clearFocus();box.hidden=true});
}

// Depuração e testes: variáveis globais só com ?dev=1 ou quando os testes automáticos o pedem (ver src/app/debug.js).
if(DEV_MODE||globalThis.__IMPERIOS_TEST__)exposeGlobals([coreNs,aiNs,legacyNs],{configDefault:v=>{configDefault=v},configEdited:v=>{configEdited=v},configApplied:v=>{configApplied=v},state:v=>{state=v},busy:v=>{busy=v},cancelRequested:v=>{cancelRequested=v},selectedTerritory:v=>{selectedTerritory=v},compareResults:v=>{compareResults=v},lastStrategyResult:v=>{lastStrategyResult=v},scenarioLoaded:v=>{scenarioLoaded=v},gameMode:v=>{gameMode=v},currentDifficulty:v=>{currentDifficulty=v},aiConfigBase:v=>{aiConfigBase=v},opponentChoices:v=>{opponentChoices=v},saveFailed:v=>{saveFailed=v},savedGameLoaded:v=>{savedGameLoaded=v},saveProblem:v=>{saveProblem=v},savedRaw:v=>{savedRaw=v},downloadCapture:v=>{downloadCapture=v},aiValidationResults:v=>{aiValidationResults=v},balanceLabResults:v=>{balanceLabResults=v},fixedRun:v=>{fixedRun=v},fixedCancel:v=>{fixedCancel=v},TEST_REGISTRY:v=>{TEST_REGISTRY=v},ftHistory:v=>{ftHistory=v},ftLastRun:v=>{ftLastRun=v},ftLabReady:v=>{ftLabReady=v},expState:v=>{expState=v},expCancel:v=>{expCancel=v},valState:v=>{valState=v},valCancel:v=>{valCancel=v},sheetOpen:v=>{sheetOpen=v},sheetReturn:v=>{sheetReturn=v},sheetHist:v=>{sheetHist=v},sheetIgnorePop:v=>{sheetIgnorePop=v},toastTimer:v=>{toastTimer=v}});
