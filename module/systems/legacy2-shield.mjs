/** Shield halves damage only in its own layer; overflow retains its full value. */
export function absorbShieldDamage(points, damage) {
  const current = Math.max(0, Math.trunc(Number(points) || 0));
  const incoming = Math.max(0, Number(damage) || 0);
  const absorbed = Math.min(incoming, current * 2);
  const spent = Math.ceil(absorbed / 2);
  return { value: current - spent, remaining: incoming - absorbed, absorbed, spent };
}
