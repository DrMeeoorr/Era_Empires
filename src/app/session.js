// Sessão de jogo: a partida atual (state), a configuração aplicada, o modo, a dificuldade e os rivais escolhidos.
// Sem DOM. Outros módulos leem estas variáveis diretamente e substituem-nas só pelas funções set… do fim do ficheiro.
import {LAB_PROFILES} from "../ai/profiles.js";
import {runHook} from "./hooks.js";
import {saveGame} from "./save.js";
import {DEFAULTS,pickAiDifficulty,DIFFICULTIES,AI_DIFF_FIELDS} from "../core/config.js";
import {beginEra,finishEra} from "../core/era.js";
import {RIVAL_NAMES} from "../core/names.js";
import {newState} from "../core/state.js";
import {makeMapTerrain,enableTerrainEffects} from "../core/terrain.js";
import {clone} from "../core/util.js";

export let configDefault=clone(DEFAULTS);
export let configApplied=clone(DEFAULTS);
export let state;
export let busy=false;
export let cancelRequested=false;
export let selectedTerritory=null;
// Modo escolhido na interface para a PRÓXIMA partida. O motor nunca lê esta variável:
// cada estado guarda o seu próprio modo (state.mode) e cada investimento guarda inv.mode.
export let gameMode="slow";
// true na versão de desenvolvimento (dev.html): laboratórios, testes e exportação. O index.html (jogador)
// tem <html class="player-build">; o dev.html não. Sem DOM (Node) é false, como no jogador.
export const DEV_MODE=typeof document!=="undefined"&&!document.documentElement.classList.contains("player-build");
// Versão do jogador: começa no "Médio"; "Configurações" (valores dos laboratórios) só existe no dev.html.
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
// Tipo de mapa da PRÓXIMA partida ("padrao" ou "sorteado"; Nova partida → Personalizar → Mapa). Cada partida guarda
// os seus terrenos em state.terrain ({type, seed, list}); por enquanto são só visuais (nenhuma regra os lê).
export let mapType="padrao";
// Terrenos da PRÓXIMA partida: false = Só visual (padrão para jogador novo e sempre no tutorial), true = Com efeitos.
// Cada partida guarda a sua escolha (state.terrainEffects); o motor só lê a do estado.
export let terrainEffectsChoice=false;
// Opções mostradas ao jogador: sem "Definido nas Configurações" fora do dev.html.
export const visibleOpponentOptions=()=>DEV_MODE?OPPONENT_OPTIONS:OPPONENT_OPTIONS.filter(([v])=>v!=="config");
// Resolve as escolhas no início de cada partida: "Aleatório" sorteia um perfil novo a cada partida e fica oculto até ao fim.
export function resolveOpponents(n){return Array.from({length:n},(_,i)=>{const c=opponentChoices[i]||"random";if(c==="random")return {profile:LAB_PROFILES[Math.floor(Math.random()*LAB_PROFILES.length)][0],hidden:true};if(c==="config")return {profile:null,hidden:false};return {profile:c,hidden:false}})}
// Uma partida começa já com a era 1 aberta: receitas recebidas, à espera da decisão do jogador.
export function newGame(){const n=configApplied.map.aiCount||1,opp=resolveOpponents(n);const s=newState(configApplied,{mode:gameMode,endRules:!!configApplied.endgame.enabled,profiles:[null,...opp.map(o=>o.profile)],startSeed:configApplied.map.randomStart?Math.floor(Math.random()*4294967296):0});opp.forEach((o,i)=>{if(s.civs[i+1]){s.civs[i+1].hiddenProfile=o.hidden;s.civs[i+1].name=RIVAL_NAMES[i]||s.civs[i+1].name}});s.difficulty=currentDifficulty;
 // Terrenos: semente própria (Math.random, como a posição aleatória), nunca o sorteio das batalhas.
 s.terrain=makeMapTerrain(mapType,mapType==="sorteado"?Math.floor(Math.random()*4294967296):null,s.owners.map((o,i)=>o==="neutral"?-1:i).filter(i=>i>=0),s.owners.length);
 // Com efeitos: liga as regras do terreno e guarda as regiões iniciais (contam como Campina). Só visual: nada muda.
 if(terrainEffectsChoice)enableTerrainEffects(s);
 // Com efeitos, a dificuldade pode ter receita própria para os rivais (Médio: +3%); fica gravada na partida, por isso
 // saves já em curso continuam com os valores com que começaram.
 const fxInc=terrainEffectsChoice&&DIFFICULTIES[currentDifficulty]?.effectsIncome;if(fxInc)s.aiIncomeEffects={...fxInc};
 beginEra(s,configApplied);s.ui={skipIdleWarning:false};return s}
export function profileOf(c){return c.profile||configApplied.military.aiStyle||"adaptive"}
// Conclui a era aberta e, se a partida continuar, abre a seguinte.
export function playEra(allocation){const era=state.era,row=finishEra(state,configApplied,{playerAllocation:allocation});if(!state.result)beginEra(state,configApplied);saveGame();runHook("afterEra",era,row);return row}
// Únicas formas de outros módulos substituírem estas variáveis (um módulo não pode reatribuir o que importa).
export function setConfigDefault(v){configDefault=v;return v}
export function setConfigApplied(v){configApplied=v;return v}
export function setState(v){state=v;return v}
export function setBusy(v){busy=v;return v}
export function setCancelRequested(v){cancelRequested=v;return v}
export function setSelectedTerritory(v){selectedTerritory=v;return v}
export function setGameMode(v){gameMode=v;return v}
export function setCurrentDifficulty(v){currentDifficulty=v;return v}
export function setAiConfigBase(v){aiConfigBase=v;return v}
export function setOpponentChoices(v){opponentChoices=v;return v}
export function setMapType(v){mapType=v==="sorteado"?"sorteado":"padrao";return mapType}
export function setTerrainEffectsChoice(v){terrainEffectsChoice=v===true;return terrainEffectsChoice}
