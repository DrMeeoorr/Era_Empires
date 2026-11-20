// Janelas (avisos, confirmações, relatório da era).
import {$} from "./dom.js";

const FOCUSABLE_IN='button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
let modalSeq=0;
/* Janela modal. Acessível: role="dialog" + aria-modal, nome pelo título (opts.label ou o primeiro <h2>), foco no
   primeiro botão, Tab preso dentro da janela e, ao fechar, o foco volta para quem estava com ele (ou opts.returnFocus).
   opts.cls: classe extra (ex.: "modal-invite", "modal-atlas"); opts.label: nome acessível;
   opts.esc: índice do botão acionado pela tecla Esc (sem ele, Esc não faz nada: ex. o relatório da era trata o seu). */
export function showModal(html,buttons,opts={}){
 const root=$("modalRoot"),prevFocus=opts.returnFocus||(root.firstChild?null:document.activeElement),id="mdl"+(++modalSeq);
 root.innerHTML=`<div class="modal-back${opts.cls?" "+opts.cls:""}" role="dialog" aria-modal="true"${opts.label?` aria-label="${opts.label}"`:""}><div class="modal">${html}<div class="actions" style="margin-top:14px">${buttons.map((b,i)=>`<button type="button" data-mb="${i}" class="${b.cls||""}">${b.label}</button>`).join("")}</div></div></div>`;
 const back=root.firstChild;back.dataset.modalId=id;
 if(!opts.label){const h=back.querySelector("h2");if(h){if(!h.id)h.id=id+"t";back.setAttribute("aria-labelledby",h.id)}}
 const p=back.querySelector(".dlg-text");if(p){if(!p.id)p.id=id+"d";back.setAttribute("aria-describedby",p.id)}
 const close=()=>{if(root.firstChild!==back)return;root.innerHTML="";
  const r=typeof prevFocus==="function"?prevFocus():prevFocus;
  if(r&&r.isConnected&&r.offsetParent!==null&&!r.closest("[inert]"))r.focus({preventScroll:true})};
 buttons.forEach((b,i)=>back.querySelector(`[data-mb="${i}"]`).onclick=()=>{const keep=b.onClick?.();if(keep!==true)close()});
 back.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&Number.isInteger(opts.esc)&&!e.defaultPrevented){e.preventDefault();back.querySelector(`[data-mb="${opts.esc}"]`)?.click();return}
  if(e.key!=="Tab")return;
  const f=[...back.querySelectorAll(FOCUSABLE_IN)].filter(x=>x.offsetParent!==null);if(!f.length)return;
  const first=f[0],last=f.at(-1),a=document.activeElement;
  if(e.shiftKey&&(a===first||!back.contains(a))){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&(a===last||!back.contains(a))){e.preventDefault();first.focus()}
 });
 back.querySelector('[data-mb="0"]').focus();
}
/* Janela no estilo "Atlas" (folha embaixo, como o convite do tutorial): ícone num medalhão, título com a fonte dos
   títulos, texto curto e botões grandes empilhados (o principal em cima, à mão do polegar).
   tone: "gold" (padrão), "danger" ou "info"; icon: símbolo do sprite (#i-…); body: HTML extra (ex.: caixa de seleção).
   Botões: {label, kind:"primary"|"danger"|"secondary", onClick}. A ordem no HTML é a da lista (o foco começa no
   primeiro: ponha "Cancelar" primeiro nas confirmações que apagam algo); o principal aparece em cima. */
export function showDialog({icon="flag",tone="gold",title,text="",body="",buttons,esc,returnFocus}){
 const cls={primary:"primary btn-main",danger:"danger btn-danger",secondary:"btn-line"};
 showModal(`<div class="grip" aria-hidden="true"></div><div class="dlg-ic tone-${tone}" aria-hidden="true"><svg class="ic"><use href="#i-${icon}"/></svg></div><h2>${title}</h2>${text?`<p class="dlg-text">${text}</p>`:""}${body}`,
  buttons.map(b=>({label:b.label,cls:cls[b.kind||"secondary"],onClick:b.onClick})),{cls:"modal-atlas",esc,returnFocus});
}
