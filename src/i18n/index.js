// Idiomas da interface do jogador (regras em docs/idiomas.md). Só exibição: nada aqui entra nas regras, nas IAs,
// no save da partida nem na impressão digital das simulações (src/core e src/ai não importam este módulo).
//   t(key, params)        texto traduzido; marcadores {n}, {name}...; plural por idioma; reserva em pt-BR.
//   formatNumber(n, d)    número no formato do idioma (pt-BR 1.234,5 · en 1,234.5 · de 1.234,5 · fr 1 234,5).
//   getLanguage() / setLanguage(code)   idioma atual / trocar (grava no aparelho, atualiza o HTML e avisa).
//   onLanguageChange(fn)  quem monta texto em JS refaz a tela quando o idioma muda (também o evento
//                         "imperios:language" em window).
//   applyI18n(root)       aplica data-i18n / data-i18n-html / data-i18n-attr ao HTML estático.
import {storage} from "../platform/storage.js";
import {DICT_PT_BR} from "./pt-BR.js";
import {DICT_EN} from "./en.js";
import {DICT_PT_PT} from "./pt-PT.js";
import {DICT_IT} from "./it.js";
import {DICT_DE} from "./de.js";
import {DICT_FR} from "./fr.js";

// Ordem = ordem no seletor. name: nome nativo (não se traduz); locale: formato dos números (Intl).
export const SUPPORTED_LANGUAGES=[
 {code:"pt-BR",name:"Português (Brasil)",locale:"pt-BR"},
 {code:"en",name:"English",locale:"en-US"},
 {code:"pt-PT",name:"Português (Portugal)",locale:"pt-PT"},
 {code:"it",name:"Italiano",locale:"it-IT"},
 {code:"de",name:"Deutsch",locale:"de-DE"},
 {code:"fr",name:"Français",locale:"fr-FR"},
];
// Idioma de origem e reserva: chave que falta num idioma usa o texto em pt-BR.
export const DEFAULT_LANGUAGE="pt-BR";
// Preferência do aparelho (não faz parte do save da partida; vale para a versão do jogador e a de desenvolvimento).
export const LANGUAGE_KEY="imperios-idioma";
export const DICTIONARIES={"pt-BR":DICT_PT_BR,en:DICT_EN,"pt-PT":DICT_PT_PT,it:DICT_IT,de:DICT_DE,fr:DICT_FR};

let current=DEFAULT_LANGUAGE;
// De onde veio o idioma atual: "url" (?lang=), "saved" (escolha gravada), "device" (aparelho), "session"
// (setLanguage sem gravar) ou "default".
export let languageSource="default";
// Chaves pedidas que não existem nem em pt-BR (para o tradutor encontrar textos esquecidos; não gera erro).
export const missingKeys=new Set();
const listeners=[];

// Converte uma etiqueta de idioma (navigator.languages, ?lang=) num código suportado, ou null.
// pt-PT → pt-PT; qualquer outro português (pt, pt-BR, pt-AO...) → pt-BR; en/it/de/fr pelas duas primeiras letras.
export function matchLanguage(tag){
 if(typeof tag!=="string")return null;
 const s=tag.trim().replace(/_/g,"-").toLowerCase();if(!s)return null;
 const base=s.split("-")[0];
 if(base==="pt")return s==="pt-pt"||s.startsWith("pt-pt-")?"pt-PT":"pt-BR";
 return ["en","it","de","fr"].includes(base)?base:null;
}
// Primeiro idioma da lista do aparelho que o jogo suporta; senão pt-BR.
export function detectLanguage(list){for(const tag of list||[]){const m=matchLanguage(tag);if(m)return m}return DEFAULT_LANGUAGE}
export const isSupportedLanguage=code=>Object.prototype.hasOwnProperty.call(DICTIONARIES,code);
export const getLanguage=()=>current;
export const languageInfo=(code=current)=>SUPPORTED_LANGUAGES.find(l=>l.code===code)||SUPPORTED_LANGUAGES[0];
export const numberLocale=(code=current)=>languageInfo(code).locale;

// Número no formato do idioma atual (no máximo `d` casas decimais, sem zeros à direita). Em pt-BR é igual ao de sempre.
export function formatNumber(n,d=1,code=current){return Number.isFinite(n)?n.toLocaleString(numberLocale(code),{maximumFractionDigits:d,minimumFractionDigits:0}):"—"}
// Categoria de plural do número no idioma ("one", "other"; o francês trata 0 e 1 como "one").
const pluralRules={};
export function pluralCategory(n,code=current){const pr=pluralRules[code]||(pluralRules[code]=new Intl.PluralRules(numberLocale(code)));return pr.select(Number(n))}

function lookup(key,code){const v=DICTIONARIES[code]?.[key];return v===undefined||v===null||v===""?undefined:v}
/* Texto da chave no idioma atual (ou em pt-BR, se faltar; ou a própria chave, se faltar também em pt-BR).
   params: {n: 3, name: "Rubro"} substitui {n} e {name}. Números são formatados no idioma (até 2 casas);
   passe um texto já formatado se precisar de outra forma.
   Plural: o valor no dicionário pode ser um objeto {one:"…", other:"…"} (e zero/two/few/many quando o idioma usar);
   a forma é escolhida por params.count ou, se não houver, params.n. "other" é sempre a forma de reserva. */
