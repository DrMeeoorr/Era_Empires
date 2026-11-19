// Nomes vistos pelo jogador: rivais (Rubro, Ocre…), símbolos e regiões do mapa (Arvela…Zênite).
// Nomes vistos pelo jogador (docs/decisoes.md, "Textos pt-BR e nomes"). Só exibição: o motor e as simulações
// dos laboratórios continuam com "Jogador"/"IA n" e "território N" (entram na impressão digital).
// Rivais "Cores", por ordem de assento: o nome é dado em newGame(); o jogador aparece como "Você" ★.
export const RIVAL_NAMES=["Rubro","Ocre","Anil","Violeta","Turquesa"];
export const CIV_SYMBOLS=["★","▲","●","◆","■","✚"];
// Regiões do mapa 6×4, em ordem de leitura (índice 0 = Arvela … 23 = Zênite).
export const REGION_NAMES=["Arvela","Brumas","Cardo","Dorna","Esmera","Fenda","Gralha","Hélia","Ivara","Jaspe","Lumen","Musgo","Névoa","Ombral","Pedral","Quartzo","Rochedo","Salgar","Torva","Urzal","Vau","Velar","Xisto","Zênite"];
export const regionName=i=>REGION_NAMES[i]||"Território "+(i+1);
// Nome do rival (saves antigos têm "IA"/"IA 2": passam a mostrar o nome da cor do mesmo assento).
export const civName=c=>!c?"":c.id==="player"?"Você":/^IA( \d+)?$/.test(c.name||"")&&RIVAL_NAMES[c.index-1]?RIVAL_NAMES[c.index-1]:String(c.name??c.id);
export const civSym=c=>CIV_SYMBOLS[c?.index]||"●";
