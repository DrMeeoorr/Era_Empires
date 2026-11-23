// Nomes no ecrã: estilo dos rivais (Equilibrado, Militar…), símbolo na cor do mapa e rótulo das civilizações.
// Também a tradução, só na exibição, dos textos que o motor guarda em português (registo de eventos, motivos de
// recusa, resultado): o texto guardado não muda (save e impressão digital iguais em todos os idiomas).
import {LAB_PROFILE_NAME} from "../ai/profiles.js";
import {state,profileOf} from "../app/session.js";
import {END_REASON_NAMES} from "../core/endgame.js";
import {civSym,civName,regionName,RIVAL_NAMES} from "../core/names.js";
import {getLanguage,t} from "../i18n/index.js";
import {cssColor,escapeHtml,fmt,ord,uiText} from "./format.js";

// Nomes de estilo mostrados ao jogador (os laboratórios continuam a usar LAB_PROFILE_NAME). Chaves do dicionário: style.*.
export const PLAYER_PROFILES=["reference","military","aggressive","technologist","economist","adaptive"];
export const playerProfileName=p=>PLAYER_PROFILES.includes(p)?t("style."+p):LAB_PROFILE_NAME[p]||p;
// Nomes de estilo em pt-BR (como estavam; para quem precisa do texto de origem).
export const PLAYER_PROFILE_NAME={reference:"Equilibrado",military:"Militar",aggressive:"Agressivo",technologist:"Científico",economist:"Construtor",adaptive:"Adaptativo"};
export function profileLabel(c,reveal=false){if(c.id==="player")return "";if(c.hiddenProfile&&!reveal&&!state.result)return t("style.hidden");return playerProfileName(profileOf(c))}
// Nome mostrado de uma civilização: "Você" e as cores dos rivais traduzidas (no save fica o nome pt-BR, ex.: "Rubro").
const RIVAL_KEY=Object.fromEntries(RIVAL_NAMES.map(n=>[n,"rival."+n.toLowerCase()]));
export const rivalDisplayName=name=>RIVAL_KEY[name]?t(RIVAL_KEY[name]):String(name??"");
export const civDisplayName=c=>!c?"":c.id==="player"?t("civ.you"):rivalDisplayName(civName(c));
// Nome do jogador/rival com o símbolo (★ ▲ ● ◆ ■ ✚) na cor do mapa: não depende só da cor.
export const civSymHtml=c=>`<span class="csym" style="color:${cssColor(c.color)}" aria-hidden="true">${civSym(c)}</span>`;
export const civLabel=c=>`${civSymHtml(c)} ${escapeHtml(civDisplayName(c))}`;
// Nome da dificuldade mostrado ao jogador (chave interna: muitofacil, facil, medio, dificil, hardcore, config).
export const DIFF_KEYS=["muitofacil","facil","medio","dificil","hardcore","config"];
export const diffName=k=>DIFF_KEYS.includes(k)?t("diff."+k):"";
export const diffDesc=k=>DIFF_KEYS.includes(k)?t("diff."+k+".desc"):"";

/* ── Textos do motor na exibição ──
   pt-BR: uiText() (como sempre). Outros idiomas: cada frase conhecida do motor vira uma chave log.* / refuse.* /
   result.* com os nomes e números convertidos; frase desconhecida fica como em pt-BR (uiText). */
