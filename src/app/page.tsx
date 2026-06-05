export default function Home() {
  return (
    <div className="space-y-8">
      <div className="text-center py-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          智能多格式批量下单系统
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          通过大模型实现任意格式文件（Excel / Word / PDF）的智能解析与导入，
          支持可配置的解析规则体系，代码零改动适配新格式。
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <a href="/import" className="card hover:shadow-md transition-shadow cursor-pointer group">
          <div className="w-12 h-12 bg-primary-light rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary transition-colors">
            <svg className="w-6 h-6 text-primary group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">文件导入</h3>
          <p className="text-sm text-gray-600">
            上传 Excel/Word/PDF 文件，AI 自动分析并生成解析规则
          </p>
        </a>

        <div className="card">
          <div className="w-12 h-12 bg-primary-light rounded-lg flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">规则引擎</h3>
          <p className="text-sm text-gray-600">
            可配置的解析规则，支持头部跳过、矩阵转置、卡片识别等复杂场景
          </p>
        </div>

        <a href="/orders" className="card hover:shadow-md transition-shadow cursor-pointer group">
          <div className="w-12 h-12 bg-primary-light rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary transition-colors">
            <svg className="w-6 h-6 text-primary group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">运单管理</h3>
          <p className="text-sm text-gray-600">
            查看已导入的运单记录，支持搜索、筛选和分页
          </p>
        </a>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">支持的出库单格式</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { name: '黎明屯配送发货单', type: 'Excel', feature: '尾部信息提取' },
            { name: '湖南仓发货明细', type: 'Excel', feature: '跨行聚合' },
            { name: '欢乐牧场模板', type: 'Excel', feature: '矩阵转置' },
            { name: '黔寨寨配送单', type: 'PDF', feature: 'PDF解析' },
            { name: '多门店分Sheet出库单', type: 'Excel', feature: '多Sheet合并' },
            { name: '门店调拨单(卡片式)', type: 'Excel', feature: '卡片识别' },
            { name: '门店配送确认单', type: 'Word', feature: '纯文本解析' },
            { name: '周配送计划', type: 'Excel', feature: '双重转置' },
            { name: '配送签收单(多单PDF)', type: 'PDF', feature: '多订单拆分' },
          ].map((item) => (
            <div key={item.name} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <span className={`tag ${item.type === 'PDF' ? 'bg-red-50 text-red-600' : item.type === 'Word' ? 'bg-orange-50 text-orange-600' : ''}`}>
                {item.type}
              </span>
              <div>
                <p className="text-sm font-medium text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-500">{item.feature}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
