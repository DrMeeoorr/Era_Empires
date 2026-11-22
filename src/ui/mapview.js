// Navegação dos mapas maiores que o Original (2×, 3×, 4×): as regiões têm o tamanho das do Original e o mapa
// inteiro fica numa camada (#mapStage) que se arrasta com um dedo, aproxima com pinça, roda do mouse (com Ctrl) ou
// com os botões + / − e volta ao seu império com o botão do alvo. No mapa Original nada disto aparece.
// Só apresentação: não mexe no estado da partida nem no save.
import {state} from "../app/session.js";
import {$} from "./dom.js";
import {mapGrid} from "./mapshape.js";
import {showToast} from "./toast.js";
import {civName,civSym} from "../core/names.js";
import {cssColor,escapeHtml} from "./format.js";

export const isBigGrid=g=>!!g&&(g.cols!==6||g.rows!==4);
const Z_MAX=2,Z_STEP=1.3,EDGE=8,FAR=.7,BADGE_R=22,BADGE_GAP=40;
const view={z:1,tx:0,ty:0,key:null};
let big=false,bound=false,hinted=false;

const box=()=>document.querySelector("#mapCard .map-box");
const stage=()=>$("mapStage");
const reduced=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
// Telas baixas (até 700 px): os botões + / − / centralizar saem de cima do mapa e vão para a linha da legenda.
const SHORT_Q="(max-height: 700px)";
const inRow=()=>!!$("mapCard")?.classList.contains("zoom-row");
// Largura e altura que os botões ocupam sobre o mapa (0 quando estão na linha da legenda).
const ctrlW=()=>big&&!inRow()?56:0,ctrlH=()=>big&&!inRow()?150:0;

