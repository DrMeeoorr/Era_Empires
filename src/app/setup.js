// Escolhas da partida guardadas durante o tutorial: a próxima partida nova volta às escolhas de antes dele.
import {runHook} from "./hooks.js";
import {state,configApplied,DEFAULT_DIFFICULTY,setConfigApplied,setGameMode,setCurrentDifficulty,applyDifficulty} from "./session.js";
import {DIFFICULTIES,normalizeConfig} from "../core/config.js";
import {clone} from "../core/util.js";

// O tutorial joga com Fácil/1 IA/30 eras/modo lento, mas guarda as escolhas anteriores do jogador em
// state.tutorial.prevSetup; a próxima partida nova (Jogar de novo, Reiniciar...) volta a elas.
export function tutorialPrevSetup(){const p=state?.tutorial?.prevSetup;return p&&typeof p==="object"?p:null}
export function restoreSetupAfterTutorial(){
 const p=tutorialPrevSetup();if(!p)return;delete state.tutorial.prevSetup;
 try{const c=clone(configApplied),diff=DIFFICULTIES[p.difficulty]?p.difficulty:DEFAULT_DIFFICULTY;
  c.map.aiCount=p.ai;c.endgame.maxEras=p.eras;c.endgame.supremacyEnabled=p.supremacy!==false;const n=normalizeConfig(c);
  setConfigApplied(n);setGameMode(p.mode==="fast"?"fast":"slow");setCurrentDifficulty(diff);applyDifficulty(diff);runHook("configChanged");
 }catch(e){}
}
