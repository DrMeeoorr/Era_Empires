// Configuração do jogo: versão do formato, semente, valores padrão, limites, validação (normalizeConfig),
// modo lento/rápido e as dificuldades (dados). Sem DOM e sem estado global: a configuração é sempre passada.
import {validateReferences} from "./references.js";
import {clone,safeNum} from "./util.js";

// Formato 5: os investimentos já não guardam a lista de retornos por era (inv.returns, nunca lida) e os
// militares guardam só o atraso (params.delay) em vez de uma cópia de toda a configuração militar.
// migrateSavedState converte saves dos formatos 3 e 4.
export const VERSION=5, SEED=74291, SUPPORTED_VERSIONS=[3,4,5];
export const DEFAULTS={
 economy:{initialBudget:120,baseIncome:22,incomeGrowth:0,precision:2,carry:true,fastModeReturnMultiplier:1,adminCostPerTerritory:1,aiIncomeMultiplier:1,aiIncomeMultiplier1v1:-1},
 military:{pointsPerInvestment:0.12,delay:1,conquestCost:5,defenseOwned:8,defenseNeutral:3,winCost:1,lossCost:1,aiMilitary:45,aiInfrastructure:30,aiTechnology:25,aiEnabled:true,aiTarget:"neutralFirst",aiStyle:"adaptive",aiAggression:75,aiReserve:0,decayRate:0.2,defensePerInfraRevenue:0.25,defensePerTechProgress:0,techAttackMax:0.6,techAttackHalf:40,defenseSplitExponent:0.5,defensePerReserveForce:1,pillageInvestShare:3,pillageMaxShare:0.2,pillageRevenueEras:3,simultaneousOrders:true,battleTechWeight:0.5,maxOrdersPerEra:0,extraOrderCostStep:1,techPillageMapExponent:0.25},
 infrastructure:{delay:1,initialReturn:0.16,peakEra:4,growthRate:0.15,declineRate:0.15,duration:12,residual:0},
 technology:{progressPerInvestment:0.2,delay:2,benefitPerProgress:0.8,maxBenefit:0,accumulation:"total",revenueBonusPerProgress:0.0011,revenueBonusCap:1.25,revenueBonusCapPerSize:0},
 map:{territories:24,initialPlayer:1,initialAI:1,aiCount:1,randomStart:false,mapSize:1},
 simulation:{blockSize:100,seed:SEED},
 endgame:{enabled:true,maxEras:30,supremacyEnabled:true,territoryPct:0.7,supremacyRelative:0.7,supremacyEras:5,supremacyMinEraShare:0.5,supremacyMaxNeutralShare:0.25,leaderTieMargin:0.01,iceMinAbsolute:0.5,iceFloor:0.05,
  iceWMilitary:0.2,iceWInfrastructure:0.2,iceWTechnology:0.2,iceWFinance:0.2,iceWTerritory:0.2,financeTreasuryWeight:0.4,
  scoreWMilitary:0.15,scoreWInfrastructure:0.15,scoreWTechnology:0.15,scoreWTreasury:0.15,scoreWTerritory:0.4,scoreNormalization:"log",scoreTerritoryProportional:true,
  scoreCapMilitary:1.5,scoreCapInfrastructure:1.5,scoreCapTechnology:1.5,scoreCapTreasury:1.5,scoreCapTerritory:1.5,scoreTieMargin:0.01,extendForSupremacy:false,
  greatDiscovery:false,discoveryGoal:6000,discoveryMinRegions:5,discoveryReact:0.5,discoveryReactMilitary:20,
  wonder:false,wonderGoal:3000,wonderMinRegions:4,wonderPerGold:0.2,
  victories:{dominion:true,supremacy:true,discovery:true,wonder:true}}
};
export const MAX_AI=5, MAP_COLS=6;
/* ── Tipos de vitória escolhidos para a partida (config.endgame.victories, 23/11/2026) ──
   Desligáveis: domínio, supremacia, Grande Descoberta e Maravilha (estas duas só existem nos mapas 2×–4×). Sempre
   ativos: eliminação (último império) e pontos no limite de eras / teto do Sem limite, para toda partida ter fim.
   Padrão: tudo ligado (o jogo de sempre). */
export const OPTIONAL_VICTORIES=["dominion","supremacy","discovery","wonder"];
export function normVictories(v){const out={};for(const k of OPTIONAL_VICTORIES)out[k]=!(v&&typeof v==="object"&&v[k]===false);return out}
/* ── Tamanho do mapa (config.map.mapSize = 1, 2, 3 ou 4; padrão 1) ──
   Grades com cerca de 1×, 2×, 3× e 4× a área do mapa original (6×4), com a mesma vizinhança (até 4 vizinhas, sem
   diagonais). 3× = 10×7 = 70 regiões (o retângulo mais próximo de 72 com a forma do original).
   mapSize 1 = o jogo de sempre, byte a byte (o estado nem ganha o campo mapSize). Nos maiores, algumas regras escalam
   com o fator de área k = regiões/24 (ver MAP_SCALE em mapScaleOf): custo administrativo ÷ k e territórios ÷ k na
   pontuação e no ICE. A meta de domínio (70%) e a trava da supremacia já são proporções do mapa. */