// Janela visível (a caixa do mapa) nas coordenadas do #map, que não se mexe.
function geom(){
 const b=box(),m=$("map"),s=stage();if(!b||!m||!s)return null;
 const br=b.getBoundingClientRect(),mr=m.getBoundingClientRect();
 return {vx:br.left-mr.left,vy:br.top-mr.top,vw:br.width,vh:br.height,sw:s.offsetWidth,sh:s.offsetHeight,mr};
}
const zMin=g=>Math.min(1,(g.vw-2*EDGE)/g.sw,(g.vh-2*EDGE)/g.sh);
function clampView(g){
 view.z=Math.min(Z_MAX,Math.max(zMin(g),view.z));
 const fit=(t,S,v0,vw,m0,m1)=>S+m0+m1<=vw?v0+(vw-S)/2:Math.min(v0+m0,Math.max(v0+vw-m1-S,t));
 // À direita sobra a largura dos botões: as últimas regiões podem ser puxadas para fora de baixo deles.
 view.tx=fit(view.tx,g.sw*view.z,g.vx,g.vw,EDGE,EDGE+ctrlW());
 view.ty=fit(view.ty,g.sh*view.z,g.vy,g.vh,EDGE,EDGE);
}
function apply(anim=false){
 const s=stage(),g=geom();if(!s||!g||g.vw<=0||g.sw<=0)return;
 clampView(g);
 s.classList.toggle("anim",anim&&!reduced());
 s.style.transform=`translate(${view.tx.toFixed(1)}px,${view.ty.toFixed(1)}px) scale(${view.z.toFixed(4)})`;
 const b=box();b.classList.toggle("far",view.z<FAR);
 const zi=$("mapZoomIn"),zo=$("mapZoomOut");
 if(zi)zi.disabled=view.z>=Z_MAX-1e-3;if(zo)zo.disabled=view.z<=zMin(g)+1e-3;
 updateEdges(g);
}
// Aproxima/afasta mantendo parado o ponto (px,py) do #map.
function zoomAt(px,py,z,anim){
 const g=geom();if(!g)return;
 const nz=Math.min(Z_MAX,Math.max(zMin(g),z)),k=nz/view.z;
 view.tx=px-(px-view.tx)*k;view.ty=py-(py-view.ty)*k;view.z=nz;apply(anim);
}
const zoomCenter=(f)=>{const g=geom();if(g)zoomAt(g.vx+g.vw/2,g.vy+g.vh/2,view.z*f,true)};
// Centro de um império, em fração do mapa (0–1); null se não tem regiões.
function civCenter(id){
 const {cols,rows}=mapGrid(state),mine=state.owners.map((o,i)=>o===id?i:-1).filter(i=>i>=0);if(!mine.length)return null;
 // A região mais próxima da média (o centro de um império em "L" pode cair fora dele).
 const mx=mine.reduce((a,i)=>a+i%cols+.5,0)/mine.length,my=mine.reduce((a,i)=>a+Math.floor(i/cols)+.5,0)/mine.length;
 const best=mine.reduce((b,i)=>{const d=Math.hypot(i%cols+.5-mx,Math.floor(i/cols)+.5-my);return d<b.d?{i,d}:b},{i:mine[0],d:Infinity}).i;
 return {x:(best%cols+.5)/cols,y:(Math.floor(best/cols)+.5)/rows,list:mine,cols,rows};
}
// Põe um império (padrão: o seu) no meio da janela (sem regiões: o meio do mapa).
export function centerOnCiv(id="player",anim=true){
 const g=geom();if(!g||!state)return;const c=civCenter(id)||{x:.5,y:.5};
 view.tx=g.vx+(g.vw-ctrlW())/2-c.x*g.sw*view.z;view.ty=g.vy+g.vh/2-c.y*g.sh*view.z;apply(anim);
}
export const centerOnEmpire=(anim=true)=>centerOnCiv("player",anim);
// Selos nas bordas: cada império (você e os rivais) sem nenhuma região à vista ganha um selo com a sua cor e o seu
// símbolo, na borda do lado em que está, com uma seta; tocar leva até ele. Somem quando o império aparece.
function updateEdges(g){
 const wrap=$("mapEdges");if(!wrap)return;
 if(!big||!state){wrap.innerHTML="";return}
 const vw=g.vw,vh=g.vh,cw=ctrlW(),chh=ctrlH(),list=[];
 for(const civ of state.civs||[]){
  if(civ.active===false)continue;const c=civCenter(civ.id);if(!c)continue;
  const at=(fx,fy)=>({x:view.tx+fx*g.sw*view.z-g.vx,y:view.ty+fy*g.sh*view.z-g.vy});
  const seen=c.list.some(i=>{const p=at((i%c.cols+.5)/c.cols,(Math.floor(i/c.cols)+.5)/c.rows);return p.x>4&&p.x<vw-4&&p.y>4&&p.y<vh-4&&!(p.x>vw-cw&&p.y>vh-chh)});
  if(seen)continue;
  const p=at(c.x,c.y),ox=vw/2,oy=vh/2,dx=p.x-ox,dy=p.y-oy,R=BADGE_R+8;
  const t=Math.min(dx?(vw/2-R)/Math.abs(dx):Infinity,dy?(vh/2-R)/Math.abs(dy):Infinity);
  let x=ox+dx*t,y=oy+dy*t;
  const side=Math.abs(x-R)<1?"l":Math.abs(x-(vw-R))<1?"r":Math.abs(y-R)<1?"t":"b";
  // Não fica embaixo dos botões do canto.
  if(cw){if(side==="r"&&y>vh-chh-R)y=vh-chh-R;if(side==="b"&&x>vw-cw-R)x=vw-cw-R}
  list.push({civ,x,y,side,ang:Math.atan2(dy,dx)});
 }
 // Selos muito perto uns dos outros andam ao longo da borda.
 list.sort((a,b)=>a.side===b.side?(a.side==="l"||a.side==="r"?a.y-b.y:a.x-b.x):a.side<b.side?-1:1);
 for(let k=1;k<list.length;k++){const a=list[k-1],b=list[k];if(a.side!==b.side)continue;
  if(b.side==="l"||b.side==="r"){if(b.y-a.y<BADGE_GAP)b.y=a.y+BADGE_GAP}else if(b.x-a.x<BADGE_GAP)b.x=a.x+BADGE_GAP}
 const key=list.map(o=>o.civ.id).join(",");
 if(wrap.dataset.key!==key){wrap.dataset.key=key;
  wrap.innerHTML=list.map(o=>{const nm=civName(o.civ);return `<button type="button" class="map-edge${o.civ.id==="player"?" me":""}" data-edge="${escapeHtml(o.civ.id)}" style="--c:${cssColor(o.civ.color)}" aria-label="${escapeHtml(o.civ.id==="player"?"Seu império está fora da tela: mostrar":nm+" está fora da tela: mostrar")}"><span class="me-arrow" aria-hidden="true"></span><span class="me-sym" aria-hidden="true">${civSym(o.civ)}</span></button>`}).join("");
  wrap.querySelectorAll("[data-edge]").forEach(b=>b.onclick=()=>centerOnCiv(b.dataset.edge,true));}
 list.forEach((o,k)=>{const el=wrap.children[k];if(!el)return;el.style.left=o.x.toFixed(1)+"px";el.style.top=o.y.toFixed(1)+"px";el.style.setProperty("--a",o.ang.toFixed(3)+"rad")});
}
// Foco do teclado numa região fora da janela: o mapa anda até ela.
function ensureVisible(el){
 const b=box(),g=geom();if(!b||!g)return;const r=el.getBoundingClientRect(),br=b.getBoundingClientRect();
 if(r.left>=br.left&&r.right<=br.right-ctrlW()&&r.top>=br.top&&r.bottom<=br.bottom)return;
 view.tx+=(br.left+br.width/2)-(r.left+r.width/2);view.ty+=(br.top+br.height/2)-(r.top+r.height/2);apply(false);
}

