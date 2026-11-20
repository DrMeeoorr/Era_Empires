// Desenhos dos terrenos (SVG feito à mão, sem imagens externas): cor de base, textura fina, desenhos espalhados
// (longe do nome da região) e ícone pequeno para a legenda, a folha da região e o Como jogar.
// Cada terreno tem uma forma própria, para não depender só da cor (daltonismo).
import {TERRAINS,TERRAIN_NAMES,TERRAIN_EFFECT_TEXT} from "../core/terrain.js";

// base: fundo (contraste ≥ 5,9:1 com o nome branco); ink/acc: cores do desenho.
export const TERRAIN_STYLE={
 campina:{base:"#3b5a2c",ink:"#86b86a",acc:"#e9d37c"},
 floresta:{base:"#1d3f2b",ink:"#4f9a64",acc:"#3a2a1a"},
 colinas:{base:"#6e3a2e",ink:"#d98c62",acc:"#f3c4a2"},
 montanha:{base:"#4a4e5c",ink:"#9aa1b4",acc:"#f2f6fb"},
 deserto:{base:"#7a5a26",ink:"#d9b26a",acc:"#f0d9a0"},
 pantano:{base:"#2c4446",ink:"#9aa95e",acc:"#7fb6c4"},
 tundra:{base:"#4c5f75",ink:"#dfeaf6",acc:"#a9c3dc"}};
