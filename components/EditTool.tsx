import React, { useMemo, useState } from 'react'
import { Edit3, CheckCircle2, AlertTriangle, FilePlus } from 'lucide-react'
import { useChapterStore } from '../stores/chapterStore'
import { validateData, CustomType } from '../sample_data/services/agentFieldModels'

interface ThemeConfig {
  backgroundColor?: string
  primaryColor?: string
  textColor?: string
  borderColor?: string
}

interface EditToolProps {
  selectedProjectId: string | null
  currentChapterId: string | null
  theme: ThemeConfig
  isChapterCounterEnabled: boolean
  autoRun?: boolean
  onSuggestionsReady?: (data: EditSuggestion) => void
}

type SuggestionType = 'grammar' | 'style' | 'logic'

interface ParagraphPatch {
  before: string
  after: string
  lines: { start: number; end: number }[]
}

interface SuggestionItem {
  type: SuggestionType
  severity: 'low'|'medium'|'high'
  title: string
  description: string
  paragraphPatch: ParagraphPatch
}

interface EditSuggestion {
  chapterId: string
  suggestions: SuggestionItem[]
  version: { history: Array<{ id: string; timestamp: number; summary: string; applied: boolean }> }
}

const splitParagraphs = (text: string) => text.split(/\n+/)

const makeGrammarFix = (p: string): string => p.replace(/。+/g, '。').replace(/！！+/g, '！')
const makeStyleFix = (p: string): string => p.replace(/非常非常/g, '非常').replace(/真的真的/g, '真的')
const makeLogicFix = (p: string): string => p

const buildPatch = (before: string): ParagraphPatch => {
  const after = makeGrammarFix(makeStyleFix(makeLogicFix(before)))
  const lines = [{ start: 1, end: splitParagraphs(before).length }]
  return { before, after, lines }
}

