import assert from 'node:assert/strict'
import test from 'node:test'
import { saveProjectSetup } from '../src/campus-pulse/projects/projectSetup.mjs'
const form={template:'custom',name:'Test project',domain:'Services',objective:'Compare responses',event:'Queue dispute',facts:'An initial post',questions:'Who responds?',affected:'Applicants',scope:'Service feedback'}
function harness(){
 const calls=[]
 const api={
  createProject:async payload=>{calls.push(['project',payload]);return {project_id:'p1'}},
  bootstrapProject:async(id,payload)=>{calls.push(['bootstrap',payload]);return {created:{scenarios:1,policies:2}}},
 }
 return {api,calls}
}
test('one request initializes exactly the authored scenario and explicit family',async()=>{
 const h=harness();await saveProjectSetup(h.api,form,{},()=>{})
 assert.deepEqual(h.calls.map(x=>x[0]),['project','bootstrap'])
 const payload=h.calls[1][1]
 assert.equal(payload.family,'custom')
 for(const value of [form.event,form.facts,form.questions,form.affected]) assert.ok(payload.description.includes(value))
 assert.equal(payload.scope,form.scope)
})
test('partial setup retries use the same committed project',async()=>{
 const h=harness();const resume={};const original=h.api.bootstrapProject
 h.api.bootstrapProject=async()=>{throw Error('unavailable')}
 await assert.rejects(saveProjectSetup(h.api,form,resume,()=>{}),/unavailable/)
 h.api.bootstrapProject=original;await saveProjectSetup(h.api,form,resume,()=>{})
 assert.equal(h.calls.filter(x=>x[0]==='project').length,1)
})
test('Century Gym and manually entered demo use explicit binding and no Provider calls',async()=>{
 for(const input of [{...form,template:'century_gym'},{...form,family:'century_gym'}]){
  const h=harness();await saveProjectSetup(h.api,input,{},()=>{})
  assert.equal(h.calls[1][1].family,'century_gym')
  assert.equal(h.calls.length,2)
 }
})
