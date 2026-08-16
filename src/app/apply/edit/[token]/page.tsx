'use client'

import { useState, useEffect, useCallback, use, useRef } from 'react'

const DOC_TYPES = [
  { type: 'resume', label: '履歷' },
  { type: 'id_card', label: '身分證' },
  { type: 'application', label: '求職申請' },
  { type: 'cv', label: 'CV' },
  { type: 'diploma', label: '畢業證／學生證' },
  { type: 'health', label: '健康證明' },
  { type: 'birth', label: '出生證明' },
  { type: 'other', label: '其他' },
]

interface Cand {
  id: string; name: string; phone: string; email: string; position: string; store: string
  id_number: string; birthday: string | null; address: string; stage: string; hired_employee_id: string | null
  identity_locked: boolean
}
interface Doc { id: string; doc_type: string; label: string; file_name: string; uploaded_at: string; url: string }

export default function ApplyEditPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [cand, setCand] = useState<Cand | null>(null)
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pendingType = useRef<string>('other')

  const load = useCallback(async () => {
    const res = await fetch(`/api/hr/apply/${token}`)
    if (!res.ok) { setNotFound(true); setLoading(false); return }
    const d = await res.json()
    setCand({ ...d.candidate, birthday: d.candidate.birthday ?? '' })
    setDocs(d.documents ?? [])
    setLoading(false)
  }, [token])
  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!cand) return
    const res = await fetch(`/api/hr/apply/${token}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cand),
    })
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
    else alert((await res.json().catch(() => ({}))).error ?? '儲存失敗')
  }

  const pickFile = (type: string) => { pendingType.current = type; fileRef.current?.click() }
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(pendingType.current)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('doc_type', pendingType.current)
    const res = await fetch(`/api/hr/apply/${token}/documents`, { method: 'POST', body: fd })
    setUploading(null)
    if (res.ok) load()
    else alert((await res.json().catch(() => ({}))).error ?? '上傳失敗')
  }
  const removeDoc = async (id: string) => {
    if (!confirm('刪除此文件？')) return
    await fetch(`/api/hr/apply/${token}/documents`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
    })
    load()
  }

  if (loading) return <Center>載入中…</Center>
  if (notFound || !cand) return <Center>連結無效或已失效</Center>

  const setF = (k: keyof Cand) => (e: React.ChangeEvent<HTMLInputElement>) => setCand({ ...cand, [k]: e.target.value })
  const docsOf = (type: string) => docs.filter(d => d.doc_type === type)
  const locked = cand.identity_locked
  const lockedInp: React.CSSProperties = locked ? { ...inp, background: '#f1f5f9', color: '#94a3b8' } : inp

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', justifyContent: 'center', padding: '24px 16px' }}>
      <input ref={fileRef} type="file" hidden onChange={onFile}
        accept="image/*,application/pdf,.doc,.docx" />
      <div style={{ width: '100%', maxWidth: 520, display: 'grid', gap: 16 }}>
        <div style={card}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>我的應徵資料</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            可隨時回到此連結修改資料與上傳文件。請保存好此網址。
          </p>
        </div>

        <div style={card}>
          <h2 style={h2}>基本資料</h2>
          {locked && (
            <p style={{ fontSize: 12, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 10px', marginBottom: 12 }}>
              🔒 重要基本資料已鎖定，僅可修改電話與地址。如需更改其他欄位，請聯繫人事開放。
            </p>
          )}
          <div style={{ display: 'grid', gap: 12 }}>
            <F label="姓名"><input style={lockedInp} disabled={locked} value={cand.name} onChange={setF('name')} /></F>
            <F label="聯絡電話"><input style={inp} value={cand.phone} onChange={setF('phone')} /></F>
            <F label="Email"><input style={lockedInp} disabled={locked} value={cand.email} onChange={setF('email')} /></F>
            <F label="應徵職位"><input style={lockedInp} disabled={locked} value={cand.position} onChange={setF('position')} /></F>
            <F label="應徵門市"><input style={lockedInp} disabled={locked} value={cand.store} onChange={setF('store')} /></F>
            <F label="身分證字號"><input style={lockedInp} disabled={locked} value={cand.id_number} onChange={setF('id_number')} /></F>
            <F label="生日"><input style={lockedInp} disabled={locked} type="date" value={cand.birthday ?? ''} onChange={setF('birthday')} /></F>
            <F label="地址"><input style={inp} value={cand.address} onChange={setF('address')} /></F>
          </div>
          <button onClick={save}
            style={{ marginTop: 16, height: 42, width: '100%', borderRadius: 10, border: 'none', background: '#2563eb', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
            {saved ? '已儲存 ✓' : '儲存資料'}
          </button>
        </div>

        <div style={card}>
          <h2 style={h2}>應徵文件</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {DOC_TYPES.map(dt => {
              const list = docsOf(dt.type)
              return (
                <div key={dt.type} style={{ border: '1px solid #f1f5f9', borderRadius: 10, padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{dt.label}</span>
                    <button onClick={() => pickFile(dt.type)} disabled={uploading === dt.type}
                      style={{ fontSize: 13, padding: '5px 10px', borderRadius: 8, border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}>
                      {uploading === dt.type ? '上傳中…' : '＋ 上傳'}
                    </button>
                  </div>
                  {list.map(d => (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, fontSize: 13 }}>
                      <a href={d.url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>
                        {d.file_name}
                      </a>
                      <button onClick={() => removeDoc(d.id)} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13 }}>刪除</button>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

const card: React.CSSProperties = { background: 'white', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
const h2: React.CSSProperties = { fontSize: 15, fontWeight: 700, marginBottom: 14 }
const inp: React.CSSProperties = { width: '100%', height: 40, borderRadius: 8, border: '1px solid #e2e8f0', padding: '0 12px', fontSize: 14, boxSizing: 'border-box' }
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 13, color: '#475569', marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  )
}
function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 15 }}>{children}</div>
}
