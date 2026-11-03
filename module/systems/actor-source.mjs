/** Read the saved system field without baking prepared Active Effect values into edits. */
export function savedSystemValue(actor, path, fallback) {
  const read = object => path.split(".").reduce((value, key) => value?.[key], object);
  return read(actor?.system?._source) ?? read(actor?._source?.system) ?? fallback;
}
