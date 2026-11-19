// Referências por era (mediana de partidas calibradas) usadas no ICE e na pontuação final.
import {clamp,clone} from "./util.js";

export const REF_DIMS=[["military","Militar","pontos disponíveis"],["infrastructure","Infraestrutura","receita de infra na era"],["technology","Tecnologia","progresso acumulado"],["treasury","Tesouraria","saldo no fim da era"],["revenue","Receita","média das últimas 3 eras"],["territories","Territórios","territórios controlados"]];
export const REF_SETS=[["ice","ICE (supremacia)"],["score","Pontuação final"]];
export function quantile(sorted,q){if(!sorted.length)return NaN;const pos=(sorted.length-1)*q,lo=Math.floor(pos),hi=Math.ceil(pos);return sorted[lo]+(sorted[hi]-sorted[lo])*(pos-lo)}
// Calibração: para cada era e dimensão, mediana dos valores de todas as civilizações de
// todas as partidas. A normalização logarítmica exige referência > 0; quando a mediana é 0
// usa-se a média (se > 0) ou 1, e a célula fica marcada como "fallback". Exceção: a tesouraria
// com mediana zero usa a referência de receita da mesma era.
export function calibrateReferences(games,meta={}){
 if(!games.length)throw Error("Sem partidas para calibrar.");
 const eras=Math.min(...games.map(g=>g.timeline.length));if(eras<1)throw Error("Partidas sem eras registadas.");
 const values={},stats={},fallback={};
 for(const [dim] of REF_DIMS){values[dim]=[];stats[dim]=[];fallback[dim]=[];
  for(let e=0;e<eras;e++){
   const xs=[];for(const g of games)for(const r of g.timeline[e].civs){const v=r.dims[dim];if(Number.isFinite(v))xs.push(v)}
   xs.sort((a,b)=>a-b);const n=xs.length,median=quantile(xs,.5),mean=n?xs.reduce((a,b)=>a+b,0)/n:NaN,zeros=xs.filter(v=>v<=1e-9).length;
   let ref=median,fb=false;if(!(ref>0)){ref=mean>0?mean:1;fb=true}
   values[dim].push(ref);fallback[dim].push(fb?(dim==="treasury"?"revenue":"mean"):false);
   stats[dim].push({n,median,mean,p25:quantile(xs,.25),p75:quantile(xs,.75),min:n?xs[0]:NaN,max:n?xs[n-1]:NaN,zeroShare:n?zeros/n:0});
  }
 }
 // Tesouraria: se a mediana é zero (todos gastam tudo), a referência passa a ser a receita
 // de referência da mesma era — guardar o equivalente a uma era de receita vale 100%.
 for(let e=0;e<eras;e++)if(fallback.treasury[e])values.treasury[e]=values.revenue[e];
 return {method:"median",eras,values,fallback,stats,meta:{games:games.length,...meta}};
}
// Referência de uma dimensão numa era; depois da última era calibrada usa o último valor.
export function refAt(table,dim,era){const arr=table?.values?.[dim];if(!arr||!arr.length)return NaN;return arr[clamp(Math.floor(era),1,arr.length)-1]}
export function validateReferences(refs){
 if(refs===undefined||refs===null)return null;
 if(typeof refs!=="object")throw Error("Referências inválidas.");
 const out={};
 for(const [set] of REF_SETS){
  let t=refs[set];if(t===undefined||t===null)continue;
  // Referências antigas sem a dimensão territorial: completar com a tabela padrão (mesmo nº de eras).
  if(t.values&&!t.values.territories&&Array.isArray(t.values.military)&&typeof DEFAULT_REFERENCE_VALUES!=="undefined"){t={...t,values:{...t.values,territories:t.values.military.map((_,e)=>DEFAULT_REFERENCE_VALUES.territories[Math.min(e,DEFAULT_REFERENCE_VALUES.territories.length-1)])}}}
  if(!t.values||typeof t.values!=="object")throw Error(`Referências ${set}: valores ausentes.`);
  let len=null;
  for(const [dim] of REF_DIMS){const arr=t.values[dim];if(!Array.isArray(arr)||!arr.length)throw Error(`Referências ${set}.${dim}: lista vazia.`);
   if(arr.some(v=>!Number.isFinite(Number(v))||Number(v)<=0))throw Error(`Referências ${set}.${dim}: todos os valores devem ser números > 0.`);
   if(len===null)len=arr.length;else if(arr.length!==len)throw Error(`Referências ${set}: as dimensões têm números de eras diferentes.`)}
  out[set]={...clone(t),eras:len,values:Object.fromEntries(REF_DIMS.map(([d])=>[d,t.values[d].map(Number)]))};
 }
 return Object.keys(out).length?out:null;
}
export const DEFAULT_REFERENCE_VALUES={"military":[1,3.408,3.609,4.14,4.763,5.101,4.65,5.181,5.747,6.176,6.029,6.264,5.248,6.542,7.445,8.026,6.825,9.124,7.999,9.006,9.855,14.33,18.25,20.12,24.87,26.37,36.51,37.49,43.01,48.14,46.48,61.68,75.57,77.81,79.17,112.8,119.6,123.7,138,182,183,179.5,169.2,223,246.3,265.5,306.8,286.7,300.2,274.8,253.9,239,229.1,223.4,221.2,222,225.6,231.6,239.9,250.4,263.1,278.1,295.5,315.5,338.4,364.8,395.2,430.3,471.4,519.9,577.6,643.8,720.4,810.2,914,1029,1159,1307,1476,1669,1893,2151,2451,2801,3210,3691,4257,4925,5717,6658,7777,8794,9553,10380,11270,12240,13290,14550,16410,18570,21080,23990,27380,31340,35990,41460,47660,54070,62170,68950,76320,83780,90790,98400,109400,119300,129300,140100,151900,164600,178400,193300,212900,253800,321400,411100,495800,591200,677900,775400,899100,1045000,1293000,1601000,1985000,2463000,3061000,3807000,4507000,5108000,5802000,6604000,7545000,8479000,9414000,10700000,12190000,13930000,15960000,17620000],"infrastructure":[1,6.248,8.43,11.44,15.16,16.79,19.57,22.68,26.54,29.53,33.66,38.42,43.42,47.2,53.41,60.39,66.7,73.78,80.19,87.12,97.06,115.9,124.5,136.2,142.6,164.4,192.1,218.2,254.3,273.4,314.6,341.8,402.8,403.6,474.2,412.4,376.5,324.2,341.7,324.7,325,331.4,269.1,276.3,283.1,151.3,126.4,131.6,137.3,143.6,150.4,157.9,166,174.8,184.4,194.9,206.2,218.6,232.1,246.7,262.8,282.4,304.9,330.3,359.3,392.6,431.3,476.8,531,596.5,676.7,771.7,884.7,1019,1178,1363,1581,1836,2135,2489,2906,3401,3988,4636,5047,5492,5974,6497,7064,7854,8858,10020,11360,12910,14720,16840,19320,22230,25660,29050,33200,36460,40810,45400,49200,53330,57860,63010,68610,74700,82160,102400,131000,165400,199900,235900,264400,309200,345000,402500,478200,571600,702200,876400,1095000,1391000,1628000,1878000,2181000,2551000,2832000,3069000,3326000,3767000,4101000,4526000,5166000,6220000,7683000,9502000,11050000,13020000,14900000,17090000,19650000,22640000,26130000,30530000,36520000,42190000],"technology":[4.26,5.244,6.647,8.268,10.22,12.37,14.77,17.45,20.44,23.77,28.09,32.89,38.24,44.63,51.76,59.74,68.68,79.19,90.68,103.6,118.3,133,149,176.6,206,231.3,271.1,314.5,305.1,342.7,326.9,309.7,295,308.5,306.7,342.5,313.2,357.2,353,346,346.9,346.8,408.1,375.9,226.7,229.7,241.6,254.5,268.4,283.3,299.5,317.1,336.3,357.3,380.3,405.6,433.6,464.7,499.6,538.7,582.9,633.2,690.9,757.6,835.6,927.9,1038,1173,1327,1424,1530,1647,1775,1916,2069,2236,2418,2736,3106,3537,4043,4636,5335,6131,6946,7983,8851,9794,11280,13040,14390,15590,16880,18290,19810,21450,23240,25170,27270,29540,32000,34670,37560,40690,44080,47760,51750,57110,66990,76210,88970,106400,121900,139000,158900,176700,192400,209500,228100,263400,329600,380900,450700,548000,700900,896500,1147000,1467000,1841000,2160000,2551000,2930000,3442000,3720000,4012000,4327000,4943000,6001000,7077000,8068000,9217000,10060000,10950000,11920000,12980000,14760000,17740000,22690000,29020000,37120000],"treasury":[22,25.12,27.89,39.27,51.12,57.96,64.41,73.5,82.35,91,104.1,119,132.9,152.7,168,184.9,205.3,230,266.3,298.2,336.5,372.5,397.8,429.7,478.4,531.3,550.9,641,724.5,788.7,942.3,1086,1124,1183,1126,1054,918.5,901.6,885.6,862.6,834.4,805,837.6,873.1,913.7,777.4,812.8,392.3,410.7,433.8,458.9,486.4,516.8,550.2,587.1,628,673.5,724.4,781.6,846.2,919.6,1003,1100,1213,1345,1503,1694,1929,2223,2595,3024,3516,4083,4763,5555,6472,7545,8824,9934,10810,11770,12800,13920,15130,16450,18460,20900,23730,27010,30840,35310,40560,46730,53690,60950,70090,77700,86040,96910,105000,113800,123300,133600,144800,156900,175700,190400,206300,223500,242200,262500,284500,308300,345700,436600,558500,688700,831200,983000,1092000,1287000,1447000,1762000,2181000,2704000,3356000,4169000,5185000,6394000,7237000,8207000,9328000,10810000,12230000,13570000,15250000,17340000,19770000,22600000,25590000,29020000,33970000,40030000,46500000,55020000,65520000,78520000,97190000,119800000,135000000],"revenue":[22,25.12,27.89,39.27,51.12,57.96,64.41,73.5,82.35,91,104.1,119,132.9,152.7,168,184.9,205.3,230,266.3,298.2,336.5,372.5,397.8,429.7,478.4,531.3,550.9,641,724.5,788.7,942.3,1086,1124,1183,1126,1054,918.5,901.6,885.6,862.6,834.4,805,837.6,873.1,913.7,777.4,812.8,392.3,410.7,433.8,458.9,486.4,516.8,550.2,587.1,628,673.5,724.4,781.6,846.2,919.6,1003,1100,1213,1345,1503,1694,1929,2223,2595,3024,3516,4083,4763,5555,6472,7545,8824,9934,10810,11770,12800,13920,15130,16450,18460,20900,23730,27010,30840,35310,40560,46730,53690,60950,70090,77700,86040,96910,105000,113800,123300,133600,144800,156900,175700,190400,206300,223500,242200,262500,284500,308300,345700,436600,558500,688700,831200,983000,1092000,1287000,1447000,1762000,2181000,2704000,3356000,4169000,5185000,6394000,7237000,8207000,9328000,10810000,12230000,13570000,15250000,17340000,19770000,22600000,25590000,29020000,33970000,40030000,46500000,55020000,65520000,78520000,97190000,119800000,135000000],"territories":[1,1,1,1,1,1,1,2,2,2,3,3,4,4,4,5,6,6,7,8,8,9,10,10,10.5,11,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12]};
export const DEFAULT_REFERENCES={ice:{method:"default",eras:150,values:DEFAULT_REFERENCE_VALUES,meta:{source:"60 partidas · 150 eras · 1×1 · modo lento · configuração padrão (ordens múltiplas, tecnologia reforçada)"}},score:{method:"default",eras:150,values:DEFAULT_REFERENCE_VALUES,meta:{source:"60 partidas · 150 eras · 1×1 · modo lento · configuração padrão (ordens múltiplas, tecnologia reforçada)"}}};
