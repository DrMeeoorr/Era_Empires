// Tutorial: partida guiada (1 rival, roteiro controlado; depois jogo livre no Fácil).
import {onHook,runHook} from "../app/hooks.js";
import {saveGame} from "../app/save.js";
import {state,configApplied,gameMode,currentDifficulty,setGameMode,setCurrentDifficulty,applyDifficulty,setConfigApplied,setState,newGame,setSelectedTerritory} from "../app/session.js";
import {tutorialPrevSetup} from "../app/setup.js";
import {normalizeConfig} from "../core/config.js";
import {countTerritories,eligibleTargets} from "../core/map.js";
import {territoryDefense,attackTerritory} from "../core/military.js";
import {regionName} from "../core/names.js";
import {P,A} from "../core/state.js";
import {storage} from "../platform/storage.js";
import {SHORT_SCREEN,readAlloc} from "./allocation.js";
import {$} from "./dom.js";
import {fmt,escapeHtml} from "./format.js";
import {renderAll,showView} from "./game.js";
import {civLabel} from "./labels.js";
import {showModal} from "./modal.js";

/* ── Tutorial: partida guiada (1 IA, roteiro controlado; depois jogo livre no Fácil) ──
   O estado do tutorial vive em state.tutorial={step,waitEra,attackDone} e é guardado com a partida.
   Proteções do motor usadas só aqui: state.aiAvoid (a IA não ataca o jogador nem o território reservado)
   e state.forcedAttack (resultado do próximo ataque de uma civilização). */
