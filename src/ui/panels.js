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
import {isSheetOpen,closeSheet} from "./sheets.js";
import {civLabel,profileLabel,civSymHtml} from "./labels.js";
import {resultMedalsHtml} from "./medals.js";

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
 $("forecast").innerHTML=`<div class="log-item"><strong class="gold">Militar</strong><p class="small muted">Força disponível: ${fmt(P(state).military,1)}. A que não for usada defende suas regiões, mas perde 20% por era.</p></div><div class="log-item"><strong class="green">Obras</strong><p class="small muted">Na próxima era: ${money(infra[0]||0)}; daqui a 5 eras: ${money(infra[4]||0)}</p></div><div class="log-item"><strong class="purple">Ciência</strong><p class="small muted">Na próxima era: ${money(tech[0]||0)}; daqui a 5 eras: ${money(tech[4]||0)} (sem contar o bônus sobre todo o ouro da era).</p></div><div class="small muted">Só investimentos já feitos.</div>`;
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
// Tela de resultado (Fase 3): vitória/derrota em destaque, sua posição, 3 números e "Jogar de novo" / "Ver detalhes".
// Os gráficos, a tabela de pontos e os estilos dos rivais ficam na folha "Detalhes do resultado" (#resultSheet).
const END_TITLE={score:"Vitória por pontos!",territorial:"Vitória por domínio do mapa!",supremacy:"Vitória por supremacia!",elimination:"Vitória: rivais eliminados!"};
const END_WHY={score:"por pontos",territorial:"por domínio do mapa",supremacy:"por supremacia",elimination:"eliminando os rivais"};
const EMBLEM={won:`<svg viewBox="0 0 84 96" aria-hidden="true"><defs><linearGradient id="resG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08f"/><stop offset="1" stop-color="#d9962a"/></linearGradient></defs><path d="M42 4 78 16v30c0 24-16 38-36 46C22 84 6 70 6 46V16Z" fill="#14213a" stroke="url(#resG)" stroke-width="4"/><path d="M20 58h44l-4-22-10 9-8-15-8 15-10-9Z" fill="url(#resG)"/><rect x="20" y="62" width="44" height="6" rx="2" fill="url(#resG)"/></svg>`,
 lost:`<svg viewBox="0 0 84 96" aria-hidden="true"><path d="M42 4 78 16v30c0 24-16 38-36 46C22 84 6 70 6 46V16Z" fill="#1a1d2b" stroke="#7d8aa3" stroke-width="4"/><path d="M44 14 36 40l12 6-10 24 4 12" fill="none" stroke="#ff9aa1" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/></svg>`,
 draw:`<svg viewBox="0 0 84 96" aria-hidden="true"><path d="M42 4 78 16v30c0 24-16 38-36 46C22 84 6 70 6 46V16Z" fill="#14213a" stroke="#9fb0c7" stroke-width="4"/><path d="M24 44h36M24 56h36" stroke="#ffd479" stroke-width="6" stroke-linecap="round"/></svg>`};
