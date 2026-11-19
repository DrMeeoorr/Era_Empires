// Armazenamento do aparelho (o único módulo que usa localStorage; verificado por tests/structure.test.js).
/* ── Armazenamento (único lugar que usa localStorage) ──
   Interface assíncrona: get(key) → texto ou null, set(key,texto), remove(key); todas devolvem promessas.
   Hoje usa o localStorage do navegador; no app Android basta trocar por @capacitor/preferences
   (Preferences.get/set/remove) sem mexer no resto do jogo. Com o localStorage a gravação acontece já na
   chamada (antes de a promessa resolver), por isso a ordem das gravações é sempre a das chamadas. */
export const storage={
 async get(key){return localStorage.getItem(key)},
 async set(key,value){localStorage.setItem(key,String(value))},
 async remove(key){localStorage.removeItem(key)},
};