export const MAP_SIZES=Object.freeze({1:Object.freeze({cols:6,rows:4}),2:Object.freeze({cols:8,rows:6}),3:Object.freeze({cols:10,rows:7}),4:Object.freeze({cols:12,rows:8})});
export const MAP_SIZE_KEYS=[1,2,3,4];
export const MAX_TERRITORIES=MAP_SIZES[4].cols*MAP_SIZES[4].rows;
export const normMapSize=v=>MAP_SIZE_KEYS.includes(Number(v))?Number(v):1;
// Número de regiões de uma configuração: o do tamanho escolhido; no tamanho 1, map.territories (24; os laboratórios
// podem usar 4–30).
export function mapTerritories(cfg){const k=normMapSize(cfg?.map?.mapSize);return k>1?MAP_SIZES[k].cols*MAP_SIZES[k].rows:cfg.map.territories}
// Colunas da grade de um mapa com n regiões (48/70/96 = tamanhos 2/3/4; qualquer outro número: 6, como sempre).
export function mapColsFor(n){for(const k of [2,3,4]){const g=MAP_SIZES[k];if(n===g.cols*g.rows)return g.cols}return MAP_COLS}
export const mapRowsFor=n=>Math.ceil(n/mapColsFor(n));
// Tamanho do mapa de uma partida (saves antigos e o mapa de sempre não têm o campo: 1).
export const mapSizeOf=s=>normMapSize(s?.mapSize);
// Fator de área k = regiões/24 (1 no mapa de sempre): escala o custo administrativo e os territórios na pontuação/ICE.
export function mapAreaFactor(s){return mapSizeOf(s)>1?(s.owners?.length||24)/24:1}
// Rival 5 (Turquesa): azul-turquesa mais claro e mais azul que o verde-jade do jogador (antes #3fa3a8, parecido).
export const CIV_COLORS=["#2c9d87","#bd5268","#c98a2e","#5b7fd6","#9a5cc4","#3cb8e0"];
export const CHART_COLORS=["#f4bd50","#ff737b","#e88a43","#62a8ff","#b49aff","#72d0df"];
export const normMode=m=>m==="fast"?"fast":"slow";
// O modo lento preserva exatamente os atrasos configurados; o rápido só os reduz.
export function effectiveDelay(type, configuredDelay, mode="slow"){
 const delay=Number(configuredDelay)||0;
 if(normMode(mode)!=="fast")return delay;
 if(type==="military"||type==="infrastructure")return Math.max(0,delay-1);
 if(type==="technology")return Math.max(1,delay-2);
 return delay;
}
export function normalizeConfig(c){
 const x=clone(c); if(!x||typeof x!=="object")throw Error("Configuração não é um objeto");
 // Referências por era (Etapa 2) ficam fora dos grupos numéricos e têm validação própria.
 const references=validateReferences(x.references);delete x.references;
 const keys=Object.keys(DEFAULTS);for(const k of keys)if(!x[k]||typeof x[k]!=="object")throw Error("Grupo ausente: "+k);
 if(x.military.defenseOwned===undefined)x.military.defenseOwned=x.military.defense??DEFAULTS.military.defenseOwned;
 if(x.military.defenseNeutral===undefined)x.military.defenseNeutral=Math.min(x.military.defense??DEFAULTS.military.defenseNeutral,DEFAULTS.military.defenseNeutral);
 delete x.military.defense;
 // Configurações anteriores à dimensão territorial: se os 4 pesos antigos já somam 1, o peso
 // territorial fica 0 (comportamento antigo preservado) em vez do padrão 0,2.
 if(x.endgame){const e=x.endgame;if(e.iceWTerritory===undefined&&["iceWMilitary","iceWInfrastructure","iceWTechnology","iceWFinance"].every(k=>e[k]!==undefined))e.iceWTerritory=0;if(e.scoreWTerritory===undefined&&["scoreWMilitary","scoreWInfrastructure","scoreWTechnology","scoreWTreasury"].every(k=>e[k]!==undefined))e.scoreWTerritory=0}
 // Configurações antigas (v3) não têm parâmetros novos: completar com os padrões.
 for(const k of keys)for(const [key,val] of Object.entries(DEFAULTS[k]))if(x[k][key]===undefined)x[k][key]=clone(val);
 const limits={initialBudget:[0,1e9],baseIncome:[0,1e9],incomeGrowth:[-0.5,5],precision:[0,6],pointsPerInvestment:[0,100],delay:[1,1000],conquestCost:[0,1e9],defenseOwned:[0,1e9],defenseNeutral:[0,1e9],winCost:[0,1],lossCost:[0,1],aiMilitary:[0,100],aiInfrastructure:[0,100],aiTechnology:[0,100],initialReturn:[0,100],peakEra:[0,10000],growthRate:[0,10],declineRate:[0,1],duration:[1,1000000],residual:[0,100],progressPerInvestment:[0,100],benefitPerProgress:[0,100],maxBenefit:[0,1e12],territories:[4,30],initialPlayer:[1,10],initialAI:[1,10],aiCount:[1,MAX_AI],blockSize:[1,1000000],seed:[0,4294967295],fastModeReturnMultiplier:[0,1000],adminCostPerTerritory:[0,1e6],aiIncomeMultiplier:[0.1,5],aiIncomeMultiplier1v1:[-1,5],decayRate:[0,1],defensePerInfraRevenue:[0,100],techAttackMax:[0,10],techAttackHalf:[0,1e9],defenseSplitExponent:[0,1],battleTechWeight:[0,100],maxOrdersPerEra:[0,100],extraOrderCostStep:[0,100],pillageInvestShare:[0,100],pillageMaxShare:[0,1],defensePerReserveForce:[0,100],pillageRevenueEras:[0,100],defensePerTechProgress:[0,100],revenueBonusPerProgress:[0,1],revenueBonusCap:[0,100],
  mapSize:[1,4],techPillageMapExponent:[0,4],revenueBonusCapPerSize:[0,100],discoveryGoal:[1,1e12],wonderGoal:[1,1e12],wonderMinRegions:[1,400],wonderPerGold:[0.0001,100],discoveryMinRegions:[1,400],discoveryReact:[0,1],discoveryReactMilitary:[0,100],maxEras:[10,150],supremacyMinEraShare:[0,1],supremacyMaxNeutralShare:[0,1],territoryPct:[0.01,1],supremacyRelative:[0,1],supremacyEras:[1,100],leaderTieMargin:[0,0.5],iceMinAbsolute:[0,1e6],iceFloor:[1e-6,1],iceWMilitary:[0,1],iceWInfrastructure:[0,1],iceWTechnology:[0,1],iceWFinance:[0,1],iceWTerritory:[0,1],scoreWTerritory:[0,1],scoreCapTerritory:[0.01,100],financeTreasuryWeight:[0,1],scoreWMilitary:[0,1],scoreWInfrastructure:[0,1],scoreWTechnology:[0,1],scoreWTreasury:[0,1],scoreCapMilitary:[0.01,100],scoreCapInfrastructure:[0.01,100],scoreCapTechnology:[0.01,100],scoreCapTreasury:[0.01,100],scoreTieMargin:[0,0.5]};
 for(const [group,obj] of Object.entries(x))for(const [k,v] of Object.entries(obj)){if(typeof DEFAULTS[group][k]==="number"){const [min,max]=limits[k]||[0,1e12];safeNum(v,min,max)}}
 if(x.economy.precision>6)throw Error("Precisão máxima: 6");
 if(!Number.isInteger(x.map.aiCount))throw Error("Número de IAs deve ser inteiro.");
 x.map.randomStart=x.map.randomStart===true;
 {const v=x.endgame.victories;if(v!==undefined&&(v===null||typeof v!=="object"||Array.isArray(v)||Object.entries(v).some(([k,b])=>!OPTIONAL_VICTORIES.includes(k)||typeof b!=="boolean")))throw Error("Tipos de vitória inválidos (use true/false para dominion, supremacy, discovery e wonder).");x.endgame.victories=normVictories(v)}
 if(!MAP_SIZE_KEYS.includes(x.map.mapSize))throw Error("Tamanho do mapa deve ser 1, 2, 3 ou 4.");
 const eg=x.endgame;
 if(!Number.isInteger(eg.maxEras)||!Number.isInteger(eg.supremacyEras))throw Error("Limite de eras e eras consecutivas devem ser inteiros.");
 for(const [keys,label] of [[ICE_WEIGHT_KEYS,"Os pesos do ICE"],[SCORE_WEIGHT_KEYS,"Os pesos da pontuação final"]])if(Math.abs(keys.reduce((a,k)=>a+eg[k],0)-1)>1e-6)throw Error(label+" devem somar 100% (1,00).");
 if(!["log","linear"].includes(eg.scoreNormalization))throw Error("Normalização da pontuação deve ser log ou linear.");
 if(eg.iceMinByEra!==undefined&&eg.iceMinByEra!==null&&(!Array.isArray(eg.iceMinByEra)||eg.iceMinByEra.some(v=>!Number.isFinite(Number(v))||Number(v)<0)))throw Error("ICE mínimo por era deve ser uma lista de números ≥ 0.");
 if(x.military.aiMilitary+x.military.aiInfrastructure+x.military.aiTechnology<=0)throw Error("A soma dos percentuais da IA deve ser positiva");
 if(x.map.initialPlayer+x.map.initialAI>mapTerritories(x))throw Error("Territórios iniciais excedem o mapa");
 if(1+x.map.aiCount>mapTerritories(x))throw Error("Há mais civilizações do que territórios no mapa.");
 if(x.infrastructure.residual>x.infrastructure.initialReturn*(1+x.infrastructure.growthRate)**Math.min(x.infrastructure.peakEra,20)+1e-8)throw Error("Retorno residual incompatível com o retorno inicial; reduza o residual.");
 if(references)x.references=references;
 return x;
}
export const ICE_WEIGHT_KEYS=["iceWMilitary","iceWInfrastructure","iceWTechnology","iceWFinance","iceWTerritory"],SCORE_WEIGHT_KEYS=["scoreWMilitary","scoreWInfrastructure","scoreWTechnology","scoreWTreasury","scoreWTerritory"];
/* ── Dificuldade ──
   Rodada de balanceamento de 20/11/2026 (aprovada): Médio com terrenos com efeito tem receita própria (effectsIncome),
   gravada na partida (state.aiIncomeEffects) ao começar. Difícil/Lendário com 2+ rivais no Só visual: regiões livres
   primeiro (ver ai/decide.js).
   Rodada 4 (20/11/2026): o saque limitado a 20% e a Força guardada que defende deixaram as partidas com 2+ rivais
   mais duras; para a escada continuar em ordem, o ouro extra dos rivais com 2+ rivais baixou: Médio 1,03 → 1,00
   (com efeitos 1,06 → 1,03) e Difícil 1,05 → 1,03. O 1×1 e o Lendário não mudaram. */