const ICON_PLUS='<svg class="ic" aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_MINUS='<svg class="ic" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14"/></svg>';
const ICON_HOME='<svg class="ic" aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>';

function bind(b){
 if(bound)return;bound=true;
 b.insertAdjacentHTML("beforeend",`<div class="map-zoom" id="mapZoom" role="group" aria-label="Navegar no mapa" hidden><button type="button" id="mapZoomIn" aria-label="Aproximar o mapa">${ICON_PLUS}</button><button type="button" id="mapZoomOut" aria-label="Afastar o mapa">${ICON_MINUS}</button><button type="button" id="mapCenter" aria-label="Centralizar no seu império">${ICON_HOME}</button></div><div class="map-edges" id="mapEdges"></div>`);
 $("mapZoomIn").onclick=()=>zoomCenter(Z_STEP);$("mapZoomOut").onclick=()=>zoomCenter(1/Z_STEP);$("mapCenter").onclick=()=>centerOnEmpire(true);
 // Arrastar e pinça. Um toque que anda mais que alguns px vira arrasto e não escolhe a região.
 const pts=new Map();let start=null,pinch=null,moved=false,suppress=false;
 const local=(e,mr)=>({x:e.clientX-mr.left,y:e.clientY-mr.top});
 const restart=()=>{const g=geom();if(!g)return;const [p]=[...pts.values()];start={x:p.x,y:p.y,tx:view.tx,ty:view.ty,mr:g.mr};pinch=null};
 b.addEventListener("pointerdown",e=>{
  if(!big||e.target.closest(".map-zoom,.map-edge")||(e.pointerType==="mouse"&&e.button!==0))return;
  suppress=false;pts.set(e.pointerId,{x:e.clientX,y:e.clientY,type:e.pointerType});
  if(pts.size===1){moved=false;restart()}
  else if(pts.size===2){const g=geom();if(!g)return;const [p,q]=[...pts.values()];
   pinch={d:Math.hypot(p.x-q.x,p.y-q.y)||1,c:{x:(p.x+q.x)/2-g.mr.left,y:(p.y+q.y)/2-g.mr.top},z:view.z,tx:view.tx,ty:view.ty,mr:g.mr};moved=true;
   for(const id of pts.keys())try{b.setPointerCapture(id)}catch(_){} b.classList.add("panning")}
 });
 b.addEventListener("pointermove",e=>{
  if(!big||!pts.has(e.pointerId))return;const p=pts.get(e.pointerId);p.x=e.clientX;p.y=e.clientY;
  if(pinch&&pts.size>=2){const [a,c]=[...pts.values()],d=Math.hypot(a.x-c.x,a.y-c.y)||1,cx=(a.x+c.x)/2-pinch.mr.left,cy=(a.y+c.y)/2-pinch.mr.top;
   const g=geom();if(!g)return;const z=Math.min(Z_MAX,Math.max(zMin(g),pinch.z*d/pinch.d));
   view.tx=cx-(pinch.c.x-pinch.tx)/pinch.z*z;view.ty=cy-(pinch.c.y-pinch.ty)/pinch.z*z;view.z=z;apply(false);return}
  if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;
  if(!moved&&Math.hypot(dx,dy)>(p.type==="mouse"?4:9)){moved=true;try{b.setPointerCapture(e.pointerId)}catch(_){}b.classList.add("panning")}
  if(moved){view.tx=start.tx+dx;view.ty=start.ty+dy;apply(false)}
 });
 const up=e=>{
  if(!pts.has(e.pointerId))return;pts.delete(e.pointerId);
  if(pts.size>=1){restart();return}
  start=null;pinch=null;b.classList.remove("panning");
  if(moved){suppress=true;setTimeout(()=>{suppress=false},400)}
 };
 b.addEventListener("pointerup",up);b.addEventListener("pointercancel",up);
 // O "click" que o navegador manda no fim de um arrasto não escolhe região.
 b.addEventListener("click",e=>{if(suppress&&!e.target.closest(".map-zoom,.map-edge")){e.preventDefault();e.stopPropagation();suppress=false}},true);
 b.addEventListener("wheel",e=>{if(!big)return;e.preventDefault();const g=geom();if(!g)return;
  if(e.ctrlKey){const {x,y}=local(e,g.mr);zoomAt(x,y,view.z*Math.exp(-e.deltaY*.01),false)}
  else{view.tx-=e.shiftKey?e.deltaY:e.deltaX;view.ty-=e.shiftKey?0:e.deltaY;apply(false)}},{passive:false});
 b.addEventListener("focusin",e=>{if(!big)return;const t=e.target.closest?.("[data-territory]");if(t)ensureVisible(t)});
 if(window.ResizeObserver)new ResizeObserver(()=>{if(big)mapViewAfterRender(true)}).observe(b);
 window.matchMedia?.(SHORT_Q).addEventListener?.("change",()=>{placeControls();if(big)apply(false)});
}

