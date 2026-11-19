// Laboratório 2 (balanceamento): cenários, parâmetros variáveis e exportação dos resultados.
import {configApplied} from "../app/session.js";
import {DEFAULTS,normalizeConfig} from "../core/config.js";
import {clone} from "../core/util.js";
import {RC_NAMES,mean,median,gameOutcome,RC} from "./engine.js";
import {PARAM_GROUPS} from "./settings.js";
import {csvDownload} from "../platform/files.js";
import {setStatus} from "../ui/dom.js";

/* ═══════════════ Laboratório 2: balanceamento ═══════════════ */
// Catálogo de parâmetros experimentais = parâmetros da configuração (exceto desempenho e nº de IAs).
export function paramCatalog(){
 const out=[];for(const [title,g,items] of PARAM_GROUPS){if(g==="simulation")continue;for(const [key,label] of items){if((g==="map"&&key==="aiCount")||(g==="endgame"&&key==="enabled"))continue;out.push({id:`${g}.${key}`,group:g,key,label:`${title} · ${label}`,type:typeof DEFAULTS[g][key]})}}
 return out;
}
export const SCENARIO_COLORS=["#f4bd50","#56d6a1","#b49aff","#62a8ff","#ff737b","#e88a43","#72d0df","#d9a4c7"];
export let expState={params:["endgame.supremacyRelative","endgame.territoryPct"],scenarios:[],results:null};
export let expCancel=false;
export const getParam=(cfg,id)=>{const [g,k]=id.split(".");return cfg[g][k]};
export function scenarioConfig(base,values){const c=clone(base);for(const [id,v] of Object.entries(values)){const [g,k]=id.split(".");c[g][k]=v}return normalizeConfig(c)}
export function parseParamValue(def,raw){if(def.type==="boolean")return !!raw;if(def.type==="string")return String(raw);const v=Number(String(raw).trim().replace(",","."));if(!Number.isFinite(v))throw Error(`Valor inválido para ${def.label}: ${raw}`);return v}
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
// Únicas formas de outros módulos substituírem estas variáveis (um módulo não pode reatribuir o que importa).
export function setExpState(v){expState=v;return v}
export function setExpCancel(v){expCancel=v;return v}
