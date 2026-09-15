export type GovernanceBranchId = 'Natural' | 'A' | 'B' | 'C' | 'D'

export interface GovernanceBranchPresentation {
  id: GovernanceBranchId
  name: string
  shortName: string
  description: string
}

const genericZh:Record<GovernanceBranchId,Omit<GovernanceBranchPresentation,'id'>> = {
  Natural:{name:'不追加治理回应',shortName:'不追加回应',description:'不引入新的治理动作，观察讨论如何自然发展。'},
  A:{name:'只解释标准与证据',shortName:'规则解释',description:'说明规则、标准和证据边界，但不承接个人问题。'},
  B:{name:'提供复核与服务入口',shortName:'服务承接',description:'让具体求助进入复核或服务处理流程。'},
  C:{name:'跨群体主动触达',shortName:'跨群触达',description:'主动接触没有直接发声或处于不同群体的人。'},
  D:{name:'多种治理措施组合',shortName:'组合治理',description:'根据有限信息组合解释、服务承接与主动触达。'},
}

const genericEn:Record<GovernanceBranchId,Omit<GovernanceBranchPresentation,'id'>> = {
  Natural:{name:'No additional governance response',shortName:'No added response',description:'Introduce no new governance action and observe how the discussion evolves.'},
  A:{name:'Standards and evidence only',shortName:'Rules explained',description:'Explain rules, standards, and evidence boundaries without handling individual cases.'},
  B:{name:'Review and service handoff',shortName:'Service handoff',description:'Route individual requests into a review or service workflow.'},
  C:{name:'Cross-group outreach',shortName:'Group outreach',description:'Proactively reach people who have not spoken directly or belong to other groups.'},
  D:{name:'Combined governance response',shortName:'Combined response',description:'Combine explanation, service handoff, and outreach using limited information.'},
}

export function branchPresentation(resultKey:string, id:GovernanceBranchId, english:boolean):GovernanceBranchPresentation {
  const source = english ? genericEn : genericZh
  const base = source[id]
  if (resultKey === 'resource-policy-r1') {
    if (id === 'A') return {id,...(english
      ? {name:'Explain allocation standards only',shortName:'Standards explained',description:'Publish allocation standards and evidence boundaries without opening an individual review path.'}
      : {name:'只解释分配标准',shortName:'解释标准',description:'公布分配标准和证据边界，但不提供个人复核入口。'})}
    if (id === 'D') return {id,...(english
      ? {name:'Standards, review service, and public Q&A',shortName:'Explanation and service',description:'Explain standards, accept review requests, issue service receipts, and answer publicly.'}
      : {name:'标准解释、复核服务与公开答疑',shortName:'解释并承接服务',description:'解释标准，同时承接复核请求、提供服务回执并公开答疑。'})}
  }
  if (resultKey === 'lecture-open-choice-r4' && id === 'D') return {id,...(english
    ? {name:'Active responsibility and follow-up',shortName:'Active follow-up',description:'Clarify responsibility, respond to concerns, and continue following up after the public apology.'}
    : {name:'主动说明责任并持续跟进',shortName:'主动跟进',description:'在公开道歉后说明责任、回应诉求并持续跟进。'})}
  return {id,...base}
}

export function branchDisplayName(resultKey:string,id:GovernanceBranchId,english:boolean,short=false):string {
  const item=branchPresentation(resultKey,id,english)
  const name=short?item.shortName:item.name
  if (english) return id==='Natural'?`${name} (Natural)`:`${name} (Plan ${id})`
  return id==='Natural'?`${name}（Natural）`:`${name}（方案 ${id}）`
}
