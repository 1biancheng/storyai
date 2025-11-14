import React, { useEffect, useState } from 'react'
import { BookOpen, Loader2, Download } from 'lucide-react'
import { getChaptersByProjectId } from '../sample_data/services/chapterApi'
import { validateData, CustomType } from '../sample_data/services/agentFieldModels'

interface ThemeConfig {
  backgroundColor?: string
  primaryColor?: string
  textColor?: string
  borderColor?: string
}

interface ReadingToolProps {
  selectedProjectId: string | null
  theme: ThemeConfig
  autoRun?: boolean
  onReportReady?: (report: ReadingReport) => void
}

type KeyEntity = { name: string; type: string; mentions: number }
type Relationship = { source: string; target: string; type: string; confidence: number }

interface ReadingReport {
  project: { id: string; name?: string; chapterCount: number; lastUpdated?: number }
  chapters: Array<{
    id: string
    chapterNumber: number
    title: string
    summary: string
    keyEntities: KeyEntity[]
    relationships: Relationship[]
  }>
  analysis: { themes: string[]; consistencyChecks: Array<{ issue: string; location: string; severity: 'low'|'medium'|'high' }> }
}

const topKeywords = (text: string, limit = 8): string[] => {
  const tokens = text
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const stop = new Set(['的','了','和','在','是','我','他','她','它','与','而','及','并','或','不','也','都','就','还','很','被','把'])
  const freq: Record<string, number> = {}
  for (const t of tokens) {
    if (t.length < 2) continue
    if (stop.has(t)) continue
    freq[t] = (freq[t] || 0) + 1
  }
  return Object.entries(freq)
    .sort((a,b) => b[1]-a[1])
    .slice(0, limit)
    .map(([w]) => w)
}

const buildSummary = (content: string): string => {
  const parts = content.split(/\n+/).map(s => s.trim()).filter(Boolean)
  const first = parts.slice(0, 2).join(' ')
  return first.length > 200 ? first.slice(0, 200) + '…' : first
}

const inferEntities = (content: string): KeyEntity[] => {
  const keys = topKeywords(content, 10)
  return keys.map(k => ({ name: k, type: 'term', mentions: 1 }))
}

const inferRelationships = (entities: KeyEntity[]): Relationship[] => {
  const res: Relationship[] = []
  for (let i = 0; i < Math.min(entities.length, 6); i++) {
    for (let j = i+1; j < Math.min(entities.length, 6); j++) {
      res.push({ source: entities[i].name, target: entities[j].name, type: 'co_occurrence', confidence: 0.6 })
    }
  }
  return res
}

