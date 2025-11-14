/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { Palette, Check, RefreshCw, Sparkles, Settings } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

// 经典色系配色方案(适合男生) - 优化对比度
const classicColorPalette = [
  { primaryColor: '#2D2D2D', primaryTextColor: '#FFFFFF', editorBgColor: '#1E1E1E', editorTextColor: '#FFFFFF', themeName: '经典黑' },
  { primaryColor: '#5A2DB8', primaryTextColor: '#FFFFFF', editorBgColor: '#1A0F33', editorTextColor: '#FFFFFF', themeName: '深紫罗兰' },
  { primaryColor: '#0F7A75', primaryTextColor: '#FFFFFF', editorBgColor: '#0D2E2C', editorTextColor: '#FFFFFF', themeName: '深青绿' },
  { primaryColor: '#B8860B', primaryTextColor: '#FFFFFF', editorBgColor: '#2D2110', editorTextColor: '#FFFFFF', themeName: '深金棕' },
  { primaryColor: '#6A4C6A', primaryTextColor: '#FFFFFF', editorBgColor: '#2A2126', editorTextColor: '#FFFFFF', themeName: '深紫灰' },
  { primaryColor: '#696969', primaryTextColor: '#FFFFFF', editorBgColor: '#2E2E2D', editorTextColor: '#FFFFFF', themeName: '深石灰' },
  { primaryColor: '#A0A2D0', primaryTextColor: '#000000', editorBgColor: '#E6E7F4', editorTextColor: '#000000', themeName: '浅紫蓝' },
  { primaryColor: '#5A7A3A', primaryTextColor: '#FFFFFF', editorBgColor: '#1F2617', editorTextColor: '#FFFFFF', themeName: '深橄榄' }
];

// 温柔色系配色方案(适合女生) - 优化对比度
const gentleColorPalette = [
  { primaryColor: '#E91E63', primaryTextColor: '#FFFFFF', editorBgColor: '#330E17', editorTextColor: '#FFFFFF', themeName: '热情粉红' },
  { primaryColor: '#FF7043', primaryTextColor: '#FFFFFF', editorBgColor: '#3D1E1C', editorTextColor: '#FFFFFF', themeName: '温柔珊瑚' },
  { primaryColor: '#F5DEB3', primaryTextColor: '#000000', editorBgColor: '#FDF2E3', editorTextColor: '#000000', themeName: '奶油杏色' },
  { primaryColor: '#D4D4AA', primaryTextColor: '#000000', editorBgColor: '#F5F5E6', editorTextColor: '#000000', themeName: '淡雅橄榄' },
  { primaryColor: '#4DB6AC', primaryTextColor: '#FFFFFF', editorBgColor: '#1A2D26', editorTextColor: '#FFFFFF', themeName: '清新薄荷' }
];

interface ThemeSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ThemeConfig {
  primaryColor: string;
  primaryTextColor: string;
  editorBgColor: string;
  editorTextColor: string;
  themeName: string;
}

