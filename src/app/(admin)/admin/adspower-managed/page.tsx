import { AdspowerManagedTable } from './AdspowerManagedTable'

export default function AdminAdspowerManagedPage() {
  return (
    <div className="px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AdsPower 代管帳號</h1>
        <p className="text-gray-500 text-sm mt-1">
          客人申請「AI-GATE 代管 AdsPower」的清單。開通步驟：在 AdsPower 團隊後台建立成員帳號與專屬分組（名稱需與下方「分組」一致），
          只把該分組授權給此成員並開啟 API 權限，再回來填入登入帳號、密碼並按「開通」。
        </p>
      </div>
      <AdspowerManagedTable />
    </div>
  )
}
