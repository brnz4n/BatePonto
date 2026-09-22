/**
 * Conversão para ISO 8859-1 (Latin-1) exigida pelo layout AFD da Portaria 671/2021 MTE. O
 * conjunto cobre todos os acentos do português (ç, ã, é, õ, â...), então cada code point do
 * texto de entrada já cabe em 1 byte — não é preciso transliterar, só truncar o que estiver
 * fora da tabela (0–255) para não corromper a contagem de colunas do arquivo de largura fixa.
 */
export function toIso88591Bytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    bytes[i] = code <= 0xff ? code : 0x3f // '?' para o raro caractere fora do Latin-1 (ex: emoji)
  }
  return bytes
}

const CRLF = new Uint8Array([13, 10])

/** Concatena as linhas já com terminação CR+LF (bytes 13,10) estrita entre cada uma. */
export function buildIso88591File(lines: string[]): Uint8Array {
  const encodedLines = lines.map((line) => toIso88591Bytes(line))
  const totalLength = encodedLines.reduce((sum, line) => sum + line.length + CRLF.length, 0)

  const output = new Uint8Array(totalLength)
  let offset = 0
  for (const line of encodedLines) {
    output.set(line, offset)
    offset += line.length
    output.set(CRLF, offset)
    offset += CRLF.length
  }

  return output
}