const NUM="([\\d\\s.,\\u00a0\\u202f]+)";
const num=s=>Number(String(s).replace(/[\s  ]/g,"").replace(",","."));
const isYou=n=>n==="Jogador"||n==="Você"||n==="Seu";
// Nome guardado no texto do motor ("Rubro", "IA 2", "Jogador") → nome mostrado.
function engineCiv(name,{obj=false}={}){
 if(isYou(name))return obj?t("civ.youObj"):t("civ.you");
 const c=state?.civs?.find(x=>x.name===name);
 return c?civDisplayName(c):rivalDisplayName(name);
}
const reg=n=>regionName(Number(n)-1);
const REASON_BY_TEXT=Object.fromEntries(Object.entries(END_REASON_NAMES).map(([k,v])=>[v,k]));
export const reasonName=k=>t("reason."+k);
function reasonsText(txt){const parts=txt.split(" + ").map(x=>REASON_BY_TEXT[x]);return parts.every(Boolean)?parts.map(reasonName).join(" + "):null}
function lootText(g,i,tc){if(g==null)return "";return tc!=null?t("log.lootSci",{gold:fmt(num(g),1),works:fmt(num(i),1),science:fmt(num(tc),1)}):t("log.loot",{gold:fmt(num(g),1),works:fmt(num(i),1)})}
function ownerText(o,name){return o==="neutro"?t("log.ownerFree"):isYou(name)?t("log.ownerYou"):t("log.ownerCiv",{civ:engineCiv(name)})}
const LOOT=`(?: — saque: ${NUM} u\\. de tesouro, ${NUM} u\\. de infraestrutura(?:, ${NUM} de progresso tecnológico)?)?`;
const ENGINE_RULES=[
 [new RegExp(`^✅ Ataque bem-sucedido: território (\\d+) \\((neutro|de (.+?))\\)${LOOT}\\.$`),m=>t("log.attackWon",{region:reg(m[1]),owner:ownerText(m[2],m[3]),loot:lootText(m[4],m[5],m[6])})],
 [new RegExp(`^⚔️ (.+?) conquistou: território (\\d+) \\((neutro|de (.+?))\\)${LOOT}\\.$`),m=>t("log.conquered",{civ:engineCiv(m[1]),region:reg(m[2]),owner:ownerText(m[3],m[4]),loot:lootText(m[5],m[6],m[7])})],
 [new RegExp(`^❌ Ataque malsucedido: território (\\d+); ${NUM} pontos comprometidos\\.$`),m=>t("log.attackFailed",{region:reg(m[1]),n:fmt(num(m[2]),1)})],
 [new RegExp(`^🛡️ Ataque de (.+?) repelido: território (\\d+); ${NUM} pontos comprometidos\\.$`),m=>t("log.repelled",{civ:engineCiv(m[1]),region:reg(m[2]),n:fmt(num(m[3]),1)})],
 [/^↩️ Ordem de (.+?) contra o território (\d+) cancelada \(já não é possível atacar\); poder devolvido\.$/,m=>isYou(m[1])?t("log.cancelNoTargetYou",{region:reg(m[2])}):t("log.cancelNoTarget",{civ:engineCiv(m[1]),region:reg(m[2])})],
 [new RegExp(`^↩️ Ordem de (.+?) contra o território (\\d+) cancelada: o alvo mudou de dono e a defesa subiu para ${NUM}; poder devolvido\\.$`),m=>isYou(m[1])?t("log.cancelDefenseYou",{region:reg(m[2]),n:fmt(num(m[3]),1)}):t("log.cancelDefense",{civ:engineCiv(m[1]),region:reg(m[2]),n:fmt(num(m[3]),1)})],
 [new RegExp(`^⚔️ Batalha pelo território (\\d+): (.+?) venceu (.+?) \\(força ${NUM} × ${NUM}\\); (.+?) perdeu ${NUM} pontos\\.$`),m=>t("log.battle",{region:reg(m[1]),winner:engineCiv(m[2]),loser:engineCiv(m[3],{obj:true}),a:fmt(num(m[4]),0),b:fmt(num(m[5]),0),n:fmt(num(m[7]),1)})],
 [/^☠️ (.+?) perdeu o último território e foi eliminada\.$/,m=>t("log.eliminated",{civ:engineCiv(m[1])})],
 [/^👑 Domínio do mapa: Jogador decidiu continuar até a era (\d+)\.$/,m=>t("log.dominionContinue",{era:m[1]})],
 [/^🏁 (.*)$/,m=>{const r=resultText(m[1]);return r==null?null:t("log.result",{text:r})}],
 [/^Civilização inexistente ou inativa\.$/,()=>t("refuse.inactive")],
 [/^Alvo não é adjacente ou já pertence ao atacante\.$/,()=>t("refuse.notAdjacent")],
 [new RegExp(`^Poder insuficiente: precisa de ${NUM} pontos\\.$`),m=>t("refuse.force",{n:fmt(num(m[1]),1)})],
 [new RegExp(`^Poder insuficiente: precisa de ${NUM} pontos \\((\\d+)\\.º ataque da era, custo ×${NUM}\\)\\.$`),m=>t("refuse.forceNth",{n:fmt(num(m[1]),1),k:ord(Number(m[2])),m:fmt(num(m[3]),1)})],
 [/^Já há uma ordem para este território\.$/,()=>t("refuse.hasOrder")],
 [/^Máximo de (\d+) ordens por era\.$/,m=>t("refuse.maxOrders",{n:m[1],count:Number(m[1])})],
];
// Frase do resultado (describeResult do motor) → idioma atual; null se não reconhecer.
function resultText(txt){
 let m=/^Era (\d+): empate geral — todas as civilizações foram eliminadas\.$/.exec(txt);if(m)return t("result.allEliminated",{era:m[1]});
 m=/^Era (\d+): vitória de (.+?) por (.+?)( \(mantida até a última era\))?\.$/.exec(txt);
 if(m){const why=reasonsText(m[3]);if(why==null)return null;const kept=m[4]?t("result.kept"):"";return isYou(m[2])?t("result.victoryYou",{era:m[1],why,kept}):t("result.victory",{era:m[1],civ:engineCiv(m[2]),why,kept})}
 m=/^Era (\d+): empate entre (.+)\.$/.exec(txt);
 if(m){const items=m[2].split(/, (?=[^()]+ \()/).map(x=>/^(.+?) \((.+)\)$/.exec(x));if(items.some(x=>!x))return null;
  const list=items.map(x=>{const why=reasonsText(x[2]);return why==null?null:t("result.drawItem",{civ:engineCiv(x[1],{obj:true}),why})});if(list.some(x=>x==null))return null;
  return t("result.draw",{era:m[1],list:list.join(", ")})}
 return null;
}
// Texto do motor (registo, motivo de recusa, resultado) como o jogador o vê no idioma atual.
export function engineText(raw){
 const s=String(raw??"");if(getLanguage()==="pt-BR")return uiText(s);
 for(const [re,fn] of ENGINE_RULES){const m=re.exec(s);if(m){const out=fn(m);if(out!=null)return out}}
 return uiText(s);
}
// Frase do resultado de uma partida (state.result), no idioma atual. pt-BR: a frase do motor convertida (uiText).
export function resultSentence(s,r,describe){
 if(getLanguage()==="pt-BR")return uiText(describe(s,r));
 return resultText(describe(s,r))??uiText(describe(s,r));
}
