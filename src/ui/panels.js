// Painéis: gráficos, histórico, previsão, eventos, condições de vitória e tela de resultado.
import {state,configApplied} from "../app/session.js";
import {DIFFICULTIES} from "../core/config.js";
import {infraReturn,techReturn} from "../core/economy.js";
import {territorialMinimum,territoryBase,finalScores,describeResult} from "../core/endgame.js";
import {countTerritories} from "../core/map.js";
import {civName} from "../core/names.js";
import {P,getCiv,aiCivs} from "../core/state.js";
import {clamp} from "../core/util.js";
import {svgLine} from "./charts.js";
import {$} from "./dom.js";
import {cssColor,escapeHtml,fmt,money,uiText} from "./format.js";
import {startNewGame} from "./game.js";
import {liveScores,PTS} from "./hud.js";
import {civLabel,profileLabel,civSymHtml} from "./labels.js";

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
