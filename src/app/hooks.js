// Ganchos entre partes do jogo: quem quer reagir a um acontecimento regista-se com onHook; quem o causa chama runHook.
/* ── Ganchos: avisam outras partes da interface (relatório, tutorial) sem substituir funções ──
   afterEra(era,row): depois de cada era jogada pelo jogador · afterRender(): depois de renderAll ·
   beforeConclude(): antes de concluir a era (devolver false impede) · continueGame / returnHome: tela inicial ·
   configChanged(): a configuração aplicada mudou (os laboratórios atualizam o editor) · viewShown(view): aba mostrada ·
   saveStatus(err): a gravação falhou (err) ou voltou a funcionar depois de uma falha (null). */
export const hooks={afterEra:[],afterRender:[],beforeConclude:[],continueGame:[],returnHome:[],configChanged:[],viewShown:[],saveStatus:[]};
export const onHook=(name,fn)=>{hooks[name].push(fn)};
export const runHook=(name,...args)=>{for(const fn of hooks[name])fn(...args)};
