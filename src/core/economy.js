// Economia: investimentos (Militar, Obras, Ciência), retornos por era, receita e estratégias automáticas.
import {effectiveDelay,normMode,mapAreaFactor,mapSizeOf} from "./config.js";
import {countTerritories} from "./map.js";
import {getCiv} from "./state.js";
import {terrainEffectsOn,terrainIncomeFactor,terrainAreaBonus} from "./terrain.js";
import {clone} from "./util.js";

export function infraReturn(inv,age){
 // O atraso efetivo depende do modo do investimento (no rápido é reduzido em 1 era, como o militar).
 const p=inv.params,activeAge=age-effectiveDelay("infrastructure",p.delay,inv.mode)+1;if(activeAge<1||activeAge>p.duration)return 0;
 // Return = invested * initialRate * growth curve to peak, then geometric decline; residual is a floor.
 let factor=activeAge<=Math.max(1,p.peakEra)?Math.pow(1+p.growthRate,activeAge-1):Math.pow(1+p.growthRate,Math.max(0,p.peakEra-1))*Math.pow(1-p.declineRate,activeAge-Math.max(1,p.peakEra));
 let amount=inv.amount*p.initialReturn*factor;
 if(p.residual>0)amount=Math.max(amount,inv.amount*p.residual);
 return Number.isFinite(amount)?Math.max(0,amount):0;
}
export function techReturn(s,inv,era){
 const p=inv.params;if(era<inv.origin+effectiveDelay("technology",p.delay,inv.mode))return 0;
 return inv.amount*p.progressPerInvestment*p.benefitPerProgress;
}
export function activeTechBenefit(s,era,cfg,owner="player"){
 let raw=0;for(const inv of s.investments)if(inv.type==="technology"&&inv.owner===owner)raw+=techReturn(s,inv,era);
 return cfg.technology.maxBenefit>0?Math.min(raw,cfg.technology.maxBenefit):raw;
}
export function militaryAvailable(s,era,owner="player"){let pts=0;for(const inv of s.investments)if(inv.type==="military"&&inv.owner===owner&&era>=inv.origin+effectiveDelay("military",inv.params.delay,inv.mode)&&!inv.released)pts+=inv.points;return pts}
export function releaseMilitaryInvestments(s,era){
 for(const inv of s.investments)if(inv.type==="military"&&era>=inv.origin+effectiveDelay("military",inv.params.delay,inv.mode)&&!inv.released){
  const civ=getCiv(s,inv.owner);if(civ)civ.military+=inv.points;
  inv.released=true;
 }
}
export function makeInvestment(type,amount,era,cfg,owner="player",mode="slow"){
 mode=normMode(mode);
 // O multiplicador afeta apenas investimentos feitos no modo rápido; no lento o fator é sempre 1.
 const returnScale=mode==="fast"?cfg.economy.fastModeReturnMultiplier:1, base={id:null,type,owner,origin:era,amount,mode,cumReturn:0};
 // Militar: das regras só o atraso é lido mais tarde (militaryAvailable); o resto da configuração não é guardado.
 if(type==="military")return {...base,points:amount*cfg.military.pointsPerInvestment*returnScale,params:{delay:cfg.military.delay}};
 if(type==="infrastructure"){const params=clone(cfg.infrastructure);params.initialReturn*=returnScale;params.residual*=returnScale;return {...base,params};}
 const params=clone(cfg.technology);params.benefitPerProgress*=returnScale;
 return {...base,progress:amount*cfg.technology.progressPerInvestment,params};
}
export function invest(s,type,amount,cfg,owner="player"){
 const civ=getCiv(s,owner);if(!civ)throw Error("Civilização inexistente: "+owner);
 amount=Math.max(0,amount);if(amount>civ.treasury*(1+1e-9)+1e-8)throw Error("Investimento superior ao orçamento.");amount=Math.min(amount,civ.treasury);
 if(amount===0)return null;civ.treasury=Math.max(0,civ.treasury-amount);civ.invested[type]+=amount;
 // Maravilha da Humanidade (só com state.wonder): soma o investimento da era por área (ver wonderEraClose em era.js).
 if(s.wonder){const e=civ.wonderEra&&civ.wonderEra.era===s.era?civ.wonderEra:(civ.wonderEra={era:s.era,military:0,infrastructure:0,technology:0});e[type]+=amount}
 const inv=makeInvestment(type,amount,s.era,cfg,owner,s.mode);
 // Terrenos com efeitos: cada região de Colinas soma +10% aos pontos de Força deste investimento.
 if(type==="military"&&terrainEffectsOn(s))inv.points*=1+terrainAreaBonus(s,owner,"forca");
 inv.id=s.nextInvestmentId++;s.investments.push(inv);return inv;
}
export function strategyWeights(strategy,custom=[34,33,33]){
 if(strategy==="military")return [100,0,0];if(strategy==="aggressive")return [85,10,5];if(strategy==="infrastructure")return [0,100,0];if(strategy==="technology")return [0,0,100];if(strategy==="techFirst")return [10,15,75];if(strategy==="growth")return [15,65,20];if(strategy==="custom")return custom;return [34,33,33];
}
export function allocateStrategy(s,cfg,strategy,custom=[34,33,33],owner="player"){
 let weights=strategyWeights(strategy,custom);
 let sum=weights.reduce((a,b)=>a+Math.max(0,b),0);if(sum<=0)weights=[34,33,33],sum=100;
 const civ=getCiv(s,owner),budget=civ.treasury, amounts=weights.map(w=>budget*Math.max(0,w)/sum);
 // Arredondamento determinístico: os dois primeiros na precisão configurada, o resíduo vai para o terceiro.
 const factor=10**cfg.economy.precision;amounts[0]=Math.floor(amounts[0]*factor)/factor;amounts[1]=Math.floor(amounts[1]*factor)/factor;amounts[2]=Math.max(0,budget-amounts[0]-amounts[1]);
 invest(s,"military",amounts[0],cfg,owner);invest(s,"infrastructure",amounts[1],cfg,owner);invest(s,"technology",amounts[2],cfg,owner);
 return {military:amounts[0],infrastructure:amounts[1],technology:amounts[2]};
}
// Multiplicadores de receita das IAs só desta partida com terrenos com efeitos ({all, v1}); null = usar a configuração.
// Valores estranhos no save são ignorados (mesmos limites da configuração: 0,1–5; v1 −1 = usar o geral).
export function aiIncomeEffectsOf(s){
 const x=s?.aiIncomeEffects;if(!terrainEffectsOn(s)||!x||typeof x!=="object")return null;
 const all=Number(x.aiIncomeMultiplier),v1=Number(x.aiIncomeMultiplier1v1??-1);
 if(!Number.isFinite(all)||all<0.1||all>5||!Number.isFinite(v1)||v1>5||(v1<0&&v1!==-1))return null;
 return {all,v1};
}
// Receita de uma civilização na era: territórios + infraestrutura + tecnologia (mesma regra para todos).
export function collectRevenue(s,civ,era,cfg){
 const territories=countTerritories(s,civ.id);
 // Custo administrativo: cada território além do primeiro reduz a receita de TODOS os territórios
 // (nos mapas maiores, dividido pelo fator de área k = regiões/24, para a terra continuar a render até ~k×12 regiões)
 // (rendimentos decrescentes da expansão); a receita por território nunca fica negativa.
 const perTerritory=Math.max(0,cfg.economy.baseIncome*Math.pow(1+cfg.economy.incomeGrowth,Math.max(0,era-1))-(cfg.economy.adminCostPerTerritory||0)/mapAreaFactor(s)*Math.max(0,territories-1));
 let normal=territories*perTerritory;
 // Terrenos com efeitos: o ouro de cada região segue o seu terreno (Campina +20%, Floresta −20%…).
 if(terrainEffectsOn(s)){normal=0;s.owners.forEach((o,i)=>{if(o===civ.id)normal+=perTerritory*terrainIncomeFactor(s,i)})}
 let infra=0,tech=0;const infraBy=[];
 for(const inv of s.investments){
  if(inv.owner!==civ.id)continue;
  if(inv.type==="infrastructure"){const ret=infraReturn(inv,era-inv.origin);inv.cumReturn+=ret;infra+=ret;if(ret>0)infraBy.push({origin:inv.origin,age:era-inv.origin,value:ret})}
  else if(inv.type==="technology"){const ret=techReturn(s,inv,era);inv.cumReturn+=ret;tech+=ret}
 }
 if(cfg.technology.maxBenefit>0)tech=Math.min(tech,cfg.technology.maxBenefit);
 // Terrenos com efeitos: % de Obras e de Ciência por região de cada terreno do império.
 if(terrainEffectsOn(s)){infra*=1+terrainAreaBonus(s,civ.id,"obras");tech*=1+terrainAreaBonus(s,civ.id,"ciencia")}
 // Bônus tecnológico permanente: o progresso já ativo (após o atraso) acrescenta uma percentagem
 // a toda a receita da era. Fica contabilizado como receita de tecnologia.
 let activeProgress=0;for(const inv of s.investments)if(inv.owner===civ.id&&inv.type==="technology"&&era>=inv.origin+effectiveDelay("technology",inv.params.delay,inv.mode))activeProgress+=inv.progress;
 // Teto do bônus: sem limite, receita → investimento → progresso → receita cresce de forma explosiva.
 // Mapas maiores (2–4): o teto sobe revenueBonusCapPerSize por tamanho acima do Original (padrão 0: desligado; medido com 0,25 e o Científico ficava forte demais com 3 rivais).
 const capSize=mapSizeOf(s)>1?(cfg.technology.revenueBonusCapPerSize||0)*(mapSizeOf(s)-1):0;
 const bonusRate=Math.min((cfg.technology.revenueBonusCap??1)+capSize,(cfg.technology.revenueBonusPerProgress||0)*activeProgress);
 const techBonus=bonusRate*(normal+infra+tech);tech+=techBonus;
 // Dificuldade: multiplicador de receita das IAs. Só em partidas com jogador humano, para não
 // distorcer os laboratórios (onde todas as civilizações são IA e o lugar 0 também).
 // Dificuldade: em 1×1 pode usar um multiplicador próprio (aiIncomeMultiplier1v1 ≥ 0; -1 = usar o geral).
 // Terrenos com efeitos: a partida pode trazer multiplicadores próprios (state.aiIncomeEffects, gravados ao começar;
 // Médio: 1,06 com 2+ rivais e 1,03 no 1×1 — rodada de 20/11/2026). Saves sem o campo usam os da configuração.
 const fxm=aiIncomeEffectsOf(s),v1=fxm?fxm.v1:cfg.economy.aiIncomeMultiplier1v1,all=fxm?fxm.all:(cfg.economy.aiIncomeMultiplier??1);
 const diffMult=(civ.index>0&&s.civs[0]?.controller==="human")?((s.civs.length===2&&v1>=0)?v1:all):1;
 if(diffMult!==1){normal*=diffMult;infra*=diffMult;tech*=diffMult}
 const total=normal+infra+tech;
 if(![normal,infra,tech,total,civ.treasury,civ.military].every(Number.isFinite)||Math.max(normal,infra,tech,total,civ.treasury,civ.military)>1e100){s.stopped=true;throw Error("Limite numérico atingido; exporte o histórico antes de continuar.")}
 civ.treasury=Math.max(0,civ.treasury+total);
 civ.lastRevenue={normal,infrastructure:infra,technology:tech,total};
 return {normal,infra,tech,total,infraBy};
}
