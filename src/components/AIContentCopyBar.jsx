// AI生成メールコンテンツのコピーバー
// フロービルダーから ?funnel_id=xxx 付きで開かれた時のみ表示
import { useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Copy, Check, Loader2, Sparkles } from 'lucide-react'
import { useFlowContext } from '../hooks/useFlowContext'
import { useGeneratedContents } from '../hooks/useGeneratedContents'

export default function AIContentCopyBar() {
  const { funnelId, isEmbedded } = useFlowContext()
  const { contents, funnelName, patternName, loading } = useGeneratedContents(funnelId, 'email')
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [copiedField, setCopiedField] = useState(null)

  // フロービルダーから開かれていない or コンテンツなし → 非表示
  if (!isEmbedded || (!loading && contents.length === 0)) return null

  const selected = selectedIndex >= 0 ? contents[selectedIndex] : null

  const handleCopy = useCallback(async (text, field) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // フォールバック: textarea経由コピー
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }, [])

  if (loading) {
    return (
      <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm text-blue-600 flex items-center gap-2 shrink-0">
        <Loader2 className="w-4 h-4 animate-spin" />
        AI生成コンテンツを読み込み中...
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 shrink-0" data-ai-copy-bar>
      {/* プルダウンバー */}
      <div className="px-4 py-3 flex items-center gap-3">
        <Sparkles className="w-5 h-5 text-blue-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
              AI生成
            </span>
            {funnelName && (
              <span className="text-xs text-slate-500 truncate">{funnelName}</span>
            )}
            {patternName && (
              <span className="text-xs text-slate-400 truncate">/ {patternName}</span>
            )}
          </div>
          <select
            value={selectedIndex}
            onChange={(e) => setSelectedIndex(Number(e.target.value))}
            className="w-full bg-white border border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 cursor-pointer"
            data-ai-step-select
          >
            <option value={-1}>コピーするメールを選択...</option>
            {contents.map((item, idx) => (
              <option key={item.id} value={idx}>
                {item.step_number}通目: {item.subject
                  ? (item.subject.length > 40 ? item.subject.substring(0, 40) + '...' : item.subject)
                  : item.step_label}
                {item.metadata?.delay_days ? ` (${item.metadata.delay_days}日後)` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* プレビューエリア */}
      {selected && (
        <div className="px-4 pb-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* 件名 */}
            {selected.subject && (
              <div className="border-b border-slate-100 p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">件名</span>
                  <CopyButton
                    label="件名をコピー"
                    copied={copiedField === 'subject'}
                    onClick={() => handleCopy(selected.subject, 'subject')}
                  />
                </div>
                <p className="text-sm text-slate-800 font-bold">{selected.subject}</p>
              </div>
            )}

            {/* 本文 */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">本文</span>
                <CopyButton
                  label="本文をコピー"
                  copied={copiedField === 'body'}
                  onClick={() => handleCopy(selected.body, 'body')}
                />
              </div>
              <div className="bg-slate-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {selected.body}
                </pre>
              </div>
            </div>

            {/* メタ情報 + ナビ */}
            <div className="bg-slate-50 border-t border-slate-100 px-4 py-2 flex items-center gap-4">
              <span className="text-xs text-slate-400">
                {selected.step_number} / {contents.length} 通目
              </span>
              {selected.metadata?.delay_days !== undefined && (
                <span className="text-xs text-slate-400">
                  配信: {selected.metadata.delay_days === 0 ? '即時' : `${selected.metadata.delay_days}日後`}
                </span>
              )}
              <div className="ml-auto flex gap-1">
                <button
                  disabled={selectedIndex <= 0}
                  onClick={() => setSelectedIndex(selectedIndex - 1)}
                  className="text-xs px-2 py-1 rounded bg-slate-200 text-slate-600 hover:bg-slate-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-0.5"
                >
                  <ChevronLeft className="w-3 h-3" /> 前
                </button>
                <button
                  disabled={selectedIndex >= contents.length - 1}
                  onClick={() => setSelectedIndex(selectedIndex + 1)}
                  className="text-xs px-2 py-1 rounded bg-slate-200 text-slate-600 hover:bg-slate-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-0.5"
                >
                  次 <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CopyButton({ label, copied, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1 rounded-full font-bold transition-all flex items-center gap-1 ${
        copied
          ? 'bg-green-100 text-green-700'
          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
      }`}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'コピー済み' : label}
    </button>
  )
}
