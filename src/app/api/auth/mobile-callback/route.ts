import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI GATE 登入完成</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0F172A; color: #FFFFFF; text-align: center; padding: 20px; }
    .card { background: #1E293B; padding: 32px; border-radius: 20px; max-width: 360px; width: 100%; border: 1px solid #334155; }
    h2 { font-size: 20px; margin-bottom: 8px; }
    p { color: #94A3B8; font-size: 14px; margin-bottom: 24px; }
    a.btn { display: block; background: #2563EB; color: #FFFFFF; padding: 14px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 15px; }
  </style>
</head>
<body>
  <div class="card">
    <h2>🎉 Google 驗證成功！</h2>
    <p>正在為您喚醒 AI GATE 手機 APP...</p>
    <a id="openBtn" class="btn" href="#">點此返回 APP</a>
  </div>
  <script>
    // 將當前的 hash 或 query 參數轉傳給 APP 的 custom scheme 或 expo scheme
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const redirectTarget = 'aigate://auth/callback' + search + hash;
    document.getElementById('openBtn').href = redirectTarget;
    // 自動嘗試跳轉回 APP
    setTimeout(() => {
      window.location.href = redirectTarget;
    }, 300);
  </script>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
