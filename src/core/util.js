// Utilitários puros do motor (sem DOM): cópia profunda, limites e validação de números.
export const clone=o=>JSON.parse(JSON.stringify(o));
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function safeNum(v,min=0,max=1e100){let n=Number(v);if(!Number.isFinite(n)||n<min||n>max)throw Error("Valor inválido: "+v);return n}
