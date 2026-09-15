import test from 'node:test'
import assert from 'node:assert/strict'
import { AGENT_ROLE_NAMES_EN, agentMicroRoleLabel, agentRoleLabel } from './agentWorldLabels.ts'

test('all fixed Agent-world roles have English labels', () => {
  assert.equal(Object.keys(AGENT_ROLE_NAMES_EN).length, 17)
  for (let index = 1; index <= 17; index += 1) {
    const roleId = `archetype-${String(index).padStart(2, '0')}`
    assert.doesNotMatch(agentRoleLabel(roleId, '中文角色', true), /[\u3400-\u9fff]/)
  }
})

test('micro-role labels retain their action and sequence without Chinese leakage', () => {
  assert.equal(
    agentMicroRoleLabel('校园规则办事询问者_question_04', 'archetype-03', '校园规则办事询问者', true),
    'Campus procedure inquirer · Question 04',
  )
  assert.equal(
    agentMicroRoleLabel('学习行动求助者_help_request_10', 'archetype-02', '学习行动求助者', true),
    'Learning-help seeker · Help request 10',
  )
})