const shade=(hex,t)=>"#"+[1,3,5].map(i=>Math.round(parseInt(hex.substr(i,2),16)*(1-t)).toString(16).padStart(2,"0")).join("");
// Desenho principal (centro 0,0; cerca de 24×16 unidades). alt: variação (capim com flor, pinheiro só, cacto, monte de neve).
export function terrainGlyph(k,ink,acc,alt=false){
 switch(k){
 case "campina":return alt?`<path d="M-8 5q1-6-2-9M-4 5q0-7 2-11M0 5q1-5 4-8" fill="none" stroke="${ink}" stroke-width="1.7" stroke-linecap="round"/><circle cx="7" cy="-1" r="1.8" fill="${acc}"/><circle cx="7" cy="4.5" r="1.2" fill="${acc}"/>`:`<path d="M-6 5q1-6-2-9M-2 5q0-7 2-11M2 5q1-5 4-8M6 5q0-4 3-6" fill="none" stroke="${ink}" stroke-width="1.7" stroke-linecap="round"/>`;
 case "floresta":return `<path d="M-5 -10l5.5 8h-3l4 6.5h-13l4-6.5h-3z" fill="${ink}"/><rect x="-6" y="4.5" width="2" height="3" fill="${acc}"/>`+(alt?"":`<path d="M6 -5l4.5 6.5h-2.5l3 5h-10l3-5h-2.5z" fill="${shade(ink,.18)}"/><rect x="5" y="6.5" width="2" height="2" fill="${acc}"/>`);
 case "colinas":return `<path d="M-1 7C1-3 11-3 13 7z" fill="${shade(ink,.3)}"/><path d="M-13 7C-11-4 3-4 5 7z" fill="${ink}"/><path d="M-8.5 .5q3.5-3.2 7 0" fill="none" stroke="${acc}" stroke-width="1.3" stroke-linecap="round"/>`;
 case "montanha":return `<path d="M-12 7l9-15 5 7 3-4 7 12z" fill="${ink}"/><path d="M-3 -8l-3.6 6 2.2-1 1.6 2 2-3.2z" fill="${acc}"/><path d="M5 -4l-1.6 2.6 1.6-.6 1.4 1z" fill="${acc}"/>`;
 case "deserto":return alt?`<path d="M-1 8v-12a2 2 0 0 1 4 0v12z" fill="${ink}"/><path d="M-1 1h-3a2 2 0 0 1-2-2v-3h2v3h3M3 -1h3v-3h2v3a2 2 0 0 1-2 2h-3" fill="${ink}"/>`:`<path d="M-12 6q6-11 13-8q6 3 11 8z" fill="${ink}"/><path d="M1 -2q2 4 1 8" fill="none" stroke="${acc}" stroke-width="1.2" stroke-linecap="round"/>`;
 case "pantano":return `<path d="M-5 6v-10M0 6v-13M5 6v-9" stroke="${ink}" stroke-width="1.5" stroke-linecap="round"/><rect x="-6.3" y="-6" width="2.6" height="5" rx="1.3" fill="#7a5530"/><rect x="-1.3" y="-9" width="2.6" height="5" rx="1.3" fill="#7a5530"/><path d="M-11 7.5h7M2 7.5h9M-6 10.5h8" stroke="${acc}" stroke-width="1.4" stroke-linecap="round"/>`;
 case "tundra":return alt?`<path d="M-11 6q3-6 9-5q4-4 9 0q4 0 4 5z" fill="${ink}"/>`:`<g stroke="${ink}" stroke-width="1.6" stroke-linecap="round"><path d="M0-7v14M-6-3.5l12 7M-6 3.5l12-7"/><path d="M-2-6l2 2 2-2M-2 6l2-2 2 2" fill="none"/></g>`;
 }
 return "";
}
// Textura fina (padrão SVG) com a cor de base: riscos, pontos ou ondas, conforme o terreno.
export function terrainTexture(k,id,op=.42){
 const {base,ink}=TERRAIN_STYLE[k];
 const P=(w,h,body)=>`<pattern id="${id}" patternUnits="userSpaceOnUse" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${base}"/><g opacity="${op}">${body}</g></pattern>`;
 switch(k){
 case "campina":return P(14,12,`<path d="M3 9l1-3M5 9l0-3.5M10 4l1-3M12 4l0-3.5" stroke="${ink}" stroke-width="1" stroke-linecap="round"/>`);
 case "floresta":return P(12,12,`<circle cx="3" cy="3" r="2" fill="${ink}"/><circle cx="9" cy="9" r="2" fill="${ink}"/>`);
 case "colinas":return P(18,12,`<path d="M1 10q4-6 8 0M10 4q3-4 6 0" fill="none" stroke="${ink}" stroke-width="1"/>`);
 case "montanha":return P(14,14,`<path d="M0 12l4-6 3 3 3-5 4 8" fill="none" stroke="${ink}" stroke-width="1"/>`);
 case "deserto":return P(18,9,`<path d="M0 6q4.5-4 9 0t9 0" fill="none" stroke="${ink}" stroke-width="1"/>`);
 case "pantano":return P(16,10,`<path d="M2 4h6M10 9h5" stroke="${ink}" stroke-width="1.2" stroke-linecap="round"/>`);
 case "tundra":return P(14,14,`<circle cx="3" cy="4" r="1.1" fill="${ink}"/><circle cx="10" cy="11" r="1.1" fill="${ink}"/><path d="M9 3l2 2" stroke="${ink}" stroke-width=".8"/>`);
 }
 return "";
}
// Ícone pequeno (16–20 px): quadrado arredondado com a cor de base e o desenho principal. Decorativo
// (aria-hidden): o nome do terreno aparece sempre ao lado em texto.
export function terrainIcon(k,px=20){
 const t=TERRAIN_STYLE[k];if(!t)return "";
 const ink=k==="floresta"?"#6fc287":t.ink,acc=k==="floresta"?"#c9a27a":t.acc;
 return `<svg class="ter-ico" width="${px}" height="${px}" viewBox="-12 -12 24 24" aria-hidden="true" focusable="false"><rect x="-12" y="-12" width="24" height="24" rx="5" fill="${t.base}"/><rect x="-11.5" y="-11.5" width="23" height="23" rx="4.5" fill="none" stroke="#fff" stroke-opacity=".28"/><g transform="translate(0 .5) scale(.86)">${terrainGlyph(k,ink,acc,false)}</g></svg>`;
}
// Etiqueta "ícone + nome" (folha da região).
export const terrainChip=k=>`<span class="ter-chip">${terrainIcon(k,20)}${TERRAIN_NAMES[k]||""}</span>`;
// Lista dos 7 terrenos (folha ⓘ Terrenos e Como jogar).
// Linha "+ … · + … · − …" de um terreno (terrenos com efeitos).
export const terrainEffectLine=k=>(TERRAIN_EFFECT_TEXT[k]||[]).join(" · ");
// Com fx=true, cada terreno mostra as suas 2 vantagens e 1 desvantagem no lugar da dica.
export const terrainListHtml=(hints,fx=false)=>`<ul class="ter-list${fx?" ter-fx":""}">${TERRAINS.map(k=>`<li>${terrainIcon(k,20)}<span><b>${TERRAIN_NAMES[k]}</b>${fx?`<small class="ter-eff">${terrainEffectLine(k)}</small>`:hints?`<small>${hints[k]}</small>`:""}</span></li>`).join("")}</ul>`;
// Onde ficam os desenhos de cada região: 2 em cima e 2 embaixo, longe da faixa do nome no meio.
// Semente fixa (por região): o desenho é sempre o mesmo e não toca no sorteio do jogo.
export function terrainSpots(shape){
 if(shape.spots)return shape.spots;
 let s=(7919+shape.i*31)>>>0;const r=()=>(s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296;
 const b=shape.box,cy=b.y+b.h/2;
 shape.spots=[[.24,-.31,0],[.72,-.33,1],[.3,.32,1],[.76,.3,0]].map(([fx,fy,a])=>[+(b.x+b.w*(fx+(r()-.5)*.1)).toFixed(1),+(cy+b.h*(fy+(r()-.5)*.05)).toFixed(1),a]);
 return shape.spots;
}
