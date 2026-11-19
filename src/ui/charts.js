// Gráficos em <canvas> (linhas e barras) e legendas.
import {clamp} from "../core/util.js";
import {fmt,cssColor,escapeHtml} from "./format.js";

/* ── Gráficos ── */
export function svgLine(canvas,series,opts={}){
 const ctx=canvas.getContext("2d"),dpr=window.devicePixelRatio||1,w=canvas.clientWidth||300,h=canvas.clientHeight||220;if(!w)return;canvas.width=w*dpr;canvas.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
 const pad={l:38,r:10,t:14,b:26},pw=w-pad.l-pad.r,ph=h-pad.t-pad.b;ctx.strokeStyle="#293951";ctx.fillStyle="#9fb0c7";ctx.font="10px system-ui";ctx.lineWidth=1;
 const all=series.flatMap(s=>s.data.map(p=>p.y)).filter(Number.isFinite),max=Math.max(opts.minMax??1,...all),min=Math.min(0,...all),range=max-min||1;
 for(let i=0;i<=4;i++){let y=pad.t+ph*i/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText(fmt(max-(max-min)*i/4,range<5?2:0),2,y+3)}
 const n=Math.max(1,...series.map(s=>s.data.length));
 if(opts.markX){const x=pad.l+(n<=1?0:(opts.markX-1)/(n-1))*pw;ctx.save();ctx.strokeStyle="#f4bd50";ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x,pad.t);ctx.lineTo(x,pad.t+ph);ctx.stroke();ctx.restore()}
 series.forEach(s=>{ctx.strokeStyle=s.color;ctx.lineWidth=2;ctx.beginPath();let started=false;s.data.forEach((p,i)=>{let x=pad.l+(n<=1?0:i/(n-1))*pw,y=pad.t+ph-(p.y-min)/range*ph;if(!Number.isFinite(y))return;if(!started){ctx.moveTo(x,y);started=true}else ctx.lineTo(x,y)});ctx.stroke()});
 ctx.fillStyle="#9fb0c7";ctx.textAlign="center";ctx.fillText("Era",pad.l+pw/2,h-5);if(n>1){ctx.fillText("1",pad.l,h-5);ctx.fillText(String(n),w-pad.r-4,h-5)}ctx.textAlign="start";
}
/* ── Gráfico de barras agrupadas (canvas) ── */
export function barChart(canvas,labels,series,opts={}){
 const ctx=canvas.getContext("2d"),dpr=window.devicePixelRatio||1,w=canvas.clientWidth||300,h=canvas.clientHeight||220;canvas.width=w*dpr;canvas.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
 const pad={l:38,r:8,t:12,b:34},pw=w-pad.l-pad.r,ph=h-pad.t-pad.b,all=series.flatMap(s=>s.values).filter(Number.isFinite),max=opts.max??Math.max(1,...all);
 ctx.font="10px system-ui";ctx.strokeStyle="#293951";ctx.fillStyle="#9fb0c7";
 for(let i=0;i<=4;i++){const y=pad.t+ph*i/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText(fmt(max*(1-i/4),0)+(opts.unit||""),2,y+3)}
 const gw=pw/Math.max(1,labels.length),bw=Math.max(2,Math.min(26,(gw-8)/Math.max(1,series.length)));
 labels.forEach((lab,i)=>{const x0=pad.l+gw*i+(gw-bw*series.length)/2;series.forEach((s,k)=>{const v=s.values[i];if(!Number.isFinite(v))return;const bh=ph*clamp(v/max,0,1);ctx.fillStyle=s.color;ctx.fillRect(x0+k*bw,pad.t+ph-bh,bw-1,bh)});ctx.fillStyle="#9fb0c7";const t=String(lab);ctx.fillText(t.length>14?t.slice(0,13)+"…":t,pad.l+gw*i+2,h-pad.b+14)});
}
export const legendHtml=items=>items.map(([name,color])=>`<span style="--c:${cssColor(color)}">${escapeHtml(name)}</span>`).join("");
