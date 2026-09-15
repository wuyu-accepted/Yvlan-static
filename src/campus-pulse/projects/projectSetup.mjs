// Keep the project id across partial initialization. The backend commits a
// single versioned scenario and its policies atomically and idempotently.
export async function saveProjectSetup(api, form, resume, persist) {
  if (!resume.projectId) {
    const project = await api.createProject({
      name: form.name.trim(), governance_domain: form.domain.trim(),
      objective: form.objective.trim(), evaluation_mode: 'simulation_stress_test',
    })
    if (!project?.project_id) throw new Error('Project creation returned no project id')
    resume.projectId = project.project_id
    persist()
  }
  await api.bootstrapProject(resume.projectId, {
    family: form.family || form.template,
    description: [form.event, form.facts, form.questions, form.affected].map(s => s.trim()).filter(Boolean).join('\n\n'),
    scope: form.scope.trim(),
  })
  return resume.projectId
}
