// Localize exact, curated template copy in either direction. Free-form user
// content is preserved; partial phrase replacement would corrupt authored text.
export function createStoredTextLocalizer(catalog) {
  const reverse = new Map()
  for (const [zh, en] of Object.entries(catalog)) {
    if (typeof en !== 'string' || !/[\u3400-\u9fff]/.test(zh)) continue
    reverse.set(en, reverse.has(en) && reverse.get(en) !== zh ? null : zh)
  }
  return (value, locale) => String(value ?? '').split('\n').map(line => {
    const key = line.trim()
    const replacement = locale === 'en-US' ? catalog[key] : reverse.get(key)
    return typeof replacement === 'string' ? line.replace(key, replacement) : line
  }).join('\n')
}