export async function initTutorial(){
 const TUT_KEY="imperios-tutorial-oferecido",P_START=7,AI_START=9,TARGET=8;
 const needMil=()=>(configApplied.military.conquestCost+configApplied.military.defenseNeutral)/configApplied.military.pointsPerInvestment;
 // Em telas baixas (≤ 700 px) os planos rápidos ficam na folha "Planos ▾".
 const planCta=name=>SHORT_SCREEN.matches?`Toque em “Planos” e escolha “${name}”.`:`Toque no plano “${name}”.`;
 const STEPS=[
  {t:"Bem-vindo a Impérios",target:()=>$("mapCard"),html:()=>`${civLabel(P(state))} (verde) e o rival ${civLabel(A(state))} disputam <strong>24 territórios</strong>. Vence quem primeiro:<br>• dominar <strong>70% do mapa</strong> (17 territórios);<br>• ou liderar com folga durante 5 eras (<strong>supremacia</strong>, só na fase final);<br>• ou tiver <strong>mais pontos</strong> na última era.`},
  {t:"Ouro e receita",target:()=>$("metrics"),html:()=>`A cada era você recebe <strong>ouro</strong>: cada território rende, e as Obras e a Ciência somam mais. O <strong>ouro</strong> aqui no topo é o que você pode investir agora; o <strong>+/era</strong> mostra quanto entrou nesta era.`},
  {t:"Investir",target:()=>$("investCard"),action:true,html:()=>`Há três áreas:<br>⚔ <strong>Militar</strong>: <strong>Força</strong> para atacar já na próxima era (perde 20% por era).<br>▰ <strong>Obras</strong>: rendem ouro a médio prazo e depois acabam.<br>✦ <strong>Ciência</strong>: rende tarde, mas para sempre.<br>Para atacar na próxima era, invista ao menos ${fmt(needMil(),0)} de ouro em Militar.<br><br>👉 <strong>${planCta("Ataque")}</strong>`,done:()=>readAlloc()[0]+1e-9>=needMil()},
  {t:"Concluir a era",target:()=>$("advance"),action:true,html:()=>`Seus investimentos estão definidos. 👉 <strong>Toque em “Concluir era”.</strong> Os rivais jogam ao mesmo tempo e começa a era seguinte.`,done:()=>state.era>=2},
  {t:"Atacar",target:()=>$("mapCard"),action:true,enter:()=>{state.forcedAttack={owner:"player",win:true}},html:()=>`Os territórios com <span class="gold">contorno dourado</span> são vizinhos e podem ser atacados. O ataque custa <strong>${configApplied.military.conquestCost} + a defesa</strong> do alvo em Força (territórios livres têm defesa ${configApplied.military.defenseNeutral}) e vence em 82% das vezes. Você pode dar várias ordens por era, mas cada ataque a mais custa mais (2.º ×2, 3.º ×3).<br><br>👉 <strong>Toque em ${regionName(TARGET)} (${TARGET+1}) e depois em “Atacar”.</strong>`,done:()=>!!(state.orders||[]).find(o=>o.owner==="player")||countTerritories(state,"player")>=2},
  {t:"Resolver as ordens",target:()=>$("advance"),action:true,html:()=>`Os ataques não são imediatos: as ordens de <strong>todos</strong> são resolvidas juntas no fim da era, em ordem sorteada. Se dois atacarem o mesmo território, há <strong>batalha</strong> — vence quem tiver mais Força (somada à Ciência).<br><br>👉 <strong>Toque em “Concluir era”</strong> e veja o relatório.`,done:()=>countTerritories(state,"player")>=2},
  {t:"Conquista!",target:()=>$("statTerr"),html:()=>`Mais territórios = mais receita e mais pontos: <strong>territórios valem 40% da pontuação</strong>. Aqui, <strong>terras</strong> mostra quantos você tem e quantos precisa para a maioria.<br><br>Invista e conclua as próximas eras à vontade; o tutorial volta na <strong>era 4</strong>.`,after:()=>{state.tutorial.waitEra=4}},
  {t:"As Obras rendem",target:()=>$("statGold"),html:()=>`O <strong>+/era</strong> ao lado do ouro soma o que rendem os territórios, as Obras e a Ciência (veja cada parte em ☰ → Detalhes da partida). Cada investimento em Obras cresce até a 4.ª era e depois vai acabando — reinvista para manter o ouro entrando.<br><br>Continue; algo vai acontecer na <strong>era 5</strong>.`,after:()=>{state.tutorial.waitEra=5}},
  {t:"Você foi atacado!",target:()=>$("mapCard"),enter:()=>scriptedAttack(),html:()=>`${state.tutorial.attackIdx!=null?`O rival ${civLabel(A(state))} atacou ${escapeHtml(regionName(state.tutorial.attackIdx))} (${state.tutorial.attackIdx+1}), um território seu, e <strong>foi repelido</strong> desta vez (todo ataque tem 18% de chance de falhar).`:"Os rivais também atacam: quando tiverem Força suficiente, seus territórios vizinhos a eles viram alvos."}<br>• A <strong>defesa</strong> dos seus territórios cresce com suas Obras e sua Ciência — o atacante precisa pagar ${configApplied.military.conquestCost} + essa defesa.<br>• Quem conquista um território <strong>saqueia</strong> parte da economia do dono.<br>Guarde um pouco de Força e não deixe o ouro parado.`},
  {t:"Como saber quem está ganhando",target:()=>$("scorePill"),html:()=>`O <strong>🏆</strong> no topo mostra sua <strong>posição</strong> no placar e a diferença de <strong>pontos</strong> para o líder. Toque nele (ou em “terras”) para ver o placar completo e quanto falta para cada vitória.<br><br>Agora é com você: a partida continua no nível <strong>Fácil</strong>. Boa sorte! 🏆`,last:true}
 ];
 function scriptedAttack(){
  const tu=state.tutorial;if(tu.attackDone)return;tu.attackDone=true;
  const ai=A(state);if(!ai?.active)return;
  const mine=state.owners.map((o,i)=>o==="player"&&eligibleTargets(state,ai.id).some(t=>t.i===i)?i:-1).filter(i=>i>=0);if(!mine.length)return;
  const idx=mine[0];tu.attackIdx=idx;const need=configApplied.military.conquestCost+territoryDefense(state,idx,configApplied);
  ai.military=Math.max(ai.military,need);state.forcedAttack={owner:ai.id,win:false};state.aiAvoid=null;
  attackTerritory(state,idx,ai.id,configApplied,true);state.aiAvoid={player:true};saveGame();renderAll();
 }
 function startTutorial(){
  scrolledStep=-1;
  storage.set(TUT_KEY,"1").catch(()=>{});
  // Escolhas do jogador antes do tutorial (se já estiver num tutorial, mantém as originais).
  const prevSetup=tutorialPrevSetup()||{mode:gameMode,difficulty:currentDifficulty,ai:configApplied.map.aiCount||1,eras:configApplied.endgame.maxEras,supremacy:configApplied.endgame.supremacyEnabled!==false};
  setGameMode("slow");setCurrentDifficulty("facil");applyDifficulty("facil");configApplied.map.aiCount=1;configApplied.endgame.maxEras=30;configApplied.endgame.supremacyEnabled=true;setConfigApplied(normalizeConfig(configApplied));
  // O rival do tutorial é sempre "Equilibrado" (definido abaixo em ai.profile); opponentChoices do jogador não muda.
  setState(newGame());
  // Posições do tutorial: você no 8, a IA no 10, o território 9 livre entre os dois.
  state.owners=state.owners.map(()=> "neutral");state.owners[P_START]="player";state.owners[AI_START]=A(state).id;
  const ai=A(state);ai.profile="reference";ai.hiddenProfile=false;
  state.aiAvoid={player:true,idx:[TARGET]};state.tutorial={step:0,waitEra:0,attackDone:false,prevSetup};state.ui.skipIdleWarning=true;   // sem o aviso de saldo parado durante o tutorial

  setSelectedTerritory(null);saveGame();
  runHook("configChanged");
  $("homeScreen").hidden=true;if($("setupScreen"))$("setupScreen").hidden=true;
  showView("game");
  renderAll();window.scrollTo({top:0});enterStep();
 }
 window.startTutorial=startTutorial;
 const box=document.createElement("div");box.id="tutBox";box.className="tut-box";box.hidden=true;box.setAttribute("role","dialog");box.setAttribute("aria-live","polite");document.body.appendChild(box);
 let focused=null,scrolledStep=-1;
 const cur=()=>state?.tutorial&&!state.tutorial.done?state.tutorial:null;
 function clearFocus(){if(focused)focused.classList.remove("tut-focus");focused=null}
 function endTutorial(skipped){const tu=cur();if(!tu)return;tu.done=true;state.aiAvoid=null;state.forcedAttack=null;state.ui.skipIdleWarning=false;saveGame();clearFocus();box.hidden=true;renderAll();
  if(skipped)showModal(`<h2>Tutorial terminado</h2><p class="small muted">A partida continua normalmente no nível Fácil. Você pode rever o tutorial pela tela inicial (botão “Tutorial”) e as regras em “Como jogar”.</p>`,[{label:"Continuar",cls:"primary"}])}
 function enterStep(){const tu=cur();if(!tu)return;const st=STEPS[tu.step];if(st?.enter&&!tu["entered"+tu.step]){tu["entered"+tu.step]=true;st.enter();saveGame()}draw()}
 function draw(msg){
  const tu=cur();clearFocus();if(!tu||!$("homeScreen").hidden||state.result){box.hidden=true;return}
  if(tu.waitEra&&state.era<tu.waitEra){box.hidden=false;box.className="tut-box tut-mini";box.innerHTML=`<span>🎓 Tutorial: continue jogando — volta na era ${tu.waitEra}.</span><button type="button" data-tut="skip" class="tut-link">Sair</button>`;bind();return}
  const st=STEPS[tu.step];if(!st){endTutorial(false);return}
  const el=st.target();if(el){focused=el;el.classList.add("tut-focus");if(scrolledStep!==tu.step){scrolledStep=tu.step;const tall=el.getBoundingClientRect().height>innerHeight*0.55;el.scrollIntoView({block:tall?"start":"center",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})}}
  box.hidden=false;box.className="tut-box";
  // Em ecrãs largos, o balão fica do lado oposto ao elemento destacado para não o tapar.
  if(window.innerWidth>640&&el){const r=el.getBoundingClientRect(),right=r.left+r.width/2>window.innerWidth/2;box.style.left=right?"16px":"auto";box.style.right=right?"auto":"16px"}else{box.style.left="";box.style.right=""}
  // A instrução de ação (👉 ...) fica sempre visível por baixo do texto, que rola dentro do balão se for longo.
  const full=st.html(),k=full.indexOf("👉"),body=(k>=0?full.slice(0,k):full).replace(/(<br>\s*)+$/,""),cta=k>=0?full.slice(k):"";
  box.innerHTML=`<div class="tut-head"><span class="pill">Tutorial ${tu.step+1}/${STEPS.length}</span><button type="button" data-tut="skip" class="tut-link">Pular tutorial</button></div><h3>${st.t}</h3><div class="tut-text">${body}</div>${cta?`<div class="tut-cta">${cta}</div>`:""}${msg?`<div class="tut-warn">${msg}</div>`:""}${st.action&&cta?"":`<div class="tut-actions">${st.action?'<span class="small muted">Faça a ação indicada para continuar.</span>':`<button type="button" class="primary" data-tut="next">${st.last?"Terminar tutorial":"Próximo →"}</button>`}</div>`}`;
  bind();place();
 }
 // Telemóvel (≤ 640 px): o balão fica acima ou abaixo do elemento destacado, do lado com mais espaço,
 // e nunca por cima da barra fixa de baixo. Se o elemento ocupar a tela toda, o balão fica em baixo.
 const safeProbe=document.createElement("div");safeProbe.style.cssText="position:fixed;left:0;top:env(safe-area-inset-top,0px);width:0;height:0;visibility:hidden;pointer-events:none";document.body.appendChild(safeProbe);
 // Texto mais comprido que o balão: esbate o fim para mostrar que dá para rolar.
 const markMore=()=>{const tt=box.querySelector(".tut-text");box.classList.toggle("more",!!tt&&tt.scrollHeight>tt.clientHeight+2&&tt.scrollTop+tt.clientHeight<tt.scrollHeight-2)};
 box.addEventListener("scroll",markMore,true);
 function place(){requestAnimationFrame(markMore);
  const reset=()=>{box.style.top="";box.style.bottom="";box.style.maxHeight=""};
  if(box.hidden||box.classList.contains("tut-mini")||!focused||window.innerWidth>640){reset();return}
  const vh=innerHeight,gap=10,minH=170,r=focused.getBoundingClientRect(),bar=document.querySelector(".actionbar");
  const sTop=safeProbe.getBoundingClientRect().top+8,barTop=bar&&bar.offsetParent?Math.min(vh,bar.getBoundingClientRect().top):vh;
  const inBar=bar&&bar.contains(focused),limitBot=inBar?vh:barTop;
  const visTop=Math.max(sTop,r.top),visBot=Math.min(limitBot,r.bottom);
  const above=visTop-gap-sTop,below=inBar?-1:barTop-8-(visBot+gap);
  if(below>=minH&&below>=above){box.style.top=(visBot+gap)+"px";box.style.bottom="auto";box.style.maxHeight=below+"px";return}
  if(above>=minH){box.style.top="auto";box.style.bottom=(vh-visTop+gap)+"px";box.style.maxHeight=above+"px";return}
  // Sem espaço livre suficiente (elemento grande): balão em baixo, por cima da barra, ocupando no máximo 45% da tela.
  box.style.top="auto";box.style.bottom=(vh-barTop+8)+"px";box.style.maxHeight=Math.round(Math.min(vh*0.45,barTop-sTop-8))+"px";
 }
 let placeQueued=false;const queuePlace=()=>{if(placeQueued)return;placeQueued=true;requestAnimationFrame(()=>{placeQueued=false;place()})};
 window.addEventListener("scroll",queuePlace,{passive:true});window.addEventListener("resize",queuePlace);
 function bind(){box.querySelectorAll("[data-tut]").forEach(b=>b.onclick=()=>{
  if(b.dataset.tut==="skip"){endTutorial(true);return}
  const tu=cur(),st=STEPS[tu.step];st.after?.();if(st.last){endTutorial(false);return}tu.step++;saveGame();enterStep()})}
 // Avanço automático das etapas com ação e retoma depois das eras de espera.
 setInterval(()=>{const tu=cur();if(!tu||!$("homeScreen").hidden)return;
  if(tu.waitEra){if(state.era>=tu.waitEra){tu.waitEra=0;saveGame();enterStep()}return}
  const st=STEPS[tu.step];if(st?.action&&st.done()){tu.step++;saveGame();enterStep()}},250);
 // Durante as etapas de ação, não deixa concluir a era antes do tempo.
 onHook("beforeConclude",()=>{const tu=cur();
  if(tu&&!tu.waitEra&&tu.step<=2){draw("Primeiro coloque pelo menos "+fmt(needMil(),0)+" de ouro em Militar (plano “Ataque”).");return false}
  if(tu&&!tu.waitEra&&tu.step===4){draw("Primeiro dê a ordem de ataque a "+regionName(TARGET)+" ("+(TARGET+1)+").");return false}
 });
 // Depois de cada desenho completo, redesenha o balão por cima.
 onHook("afterRender",()=>{if(cur())setTimeout(()=>{if(focused||box.hidden===false)draw()},0)});
 // Tela inicial: botão e oferta na primeira visita.
 const how=$("homeHowTo");if(how){const b=document.createElement("button");b.type="button";b.className="home-secondary";b.id="homeTutorial";b.textContent="🎓 Tutorial";how.insertAdjacentElement("beforebegin",b);
  b.onclick=()=>{const inProg=state&&!state.result&&(state.era>1||state.history.length>0)&&!cur();if(inProg)showModal(`<h2>Começar o tutorial?</h2><p class="small muted">A partida em andamento (era ${state.era}) será substituída por uma partida guiada.</p>`,[{label:"Cancelar"},{label:"Começar tutorial",cls:"primary",onClick:startTutorial}]);else startTutorial()}}
 let offered=false;try{offered=!!await storage.get(TUT_KEY)}catch(e){offered=true}
 const fresh=!state||(!state.history.length&&state.era<=1);
 if(!offered&&fresh)setTimeout(()=>showModal(`<h2>Primeira vez em Impérios?</h2><p class="small muted">Uma partida guiada mostra, em poucos minutos, como investir, atacar, defender e vencer. Você pode sair quando quiser.</p>`,[{label:"Jogar o tutorial",cls:"primary",onClick:startTutorial},{label:"Agora não",onClick:()=>{storage.set(TUT_KEY,"1").catch(()=>{})}}]),300);
 if(cur())setTimeout(draw,0);
 // Ao voltar ao jogo a partir da tela inicial, mostra de novo o balão.
 onHook("continueGame",()=>setTimeout(draw,0));
 onHook("returnHome",()=>{clearFocus();box.hidden=true});
}
