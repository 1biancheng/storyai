import React, { useState } from 'react';
import { 
  Zap, 
  FileText, 
  Sparkles, 
  PenTool, 
  User, 
  List, 
  Lightbulb,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface QuickPhraseProps {
  onPhraseSelect: (phrase: string, type: string) => void;
  className?: string;
}

interface PhraseCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  items: PhraseItem[];
}

interface PhraseItem {
  id: string;
  title: string;
  content: string;
  description?: string;
}

const QuickPhraseTool: React.FC<QuickPhraseProps> = ({ onPhraseSelect, className = '' }) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['quick-actions']));
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const handlePhraseClick = (phrase: PhraseItem, category: PhraseCategory) => {
    setSelectedItem(phrase.id);
    onPhraseSelect(phrase.content, category.name);
  };

  const phraseCategories: PhraseCategory[] = [
    {
      id: 'quick-actions',
      name: '快速功能',
      icon: <Zap className="w-4 h-4" />,
      items: [
        {
          id: 'qa-1',
          title: '总结当前内容',
          content: '请帮我总结当前章节的主要内容,提取关键情节和人物发展.',
          description: '快速提取章节要点'
        },
        {
          id: 'qa-2',
          title: '扩展当前段落',
          content: '请帮我扩展当前段落,增加更多细节描述和情感表达.',
          description: '丰富段落内容'
        },
        {
          id: 'qa-3',
          title: '检查语法错误',
          content: '请帮我检查当前文本中的语法错误和表达不当之处.',
          description: '提升文本质量'
        },
        {
          id: 'qa-4',
          title: '生成情节',
          content: '请帮我为当前故事生成一个精彩的情节,包含冲突、转折和高潮.',
          description: '创造引人入胜的情节'
        },
        {
          id: 'qa-5',
          title: '润色文字',
          content: '请帮我润色这段文字,提升文学性、流畅度和表达效果.',
          description: '优化文本表达质量'
        },
        {
          id: 'qa-6',
          title: '续写内容',
          content: '请帮我续写当前内容,保持故事连贯性和风格一致性.',
          description: '延续故事发展'
        },
        {
          id: 'qa-7',
          title: '分析章节',
          content: '请帮我分析当前章节的结构、主题、人物发展和情节推进.',
          description: '深度分析章节内容'
        }
      ]
    },
    {
      id: 'generate-paragraph',
      name: '生成段落',
      icon: <FileText className="w-4 h-4" />,
      items: [
        {
          id: 'gp-1',
          title: '描写环境',
          content: '请帮我生成一段生动的环境描写,包括视觉、听觉和嗅觉等感官细节.',
          description: '创造沉浸式场景'
        },
        {
          id: 'gp-2',
          title: '人物对话',
          content: '请帮我生成一段符合人物性格的对话,体现角色之间的关系和情感.',
          description: '丰富人物互动'
        },
        {
          id: 'gp-3',
          title: '动作描写',
          content: '请帮我生成一段精彩的动作描写,使场景更加生动和紧张.',
          description: '增强场景动感'
        }
      ]
    },
    {
      id: 'polish-text',
      name: '润色文本',
      icon: <Sparkles className="w-4 h-4" />,
      items: [
        {
          id: 'pt-1',
          title: '提升文采',
          content: '请帮我润色这段文字,使用更优美的词汇和修辞手法,增强文学性.',
          description: '提高文本文学性'
        },
        {
          id: 'pt-2',
          title: '调整语气',
          content: '请帮我调整这段文字的语气,使其更加[紧张/轻松/悲伤/欢快].',
          description: '改变文本情感基调'
        },
        {
          id: 'pt-3',
          title: '精简表达',
          content: '请帮我精简这段文字,去除冗余表达,使语言更加简洁有力.',
          description: '提高表达效率'
        }
      ]
    },
    {
      id: 'continue-story',
      name: '续写故事',
      icon: <PenTool className="w-4 h-4" />,
      items: [
        {
          id: 'cs-1',
          title: '续写当前场景',
          content: '请帮我续写当前场景,保持风格一致,推动情节发展.',
          description: '自然衔接当前内容'
        },
        {
          id: 'cs-2',
          title: '添加转折',
          content: '请帮我为当前情节添加一个意想不到的转折,增加故事张力.',
          description: '创造情节起伏'
        },
        {
          id: 'cs-3',
          title: '推进高潮',
          content: '请帮我推进故事高潮,增强紧张感和戏剧冲突.',
          description: '提升故事张力'
        }
      ]
    },
    {
      id: 'character-shaping',
      name: '角色塑造',
      icon: <User className="w-4 h-4" />,
      items: [
        {
          id: 'cs-1',
          title: '角色背景',
          content: '请帮我为[角色名]设计一个丰富的背景故事,包括成长经历和性格成因.',
          description: '构建角色深度'
        },
        {
          id: 'cs-2',
          title: '心理描写',
          content: '请帮我描写[角色名]的内心活动,展现其复杂的情感和思想.',
          description: '深化角色内心'
        },
        {
          id: 'cs-3',
          title: '角色关系',
          content: '请帮我发展[角色A]和[角色B]之间的关系,增加互动和情感变化.',
          description: '丰富角色互动'
        }
      ]
    },
    {
      id: 'plot-outline',
      name: '情节大纲',
      icon: <List className="w-4 h-4" />,
      items: [
        {
          id: 'po-1',
          title: '章节大纲',
          content: '请帮我为下一章设计一个详细的大纲,包括主要情节、转折点和结局.',
          description: '规划章节结构'
        },
        {
          id: 'po-2',
          title: '故事线索',
          content: '请帮我梳理当前故事的主要线索,分析伏笔和后续发展可能性.',
          description: '整理故事脉络'
        },
        {
          id: 'po-3',
          title: '多线叙事',
          content: '请帮我设计一个多线叙事结构,使故事更加丰富和立体.',
          description: '构建复杂叙事'
        }
      ]
    },
    {
      id: 'creative-inspiration',
      name: '创意灵感',
      icon: <Lightbulb className="w-4 h-4" />,
      items: [
        {
          id: 'ci-1',
          title: '情节灵感',
          content: '请给我一些关于[主题]的情节灵感,帮助我突破创作瓶颈.',
          description: '获取创意点子'
        },
        {
          id: 'ci-2',
          title: '设定灵感',
          content: '请给我一些关于世界观设定的创意灵感,使故事更加独特.',
          description: '丰富世界观'
        },
        {
          id: 'ci-3',
          title: '标题灵感',
          content: '请为我的小说提供一些有创意的标题建议,体现故事核心主题.',
          description: '寻找合适标题'
        }
      ]
    }
  ];

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">快捷短语</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">选择预设提示词,快速获取AI帮助</p>
      </div>
      
      <div className="max-h-80 overflow-y-auto">
        {phraseCategories.map(category => (
          <div key={category.id} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
            <button
              onClick={() => toggleCategory(category.id)}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center space-x-2">
                {expandedCategories.has(category.id) ? 
                  <ChevronDown className="w-4 h-4 text-gray-500" /> : 
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                }
                {category.icon}
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {category.name}
                </span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {category.items.length}
              </span>
            </button>
            
            {expandedCategories.has(category.id) && (
              <div className="px-4 pb-3 space-y-2">
                {category.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handlePhraseClick(item, category)}
                    className={`w-full text-left p-3 rounded-md transition-colors ${
                      selectedItem === item.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                        : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 border border-transparent'
                    }`}
                  >
                    <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                      {item.title}
                    </div>
                    {item.description && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {item.description}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuickPhraseTool;