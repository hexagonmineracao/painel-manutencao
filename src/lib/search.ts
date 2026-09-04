// Remove acentos (via NFD + descarte dos diacríticos combinantes) pra
// busca ignorar acentuação, ex: "oleo" encontrar "óleo".
export function normalize(s: string) {
  return s
    .normalize('NFD')
    .split('')
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0
      return !(code >= 0x0300 && code <= 0x036f)
    })
    .join('')
    .toLowerCase()
    .trim()
}

export function matchesSearch(query: string, ...fields: Array<string | null | undefined>) {
  const q = normalize(query)
  if (!q) return true
  return fields.some((f) => f && normalize(f).includes(q))
}