// Linhas do placar final: pontuação final (vitória por pontos) ou o placar da última era.
function finalRows(r){const rows=r.scores?r.scores.map(x=>({id:x.id,score:x.score,civ:getCiv(state,x.id)})):(liveScores()||[]);return rows.slice().sort((a,b)=>b.score-a.score)}
export function resultSummary(s=state){
 const r=s.result;if(!r)return null;
 const won=r.type==="victory"&&r.winners[0]==="player",drawn=r.type==="draw"&&r.winners.includes("player"),why=id=>(r.reasons?.[id]||[])[0];
 const rows=finalRows(r),k=rows.findIndex(x=>x.id==="player"),pos=k>=0?k+1:null,me=k>=0?PTS(rows[k].score):null;
 const other=pos===1?rows[1]:rows[0],gap=me!=null&&other?me-PTS(other.score):null;
 const winner=r.type==="victory"?getCiv(s,r.winners[0]):null;
 let title,sub;
 if(won){title=END_TITLE[why("player")]||"Vitória!";sub=pos?`Você terminou em ${pos}.º de ${rows.length}.`:""}
 else if(drawn||(r.type==="draw")){title="Empate!";sub=r.allEliminated?"Todas as civilizações foram eliminadas.":`Empate entre ${r.winners.map(id=>id==="player"?"você":escapeHtml(civName(getCiv(s,id)))).join(" e ")}.`}
 else{title=!P(s).active?"Derrota: você foi eliminado":"Derrota";sub=winner?`${civLabel(winner)} venceu ${END_WHY[why(winner.id)]||""}.${pos?` Você ficou em ${pos}.º.`:""}`:""}
 const terr=countTerritories(s,"player"),wins=s.history.at(-1)?.attacksTotal?.playerWins??0;
 const tiles=[{v:`${terr}<small>/${territoryBase(s)}</small>`,k:"territórios"},gap==null?{v:me==null?"—":fmt(me,0),k:"pontos"}:{v:(gap>=0?"+":"−")+fmt(Math.abs(gap),0),k:gap>=0?(pos===1?"pontos à frente do 2.º":"pontos"):"pontos para o 1.º"},{v:fmt(wins,0),k:wins===1?"conquista":"conquistas"}];
 return {won,drawn,tone:won?"won":(drawn||r.type==="draw")?"draw":"lost",title,sub,rows,pos,tiles,era:r.era};
}
export function renderResult(){
 const s=state,b=$("resultBanner"),scr=$("resultScreen"),r=s.result;
 document.documentElement.classList.toggle("result-open",!!r);
 if(!r){scr.hidden=true;scr.innerHTML="";if(!P(s).active){b.className="notice error";b.innerHTML=`<strong>Você foi eliminado na era ${escapeHtml(P(s).eliminatedEra)}.</strong> A partida continua entre os rivais; você pode concluir as eras para ver o final.`}else{b.className="hidden";b.innerHTML=""}return}
 b.className="hidden";b.innerHTML="";
 const sm=resultSummary(s),max=Math.max(1,...sm.rows.map(x=>PTS(x.score)));
 if(scr.dataset.key!==String(r.era)+sm.title||scr.hidden){
 scr.dataset.key=String(r.era)+sm.title;
 scr.className="result-screen "+sm.tone;
 scr.innerHTML=`<div class="res-inner"><div class="res-emblem">${EMBLEM[sm.tone]}</div><div class="sum-kicker">Fim da partida · Era ${escapeHtml(sm.era)}</div><h2 class="res-title" id="resultTitle">${sm.title}</h2><p class="res-sub">${sm.sub}</p>
 <div class="sum-score res-score"><div class="sum-score-h"><span>Placar final</span><span>pontos</span></div>${sm.rows.map((x,i)=>`<div class="sum-row ${x.id==="player"?"me":""}"><span class="pos">${i+1}.º</span><span class="nm">${x.civ?civLabel(x.civ):escapeHtml(x.name||x.id)}</span><span class="bar"><i style="--w:${(100*PTS(x.score)/max).toFixed(1)}%;background:${cssColor(x.civ?.chartColor)}"></i></span><b>${fmt(PTS(x.score),0)}</b><span></span></div>`).join("")}</div>
 <div class="res-tiles">${sm.tiles.map(t=>`<div class="res-tile"><div class="v">${t.v}</div><div class="k">${t.k}</div></div>`).join("")}</div>
 ${resultMedalsHtml()}
 <div class="res-actions"><button type="button" id="newGameAfterEnd" class="primary res-again">Jogar de novo</button><div class="res-two"><button type="button" id="seeDetails" data-open="resultSheet" aria-haspopup="dialog">Ver detalhes</button><button type="button" id="resultHome">Início</button></div></div></div>`;
 // A partida acabou: fecha a folha que estiver aberta (placar, detalhes...) para a tela de resultado ficar à vista.
 if(scr.hidden&&isSheetOpen()&&!isSheetOpen("resultSheet"))closeSheet({focus:false});
 scr.hidden=false;
 $("newGameAfterEnd").onclick=startNewGame;$("resultHome").onclick=()=>$("returnHome").click();
 }
 if(isSheetOpen("resultSheet"))renderResultDetails();
}
// Folha "Ver detalhes": frase completa, quem liderou, estilos dos rivais, gráficos e tabela de pontos.
export function renderResultDetails(){
 const s=state,r=s.result,box=$("resultDetailsBody");if(!r||!box)return;
 const series=scoreSeries(),wIdx=r.type==="victory"?s.civs.findIndex(c=>c.id===r.winners[0]):-1,advEra=wIdx>=0?advantageEra(wIdx,series):null;
 const advTxt=wIdx>=0?(advEra>r.era?"":`${wIdx===0?"Você assumiu":escapeHtml(civName(s.civs[wIdx]))+" assumiu"} a liderança da pontuação na era ${advEra} e não a perdeu mais.`):"";
 const scoreTable=r.scores?`<div class="tablewrap" style="margin-top:8px"><table><thead><tr><th>Civilização</th><th>Pontuação</th><th>Força</th><th>Obras</th><th>Ciência</th><th>Ouro</th><th>Territórios</th></tr></thead><tbody>${[...r.scores].sort((a,b)=>b.score-a.score).map(x=>`<tr><td>${getCiv(s,x.id)?civLabel(getCiv(s,x.id)):escapeHtml(x.id)}</td><td><strong>${PTS(x.score)}</strong></td>${["military","infrastructure","technology","treasury","territories"].map(d=>`<td>${fmt(100*(x.parts[d]??0),0)}%</td>`).join("")}</tr>`).join("")}</tbody></table></div>`:"";
 const legend=s.civs.map(c=>`<span style="--c:${c.chartColor}">${civLabel(c)}</span>`).join("");
 box.innerHTML=`<p class="small">${escapeHtml(uiText(describeResult(s,r)))} <span class="pill">${DIFFICULTIES[s.difficulty]?.name||"Médio"}</span></p>${advTxt?`<p class="small muted">${advTxt}</p>`:""}<p class="small muted">Estilos dos rivais: ${aiCivs(s).map(c=>`${civSymHtml(c)} <strong>${escapeHtml(civName(c))}</strong> jogou como ${escapeHtml(profileLabel(c,true))}${c.hiddenProfile?" (sorteado)":""}`).join(" · ")}.</p>
 <h3>Pontuação ao longo da partida</h3>${advEra&&advEra<=r.era?`<div class="small muted">Linha tracejada: início da vantagem.</div>`:""}<canvas id="endScoreChart" class="chart" style="height:180px"></canvas><div class="chart-legend">${legend}</div>
 <h3>Territórios por era</h3><canvas id="endTerrChart" class="chart" style="height:180px"></canvas><div class="chart-legend">${legend}</div>${scoreTable}
 <div class="actions" style="margin-top:12px"><button type="button" id="changeSettingsAfterEnd">Mudar escolhas</button></div>`;
 svgLine($("endScoreChart"),s.civs.map((c,k)=>({color:c.chartColor,data:series.map((row,i)=>({x:i+1,y:PTS(row[k])}))})),{markX:advEra&&advEra<=r.era?advEra:null});
 svgLine($("endTerrChart"),s.civs.map((c,k)=>({color:c.chartColor,data:s.timeline.map(e=>({x:e.era,y:e.civs[k].territories}))})));
 $("changeSettingsAfterEnd").onclick=()=>{closeSheet({focus:false});window.openSetup&&window.openSetup(true)};
}
