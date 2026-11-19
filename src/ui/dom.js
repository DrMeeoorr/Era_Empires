// Atalhos do DOM.
export const $=id=>document.getElementById(id);
export function setStatus(id,msg,cls=""){const el=$(id);el.className="status "+cls;el.textContent=msg}
