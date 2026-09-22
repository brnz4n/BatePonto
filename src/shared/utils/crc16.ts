/**
 * CRC-16/CCITT-FALSE (polinômio 0x1021, valor inicial 0xFFFF, sem reflexão) — variante usada
 * pelos geradores de AFD do mercado para os registros de controle (Tipo 1 e Tipo 9) exigidos
 * pela Portaria 671/2021 MTE.
 */
export function crc16(bytes: Uint8Array): number {
  let crc = 0xffff

  for (const byte of bytes) {
    crc ^= byte << 8
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }

  return crc
}

/** Retorna o CRC-16 já formatado como 4 dígitos hexadecimais maiúsculos, padrão exigido no layout. */
export function crc16Hex(bytes: Uint8Array): string {
  return crc16(bytes).toString(16).toUpperCase().padStart(4, '0')
}
