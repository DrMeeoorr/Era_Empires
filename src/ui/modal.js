// Janela modal simples (avisos, confirmações, relatório da era).
import {$} from "./dom.js";

export function showModal(html,buttons){
 $("modalRoot").innerHTML=`<div class="modal-back" role="dialog" aria-modal="true"><div class="modal">${html}<div class="actions" style="margin-top:14px">${buttons.map((b,i)=>`<button data-mb="${i}" class="${b.cls||""}">${b.label}</button>`).join("")}</div></div></div>`;
 buttons.forEach((b,i)=>$("modalRoot").querySelector(`[data-mb="${i}"]`).onclick=()=>{const keep=b.onClick?.();if(keep!==true)$("modalRoot").innerHTML=""});
 $("modalRoot").querySelector('[data-mb="0"]').focus();
}
