import { extractPack } from "@foundryvtt/foundryvtt-cli";
import path from "node:path";
const origem = "C:/Users/kaa_v/Documents/FoundryVTT/Data/modules/jujutsu-compendium/packs/geral";
const destino = "C:/Users/kaa_v/Documents/FoundryVTT/Data/systems/jujutsu-system/packs/_source/_geral-1-0";
await extractPack(origem, destino, { recursive: true, log: false, yaml: true });
console.log("OK");
