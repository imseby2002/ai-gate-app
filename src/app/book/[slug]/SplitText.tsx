// 大標題逐字浮現用：先把文字切成一個個 span（伺服器端就渲染好，不在瀏覽器改 DOM，避免和 React 衝突）。
// 螢幕報讀器讀外層 aria-label，切開的字元一律 aria-hidden。
export default function SplitText({ text, enabled }: { text: string; enabled: boolean }) {
  if (!enabled) return <>{text}</>
  return (
    <span data-split aria-label={text}>
      {Array.from(text).map((ch, i) => ch === ' '
        ? <span key={i} aria-hidden> </span>
        : <span key={i} data-split-char aria-hidden className="inline-block">{ch}</span>)}
    </span>
  )
}
