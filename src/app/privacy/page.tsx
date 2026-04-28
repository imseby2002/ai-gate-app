export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 text-gray-700">
      <h1 className="text-3xl font-bold mb-2 text-gray-900">隱私政策</h1>
      <p className="text-sm text-gray-400 mb-10">最後更新：2026年4月28日</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3 text-gray-800">1. 資料收集</h2>
        <p>AI Gate（「本服務」）僅收集提供服務所必要的資料，包括帳號資訊、使用紀錄及您主動提供的內容。本服務不會向第三方出售您的個人資料。</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3 text-gray-800">2. Facebook / Meta 資料使用</h2>
        <p>當您授權本服務存取您的 Facebook 粉絲專頁或 Instagram 帳號時，本服務僅使用所獲得的權限執行您指定的行銷自動化功能（例如發佈貼文、上傳影片），不會讀取或儲存超出此範圍的 Meta 資料。</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3 text-gray-800">3. 資料安全</h2>
        <p>所有憑證（Access Token 等）均以加密方式儲存，且僅用於您授權的操作。您可隨時在設定頁面移除已連結的平台憑證。</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3 text-gray-800">4. 用戶資料刪除</h2>
        <p>您可以隨時透過設定頁面刪除您的帳號及所有相關資料。若需要協助，請聯絡我們。</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3 text-gray-800">5. 聯絡我們</h2>
        <p>如有隱私相關問題，請聯絡：<a href="mailto:imseby@gmail.com" className="text-blue-600 underline">imseby@gmail.com</a></p>
      </section>
    </div>
  )
}
