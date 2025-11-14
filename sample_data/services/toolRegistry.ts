import { apiClient } from './apiClient'

export type JSONSchema = {
  type: 'object'
  properties?: Record<string, any>
  required?: string[]
}

export interface ToolSpec {
  id: string
  name: string
  description: string
  parameters: JSONSchema
  invoke: (args: any) => Promise<any>
  sample_args?: any
  expected_output?: any
}

class ToolRegistry {
  private specs: Map<string, ToolSpec> = new Map()

  register(spec: ToolSpec) {
    this.specs.set(spec.id, spec)
    this.specs.set(spec.name, spec)
  }

  getById(id: string): ToolSpec | undefined {
    return this.specs.get(id)
  }

  getByName(name: string): ToolSpec | undefined {
    return this.specs.get(name)
  }

  list(ids?: string[]): ToolSpec[] {
    if (!ids || ids.length === 0) return Array.from(new Set(this.specs.values()))
    const out: ToolSpec[] = []
    ids.forEach(id => {
      const s = this.getById(id) || this.getByName(id)
      if (s) out.push(s)
    })
    return out
  }
}

export const registry = new ToolRegistry()

registry.register({
  id: 'web_search',
  name: 'web_search',
  description: '搜索互联网以获取最新信息',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      num_results: { type: 'number' }
    },
    required: ['query']
  },
  invoke: async (args: any) => {
    const q = typeof args?.query === 'string' ? args.query : ''
    const n = typeof args?.num_results === 'number' ? args.num_results : 10
    const res = await apiClient.post('/api/v1/tools/web_search', { query: q, num_results: n })
    return res.data
  },
  sample_args: { query: 'Kimi Moonshot API 工具调用', num_results: 5 },
  expected_output: { results: [{ title: '...', url: '...', snippet: '...' }] }
})

registry.register({
  id: 'file_upload',
  name: 'file_upload',
  description: '上传文件并返回存储信息',
  parameters: { type: 'object', properties: { name: { type: 'string' }, content: { type: 'string' } }, required: ['name','content'] },
  invoke: async (args: any) => {
    return { success: false, message: '前端交互工具,请通过UI上传' }
  }
})

registry.register({
  id: 'quick_phrase',
  name: 'quick_phrase',
  description: '返回常用写作短语集合',
  parameters: { type: 'object', properties: { category: { type: 'string' } } },
  invoke: async (args: any) => {
    const c = args?.category || 'general'
    return { category: c, phrases: ['描写环境','刻画人物','转折推进'] }
  }
})

registry.register({
  id: 'workflow',
  name: 'workflow',
  description: '执行预设工作流并返回状态',
  parameters: { type: 'object', properties: { workflowId: { type: 'string' } }, required: ['workflowId'] },
  invoke: async (args: any) => {
    const id = args?.workflowId
    if (!id) return { success: false, message: '缺少 workflowId' }
    const { getWorkflowById, startWorkflow } = await import('./workflowManager')
    const wf = getWorkflowById(id)
    if (!wf) return { success: false, message: `未找到工作流: ${id}` }
    const executionId = await startWorkflow(wf)
    return { success: true, executionId, streamUrl: `/api/v1/workflows/stream/${executionId}` }
  },
  sample_args: { workflowId: 'default-8-agent-workflow' },
  expected_output: { success: true, executionId: '...', streamUrl: '/api/v1/workflows/stream/...' }
})