// Botões sobre o mapa (canto inferior direito) ou, em telas baixas, na linha da legenda antes de "ⓘ Terrenos".
function placeControls(){
 const z=$("mapZoom"),card=$("mapCard"),b=box();if(!z||!card||!b)return;
 const row=big&&!!window.matchMedia?.(SHORT_Q).matches,lr=card.querySelector(".legend-row");
 card.classList.toggle("zoom-row",row&&!!lr);
 if(row&&lr){if(z.parentElement!==lr)lr.insertBefore(z,$("terrainBtn"))}else if(z.parentElement!==b)b.insertBefore(z,$("mapEdges"));
}
// Chamado pelo renderMap(): liga/desliga o modo de mapa grande (classe na caixa e botões).
export function setupMapView(isBig){
 const b=box();if(!b)return;bind(b);big=!!isBig;
 b.classList.toggle("map-big",big);$("mapCard")?.classList.toggle("map-big",big);
 const z=$("mapZoom");if(z)z.hidden=!big;placeControls();
 if(!big){b.classList.remove("far","panning");const e=$("mapEdges");if(e){e.innerHTML="";e.dataset.key=""}}
}
// Depois de redesenhar: a camada nova recebe a mesma posição; numa partida nova começa no seu império.
export function mapViewAfterRender(isBig){
 if(!isBig)return;
 const g=geom();if(!g||g.vw<=0||g.sw<=0)return;   // jogo escondido (tela inicial por cima): espera o ResizeObserver
 if(view.key!==state){view.key=state;view.z=1;centerOnEmpire(false);
  // Uma vez por sessão: como andar no mapa grande.
  if(!hinted){hinted=true;showToast("Arraste o mapa para ver o resto. Dois dedos ou + e − aproximam.")}
  return}
 apply(false);
}
