// Formatação para o jogador (pt-BR: 1.234,5 · "de ouro"), texto seguro em HTML e conversão dos textos do motor.
import {regionName} from "../core/names.js";
import {formatNumber,getLanguage,ordinal,t} from "../i18n/index.js";

// Texto vindo do estado salvo ou de ficheiros importados (nomes, registo, cenários) entra no HTML sempre escapado.
export const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[ch]);
// Cores usadas em style=: só "#rgb"/"#rrggbb"/"#rrggbbaa"; qualquer outra coisa vira cinzento.
export const cssColor=c=>typeof c==="string"&&/^#[0-9a-fA-F]{3,8}$/.test(c)?c:"#888888";
// Números do jogador no formato do idioma escolhido (src/i18n): pt-BR 1.234,5 (igual ao de sempre), en 1,234.5...
export const fmt=(n,d=1)=>formatNumber(n,d);
// Ouro: "142,5 de ouro" em frases; "142,5 🪙" onde o espaço é curto (cartões, barra de baixo).
export const money=n=>t("format.gold",{n:fmt(n,2)});
export const goldShort=n=>t("format.goldShort",{n:fmt(n,2)});
// Laboratórios e ferramentas (?dev=1) não se traduzem: ficam sempre em pt-BR, qualquer que seja o idioma do jogador.
export const fmtBR=(n,d=1)=>formatNumber(n,d,"pt-BR");
export const moneyBR=n=>fmtBR(n,2)+" de ouro";
// Exibição (pt-BR) dos textos guardados pelo motor (registo de eventos, motivos de recusa, resultado):
// o texto guardado não muda — só a forma como aparece ao jogador. Números passam a 1.234,5;
// "u." vira ouro, "pontos"/"poder" militar vira Força, infraestrutura → obras, tecnologia → ciência.
export const UI_TEXT_RULES=[
 [/(\d)[   ](?=\d{3}(?!\d))/g,"$1."],
 [/\b(\d)(\d{3})(?=(?:,\d+)?\s(?:u\.|pontos))/g,"$1.$2"],
 [/Poder insuficiente: precisa de ([\d.,]+) pontos/g,"Força insuficiente: você precisa de $1 de Força"],
 [/([\d.,]+) u\. de tesouro/g,"$1 de ouro"],
 [/([\d.,]+) u\. de infraestrutura/g,"$1 de ouro em Obras"],
 [/([\d.,]+) de progresso tecnológico/g,"$1 de Ciência"],
 [/([\d.,]+) u\./g,"$1 de ouro"],
 [/([\d.,]+) pontos comprometidos/g,"$1 de Força gastos"],
 [/perdeu ([\d.,]+) pontos/g,"perdeu $1 de Força"],
 [/\(força ([\d.,]+) × ([\d.,]+)\)/g,"(Força $1 × $2)"],
 [/já não é possível atacar/g,"não é mais possível atacar"],
 [/poder devolvido/g,"Força devolvida"],
 [/acumulando poder militar/g,"acumulando Força"],
 [/Alvo não é adjacente ou já pertence ao atacante\./g,"Esse território não faz fronteira com o seu ou já é seu."],
 [/\(de Jogador\)/g,"(seu)"],[/\(neutro\)/g,"(livre)"],
 [/vitória de Jogador por/g,"você venceu por"],[/\bJogador\b/g,"você"],
 [/Ordem de Você contra/g,"Sua ordem contra"],[/venceu Você/g,"venceu você"],[/pontuação final por recursos/g,"pontuação final"],
 [/eliminação dos adversários/g,"eliminação dos rivais"],
 // "território 9" → nome da região (Ivara). Os rivais têm nomes masculinos (o Rubro, o Ocre...).
 [/\bpelo território (\d+)/g,(m,n)=>"por "+regionName(n-1)],
 [/\b(ao|o) território (\d+)/g,(m,p,n)=>(p==="ao"?"a ":"")+regionName(n-1)],
 [/\b[Tt]erritório (\d+)/g,(m,n)=>regionName(n-1)],
 [/e foi eliminada\./g,"e foi eliminado."]
];
export const uiText=t=>UI_TEXT_RULES.reduce((s,[re,to])=>s.replace(re,to),String(t??""));
// Campos de investimento: mostram o separador decimal do idioma (vírgula em pt-BR, pt-PT, it, de e fr; ponto em en)
// e aceitam as duas formas e o separador de milhar ("12,5", "12.5", "1.250" em pt-BR; "12.5", "1,250" em en).
// Sem separador de milhar no valor mostrado (o campo é curto). lang: idioma (padrão: o atual).
export const decimalSeparator=(lang=getLanguage())=>lang==="en"?".":",";
export const fmtInput=(v,lang=getLanguage())=>String(Math.round(v*100)/100).replace(".",decimalSeparator(lang));
export function parseAmount(raw,lang=getLanguage()){
 let t=String(raw??"").trim().replace(/\s/g,"");
 if(decimalSeparator(lang)==="."){
  // Inglês: ponto decimal, vírgula de milhar ("1,250.75"); só vírgula: milhar se tiver grupos de 3 ("1,250"), senão decimal ("12,5").
  if(t.includes("."))t=t.replace(/,/g,"");else if(/^\d{1,3}(,\d{3})+$/.test(t))t=t.replace(/,/g,"");else t=t.replace(",",".");
 }
 else if(t.includes(","))t=t.replace(/\./g,"").replace(",",".");else if(/^\d{1,3}(\.\d{3})+$/.test(t))t=t.replace(/\./g,"");
 const v=Number(t);return Number.isFinite(v)?v:0;
}
// Ordinal no idioma: "1.º" (pt), "1st" (en), "1º" (it), "1." (de), "1er" (fr). fem: feminino do português ("1.ª").
export const ord=(n,fem=false)=>ordinal(n,fem?"format.ordinalF":"format.ordinal");