export const DIFFICULTIES={
 muitofacil:{name:"Muito fácil",desc:"Os rivais recebem 70% da receita normal. Ideal para aprender: dá para vencer com frequência mesmo contra 3 rivais.",aiIncomeMultiplier:0.7,aiAggression:75,aiTarget:"neutralFirst"},
 facil:{name:"Fácil",desc:"Os rivais recebem 92% da receita normal.",aiIncomeMultiplier:0.92,aiAggression:75,aiTarget:"neutralFirst"},
 medio:{name:"Médio",desc:"Rivais com as mesmas regras que você. Com terrenos com efeito, os rivais recebem +3% de receita.",aiIncomeMultiplier:1,aiIncomeMultiplier1v1:1,aiAggression:75,aiTarget:"neutralFirst",effectsIncome:{aiIncomeMultiplier:1.03,aiIncomeMultiplier1v1:1.03}},
 dificil:{name:"Difícil",desc:"Rivais estrategas: atacam sempre e recebem +3% de receita. No 1×1 o rival se concentra em você; com 2 ou mais rivais, eles correm primeiro para as regiões livres (com terrenos com efeito, se unem contra quem lidera).",aiIncomeMultiplier:1.03,aiIncomeMultiplier1v1:1.03,aiAggression:100,aiTarget:"leader"},
 hardcore:{name:"Lendário",desc:"Rivais estrategas que atacam sempre e recebem +12% de receita. No 1×1 o rival se concentra em você; com 2 ou mais rivais, eles correm primeiro para as regiões livres (com terrenos com efeito, se unem contra quem lidera). Para quem já domina o jogo.",aiIncomeMultiplier:1.12,aiAggression:100,aiTarget:"leader"},
 config:{name:"Configurações",desc:"Usa a receita, a agressividade e o alvo das IAs definidos nas Configurações."}
};
// Os 4 valores que as dificuldades substituem. aiConfigBase guarda os valores "das Configurações", para que
// escolher "Configurações" depois de outra dificuldade volte a eles (antes ficavam os da dificuldade anterior).
export const AI_DIFF_FIELDS=[["economy","aiIncomeMultiplier"],["economy","aiIncomeMultiplier1v1"],["military","aiAggression"],["military","aiTarget"]];
export const pickAiDifficulty=cfg=>Object.fromEntries(AI_DIFF_FIELDS.map(([g,k])=>[g+"."+k,cfg[g][k]]));
// Valores vindos de um save: só são aceites se a configuração continuar válida com eles.
export function validAiBase(b){if(!b||typeof b!=="object")return null;try{const c=clone(DEFAULTS);for(const [g,k] of AI_DIFF_FIELDS){if(!(g+"."+k in b))return null;c[g][k]=b[g+"."+k]}normalizeConfig(c);return pickAiDifficulty(c)}catch(e){return null}}