const ThemeSettings: React.FC<ThemeSettingsProps> = ({ isOpen, onClose }) => {
  const { theme, setTheme } = useTheme();
  const [activePalette, setActivePalette] = useState<'classic' | 'gentle'>('classic');
  const [selectedTheme, setSelectedTheme] = useState<ThemeConfig>({
    primaryColor: '#333230',
    primaryTextColor: '#FFFFFF',
    editorBgColor: '#1E1E1E',
    editorTextColor: '#FFFFFF',
    themeName: '经典黑'
  });

  // 从Context加载当前主题设置
  useEffect(() => {
    if (theme) {
      setSelectedTheme({
        primaryColor: theme.primaryColor,
        primaryTextColor: theme.primaryTextColor,
        editorBgColor: theme.editorBgColor,
        editorTextColor: theme.editorTextColor,
        themeName: theme.themeName || '经典黑'
      });

      // 根据当前主色调决定活跃调色板
      const inClassic = classicColorPalette.some(c => c.primaryColor === theme.primaryColor);
      if (inClassic) setActivePalette('classic');
      else setActivePalette('gentle');
    }
  }, [theme]);

  // 应用主题设置
  const applyTheme = (config: ThemeConfig) => {
    setSelectedTheme(config);
    // 通过Context更新主题
    setTheme({
      primaryColor: config.primaryColor,
      primaryTextColor: config.primaryTextColor,
      editorBgColor: config.editorBgColor,
      editorTextColor: config.editorTextColor,
      themeName: config.themeName
    });
  };

  // 处理颜色选择
  const handleColorSelect = (colorObj: { primaryColor: string; primaryTextColor: string; editorBgColor: string; editorTextColor: string; themeName: string }) => {
    applyTheme(colorObj);
  };

  const handleEditorBgSelect = (colorObj: { bg: string; text: string; name: string }) => {
    const newTheme: ThemeConfig = {
      ...selectedTheme,
      editorBgColor: colorObj.bg,
      editorTextColor: colorObj.text
    };
    applyTheme(newTheme);
  };

  // 重置为默认主题
  const resetToDefault = () => {
    const defaultTheme: ThemeConfig = {
      primaryColor: '#333230',
      primaryTextColor: '#FFFFFF',
      editorBgColor: '#1E1E1E',
      editorTextColor: '#FFFFFF',
      themeName: '经典黑'
    };
    applyTheme(defaultTheme);
  };

  if (!isOpen) return null;

  const currentPalette = activePalette === 'classic' ? classicColorPalette : gentleColorPalette;

// 编辑器背景色选项
const EDITOR_BG_COLORS = [
  { bg: '#1E1E1E', text: '#FFFFFF', name: '深色' },
  { bg: '#FFFFFF', text: '#000000', name: '浅色' },
  { bg: '#F5F5F5', text: '#000000', name: '浅灰' },
  { bg: '#2D2D2D', text: '#FFFFFF', name: '炭黑' },
  { bg: '#0D2E2C', text: '#FFFFFF', name: '深青' },
  { bg: '#1A0F33', text: '#FFFFFF', name: '深紫' }
];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Palette className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">外观和主题设置</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="text-gray-500 dark:text-gray-400">✕</span>
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* 主题色选择 */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">主题色彩</h3>
            </div>
            
            {/* 色系切换 */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActivePalette('classic')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activePalette === 'classic'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                经典色系
              </button>
              <button
                onClick={() => setActivePalette('gentle')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activePalette === 'gentle'
                    ? 'bg-pink-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                温柔色系
              </button>
            </div>

            {/* 颜色选择网格 */}
            <div className="grid grid-cols-4 gap-3">
              {currentPalette.map((color, index) => (
                <div
                  key={index}
                  onClick={() => handleColorSelect(color)}
                  className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all hover:scale-105 ${
                    selectedTheme.primaryColor === color.primaryColor
                      ? 'border-purple-500 shadow-lg'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                  style={{ backgroundColor: color.primaryColor }}
                >
                  <div className="text-center">
                    <div 
                      className="w-8 h-8 rounded-full mx-auto mb-2 border-2 border-white shadow-sm"
                      style={{ backgroundColor: color.primaryTextColor }}
                    />
                    <p className="text-xs font-medium" style={{ color: color.primaryTextColor }}>
                      {color.themeName}
                    </p>
                  </div>
                  {selectedTheme.primaryColor === color.primaryColor && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 编辑器背景色选择 */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">编辑器外观</h3>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              {EDITOR_BG_COLORS.map((color, index) => (
                <div
                  key={index}
                  onClick={() => handleEditorBgSelect(color)}
                  className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all hover:scale-105 ${
                    selectedTheme.editorBgColor === color.bg
                      ? 'border-purple-500 shadow-lg'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                  style={{ backgroundColor: color.bg }}
                >
                  <div className="text-center">
                    <div 
                      className="w-8 h-8 rounded-full mx-auto mb-2 border-2 border-white shadow-sm"
                      style={{ backgroundColor: color.text }}
                    />
                    <p className="text-xs font-medium" style={{ color: color.text }}>
                      {color.name}
                    </p>
                  </div>
                  {selectedTheme.editorBgColor === color.bg && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 预览区域 */}
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">预览效果</h4>
            <div 
              className="p-6 rounded-lg border-2 border-gray-200 dark:border-gray-600"
              style={{ backgroundColor: selectedTheme.primaryColor }}
            >
              <h5 className="text-lg font-bold mb-2" style={{ color: selectedTheme.primaryTextColor }}>
                主题预览
              </h5>
              <p className="text-sm mb-4" style={{ color: selectedTheme.primaryTextColor }}>
                这是主题色彩的预览效果,您可以在这里看到主题色和文字颜色的搭配效果.
              </p>
              <div 
                className="p-4 rounded border"
                style={{ 
                  backgroundColor: selectedTheme.editorBgColor,
                  color: selectedTheme.editorTextColor,
                  borderColor: selectedTheme.primaryColor 
                }}
              >
                <p className="text-sm">这是编辑器区域的预览效果,显示背景色和文字颜色的对比.</p>
              </div>
            </div>
          </div>
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={resetToDefault}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            重置为默认
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => {
                applyTheme(selectedTheme);
                onClose();
              }}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              应用设置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemeSettings;