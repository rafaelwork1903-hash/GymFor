/**
 * Generación de IDs UUID v4 para las entidades del dominio.
 *
 * Usa crypto.randomUUID / crypto.getRandomValues cuando el runtime los
 * provee (Hermes reciente, web) y cae a un generador pseudoaleatorio en el
 * resto de casos. Suficiente para IDs locales offline-first; la capa de
 * sincronización futura puede reemplazar el generador sin tocar a los callers.
 */

function randomHex(size: number): string {
  const cryptoGlobal = globalThis.crypto
  if (cryptoGlobal?.getRandomValues) {
    const bytes = cryptoGlobal.getRandomValues(new Uint8Array(size))
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  }
  let hex = ''
  for (let i = 0; i < size; i += 1) {
    hex += Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0')
  }
  return hex
}

export function generarId(): string {
  const cryptoGlobal = globalThis.crypto
  if (typeof cryptoGlobal?.randomUUID === 'function') {
    return cryptoGlobal.randomUUID()
  }
  // RFC 4122 v4
  const hex = randomHex(16)
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-')
}

/** Marca temporal ISO 8601 actual (UTC). */
export function ahoraISO(): string {
  return new Date().toISOString()
}
