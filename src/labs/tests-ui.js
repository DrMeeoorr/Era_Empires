// Aba "Testes funcionais": correr os testes internos e mostrar os resultados (runTests).
import {executeTests,testRegistry,ftHistory,TEST_CATS,ftResults,ftLastRun} from "./tests-def.js";
import {csvDownload} from "../platform/files.js";
import {$} from "../ui/dom.js";
import {fmtBR as fmt} from "../ui/format.js";

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
// Únicas formas de outros módulos substituírem estas variáveis (um módulo não pode reatribuir o que importa).
export function setFtLabReady(v){ftLabReady=v;return v}
