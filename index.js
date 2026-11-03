/**
 * Host half of the ASCII Sharks bundle.
 *
 * The ocean is browser-only: the Client module owns the canvas, the composer
 * dock entry, and the settings page. The Host contributes the inventory row and
 * its display metadata, so `apply` has nothing to mount.
 */
export const name = 'ascii-sharks'

export function apply() {}
