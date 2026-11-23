// Laboratório 3 (validação estratégica das IAs): comportamento esperado de cada perfil e diagnóstico.
import {median,mean,profileName} from "./engine.js";
import {fmtBR as fmt} from "../ui/format.js";

/* ═══════════════ Laboratório 3: validação estratégica das IAs ═══════════════ */
export let valState={results:null};
export let valCancel=false;
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
// Únicas formas de outros módulos substituírem estas variáveis (um módulo não pode reatribuir o que importa).
export function setValState(v){valState=v;return v}
export function setValCancel(v){valCancel=v;return v}