export default function ReadingTool({ selectedProjectId, theme, autoRun = false, onReportReady }: ReadingToolProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [log, setLog] = useState<string>('')
  const [report, setReport] = useState<ReadingReport | null>(null)
  const [autoKey, setAutoKey] = useState<string | null>(null)

  const addLog = (s: string) => setLog(prev => prev ? prev + '\n' + s : s)

  const handleGenerate = async () => {
    if (!selectedProjectId) return
    setIsGenerating(true)
    setProgress(0)
    setLog('开始生成阅读报告…')
    try {
      const chapters = await getChaptersByProjectId(selectedProjectId)
      const total = chapters.length || 1
      const items = [] as ReadingReport['chapters']
      for (let idx = 0; idx < chapters.length; idx++) {
        const ch = chapters[idx]
        const summary = buildSummary(ch.content || '')
        const entities = inferEntities(ch.content || '')
        const rels = inferRelationships(entities)
        items.push({ id: ch.id, chapterNumber: ch.chapterNumber, title: ch.title || '', summary, keyEntities: entities, relationships: rels })
        const pct = Math.round(((idx+1)/total) * 100)
        setProgress(pct)
        addLog(`已解析章节 ${ch.chapterNumber} (${pct}%)`)
      }
      const lastUpdated = chapters.reduce((m, c) => Math.max(m, c.updatedAt || 0), 0)
      const themes = Array.from(new Set(items.flatMap(i => i.keyEntities.slice(0,3).map(e => e.name)))).slice(0,5)
      const checks: ReadingReport['analysis']['consistencyChecks'] = []
      const reportObj: ReadingReport = {
        project: { id: selectedProjectId, chapterCount: chapters.length, lastUpdated },
        chapters: items,
        analysis: { themes, consistencyChecks: checks }
      }
      const schema = {
        type: CustomType.OBJECT,
        properties: {
          project: { type: CustomType.OBJECT, properties: { id: { type: CustomType.STRING }, name: { type: CustomType.STRING }, chapterCount: { type: CustomType.INTEGER }, lastUpdated: { type: CustomType.INTEGER } }, required: ['id','chapterCount'] },
          chapters: { type: CustomType.ARRAY, items: { type: CustomType.OBJECT, properties: { id: { type: CustomType.STRING }, chapterNumber: { type: CustomType.INTEGER }, title: { type: CustomType.STRING }, summary: { type: CustomType.STRING }, keyEntities: { type: CustomType.ARRAY, items: { type: CustomType.OBJECT, properties: { name: { type: CustomType.STRING }, type: { type: CustomType.STRING }, mentions: { type: CustomType.INTEGER } }, required: ['name','type','mentions'] } }, relationships: { type: CustomType.ARRAY, items: { type: CustomType.OBJECT, properties: { source: { type: CustomType.STRING }, target: { type: CustomType.STRING }, type: { type: CustomType.STRING }, confidence: { type: CustomType.NUMBER } }, required: ['source','target','type','confidence'] } } }, required: ['id','chapterNumber','title','summary'] } },
          analysis: { type: CustomType.OBJECT, properties: { themes: { type: CustomType.ARRAY }, consistencyChecks: { type: CustomType.ARRAY } }, required: ['themes','consistencyChecks'] }
        },
        required: ['project','chapters','analysis']
      }
      const result = validateData(reportObj, schema as any)
      if (!result.isValid) {
        addLog('字段校验缺失: ' + result.missingFields.join(', '))
      }
      setReport(reportObj)
      if (onReportReady) onReportReady(reportObj)
      addLog('阅读报告生成完成')
    } catch (e: any) {
      addLog(`生成失败: ${e?.message || '未知错误'}`)
    } finally {
      setIsGenerating(false)
    }
  }

  useEffect(() => {
    if (autoRun && selectedProjectId && !isGenerating) {
      if (autoKey !== selectedProjectId) {
        setAutoKey(selectedProjectId)
        if (!report) handleGenerate()
      }
    }
  }, [autoRun, selectedProjectId])

  const handleExport = () => {
    if (!report) return
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'reading_report.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen size={16} style={{ color: theme.primaryColor }} />
          <span className="text-sm" style={{ color: theme.textColor }}>阅读工具</span>
        </div>
        <button
          onClick={handleGenerate}
          disabled={!selectedProjectId || isGenerating}
          className="px-3 py-1.5 text-xs rounded bg-green-600 text-white"
        >
          {isGenerating ? '解析中…' : '生成阅读报告'}
        </button>
      </div>
      <div className="text-xs" style={{ color: theme.textColor }}>进度: {progress}%</div>
      <div className="text-xs" style={{ color: theme.textColor, opacity: 0.7, whiteSpace: 'pre-wrap' }}>{log}</div>
      {report && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: theme.textColor }}>已生成阅读报告</span>
            <button onClick={handleExport} className="px-2 py-1 text-xs rounded bg-blue-600 text-white flex items-center gap-1">
              <Download size={12} /> 导出JSON
            </button>
          </div>
          <div className="text-xs" style={{ color: theme.textColor, opacity: 0.85 }}>
            章节: {report.chapters.length} · 主题: {report.analysis.themes.join('、')}
          </div>
        </div>
      )}
    </div>
  )
}