registry.register({
  id: 'knowledge_base',
  name: 'knowledge_base',
  description: '检索知识库并返回匹配项(章节/角色/情节/自建资料)',
  parameters: { type: 'object', properties: { projectId: { type: 'string' }, category: { type: 'string' }, subcategory: { type: 'string' }, query: { type: 'string' } }, required: ['projectId'] },
  invoke: async (args: any) => {
    const projectId = args?.projectId
    const category = (args?.category || 'chapter').toLowerCase()
    const query = (args?.query || '').toLowerCase()
    const sub = (args?.subcategory || '').toLowerCase()
    const items: any[] = []
    const readJson = async (path: string) => {
      const readRes = await apiClient.get('/api/workspace/read', { path })
      const content = readRes.data?.content || ''
      let parsed: any = {}
      try { parsed = JSON.parse(content) } catch { parsed = { content } }
      return { parsed, raw: content }
    }
    const listDir = async (base: string): Promise<{ files: string[]; directories: string[] }> => {
      const listRes = await apiClient.get('/api/workspace/list', { path: base })
      const files: string[] = (listRes.data?.files || [])
      const directories: string[] = (listRes.data?.directories || [])
      return { files, directories }
    }
    const collectUnder = async (base: string) => {
      const { files, directories } = await listDir(base)
      for (const f of files.filter((x) => x.endsWith('.json'))) {
        const full = `${base}/${f}`
        const { parsed, raw } = await readJson(full)
        items.push({ id: f, title: parsed.title || f.replace('.json',''), content: parsed.content || raw, tags: parsed.tags || [], updatedAt: parsed.updatedAt || Date.now(), category, sourcePath: full })
      }
      for (const d of directories) {
        const subBase = `${base}/${d}`
        const { files: sf } = await listDir(subBase)
        for (const f of sf.filter((x) => x.endsWith('.json'))) {
          const full = `${subBase}/${f}`
          const { parsed, raw } = await readJson(full)
          items.push({ id: `${d}/${f}`, title: parsed.title || f.replace('.json',''), content: parsed.content || raw, tags: parsed.tags || [], updatedAt: parsed.updatedAt || Date.now(), category, subcategory: d.toLowerCase(), sourcePath: full })
        }
      }
    }
    if (category === 'chapter') {
      const res = await apiClient.get(`/api/v1/chapters/project/${projectId}`)
      const chapters = Array.isArray(res.data) ? res.data : []
      chapters.forEach((ch: any) => {
        items.push({ id: ch.id, title: ch.title, content: ch.content || '', tags: ch.tags || [], chapterNumber: ch.chapterNumber, updatedAt: ch.updatedAt, category: 'chapter', sourcePath: `chapters/${projectId}/chap_${ch.chapterNumber}.json` })
      })
    } else {
      const base = `materials/${projectId}/${category}`
      if (sub) {
        await collectUnder(`${base}/${sub}`)
      } else {
        await collectUnder(base)
      }
    }
    const filtered = items.filter(it => !query || (it.title?.toLowerCase().includes(query) || it.content?.toLowerCase().includes(query) || (it.tags||[]).some((t: string) => t.toLowerCase().includes(query))))
    return { projectId, category, query, items: filtered.slice(0, 50) }
  },
  sample_args: { projectId: 'project-1', category: 'character', subcategory: '外貌', query: '眼神' },
  expected_output: { items: [{ id: '...', title: '...', content: '...' }] }
})

registry.register({
  id: 'workspace_fs',
  name: 'workspace_fs',
  description: '访问workspace文件系统(list/read/write)',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list','read','write'] },
      path: { type: 'string' },
      content: { type: 'string' }
    },
    required: ['action','path']
  },
  invoke: async (args: any) => {
    const action = args?.action
    const path = args?.path
    if (action === 'list') {
      const res = await apiClient.get('/api/workspace/list', { path })
      return res.data
    } else if (action === 'read') {
      const res = await apiClient.get('/api/workspace/read', { path })
      return res.data
    } else if (action === 'write') {
      const content = args?.content || ''
      const res = await apiClient.post('/api/workspace/write', { path, content })
      return res.data
    }
    return { success: false, message: '不支持的action' }
  },
  sample_args: { action: 'list', path: 'knowledge/project-1/plot' },
  expected_output: { files: ['a.json'], directories: [] }
})

export const runToolSamples = async () => {
  const results: Record<string, any> = {}
  for (const spec of registry.list()) {
    if (!spec.sample_args) continue
    try {
      const out = await spec.invoke(spec.sample_args)
      results[spec.id] = { ok: true, output: out, expected: spec.expected_output }
    } catch (e: any) {
      results[spec.id] = { ok: false, error: e?.message || String(e) }
    }
  }
  return results
}

export const getToolDefinitions = (ids: string[]) => {
  return registry.list(ids).map(s => ({
    type: 'function',
    function: {
      name: s.name,
      description: s.description,
      parameters: s.parameters
    }
  }))
}

export const invokeToolByName = async (name: string, args: any) => {
  const spec = registry.getByName(name)
  if (!spec) return null
  return spec.invoke(args)
}
