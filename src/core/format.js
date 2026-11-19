// Números nos textos do motor (registo de eventos). O motor escreve em pt-PT com "u."; a interface converte
// para pt-BR na exibição (uiText em src/legacy.js).
// Textos gerados pelas regras (registo, ações, relatórios) mantêm a formatação original: entram no estado
// guardado e na "impressão digital" das simulações (tests/fingerprint.js), que não pode mudar.
export const fmtCore=(n,d=1)=>Number.isFinite(n)?n.toLocaleString("pt-PT",{maximumFractionDigits:d,minimumFractionDigits:0}):"—";
export const moneyCore=n=>fmtCore(n,2)+" u.";
