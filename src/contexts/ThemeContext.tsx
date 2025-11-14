/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface ThemeConfig {
  primaryColor: string;
  primaryTextColor: string;
  editorBgColor: string;
  editorTextColor: string;
  themeName: string;
}

interface ThemeContextType {
  theme: ThemeConfig;
  setTheme: (theme: ThemeConfig) => void;
  resetTheme: () => void;
}

const defaultTheme: ThemeConfig = {
  primaryColor: '#333230',
  primaryTextColor: '#FFFFFF',
  editorBgColor: '#1E1E1E',
  editorTextColor: '#FFFFFF',
  themeName: '经典黑'
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeConfig>(defaultTheme);

  // 从localStorage加载保存的主题设置
  useEffect(() => {
    const savedTheme = localStorage.getItem('themeConfig');
    if (savedTheme) {
      try {
        const parsedTheme = JSON.parse(savedTheme);
        setThemeState(parsedTheme);
        applyThemeToDOM(parsedTheme);
      } catch (e) {
        console.error('Failed to parse saved theme config:', e);
        applyThemeToDOM(defaultTheme);
      }
    } else {
      applyThemeToDOM(defaultTheme);
    }
  }, []);

  // 应用主题到DOM
  const applyThemeToDOM = (themeConfig: ThemeConfig) => {
    document.documentElement.style.setProperty('--primary-color', themeConfig.primaryColor);
    document.documentElement.style.setProperty('--primary-text-color', themeConfig.primaryTextColor);
    document.documentElement.style.setProperty('--editor-bg-color', themeConfig.editorBgColor);
    document.documentElement.style.setProperty('--editor-text-color', themeConfig.editorTextColor);
  };

  // 设置主题
  const setTheme = (newTheme: ThemeConfig) => {
    setThemeState(newTheme);
    localStorage.setItem('themeConfig', JSON.stringify(newTheme));
    applyThemeToDOM(newTheme);
    
    // 触发主题变更事件
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: newTheme }));
  };

  // 重置为默认主题
  const resetTheme = () => {
    setTheme(defaultTheme);
  };

  // 监听系统主题变化
  useEffect(() => {
    const handleThemeChange = (event: CustomEvent) => {
      if (event.detail && typeof event.detail === 'object') {
        setThemeState(event.detail as ThemeConfig);
      }
    };

    window.addEventListener('themeChanged', handleThemeChange as EventListener);
    
    return () => {
      window.removeEventListener('themeChanged', handleThemeChange as EventListener);
    };
  }, []);

  const value: ThemeContextType = {
    theme,
    setTheme,
    resetTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;