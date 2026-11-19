// Ficheiros: descarregar JSON/CSV (navegador). No app Android isto passará a usar Filesystem/Share.
// captureDownloads(fn): os próximos download(...) vão para fn(name,text,type) em vez de gerar um ficheiro
// (usado pelos testes internos); devolve a função que desliga a captura.
export let downloadCapture=null;
export function captureDownloads(fn){downloadCapture=fn;return ()=>{if(downloadCapture===fn)downloadCapture=null}}
export function download(name,text,type="application/json"){if(downloadCapture)return downloadCapture(name,text,type);const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export function csvDownload(name,rows){download(name,rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(";")).join("\n"),"text/csv;charset=utf-8")}
// Únicas formas de outros módulos substituírem estas variáveis (um módulo não pode reatribuir o que importa).
export function setDownloadCapture(v){downloadCapture=v;return v}
