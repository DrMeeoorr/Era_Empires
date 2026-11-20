// Formas do mapa ilustrado (Fase 3): as 24 regiões da grade 6×4 com bordas irregulares e mar em volta.
// Só desenho: a vizinhança das regras (src/core/map.js) continua a da grade. Cada borda entre duas regiões é
// gerada uma vez e usada pelas duas, ponto a ponto; por isso duas regiões só partilham uma borda quando são
// vizinhas na grade (cima, baixo, esquerda, direita) e as diagonais só se tocam num canto.
// Sem DOM e sem aleatoriedade do jogo (semente fixa): o mapa é sempre o mesmo e não mexe na impressão digital.

export const SHAPE_COLS=6,SHAPE_ROWS=4,CELL=100,SHAPE_W=SHAPE_COLS*CELL,SHAPE_H=SHAPE_ROWS*CELL;
const SEED=20261120;

function lcg(seed){let s=seed>>>0||1;return()=>(s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296}
// Uma iteração de Chaikin numa linha aberta, mantendo as pontas (a borda partilhada continua idêntica dos dois lados).
function chaikin(pts){const out=[pts[0]];for(let k=0;k<pts.length-1;k++){const [ax,ay]=pts[k],[bx,by]=pts[k+1];out.push([ax*.75+bx*.25,ay*.75+by*.25],[ax*.25+bx*.75,ay*.25+by*.75])}out.push(pts.at(-1));return out}
const r1=v=>Math.round(v*10)/10;

// Ponto de corte de uma linha horizontal (y) com o polígono: menor e maior x.
function spanAt(poly,y){let lo=Infinity,hi=-Infinity;for(let k=0;k<poly.length;k++){const [ax,ay]=poly[k],[bx,by]=poly[(k+1)%poly.length];if((ay<=y&&by>y)||(by<=y&&ay>y)){const x=ax+(y-ay)/(by-ay)*(bx-ax);lo=Math.min(lo,x);hi=Math.max(hi,x)}}return [lo,hi]}

let cache=null;
export function regionShapes(){
 if(cache)return cache;
 const rnd=lcg(SEED),j=a=>(rnd()*2-1)*a,COLS=SHAPE_COLS,ROWS=SHAPE_ROWS;
 // Vértices da grade deformada. Na costa ficam um pouco para dentro (mar em volta) e os 4 cantos arredondam.
 const V=[];
 for(let r=0;r<=ROWS;r++){V[r]=[];for(let c=0;c<=COLS;c++){
  let x=c*CELL,y=r*CELL;
  const bx=c===0||c===COLS,by=r===0||r===ROWS;
  x=bx?(c===0?2+rnd()*4:SHAPE_W-2-rnd()*4):x+j(3.5);
  y=by?(r===0?1+rnd()*3:SHAPE_H-1-rnd()*3):y+j(11);
  if(bx&&by){x+=c===0?6:-6;y+=r===0?6:-6}
  V[r][c]=[x,y];
 }}
 // Bordas: pontos intermédios com desvio perpendicular; na costa só para dentro.
 const edges={};
 const makeEdge=(a,b,amp,coast)=>{const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy),nx=-dy/L,ny=dx/L,pts=[a];
  for(const t of [.25,.5,.75]){let o=coast?coast*(rnd()*amp-amp*.45):j(amp);pts.push([a[0]+dx*t+nx*o,a[1]+dy*t+ny*o])}
  pts.push(b);return chaikin(chaikin(pts)).map(p=>[r1(p[0]),r1(p[1])])};
 // Horizontal: topo da linha r, entre as colunas c e c+1 (esquerda → direita). Normal aponta para baixo.
 const hEdge=(r,c)=>edges["h"+r+","+c]||(edges["h"+r+","+c]=makeEdge(V[r][c],V[r][c+1],r===0||r===ROWS?9:11,r===0?1:r===ROWS?-1:0));
 // Vertical: esquerda da coluna c, entre as linhas r e r+1 (cima → baixo). Normal aponta para a esquerda.
 const vEdge=(r,c)=>edges["v"+r+","+c]||(edges["v"+r+","+c]=makeEdge(V[r][c],V[r+1][c],c===0||c===COLS?6:1.8,c===0?-1:c===COLS?1:0));
 const shapes=[];
 for(let i=0;i<COLS*ROWS;i++){
  const r=Math.floor(i/COLS),c=i%COLS;
  const top=hEdge(r,c),right=vEdge(r,c+1),bottom=hEdge(r+1,c).slice().reverse(),left=vEdge(r,c).slice().reverse();
  const poly=[...top.slice(0,-1),...right.slice(0,-1),...bottom.slice(0,-1),...left.slice(0,-1)];
  const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);
  const box={x:Math.min(...xs),y:Math.min(...ys)};box.w=Math.max(...xs)-box.x;box.h=Math.max(...ys)-box.y;
  // Faixa segura para o nome: a parte do meio da região, onde cabe o texto sem tocar nas bordas.
  const cy=box.y+box.h/2;let safeL=-Infinity,safeR=Infinity;
  for(const dy of [-20,-10,0,10,20]){const [lo,hi]=spanAt(poly,cy+dy);safeL=Math.max(safeL,lo);safeR=Math.min(safeR,hi)}
  safeL+=1;safeR-=1;
  // Enfeite de relevo (monte ou árvore) num canto, longe do nome; e um tom de terreno (0–2) para as regiões livres.
  const deco={x:box.x+box.w/2+(rnd()<.5?-1:1)*box.w*.3,y:cy+(rnd()<.5?-1:1)*box.h*.3,kind:rnd()<.5?"hill":"tree"},tone=Math.floor(rnd()*3);
  shapes.push({i,poly,box,safeL,safeR,deco,tone,d:"M"+poly.map(p=>p[0]+" "+p[1]).join("L")+"Z"});
 }
 cache={shapes,width:SHAPE_W,height:SHAPE_H};
 return cache;
}
