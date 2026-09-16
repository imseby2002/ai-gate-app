// 禁止「只解構 data、丟掉 error」的 Supabase 查詢寫法。
//
// 由來：profiles 與 companies 之間多了外鍵後，(app)/layout.tsx 裡
// `.select('*, companies(...)')` 開始回 PGRST201 讓整個查詢失敗。因為那行只解構了
// data、沒有接 error，錯誤完全沒有產生，profile 變成 null 被當作「沒登入」，已登入
// 的使用者被導回 /login，兩邊互彈成無限迴圈——而且沒有任何 log 可查。
//
// 這條規則只套用在「吞掉錯誤 ＝ 使用者被鎖在外面」的權限相關檔案（見
// eslint.config.mjs 的 files 設定）。全專案有 900 多處這種寫法，全面套用只會產生
// 幾百個沒人看的警告；限縮範圍才擋得住真正會出事的地方。
//
// 只檢查資料查詢（from / rpc 等鏈式呼叫）。auth.getUser() 這類先不納入：
// 它的錯誤處理牽涉「連線失敗要不要當成未登入」的設計取捨，不在這條規則的範圍。

const QUERY_METHODS = new Set([
  'from', 'rpc',
  'select', 'insert', 'update', 'upsert', 'delete',
  'single', 'maybeSingle',
])

// 沿著呼叫鏈往內找，看有沒有 Supabase 查詢會用到的方法名
function isSupabaseQuery(node) {
  let current = node
  while (current) {
    switch (current.type) {
      case 'AwaitExpression':
        current = current.argument
        break
      case 'CallExpression':
        current = current.callee
        break
      case 'MemberExpression':
        if (current.property?.type === 'Identifier' && QUERY_METHODS.has(current.property.name)) {
          return true
        }
        current = current.object
        break
      case 'TSNonNullExpression':
        current = current.expression
        break
      default:
        return false
    }
  }
  return false
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: '權限相關檔案的 Supabase 查詢必須接住 error，避免查詢失敗被誤判成沒有權限',
    },
    schema: [],
    messages: {
      swallowed:
        'Supabase 查詢沒有接住 error。查詢失敗時 data 會是 null，在這個檔案裡會被當成「查無資料／沒有權限」把使用者擋掉，而且不會留下任何線索。請改成 `const { data, error } = await ...` 並在 error 時記錄。',
    },
  },
  create(context) {
    return {
      VariableDeclarator(node) {
        if (node.id?.type !== 'ObjectPattern') return
        if (node.init?.type !== 'AwaitExpression') return
        if (!isSupabaseQuery(node.init.argument)) return

        const keys = node.id.properties
          .filter(p => p.type === 'Property' && p.key?.type === 'Identifier')
          .map(p => p.key.name)

        if (!keys.includes('data') || keys.includes('error')) return

        context.report({ node: node.id, messageId: 'swallowed' })
      },
    }
  },
}
