import bundledTranslations from './contentTranslations.en.json'
import gymTranslations from './centuryGymContent.en.json'

interface TranslationResponse {
  data?: { translation?: string; model?: string; source?: string }
}

const bundled = (bundledTranslations as { translations?: Record<string, string> }).translations || {}
const memory = new Map<string, string>(Object.entries({ ...bundled, ...gymTranslations.translations }))

export function savedEnglishText(text: string): string | null {
  const normalized = text.trim()
  if (!/[\u3400-\u9fff]/.test(normalized)) return normalized
  return memory.get(normalized) || null
}

export async function translateSyntheticContent(text: string): Promise<{ text: string; source: string }> {
  const normalized = text.trim()
  if (!normalized) return { text: '', source: 'empty' }
  const cached = memory.get(normalized)
  if (cached) return { text: cached, source: 'bundled' }
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await fetch('/api/campus-pulse/v1/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: normalized, target_language: 'en' }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = await response.json() as TranslationResponse
    const translated = payload.data?.translation?.trim()
    if (!translated) throw new Error('empty translation')
    memory.set(normalized, translated)
    return { text: translated, source: payload.data?.source || 'translation_api' }
  } finally {
    window.clearTimeout(timeout)
  }
}
