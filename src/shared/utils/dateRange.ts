/** Intervalo ISO (início às 00:00:00.000, fim às 23:59:59.999) de um mês, em horário local. */
export function monthRange(year: number, month: number): { startIso: string; endIso: string } {
  const start = new Date(year, month, 1, 0, 0, 0, 0)
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}
