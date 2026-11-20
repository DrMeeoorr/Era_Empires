// Janela modal simples (avisos, confirmações, relatório da era).
import {$} from "./dom.js";

// opts.cls: classe extra da janela (ex.: "modal-invite", a folha do convite do tutorial); opts.label: nome acessível.
export function showModal(html,buttons,opts={}){
 $("modalRoot").innerHTML=`<div class="modal-back${opts.cls?" "+opts.cls:""}" role="dialog" aria-modal="true"${opts.label?` aria-label="${opts.label}"`:""}><div class="modal">${html}<div class="actions" style="margin-top:14px">${buttons.map((b,i)=>`<button data-mb="${i}" class="${b.cls||""}">${b.label}</button>`).join("")}</div></div></div>`;
 buttons.forEach((b,i)=>$("modalRoot").querySelector(`[data-mb="${i}"]`).onclick=()=>{const keep=b.onClick?.();if(keep!==true)$("modalRoot").innerHTML=""});
 $("modalRoot").querySelector('[data-mb="0"]').focus();
}
