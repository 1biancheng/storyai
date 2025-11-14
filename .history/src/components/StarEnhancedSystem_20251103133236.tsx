import React from 'react'

const StarEnhancedSystem: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Star小说生成系统</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button className="text-gray-500 hover:text-gray-700">设置</button>
              <button className="text-gray-500 hover:text-gray-700">帮助</button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-medium text-gray-900 mb-2">欢迎使用Star小说生成系统</h2>
              <p className="text-gray-600 mb-6">一个基于AI的智能小说创作平台</p>
              <div className="space-x-4">
                <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded">
                  开始创作
                </button>
                <button className="bg-white hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded border">
                  查看教程
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default StarEnhancedSystem