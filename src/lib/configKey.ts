import type { ConfigResult } from "./modelTypes";

/**
 * Stable identity for a `(architecture, cell, S, P)` row. Used as the key
 * for the selection set, for highlighting points in charts, and for any
 * cross-component "is this the same config" check.
 */
export function configKey(c: {
  architecture: string;
  cell: string;
  S: number;
  P: number;
}): string {
  return `${c.architecture}|${c.cell}|${c.S}|${c.P}`;
}

/** Pull the matching configs out of `pool` by selectedKeys, preserving
 *  the order configs appear in the pool. */
export function configsByKeys(
  pool: ConfigResult[],
  keys: Set<string>,
): ConfigResult[] {
  if (keys.size === 0) return [];
  return pool.filter((c) => keys.has(configKey(c)));
}
