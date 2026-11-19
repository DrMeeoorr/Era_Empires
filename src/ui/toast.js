// Aviso rápido no topo da tela.
import {$} from "./dom.js";

// Aviso rápido no topo (ordem dada, ataque cancelado...): some sozinho ou com um toque.
export let toastTimer=null;
export function showToast(html,bad=false){
 let t=$("toast");if(!t){t=document.createElement("div");t.id="toast";t.className="toast";t.setAttribute("role","status");t.setAttribute("aria-live","polite");t.hidden=true;t.onclick=()=>{t.hidden=true};document.body.appendChild(t)}
 t.innerHTML=`<span>${html}</span>`;t.classList.toggle("bad",bad);t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{t.hidden=true},3500);
}
// Únicas formas de outros módulos substituírem estas variáveis (um módulo não pode reatribuir o que importa).
export function setToastTimer(v){toastTimer=v;return v}
