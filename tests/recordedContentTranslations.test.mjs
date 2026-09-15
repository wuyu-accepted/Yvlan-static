import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createStoredTextLocalizer } from '../src/campus-pulse/i18n/storedText.mjs'
const read = p => JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'))
test('saved template text switches both ways while custom writing is preserved',()=>{
 const catalog=read('../src/campus-pulse/i18n/uiCatalog.zh-en.json').translations
 const display=createStoredTextLocalizer(catalog)
 for(const [zh,en] of Object.entries(catalog).filter(([zh])=>zh.includes('世纪馆预约服务') || zh==='校园体育预约与公共服务')){
  assert.equal(display(zh,'en-US'),en)
  assert.equal(display(en,'zh-CN'),zh)
 }
 assert.equal(display('My own booking project!','zh-CN'),'My own booking project!')
 assert.equal(display('我自己的校园项目','en-US'),'我自己的校园项目')
 const ambiguous=createStoredTextLocalizer({'运行':'Run','推演':'Run'})
 assert.equal(ambiguous('Run','zh-CN'),'Run')
})
test('hot-list rows expand time-visible thread contents and extend playback',()=>{
 const source=readFileSync(new URL('../src/campus-pulse/live/CenturyGymLivePage.vue',import.meta.url),'utf8')
 assert.match(source, /<details class="hot-thread" @toggle=/)
 assert.match(source, /\.open && extendFrameForInspection\(\)/)
 assert.match(source, /v-for="message in item.rows"/)
 assert.match(source, /messages\.value\.filter\(\(message\) => message\.thread_id === thread\.thread_id\)/)
 assert.match(source, /<RecordedMessageText :text="message.visible_text"/)
})
test('every Century Gym public message has an offline English translation',()=>{
 const translations=read('../src/campus-pulse/i18n/centuryGymContent.en.json').translations
 const manifest=read('../../../evidence/century-gym-demo-v2/public-progress/latest.json')
 const originals=new Set()
 for(const entry of manifest.committed_ticks){
  const frame=read('../../../evidence/century-gym-demo-v2/public-progress/'+entry.path)
  for(const message of frame.public_branch.messages){
   const text=message.visible_text;originals.add(text)
   assert.ok(translations[text]?.length>15,text)
   assert.doesNotMatch(translations[text],/[\u3400-\u9fff]/)
  }
 }
 assert.equal(originals.size,199)
 assert.equal(Object.keys(translations).length,199)
})
