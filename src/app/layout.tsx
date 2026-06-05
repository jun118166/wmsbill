import type { Metadata } from 'next';
import './globals.css';

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
        <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">AI</span>
                </div>
                <h1 className="text-lg font-semibold text-gray-900">万能导入 V2</h1>
              </div>
              <nav className="flex items-center gap-4">
                <a href="/import" className="text-sm text-gray-600 hover:text-primary transition-colors">
                  文件导入
                </a>
                <a href="/orders" className="text-sm text-gray-600 hover:text-primary transition-colors">
                  已导入运单
                </a>
              </nav>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
