'use client'

import { useState } from 'react'
import type { CsFormField } from '@/app/api/marketing/cs-forms/route'

export default function FormClient({
  slug,
  name,
  fields,
}: {
  slug: string
  name: string
  fields: CsFormField[]
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const setAnswer = (id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/public/cs-form/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '送出失敗，請稍後再試')
        return
      }
      setDone(true)
    } catch {
      setError('送出失敗，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <div className="mb-3 text-3xl">✅</div>
          <h1 className="mb-2 text-lg font-semibold text-gray-900">已送出</h1>
          <p className="text-sm text-gray-500">感謝您的填寫，我們已收到您的回覆。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <form
        onSubmit={handleSubmit}
        className="mx-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-sm"
      >
        <h1 className="mb-6 text-lg font-semibold text-gray-900">{name}</h1>

        {fields.map((f) => (
          <div key={f.id} className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {f.label}
              {f.required && <span className="ml-1 text-red-500">*</span>}
            </label>

            {f.type === 'textarea' && (
              <textarea
                value={answers[f.id] ?? ''}
                onChange={(e) => setAnswer(f.id, e.target.value)}
                required={f.required}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
              />
            )}

            {f.type === 'select' && (
              <select
                value={answers[f.id] ?? ''}
                onChange={(e) => setAnswer(f.id, e.target.value)}
                required={f.required}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
              >
                <option value="" disabled>
                  請選擇
                </option>
                {(f.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}

            {f.type === 'radio' && (
              <div className="space-y-2">
                {(f.options ?? []).map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      name={f.id}
                      value={opt}
                      checked={answers[f.id] === opt}
                      onChange={(e) => setAnswer(f.id, e.target.value)}
                      required={f.required}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}

            {f.type === 'number' && (
              <input
                type="number"
                value={answers[f.id] ?? ''}
                onChange={(e) => setAnswer(f.id, e.target.value)}
                required={f.required}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
              />
            )}

            {f.type === 'text' && (
              <input
                type="text"
                value={answers[f.id] ?? ''}
                onChange={(e) => setAnswer(f.id, e.target.value)}
                required={f.required}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
              />
            )}
          </div>
        ))}

        {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? '送出中...' : '送出'}
        </button>
      </form>
    </div>
  )
}