export default function EditTool({ selectedProjectId, currentChapterId, theme, isChapterCounterEnabled, autoRun = false, onSuggestionsReady }: EditToolProps) {
  const { chapters, saveChapter, createChapter } = useChapterStore()
  const chapter = useMemo(() => chapters.find(ch => ch.id === currentChapterId) || null, [chapters, currentChapterId])
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([])
  const [history, setHistory] = useState<Array<{ id: string; timestamp: number; summary: string; applied: boolean }>>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [notice, setNotice] = useState<string>('')
  const [autoKey, setAutoKey] = useState<string | null>(null)

  const generateSuggestions = () => {
    if (!chapter) return
    setIsProcessing(true)
    const paragraphs = splitParagraphs(chapter.content || '')
    const picks = paragraphs.slice(0, Math.min(3, paragraphs.length))
    const result: SuggestionItem[] = picks.map((p, idx) => ({
      type: idx % 3 === 0 ? 'grammar' : idx % 3 === 1 ? 'style' : 'logic',
      severity: idx % 3 === 0 ? 'low' : idx % 3 === 1 ? 'medium' : 'high',
      title: `段落优化 ${idx+1}`,
      description: '对该段落进行语法/风格/逻辑上的等行替换优化',
      paragraphPatch: buildPatch(p)
    }))
    setSuggestions(result)
    if (chapter && onSuggestionsReady) {
      const payload: EditSuggestion = { chapterId: chapter.id, suggestions: result, version: { history } }
      onSuggestionsReady(payload)
    }
    setIsProcessing(false)
  }

  const exportSuggestionJson = () => {
    if (!chapter || suggestions.length === 0) return
    const payload: EditSuggestion = {
      chapterId: chapter.id,
      suggestions,
      version: { history }
    }
    const schema = {
      type: CustomType.OBJECT,
      properties: {
        chapterId: { type: CustomType.STRING },
        suggestions: { type: CustomType.ARRAY, items: { type: CustomType.OBJECT, properties: { type: { type: CustomType.STRING }, severity: { type: CustomType.STRING }, title: { type: CustomType.STRING }, description: { type: CustomType.STRING }, paragraphPatch: { type: CustomType.OBJECT, properties: { before: { type: CustomType.STRING }, after: { type: CustomType.STRING }, lines: { type: CustomType.ARRAY } }, required: ['before','after','lines'] } }, required: ['type','severity','title','description','paragraphPatch'] } },
        version: { type: CustomType.OBJECT, properties: { history: { type: CustomType.ARRAY } }, required: ['history'] }
      },
      required: ['chapterId','suggestions','version']
    }
    const result = validateData(payload, schema as any)
    if (!result.isValid) {
      setNotice('建议JSON字段缺失: ' + result.missingFields.join(', '))
      setTimeout(() => setNotice(''), 2000)
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'edit_suggestion.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  React.useEffect(() => {
    if (autoRun && currentChapterId && !isProcessing) {
      if (autoKey !== currentChapterId) {
        setAutoKey(currentChapterId)
        if (suggestions.length === 0) generateSuggestions()
      }
    }
  }, [autoRun, currentChapterId])

  const requestApply = async (item: SuggestionItem) => {
    if (!chapter || !currentChapterId) return
    if (!isChapterCounterEnabled) {
      setNotice('请先在工具栏开启章节计数器以进行审批')
      setTimeout(() => setNotice(''), 2000)
      return
    }
    const before = chapter.content || ''
    const after = before.replace(item.paragraphPatch.before, item.paragraphPatch.after)
    const ok = window.confirm('确认申请审批并替换选中段落吗?')
    if (!ok) return
    try {
      await saveChapter(currentChapterId, { content: after })
      setHistory(prev => [{ id: String(Date.now()), timestamp: Date.now(), summary: item.title, applied: true }, ...prev])
      setNotice('已通过审批并保存')
      setTimeout(() => setNotice(''), 2000)
    } catch (e: any) {
      setNotice('保存失败,请稍后重试')
      setTimeout(() => setNotice(''), 2000)
    }
  }

  const requestCreateChapter = async () => {
    if (!selectedProjectId) return
    if (!isChapterCounterEnabled) {
      setNotice('请先在工具栏开启章节计数器以进行审批')
      setTimeout(() => setNotice(''), 2000)
      return
    }
    const base = chapter?.content || ''
    const title = chapter?.title ? chapter.title + '·续' : '新章节'
    const ok = window.confirm('确认申请审批并创建新章节吗?')
    if (!ok) return
    const numbers = chapters.filter(ch => ch.projectId === selectedProjectId).map(ch => ch.chapterNumber)
    const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1
    try {
      const created = await createChapter({ projectId: selectedProjectId, chapterNumber: nextNumber, title, content: base })
      if (created) {
        setHistory(prev => [{ id: String(Date.now()), timestamp: Date.now(), summary: `创建章节 ${created.title}`, applied: true }, ...prev])
        setNotice('已通过审批并创建章节')
        setTimeout(() => setNotice(''), 2000)
      }
    } catch {
      setNotice('创建失败,请稍后重试')
      setTimeout(() => setNotice(''), 2000)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Edit3 size={16} style={{ color: theme.primaryColor }} />
          <span className="text-sm" style={{ color: theme.textColor }}>编辑工具</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={generateSuggestions}
            disabled={!currentChapterId || isProcessing}
            className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white"
          >
            生成优化建议
          </button>
          <button
            onClick={exportSuggestionJson}
            disabled={!currentChapterId || suggestions.length === 0}
            className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white"
          >
            导出建议JSON
          </button>
          <button
            onClick={requestCreateChapter}
            disabled={!selectedProjectId}
            className="px-3 py-1.5 text-xs rounded bg-green-600 text-white flex items-center gap-1"
          >
            <FilePlus size={14} /> 创建新章节(审批)
          </button>
        </div>
      </div>
      {notice && (
        <div className="text-xs px-2 py-1 rounded" style={{ backgroundColor: `${theme.textColor}10`, color: theme.textColor }}>{notice}</div>
      )}
      <div className="space-y-1">
        {suggestions.length === 0 ? (
          <div className="text-xs" style={{ color: theme.textColor, opacity: 0.7 }}>暂无建议</div>
        ) : (
          suggestions.map((s, idx) => (
            <div key={idx} className="p-2 rounded border" style={{ borderColor: theme.borderColor }}>
              <div className="flex items-center justify-between">
                <div className="text-xs" style={{ color: theme.textColor }}>{s.title} · {s.type} · {s.severity}</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => requestApply(s)}
                    className="px-2 py-1 text-xs rounded bg-green-600 text-white flex items-center gap-1"
                  >
                    <CheckCircle2 size={12} /> 应用(审批)
                  </button>
                </div>
              </div>
              <div className="text-xs mt-1" style={{ color: theme.textColor, opacity: 0.85 }}>{s.description}</div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="text-xs p-2 rounded bg-gray-100 dark:bg-gray-800" style={{ color: theme.textColor }}>
                  {s.paragraphPatch.before}
                </div>
                <div className="text-xs p-2 rounded bg-gray-100 dark:bg-gray-800" style={{ color: theme.textColor }}>
                  {s.paragraphPatch.after}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      {history.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs" style={{ color: theme.textColor }}>编辑历史</div>
          {history.map(h => (
            <div key={h.id} className="flex items-center justify-between text-xs">
              <div style={{ color: theme.textColor }}>{new Date(h.timestamp).toLocaleString()}</div>
              <div style={{ color: theme.textColor, opacity: 0.8 }}>{h.summary}</div>
              <div className="flex items-center gap-1" style={{ color: theme.textColor }}>{h.applied ? '已应用' : '未应用'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
