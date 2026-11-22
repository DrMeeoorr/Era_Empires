// Nomes vistos pelo jogador: rivais (Rubro, Ocre…), símbolos e regiões do mapa (Arvela…Zênite).
// Nomes vistos pelo jogador (docs/decisoes.md, "Textos pt-BR e nomes"). Só exibição: o motor e as simulações
// dos laboratórios continuam com "Jogador"/"IA n" e "território N" (entram na impressão digital).
// Rivais "Cores", por ordem de assento: o nome é dado em newGame(); o jogador aparece como "Você" ★.
export const RIVAL_NAMES=["Rubro","Ocre","Anil","Violeta","Turquesa"];
export const CIV_SYMBOLS=["★","▲","●","◆","■","✚"];
// Regiões do mapa 6×4, em ordem de leitura (índice 0 = Arvela … 23 = Zênite).
export const REGION_NAMES=["Arvela","Brumas","Cardo","Dorna","Esmera","Fenda","Gralha","Hélia","Ivara","Jaspe","Lumen","Musgo","Névoa","Ombral","Pedral","Quartzo","Rochedo","Salgar","Torva","Urzal","Vau","Velar","Xisto","Zênite"];
// Mapas maiores (tamanhos 2–4, até 96 regiões): os 24 nomes de sempre ficam nos índices 0–23 e seguem-se mais 72, sem
// repetir (REGION_NAMES_EXTRA). O mapa de 24 continua igual.
export const REGION_NAMES_EXTRA=["Acácia","Alcova","Almagre","Alvorada","Arenal","Aroeira","Baluarte","Barranco","Bétula","Bravio","Breu","Cascalho","Cedral","Cerrado","Cimo","Colmeia","Coral","Corisco","Duna","Encosta","Espinho","Estio","Faial","Falésia","Farol","Fráguas","Garoa","Granito","Gruta","Ilhota","Ipê","Jacarandá","Jazida","Junco","Lagoa","Lajedo","Lírio","Louro","Malva","Mangue","Marola","Mirante","Nascente","Neblina","Olmo","Orvalho","Outeiro","Paineira","Penhasco","Planalto","Poente","Quebrada","Quina","Ravina","Restinga","Ribeira","Sargaço","Sereno","Sílex","Tabuleiro","Taipa","Tojal","Trovão","Ubá","Umbral","Urtiga","Várzea","Vereda","Vertente","Xaxim","Zéfiro","Zimbro"];
export const REGION_NAMES_ALL=[...REGION_NAMES,...REGION_NAMES_EXTRA];
export const regionName=i=>REGION_NAMES_ALL[i]||"Território "+(i+1);
// Nome do rival (saves antigos têm "IA"/"IA 2": passam a mostrar o nome da cor do mesmo assento).
export const civName=c=>!c?"":c.id==="player"?"Você":/^IA( \d+)?$/.test(c.name||"")&&RIVAL_NAMES[c.index-1]?RIVAL_NAMES[c.index-1]:String(c.name??c.id);
export const civSym=c=>CIV_SYMBOLS[c?.index]||"●";
