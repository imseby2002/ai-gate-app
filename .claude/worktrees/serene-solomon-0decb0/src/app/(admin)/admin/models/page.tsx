import { createClient } from '@/lib/supabase/server'
import { ModelConfigTable } from '@/components/admin/ModelConfigTable'

export default async function AdminModelsPage() {
  const supabase = await createClient()

  const { data: models } = await supabase
    .from('ai_models')
    .select('*')
    .order('sort_order')

  return (
    <div className="px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">模型設定</h1>
        <p className="text-gray-500 text-sm mt-1">啟用/停用模型，更新費率設定</p>
      </div>
      <ModelConfigTable models={models ?? []} />
    </div>
  )
}
