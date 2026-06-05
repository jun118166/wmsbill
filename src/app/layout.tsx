import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';

export const metadata: Metadata = {
  title: '万能导入 - 智能多格式批量下单系统',
  description: '通过大模型实现任意格式文件的智能解析与导入',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="flex h-screen overflow-hidden">
          {/* 左侧导航栏 */}
          <Sidebar />

          {/* 右侧内容区 */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <header className="bg-white border-b border-gray-100 flex-shrink-0">
              <div className="px-6">
                <div className="flex items-center h-16">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">AI</span>
                    </div>
                    <h1 className="text-lg font-semibold text-gray-900">万能导入 V2</h1>
                  </div>
                </div>
              </div>
            </header>
            <main className="flex-1 overflow-y-auto px-6 py-8">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
