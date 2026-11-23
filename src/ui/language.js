// Seletor de idioma (só exibição: a partida, o save e as regras não mudam). Uma folha inferior (#languageSheet) com os
// 6 idiomas pelo nome nativo, aberta pelo botão 🌐 da tela inicial (#homeLang) e pelo item "Idioma" do menu ☰
// (#menuLanguage). Cada idioma é um radio (role="radio" + aria-checked); o atual tem o círculo cheio com ✓ e a borda
// dourada (não só a cor). Tocar num idioma troca na hora (setLanguage grava a escolha e redesenha as telas) e fecha
// a folha; Esc, ✕, toque fora e o botão voltar do Android fecham sem trocar (sheets.js). Setas ↑/↓ (e Home/End)
// movem o foco entre os idiomas; Enter/Espaço escolhem.
import {SUPPORTED_LANGUAGES,getLanguage,setLanguage,onLanguageChange,languageInfo,t} from "../i18n/index.js";
import {$} from "./dom.js";
import {SHEET_HOOKS,closeSheet,isSheetOpen} from "./sheets.js";

// Código curto mostrado no botão da tela inicial (PT-BR, EN, PT-PT, IT, DE, FR).
export const shortCode=code=>String(code).toUpperCase();

function renderList(){
 const list=$("languageList");if(!list)return;const cur=getLanguage();
 list.innerHTML=SUPPORTED_LANGUAGES.map(l=>{const on=l.code===cur;
  return `<button type="button" class="lang-opt${on?" on":""}" role="radio" aria-checked="${on}" data-lang="${l.code}" lang="${l.code}"><span class="lang-radio" aria-hidden="true"><svg class="ic"><use href="#i-check"/></svg></span><span class="lang-name">${l.name}</span><span class="lang-code" aria-hidden="true">${shortCode(l.code)}</span></button>`}).join("");
}
// Botão da tela inicial e item do menu: idioma atual (nome nativo, com lang= para a leitura em voz alta).
function renderEntry(){
 const info=languageInfo(getLanguage());
 const hb=$("homeLang");if(hb){hb.setAttribute("aria-label",t("settings.languageAria",{name:info.name}));const c=$("homeLangCode");if(c)c.textContent=shortCode(info.code)}
 const mn=$("menuLanguageName");if(mn){mn.textContent=info.name;mn.lang=info.code}
}
async function choose(code){
 if(code!==getLanguage())await setLanguage(code);
 if(isSheetOpen("languageSheet"))closeSheet();
}
export function initLanguagePicker(){
 const sheet=$("languageSheet"),list=$("languageList");if(!sheet||!list)return;
 // Ao abrir: lista atualizada e foco no idioma atual (depois de openSheet focar a folha).
 SHEET_HOOKS.languageSheet={onOpen:()=>{renderList();requestAnimationFrame(()=>list.querySelector('[aria-checked="true"]')?.focus({preventScroll:true}))}};
 list.addEventListener("click",e=>{const b=e.target.closest("[data-lang]");if(b)choose(b.dataset.lang)});
 list.addEventListener("keydown",e=>{
  const opts=[...list.querySelectorAll("[data-lang]")],i=opts.indexOf(document.activeElement);if(i<0)return;
  const j={ArrowDown:i+1,ArrowRight:i+1,ArrowUp:i-1,ArrowLeft:i-1,Home:0,End:opts.length-1}[e.key];
  if(j===undefined)return;e.preventDefault();opts[(j+opts.length)%opts.length].focus();
 });
 onLanguageChange(()=>{renderEntry();if(isSheetOpen("languageSheet"))renderList()});
 renderEntry();renderList();
}
