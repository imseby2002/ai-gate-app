// 公開測驗題庫（中／英／越三語）。
// 題目與選項由 GET /api/quiz/[id] 提供（不含答案）；正確答案與解說只在交卷後由 POST /api/quiz/submit 回傳。

export const QUIZ_LANGS = ['zh', 'en', 'vi'] as const
export type QuizLang = (typeof QUIZ_LANGS)[number]
export type L10n = Record<QuizLang, string>

export interface QuizQuestion {
  id: string
  question: L10n
  options: Record<'A' | 'B' | 'C', L10n>
  answer: 'A' | 'B' | 'C'
  explanation: L10n
}

export interface Quiz {
  title: L10n
  questions: QuizQuestion[]
}

export const QUIZZES: Record<string, Quiz> = {
  'sop-video': {
    title: {
      zh: '短影音 SOP 測驗',
      en: 'Short Video SOP Quiz',
      vi: 'Bài Kiểm Tra SOP Video Ngắn',
    },
    questions: [
      {
        id: 'q1',
        question: {
          zh: '依照 SOP 黃金鉤子（前 0～3 秒）規範，下列哪一項是絕對禁止的？',
          en: 'According to the SOP for the Golden Hook stage (the first 0–3 seconds), which of the following is strictly prohibited?',
          vi: 'Theo quy chuẩn SOP của giai đoạn Vàng Hook (0~3 giây đầu tiên), hành động nào sau đây bị cấm tuyệt đối?',
        },
        options: {
          A: { zh: '使用傳統的自我介紹開場。', en: 'Using a traditional self-introduction.', vi: 'Sử dụng màn giới thiệu bản thân truyền thống.' },
          B: { zh: '使用動態轉場特效。', en: 'Using dynamic transition effects.', vi: 'Sử dụng hiệu ứng chuyển cảnh động.' },
          C: { zh: '立即凸顯問題／痛點。', en: 'Highlighting the problem / pain point immediately.', vi: 'Làm nổi bật vấn đề/nỗi đau ngay lập tức.' },
        },
        answer: 'A',
        explanation: {
          zh: '依 SOP 第 1 章，自我介紹（如「大家好，我是XX」）或停頓超過 0.5 秒，會直接導致前 3 秒留存率下降，屬於硬性規定中嚴格禁止的行為。',
          en: 'Per Chapter 1 of the SOP, self-introductions (e.g. "Hi everyone, I\'m XX") or pauses longer than 0.5 seconds directly lower the first-3-second retention rate, and are strictly prohibited under the hard rules.',
          vi: 'Theo Chương 1 của SOP, các hình thức tự giới thiệu (như "Xin chào mọi người, tôi là XX") hoặc ngừng nghỉ quá 0.5 giây sẽ trực tiếp làm giảm tỷ lệ giữ chân trong 3 giây đầu, thuộc hành vi bị nghiêm cấm trong các quy tắc cứng.',
        },
      },
      {
        id: 'q2',
        question: {
          zh: '在剪輯節奏設計原則中，任何單一畫面（單一鏡頭）允許的最長時間是多少？',
          en: 'Under the editing rhythm principles, what is the maximum duration allowed for any single shot?',
          vi: 'Trong nguyên tắc thiết kế nhịp điệu cắt dựng, thời lượng tối đa cho phép đối với bất kỳ một khung hình đơn lẻ nào là bao nhiêu?',
        },
        options: {
          A: { zh: '5.0 秒。', en: '5.0 seconds.', vi: '5.0 giây.' },
          B: { zh: '2.5 秒。', en: '2.5 seconds.', vi: '2.5 giây.' },
          C: { zh: '10.0 秒。', en: '10.0 seconds.', vi: '10.0 giây.' },
        },
        answer: 'B',
        explanation: {
          zh: '為維持快節奏、留住觀眾並提高重複觀看（Looping）率，SOP 明確規定單一鏡頭／畫面停留不得超過 2.5 秒。',
          en: 'To keep a fast pace, retain viewers and boost replays (looping), the SOP clearly states that no single shot may stay on screen longer than 2.5 seconds.',
          vi: 'Để đảm bảo nhịp độ nhanh, giữ chân người xem và kích thích tỷ lệ xem lặp lại (Looping), SOP quy định rõ mỗi cảnh quay/khung hình đơn lẻ không được phép dừng lại quá 2.5 giây.',
        },
      },
      {
        id: 'q3',
        question: {
          zh: '處理短影音音訊時，背景音樂（BGM）相對於人聲的標準音量比例是多少？',
          en: 'When mixing audio for short videos, what is the standard volume of the background music (BGM) relative to the voice?',
          vi: 'Khi xử lý âm thanh cho video ngắn, tỷ lệ âm lượng tiêu chuẩn của nhạc nền (BGM) so với giọng nói là bao nhiêu?',
        },
        options: {
          A: { zh: '15%～20%。', en: '15% to 20%.', vi: 'Từ 15% đến 20%.' },
          B: { zh: '50%～60%。', en: '50% to 60%.', vi: 'Từ 50% đến 60%.' },
          C: { zh: '與人聲相同（100%）。', en: 'Equal to the voice (100%).', vi: 'Bằng 100% so với giọng nói.' },
        },
        answer: 'A',
        explanation: {
          zh: '依音訊處理規範，BGM 只負責輔助節奏，音量必須控制在人聲的 15%～20%，避免蓋過人聲。',
          en: 'Under the audio rules, BGM only supports the rhythm, so its volume must be kept at 15%–20% of the voice so it never drowns the voice out.',
          vi: 'Theo quy định về xử lý âm thanh, BGM chỉ đóng vai trò hỗ trợ nhịp điệu, do đó âm lượng bắt buộc phải khống chế ở mức 15% - 20% so với giọng nói để tránh bị lấn át.',
        },
      },
      {
        id: 'q4',
        question: {
          zh: '當影片內容需要呈現高效率資訊、清單或懶人包時，最適合使用哪一種敘事框架？',
          en: 'Which narrative framework fits best when a video needs to present high-efficiency information, a list, or a quick-guide summary?',
          vi: 'Khung tường thuật nào phù hợp nhất khi nội dung video cần trình bày thông tin hiệu suất cao, danh sách hoặc cẩm nang tóm tắt?',
        },
        options: {
          A: { zh: 'ASMR／沉浸感框架。', en: 'ASMR / immersive framework.', vi: 'Khung ASMR / Cảm giác đắm chìm.' },
          B: { zh: '偷窺與清單懶人包框架。', en: 'Peek & list / quick-guide framework.', vi: 'Khung Tựa đề / Cẩm nang danh sách.' },
          C: { zh: '挑戰與限制框架。', en: 'Challenge & constraint framework.', vi: 'Khung Thử thách & Giới hạn.' },
        },
        answer: 'B',
        explanation: {
          zh: '依第 3 章六大敘事框架對照表，「偷窺與清單懶人包」框架專門用來呈現清單式、摘要式資訊，能節省觀眾時間並提高收藏／分享數。',
          en: 'Per the six narrative frameworks table (Chapter 3), the "peek & list / quick-guide" framework is designed for list-style, summarized information, saving viewers\' time and driving saves and shares.',
          vi: 'Dựa vào bảng đối chiếu 6 khung tường thuật lớn (Chương 3), khung "Tựa đề / Cẩm nang danh sách" chuyên dùng cho việc trình bày thông tin dạng danh sách, tóm tắt để tối ưu hóa thời gian và kích thích lượt lưu trữ/chia sẻ.',
        },
      },
      {
        id: 'q5',
        question: {
          zh: '依行動呼籲（Call to Action，CTA）規範，每支影片最多可以設定幾個主要行動？',
          en: 'Under the Call to Action (CTA) rules, how many main actions can each video include at most?',
          vi: 'Theo quy định về Lời kêu gọi hành động (Call to Action - CTA), mỗi video được phép thiết lập tối đa bao nhiêu hành động chính?',
        },
        options: {
          A: { zh: '最多 3 個，可任意選擇。', en: 'Up to 3 actions of your choice.', vi: 'Tối đa 3 hành động tùy ý.' },
          B: { zh: '越多越好，以增加互動。', en: 'As many as possible to increase engagement.', vi: 'Càng nhiều càng tốt để tăng tương tác.' },
          C: { zh: '只有唯一 1 個。', en: 'Exactly one single action.', vi: 'Đúng 1 hành động duy nhất.' },
        },
        answer: 'C',
        explanation: {
          zh: 'SOP 強調每支影片只能有一個 CTA 目標（例如只呼籲收藏，或只呼籲留言關鍵字），避免觀眾困惑、分心。',
          en: 'The SOP stresses that each video may contain only one CTA goal (e.g. only asking viewers to save, or only asking them to comment a keyword) so they are not confused or distracted.',
          vi: 'SOP nhấn mạnh mỗi video chỉ được phép chứa duy nhất một mục tiêu CTA (ví dụ: chỉ kêu gọi lưu trữ hoặc chỉ kêu gọi bình luận từ khóa) để tránh làm người xem bối rối và mất tập trung.',
        },
      },
      {
        id: 'q6',
        question: {
          zh: '在標題或影片開頭使用沉浸式視角前綴（如「POV:」）的主要目的是什麼？',
          en: 'What is the main purpose of using an immersive point-of-view prefix (such as "POV:") in the title or at the start of a video?',
          vi: 'Mục đích chính của việc sử dụng tiền tố góc nhìn chìm đắm (như POV:) ở phần tiêu đề hoặc đầu video là gì?',
        },
        options: {
          A: { zh: '轉換觀眾心理狀態，提高前 3 秒留存率。', en: 'To shift the viewer\'s mindset and raise retention in the first 3 seconds.', vi: 'Chuyển đổi tâm lý người xem và nâng cao tỷ lệ giữ chân ở 3 giây đầu.' },
          B: { zh: '讓標題更長、更好讀。', en: 'To make the title longer and easier to read.', vi: 'Làm cho tiêu đề dài hơn để dễ đọc.' },
          C: { zh: '裝飾畫面，讓畫面更生動。', en: 'To decorate the frame and make it livelier.', vi: 'Trang trí cho khung hình sinh động hơn.' },
        },
        answer: 'A',
        explanation: {
          zh: '依第 6 章，「POV:」前綴是一種心理工具，能在前 0.5 秒讓觀眾大腦從「半被動」模式切換到第一人稱角色視角，同時善用平台的 SEO 關鍵字。',
          en: 'Per Chapter 6, the "POV:" prefix works as a psychological tool that switches the viewer\'s brain from a "semi-passive" mode into a first-person character view within the first 0.5 seconds, while also using the platform\'s SEO keywords.',
          vi: 'Theo Chương 6, tiền tố POV: hoạt động như một công cụ tâm lý giúp não bộ người xem chuyển từ chế độ "bán thụ động" sang góc nhìn nhân vật thứ nhất trong 0.5 giây đầu, đồng thời tận dụng từ khóa SEO của nền tảng.',
        },
      },
      {
        id: 'q7',
        question: {
          zh: '剪輯製作無縫循環（Seamless Loop）時，影片結尾的音訊要怎麼處理？',
          en: 'When editing for a seamless loop, what should you do with the audio at the end of the video?',
          vi: 'Khi thực hiện thao tác cắt dựng để tạo vòng lặp liền mạch (Seamless Loop), thao tác đối với âm thanh ở cuối video là gì?',
        },
        options: {
          A: { zh: '完整保留結尾音訊。', en: 'Keep all of the ending audio.', vi: 'Giữ nguyên toàn bộ âm thanh kết thúc.' },
          B: { zh: '刪除最後的尾音衰減波形並修剪空白。', en: 'Remove the final decay waveform and trim the silence.', vi: 'Xóa bỏ sóng suy giảm cuối cùng và cắt bớt khoảng trắng.' },
          C: { zh: '將結尾音量放大兩倍。', en: 'Double the volume of the ending.', vi: 'Tăng âm lượng phần kết thúc lên gấp đôi.' },
        },
        answer: 'B',
        explanation: {
          zh: '第 4 章技術細節規定，必須完全刪除尾音衰減波形與呼吸聲，並剪掉結尾 0.05～0.15 秒的空白，讓結尾順暢接回影片開頭。',
          en: 'The technical details in Chapter 4 require fully removing the trailing decay waveform and breath sounds, and trimming 0.05–0.15 seconds of silence at the end so it joins smoothly back to the start of the video.',
          vi: 'Chi tiết kỹ thuật ở Chương 4 hướng dẫn phải loại bỏ hoàn toàn phần sóng suy giảm ở cuối âm và tiếng thở, cắt bỏ từ 0.05 đến 0.15 giây khoảng trắng ở cuối để nối mượt mà vào đầu video.',
        },
      },
      {
        id: 'q8',
        question: {
          zh: '在規則分級體系中，下列哪一項屬於必須遵守的「硬性規則」（Hard Rules）？',
          en: 'In the rule hierarchy, which of the following belongs to the mandatory "Hard Rules"?',
          vi: 'Trong hệ thống phân cấp quy tắc, yếu tố nào sau đây thuộc về nhóm "Quy tắc cứng" (Hard Rules) bắt buộc phải tuân thủ?',
        },
        options: {
          A: { zh: '主題單一、前 3 秒清楚明確。', en: 'A single topic and a clear first 3 seconds.', vi: 'Chủ đề đơn nhất và 3 giây đầu rõ ràng.' },
          B: { zh: '濾鏡色彩與藝術字風格。', en: 'Filter colors and artistic font style.', vi: 'Màu sắc bộ lọc và phong cách chữ nghệ thuật.' },
          C: { zh: '影片總長固定為剛好 45 秒。', en: 'Total video length fixed at exactly 45 seconds.', vi: 'Thời lượng tổng thể video cố định chính xác 45 giây.' },
        },
        answer: 'A',
        explanation: {
          zh: '硬性規則（🔴）包括：主題單一、前 3 秒鉤子清楚、字幕避開 UI 區域、只有一個 CTA，以及發布前完成 QA。違反者會被退回修改。',
          en: 'The hard rules (🔴) include: a single topic, a clear 3-second hook, subtitles kept clear of UI areas, a single CTA, and QA completed before publishing. Violations are sent back for revision.',
          vi: 'Các quy tắc cứng (🔴) bao gồm chủ đề phải đơn nhất, Hook 3 giây rõ ràng, phụ đề tránh vùng UI, CTA duy nhất và hoàn thành QA trước khi đăng. Vi phạm sẽ bị trả về chỉnh sửa.',
        },
      },
      {
        id: 'q9',
        question: {
          zh: '想利用「刻意露出小瑕疵／小錯誤」來提高留言數時，通常會用哪種方法？',
          en: 'Which method is typically used when deliberately "leaving a small flaw / mistake" to drive comments?',
          vi: 'Phương pháp nào thường được áp dụng khi muốn tận dụng yếu tố "Cố ý để lộ hạt sạn/lỗi nhỏ" để thúc đẩy chỉ số bình luận?',
        },
        options: {
          A: { zh: '刻意在字幕中寫錯一個極小的錯字。', en: 'Deliberately put one tiny typo in the subtitles.', vi: 'Cố tình viết sai một lỗi chính tả cực nhỏ trong phụ đề.' },
          B: { zh: '刻意在影片中途突然中斷。', en: 'Deliberately cut the video off midway.', vi: 'Cố tình cắt ngang video giữa chừng.' },
          C: { zh: '發布影片時不開聲音。', en: 'Post the video with the sound off.', vi: 'Không bật tiếng khi đăng video.' },
        },
        answer: 'A',
        explanation: {
          zh: '依第 1 章互動誘餌（Engagement Baiting）段落，主動留下一個極小的錯字或小口誤，是吸引觀眾留言糾正的有效誘餌。',
          en: 'Per the Engagement Baiting section in Chapter 1, intentionally leaving a tiny typo or a small slip of the tongue is an effective bait that prompts viewers to comment with corrections.',
          vi: 'Theo phần tương tác mồi nhử (Engagement Baiting) ở Chương 1, việc chủ động để lại một lỗi chính tả cực nhỏ hoặc lỗi phát âm nhỏ là mồi nhử (Bait) hiệu quả để kích thích người xem vào bình luận chỉnh sửa.',
        },
      },
      {
        id: 'q10',
        question: {
          zh: '發布前「閉眼測試」（Closed-eyes test）的合格標準是什麼？',
          en: 'What is the pass criterion for the "closed-eyes test" before publishing a video?',
          vi: 'Tiêu chuẩn đánh giá đạt của "Bài kiểm tra nhắm mắt" (Closed-eyes test) trước khi xuất bản video là gì?',
        },
        options: {
          A: { zh: '聽到影片結尾有雜音。', en: 'Hearing a crackling noise at the end of the video.', vi: 'Nghe thấy âm thanh rè ở cuối video.' },
          B: { zh: '無法明顯察覺結尾與重新開始循環的痕跡。', en: 'No noticeable trace of where the video ends and the loop restarts.', vi: 'Không nhận ra rõ ràng dấu vết kết thúc và khởi động lại vòng lặp.' },
          C: { zh: '明顯察覺說話的斷點。', en: 'Clearly noticing a break in the speech.', vi: 'Phát hiện rõ ràng điểm ngắt quãng của câu nói.' },
        },
        answer: 'B',
        explanation: {
          zh: '在最後的 QA 步驟中，閉眼聽 3 輪循環，若分辨不出結尾與重新開始的斷點，代表音訊與循環已達標（第 4 章）。',
          en: 'In the final QA step, listen to 3 loops with your eyes closed; if you cannot tell where the end meets the restart, the audio and loop meet the standard (Chapter 4).',
          vi: 'Trong bước QA cuối cùng, nếu bạn nhắm mắt nghe 3 vòng lặp mà không nhận ra chỗ nào là điểm ngắt giữa kết thúc và khởi động lại, điều đó chứng tỏ âm thanh và vòng lặp đã đạt chuẩn (Chương 4).',
        },
      },
    ],
  },
}

export function isQuizLang(v: unknown): v is QuizLang {
  return typeof v === 'string' && (QUIZ_LANGS as readonly string[]).includes(v)
}

export const QUIZ_LANG_LABEL: Record<QuizLang, string> = { zh: '中文', en: 'English', vi: 'Tiếng Việt' }

// 交卷後會公布答案，重考分數不具參考性：依姓名（忽略大小寫與多餘空白）照交卷時間標出第幾次作答。
// rows 須為同一份測驗、依 created_at 由新到舊排序。
export function attemptNumbers<T extends { id: string; name: string }>(rows: T[]): Map<string, number> {
  const attempt = new Map<string, number>()
  const seen = new Map<string, number>()
  for (const r of [...rows].reverse()) {
    const n = r.name.trim().replace(/\s+/g, ' ').toLowerCase()
    const c = (seen.get(n) ?? 0) + 1
    seen.set(n, c)
    attempt.set(r.id, c)
  }
  return attempt
}
