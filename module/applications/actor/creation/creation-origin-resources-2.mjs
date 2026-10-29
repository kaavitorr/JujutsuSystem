const SCOPES = ["jujutsu-system", "JujutsuLegacy"];
const PATH = "system.legacy2.";
const GOJO_POWER_ID = "kTJxk9JvrOMOfOMF";
const SIX_EYES_ID = "H3NQzS9ioMwybCCd";
const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const canonicalSource = value => String(value ?? "")
  .replace(/^Compendium\.jujutsu-compendium\.geral\.Item\./, "Compendium.jujutsu-compendium.geral-2-0.Item.");
const featureSource = id => `Compendium.jujutsu-compendium.geral-2-0.Item.${id}`;

/**
 * Recover a source item's stable identities after it receives an owned ID.
 *
 * @param {object} item  Item source data.
 * @returns {Set<string>} Source UUIDs across both supported flag namespaces.
 */
function identities(item) {
  return new Set([item.uuid, item._stats?.compendiumSource,
    ...SCOPES.flatMap(scope => [item.flags?.[scope]?.sourceId, item.flags?.[scope]?.creation2Source])]
    .filter(Boolean).map(canonicalSource));
}

/**
 * Treat nullable metadata as absent without losing explicit zero or negatives.
 *
 * @param {*} value  A numeric metadata or effect value.
 * @returns {number|null} A finite number, or null when no number was authored.
 */
function number(value) {
  if ((value === null) || (value === undefined) || (String(value).trim() === "")) return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

/**
 * Read origin metadata, falling back to the same labeled description fields.
 *
 * @param {object} origin  Selected origin source data.
 * @returns {object} Initial resource base offsets authored on the origin.
 */
function originOffsets(origin) {
  const rules = origin.flags?.["jujutsu-system"]?.legacy2 ?? {};
  const text = (origin.system?.description?.value ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ");
  return {
    pvEspecie: number(rules.pvEspecie) ?? number(rules.vidaBase)
      ?? Number(/(?:Pontos de Vida Base|Vida Base)\s*:\s*([+-]?\d+)/i.exec(text)?.[1] ?? 0),
    energiaEspecie: number(rules.energiaEspecie)
      ?? Number(/Energia Base\s*:\s*([+-]?\d+)/i.exec(text)?.[1] ?? 0)
  };
}

/**
 * Restrict overlap to the selected origin and its actual initial grants.
 * @param {object} origin  Selected origin source data.
 * @param {object[]} items  Actual selected item sources.
 * @returns {Set<object>} The origin and its selected grant descendants.
 */
function originItems(origin, items) {
  const related = new Set([origin]);
  let changed = true;
  while (changed) {
    changed = false;
    const owners = new Set([...related].map(item => item._id).filter(Boolean));
    const sources = new Set();
    for (const item of related) for (const advancement of Object.values(item.system?.advancement ?? {})) {
      const config = advancement.configuration ?? {};
      if (advancement.type === "ItemGrant" && Number(advancement.level ?? 0) <= 1) {
        for (const grant of config.items ?? []) if (grant.uuid) sources.add(canonicalSource(grant.uuid));
      }
      if (advancement.type === "ItemChoice" && [0, 1].some(level => Number(config.choices?.[level]?.count) > 0)) {
        for (const grant of config.pool ?? []) if (grant.uuid) sources.add(canonicalSource(grant.uuid));
      }
    }
    for (const item of items) {
      if (related.has(item)) continue;
      const belongs = SCOPES.some(scope => ["advancementOrigin", "advancementRoot"].some(key =>
        owners.has(item.flags?.[scope]?.[key]?.split(".")[0])));
      if (belongs || [...identities(item)].some(id => sources.has(id))) {
        related.add(item); changed = true;
      }
    }
  }
  return related;
}

/**
 * Recognize unconditional source effects without evaluating gameplay conditions.
 *
 * @param {string|object|null} conditions  Serialized or plain effect conditions.
 * @returns {boolean} Whether no condition restricts the change.
 */
function unconditional(conditions) {
  if (!conditions) return true;
  if (typeof conditions === "string") {
    try { conditions = JSON.parse(conditions); }
    catch { return false; }
  }
  return conditions && typeof conditions === "object" && Object.keys(conditions).length === 0;
}

/**
 * Find an initial transferred ADD that already supplies the authored offset.
 *
 * @param {object} item  An origin or selected origin grant.
 * @param {string} key  Resource field within legacy2.
 * @param {number} amount  Offset authored on the origin.
 * @returns {boolean} Whether a transferred effect supplies that exact offset.
 */
function duplicatesOffset(item, key, amount) {
  if (!amount) return false;
  return (item.effects ?? []).some(effect => {
    if (!effect.transfer || effect.disabled || effect.isSuppressed
      || !unconditional(effect.system?.conditions)) return false;
    return (effect.system?.changes ?? effect.changes ?? []).some(change => {
      const add = change.type === "add" || (!change.type && Number(change.mode) === 2);
      // OVERRIDE already replaces the stored field. Different amounts may be
      // distinct benefits, so only an exact authored ADD replaces its fallback.
      return add && change.key === `${PATH}${key}` && number(change.value) === amount
        && (!change.phase || change.phase === "initial") && unconditional(change.conditions);
    });
  });
}

/**
 * Derive stored origin offsets from source data and the final selected items.
 * Call before preparing native effects, and again after optional advancements.
 * Recomputing never subtracts from a previously prepared actor, so it is safe
 * after selecting, deselecting, or revisiting choices. Items remain unchanged.
 * @param {Iterable<object>} items  Actual selected item documents or source data.
 * @returns {object} Actor source updates for the two origin resource fields.
 */
export function creationOriginResourceUpdates(items) {
  items = Array.from(items?.contents ?? items ?? [], item => {
    const data = item.toObject?.() ?? item;
    return item.uuid && !data.uuid ? { ...data, uuid: item.uuid } : data;
  });
  const origin = items.find(item => item.type === "race");
  if (!origin) return {};
  const offsets = originOffsets(origin);
  const related = originItems(origin, items);
  const gojo = normalize(origin.system?.identifier) === "gojo" || normalize(origin.name) === "linhagem - gojo";
  const sixEyes = items.some(item => item.type === "feat"
    && (identities(item).has(featureSource(SIX_EYES_ID)) || normalize(item.name) === "seis olhos"));
  const selectedPower = [...related].some(item => item.type === "feat"
    && (identities(item).has(featureSource(GOJO_POWER_ID)) || normalize(item.name) === "poder da linhagem"));
  // Gojo's +2 applies without Seis Olhos. The legendary Seis Olhos feat also
  // explicitly permits Poder da Linhagem as its Benefício Inerente; selecting
  // that item keeps its authored benefit, including a metadata fallback.
  if (gojo && sixEyes && !selectedPower) offsets.energiaEspecie = 0;
  for (const key of Object.keys(offsets)) {
    if ([...related].some(item => duplicatesOffset(item, key, offsets[key]))) offsets[key] = 0;
  }
  return Object.fromEntries(Object.entries(offsets).map(([key, value]) => [`${PATH}${key}`, value]));
}
