// 公開測驗的題庫答案（只在伺服器端使用，不送到前端）
export const QUIZZES: Record<string, { title: string; answers: Record<string, string> }> = {
  'sop-video': {
    title: '短影音 SOP 測驗',
    answers: { q1: 'A', q2: 'B', q3: 'A', q4: 'B', q5: 'C', q6: 'A', q7: 'B', q8: 'A', q9: 'A', q10: 'B' },
  },
}
