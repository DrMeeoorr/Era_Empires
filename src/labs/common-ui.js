// Peças comuns das telas dos laboratórios (opções de simulação, escolha de perfis).
import {LAB_PROFILES} from "../ai/profiles.js";
import {MAX_AI} from "../core/config.js";
import {safeNum} from "../core/util.js";
import {$} from "../ui/dom.js";

export function readSimOpts(prefix){
 const num=(id,min,max)=>{const v=safeNum($(prefix+id).value,min,max);if(!Number.isInteger(v))throw Error("Use números inteiros nas configurações da simulação.");return v};
 const profiles=[...document.querySelectorAll(`#${prefix}Profiles input:checked`)].map(x=>x.value);if(!profiles.length)throw Error("Selecione pelo menos um perfil.");
 return {kind:$(prefix+"Kind").value==="fixed"?"fixed":"auto",games:num("Games",1,5000),eras:num("Eras",1,300),civCount:num("Civs",2,1+MAX_AI),baseSeed:num("Seed",0,4294967295),mode:["fast","both"].includes($(prefix+"Mode").value)?$(prefix+"Mode").value:"slow",profiles};
}
export function profileChecks(containerId){$(containerId).innerHTML=LAB_PROFILES.map(([v,n])=>`<label><input type="checkbox" value="${v}" checked> ${n}</label>`).join("")}
