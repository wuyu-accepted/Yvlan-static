import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const inventory = JSON.parse(readFileSync(resolve('src/campus-pulse/i18n/uiStrings.zh.json'), 'utf8'))
const catalog = JSON.parse(readFileSync(resolve('src/campus-pulse/i18n/uiCatalog.zh-en.json'), 'utf8'))
const strings = Array.isArray(inventory.strings) ? inventory.strings : []
const translations = catalog.translations || {}
const missing = strings.filter((value) => !translations[value])

console.log(JSON.stringify({ strings: strings.length, translations: Object.keys(translations).length, missing }, null, 2))
if (missing.length) process.exit(1)
