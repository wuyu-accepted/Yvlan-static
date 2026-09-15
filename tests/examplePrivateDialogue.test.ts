import test from 'node:test'
import assert from 'node:assert/strict'
import { examplePrivateDialogue } from '../src/campus-pulse/agent-world/examplePrivateDialogue.ts'
import { distinctRuntimeEvidence, sharedEvidenceOwners, groupThreadMessages } from '../src/campus-pulse/agent-world/forumWorldRuntime.ts'

test('feed groups a busy thread without losing any individual message', () => {
 const rows=[{thread_id:'a',message_id:'3'},{thread_id:'b',message_id:'2'},{thread_id:'a',message_id:'1'}]
 const grouped=groupThreadMessages(rows)
 assert.deepEqual(grouped.map(group=>group[0].message_id),['3','2'])
 assert.deepEqual(grouped.flat().map(row=>row.message_id).sort(),['1','2','3'])
 assert.equal(rows.length,3)
})

test('repeated rendering is collapsed without rewriting source dialogue or counts', () => {
  const row={id:'m1',text:'同一句话。',kicker:'Reply',provenance:'authorized_live_llm',speaker:'A'}
  const rows=[row,{...row,id:'m2',text:'同一 句话。'}, {...row,id:'m3',text:'另一条回复。'}]
  const before=JSON.stringify(rows)
  assert.equal(distinctRuntimeEvidence(rows).length,2)
  assert.equal(JSON.stringify(rows),before)
  const base={sourceId:'a',targetId:'b',channel:'private_direct' as const,count:4}
  const edges=[{...base,id:'b',evidence:examplePrivateDialogue('housing',false,false,'b')},{...base,id:'a',evidence:examplePrivateDialogue('housing',false,false,'a')}]
  assert.equal(sharedEvidenceOwners(edges).get('b'),'a')
  assert.equal(sharedEvidenceOwners([...edges].reverse()).get('b'),'a')
  assert.equal(edges[0].count,4)
})

test('group preview has individual speakers, direct preview has only two participants', () => {
  const group = examplePrivateDialogue('gym', true, false, 'preview')
  assert.equal(group.length, 6)
  assert.equal(new Set(group.map(row => row.speaker)).size, 3)
  const direct = examplePrivateDialogue('gym', false, false, 'preview')
  assert.equal(direct.length, 4)
  assert.equal(new Set(direct.map(row => row.speaker)).size, 2)
})

test('examples carry explicit UI provenance and bilingual labels, not run provenance', () => {
  for (const english of [true, false]) {
    const messages = examplePrivateDialogue('governance_legitimacy_dispute', true, english, 'housing')
    for (const message of messages) {
      assert.equal(message.provenance, 'ui_example')
      assert.equal(message.kicker, english ? 'Conversation example' : '示例对话')
      assert.ok(message.text.length > 10)
      assert.match(message.id, /^ui-example:/)
      assert.ok(message.speaker)
      if (english) assert.doesNotMatch(message.text, /[\u4e00-\u9fff]/)
    }
  }
})

test('scenario previews do not leak gym copy into housing or unrelated projects', () => {
  const housing = examplePrivateDialogue('housing', true, false, 'a').map(row => row.text).join('')
  const generic = examplePrivateDialogue('custom-event', true, false, 'b').map(row => row.text).join('')
  assert.match(housing, /床位/)
  assert.doesNotMatch(housing, /羽毛球|预约/)
  assert.doesNotMatch(generic, /床位|羽毛球|讲座/)
  assert.notEqual(examplePrivateDialogue('gym', true, false, 'a')[0].id, examplePrivateDialogue('gym', true, false, 'b')[0].id)
})
