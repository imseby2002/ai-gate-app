// 公開測驗的題庫答案與解說（只在伺服器端使用；交卷後才隨計分結果回傳給作答者）
export interface QuizKey {
  answer: string
  text: string
  explanation: string
}

export const QUIZZES: Record<string, { title: string; key: Record<string, QuizKey> }> = {
  'sop-video': {
    title: '短影音 SOP 測驗',
    key: {
      q1: { answer: 'A', text: "Sử dụng màn giới thiệu bản thân truyền thống.", explanation: "Theo Chương 1 của SOP, các hình thức tự giới thiệu (như \"大家好，我是XX\") hay停頓超過 0.5 秒會直接導致前 3 秒留存率下降，屬於硬性規定中嚴格禁止的行為。" },
      q2: { answer: 'B', text: "2.5 giây.", explanation: "Để đảm bảo nhịp độ nhanh, giữ chân người xem và kích thích tỷ lệ xem lặp lại (Looping), SOP quy định rõ đơn kính/khung hình đơn lẻ không được phép dừng lại quá 2.5 giây." },
      q3: { answer: 'A', text: "Từ 15% đến 20%.", explanation: "Theo quy định về xử lý âm thanh, BGM chỉ đóng vai trò hỗ trợ nhịp điệu, do đó âm lượng bắt buộc phải khống chế ở mức 15% - 20% so với giọng nói để tránh bị lấn át." },
      q4: { answer: 'B', text: "Khung Tựa đề / Cẩm nang danh sách.", explanation: "Dựa vào bảng đối chiếu 6 đại敘事框架 (Chương 3), khung \"偷窺與清單懶人包\" (偷窺與清單) chuyên dùng cho việc trình bày thông tin dạng danh sách, tóm tắt để tối ưu hóa thời gian và kích thích lượt lưu trữ/chia sẻ." },
      q5: { answer: 'C', text: "Đúng 1 hành động duy nhất.", explanation: "SOP nhấn mạnh mỗi video chỉ được phép chứa duy nhất một mục tiêu CTA (ví dụ: chỉ kêu gọi lưu trữ hoặc chỉ kêu gọi bình luận từ khóa) để tránh làm người xem bối rối và mất tập trung." },
      q6: { answer: 'A', text: "Chuyển đổi tâm lý người xem và nâng cao tỷ lệ giữ chân ở 3 giây đầu.", explanation: "Theo Chương 6, tiền tố POV: hoạt động như một công cụ tâm lý giúp não bộ người xem chuyển từ chế độ \"bán thụ động\" sang góc nhìn nhân vật thứ nhất trong 0.5 giây đầu, đồng thời tận dụng từ khóa SEO của nền tảng." },
      q7: { answer: 'B', text: "Xóa bỏ sóng suy giảm cuối cùng và cắt bớt khoảng trắng.", explanation: "Chi tiết kỹ thuật ở Chương 4 hướng dẫn phải loại bỏ hoàn toàn phần sóng suy giảm (尾音衰減波形) và tiếng thở, cắt bỏ từ 0.05 đến 0.15 giây khoảng trắng ở cuối để nối mượt mà vào đầu video." },
      q8: { answer: 'A', text: "Chủ đề đơn nhất và 3 giây đầu rõ ràng.", explanation: "Các quy tắc cứng (🔴 硬性規則) bao gồm chủ đề phải đơn nhất, Hook 3 giây rõ ràng, phụ đề tránh vùng UI, CTA duy nhất và hoàn thành QA trước khi đăng. Vi phạm sẽ bị trả về chỉnh sửa." },
      q9: { answer: 'A', text: "Cố tình viết sai một lỗi chính tả cực nhỏ trong phụ đề.", explanation: "Theo phần tương tác mật mã (Engagement Baiting) ở Chương 1, việc chủ động để lại một lỗi chính tả cực nhỏ hoặc lỗi phát âm nhỏ là mồi nhử (Bait) hiệu quả để kích thích người xem vào bình luận chỉnh sửa." },
      q10: { answer: 'B', text: "Không nhận ra rõ ràng dấu vết kết thúc và khởi động lại vòng lặp.", explanation: "Trong bước QA cuối cùng, nếu bạn nhắm mắt nghe 3 vòng lặp mà không nhận ra chỗ nào là điểm ngắt giữa kết thúc và khởi động lại, điều đó chứng tỏ âm thanh và vòng lặp đã đạt chuẩn (Chương 4)." },
    },
  },
}
