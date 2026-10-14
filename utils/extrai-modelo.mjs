// Extrai o pack geral-2-0 DO MÓDULO jujutsu-compendium (modelo do autor)
// para packs/_source/geral-2-0-modelo — referência versionada do estado in-game.
// Servidor precisa estar desligado (LevelDB destravado).
import { extractPack } from "@foundryvtt/foundryvtt-cli";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const origem = path.normalize(path.join(aqui, "..", "..", "..", "modules", "jujutsu-compendium", "packs", "geral-2-0"));
const destino = path.join(aqui, "..", "packs", "_source", "geral-2-0-modelo");
await extractPack(origem, destino, { recursive: true, log: false, yaml: true });
console.log("EXTRAÇÃO OK →", destino);
