// Escolhas da partida guardadas durante o tutorial: a próxima partida nova volta às escolhas de antes dele.
import {runHook} from "./hooks.js";
import {state,configApplied,gameMode,currentDifficulty,DEFAULT_DIFFICULTY,setConfigApplied,setGameMode,setCurrentDifficulty,applyDifficulty,setState,newGame} from "./session.js";
import {DIFFICULTIES,normalizeConfig} from "../core/config.js";
import {A} from "../core/state.js";
import {clone} from "../core/util.js";

// O tutorial joga com Fácil/1 IA/30 eras/modo lento, mas guarda as escolhas anteriores do jogador em
// state.tutorial.prevSetup; a próxima partida nova (Jogar de novo, Reiniciar...) volta a elas.
export function tutorialPrevSetup(){const p=state?.tutorial?.prevSetup;return p&&typeof p==="object"?p:null}
export function restoreSetupAfterTutorial(){
 const p=tutorialPrevSetup();if(!p)return;delete state.tutorial.prevSetup;
 try{const c=clone(configApplied),diff=DIFFICULTIES[p.difficulty]?p.difficulty:DEFAULT_DIFFICULTY;
  c.map.aiCount=p.ai;c.endgame.maxEras=p.eras;c.endgame.supremacyEnabled=p.supremacy!==false;c.map.randomStart=p.randomStart===true;const n=normalizeConfig(c);
  setConfigApplied(n);setGameMode(p.mode==="fast"?"fast":"slow");setCurrentDifficulty(diff);applyDifficulty(diff);runHook("configChanged");
 }catch(e){}
}
// Partida do tutorial, sem tocar na tela nem gravar (ui/tutorial.js faz o resto): Fácil, 1 rival "Equilibrado",
// 30 eras, modo lento e posições fixas (você no 8, a IA no 10, o 9 livre entre os dois), mesmo com a
// posição inicial aleatória ligada. Guarda as escolhas anteriores em state.tutorial.prevSetup.
export const TUTORIAL_POS={player:7,ai:9,target:8};
export function newTutorialGame(){
 // Escolhas do jogador antes do tutorial (se já estiver num tutorial, mantém as originais).
 const prevSetup=tutorialPrevSetup()||{mode:gameMode,difficulty:currentDifficulty,ai:configApplied.map.aiCount||1,eras:configApplied.endgame.maxEras,supremacy:configApplied.endgame.supremacyEnabled!==false,randomStart:!!configApplied.map.randomStart};
 setGameMode("slow");setCurrentDifficulty("facil");applyDifficulty("facil");configApplied.map.aiCount=1;configApplied.endgame.maxEras=30;configApplied.endgame.supremacyEnabled=true;setConfigApplied(normalizeConfig(configApplied));
 // O rival do tutorial é sempre "Equilibrado" (ai.profile); opponentChoices do jogador não muda.
 setState(newGame());
 state.owners=state.owners.map(()=> "neutral");state.owners[TUTORIAL_POS.player]="player";state.owners[TUTORIAL_POS.ai]=A(state).id;
 const ai=A(state);ai.profile="reference";ai.hiddenProfile=false;
 state.aiAvoid={player:true,idx:[TUTORIAL_POS.target]};state.tutorial={step:0,waitEra:0,attackDone:false,prevSetup};state.ui.skipIdleWarning=true;   // sem o aviso de saldo parado durante o tutorial
 return state;
}
