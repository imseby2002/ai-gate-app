import { CompanySocialResources } from './CompanySocialResources'

export default function AdminCompanySocialResourcesPage() {
  return (
    <div className="px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">公司社群矩陣資源</h1>
        <p className="text-gray-500 text-sm mt-1">
          設定每家公司的官方 IP 附贈數（ISP／住宅）與 AdsPower 模式。共享代管：環境數預設 200、成員席次每席每月 3 點；
          企業版為方案內附贈不扣點，一般公司版開通時從公司錢包預扣一期，到期每日自動續扣。
          開通前請先在 AdsPower 團隊後台建立分組（名稱需一致）與成員帳號，只授權該分組並開啟 API 權限。
        </p>
      </div>
      <CompanySocialResources />
    </div>
  )
}