export function translate(key,params){
 let v=lookup(key,current),lang=current;
 if(v===undefined&&current!==DEFAULT_LANGUAGE){v=lookup(key,DEFAULT_LANGUAGE);lang=DEFAULT_LANGUAGE}
 if(v===undefined){missingKeys.add(key);return key}
 if(typeof v==="object"){
  const count=params?.count??params?.n;
  const cat=Number.isFinite(Number(count))?pluralCategory(count,lang):"other";
  v=v[cat]??v.other??Object.values(v)[0]??key;
 }
 return fill(String(v),params,lang);
}
// Nome curto usado em todo o código (const, não function: tests/structure.test.js procura funções reatribuídas
// e `t` é nome comum de variável local).
export const t=(key,params)=>translate(key,params);
function fill(s,params,lang){
 if(!params)return s;
 return s.replace(/\{(\w+)\}/g,(m,name)=>{
  if(!Object.prototype.hasOwnProperty.call(params,name))return m;
  const p=params[name];
  return typeof p==="number"?formatNumber(p,2,lang):String(p??"");
 });
}

/* HTML estático: <h1 data-i18n="app.title">IMPÉRIOS</h1> troca o texto; data-i18n-html troca o HTML (só textos
   dos dicionários, nunca dados do jogador); data-i18n-attr="aria-label:setup.back;title:setup.backHint" troca atributos.
   O texto escrito no HTML é o pt-BR (o jogo abre bem mesmo antes de o JS correr). */
export function applyI18n(root=typeof document!=="undefined"?document:null){
 if(!root?.querySelectorAll)return;
 const all=sel=>[...(root.matches?.(sel)?[root]:[]),...root.querySelectorAll(sel)];
 for(const el of all("[data-i18n]"))el.textContent=t(el.dataset.i18n);
 for(const el of all("[data-i18n-html]"))el.innerHTML=t(el.dataset.i18nHtml);
 for(const el of all("[data-i18n-attr]"))
  for(const pair of el.dataset.i18nAttr.split(";")){const [attr,key]=pair.split(":").map(s=>s.trim());if(attr&&key)el.setAttribute(attr,t(key))}
}
function applyDocument(){
 if(typeof document==="undefined")return;
 document.documentElement.lang=current;
 applyI18n(document);
 const title=lookup("app.tabTitle",current)??lookup("app.tabTitle",DEFAULT_LANGUAGE);if(title)document.title=title;
}

export function onLanguageChange(fn){listeners.push(fn);return ()=>{const i=listeners.indexOf(fn);if(i>=0)listeners.splice(i,1)}}
function emit(){
 for(const fn of [...listeners])fn(current);
 if(typeof window!=="undefined"&&typeof CustomEvent==="function")window.dispatchEvent(new CustomEvent("imperios:language",{detail:{language:current}}));
}

/* Troca o idioma da interface: atualiza <html lang>, o HTML estático e avisa quem desenha a tela (onLanguageChange).
   Grava a escolha no aparelho (persist:false só troca nesta sessão). Não mexe na partida: só a exibição muda.
   Devolve uma promessa: true se trocou e gravou, false se o código não é suportado ou a gravação falhou. */
export function setLanguage(code,{persist=true}={}){
 const lang=isSupportedLanguage(code)?code:matchLanguage(code);
 if(!lang)return Promise.resolve(false);
 const changed=lang!==current;current=lang;languageSource=persist?"saved":"session";
 applyDocument();if(changed)emit();
 if(!persist)return Promise.resolve(true);
 let w;try{w=storage.set(LANGUAGE_KEY,lang)}catch(e){w=Promise.reject(e)}
 return w.then(()=>true,()=>false);
}

/* Idioma no arranque (src/ui/boot.js), por prioridade:
   1. ?lang=xx no endereço (para testes e capturas; NÃO é gravado);
   2. a escolha gravada no aparelho (setLanguage);
   3. o idioma do aparelho (navigator.languages);
   4. pt-BR. */
export async function initLanguage({search=typeof location!=="undefined"?location.search:"",languages=typeof navigator!=="undefined"?(navigator.languages?.length?navigator.languages:[navigator.language]):[]}={}){
 let lang=null,src="default";
 const q=matchLanguage(new URLSearchParams(search||"").get("lang"));
 if(q){lang=q;src="url"}
 if(!lang){let saved=null;try{saved=await storage.get(LANGUAGE_KEY)}catch(e){saved=null}if(isSupportedLanguage(saved)){lang=saved;src="saved"}}
 if(!lang){const d=detectLanguage(languages);if(d!==DEFAULT_LANGUAGE||(languages||[]).some(l=>matchLanguage(l)))src="device";lang=d}
 current=lang;languageSource=src;
 applyDocument();
 return current;
}
