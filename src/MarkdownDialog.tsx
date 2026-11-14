import { useEffect, useState, type ReactNode } from "react"

type MarkdownDialogProps = {
  title: string
  source: string
  onClose: () => void
  actions: ReactNode
  ariaLabel?: string
}

function inlineMarkdown(text: string) {
  const parts: ReactNode[] = []
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)|`([^`]+)`/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text))) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index))
    if (match[1] && match[2]) {
      parts.push(
        <a
          className="font-bold text-indigo-600 underline underline-offset-2 dark:text-indigo-300"
          href={match[2]}
          key={`${match.index}-${match[2]}`}
          rel="noreferrer"
          target="_blank"
        >
          {match[1]}
        </a>,
      )
    } else {
      parts.push(
        <code
          className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.9em] dark:bg-slate-800"
          key={`${match.index}-${match[3]}`}
        >
          {match[3]}
        </code>,
      )
    }
    cursor = pattern.lastIndex
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}

function Markdown({ content }: { content: string }) {
  return (
    <div className="space-y-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
      {content.split(/\r?\n/).map((line, index) => {
        if (!line.trim()) return <div className="h-1" key={index} />
        if (line.startsWith("### "))
          return (
            <h4
              className="pt-2 text-base font-black text-slate-900 dark:text-white"
              key={index}
            >
              {inlineMarkdown(line.slice(4))}
            </h4>
          )
        if (line.startsWith("## "))
          return (
            <h3
              className="pt-3 text-lg font-black text-slate-900 dark:text-white"
              key={index}
            >
              {inlineMarkdown(line.slice(3))}
            </h3>
          )
        if (line.startsWith("# "))
          return (
            <h2
              className="pt-3 text-xl font-black text-slate-900 dark:text-white"
              key={index}
            >
              {inlineMarkdown(line.slice(2))}
            </h2>
          )
        if (line.startsWith("- "))
          return (
            <div className="flex gap-2 pl-1" key={index}>
              <span aria-hidden="true" className="text-indigo-500">
                •
              </span>
              <p>{inlineMarkdown(line.slice(2))}</p>
            </div>
          )
        if (line.startsWith("> "))
          return (
            <blockquote
              className="rounded-r-xl border-l-4 border-indigo-400 bg-indigo-50 px-4 py-3 font-semibold text-indigo-900 dark:bg-indigo-500/10 dark:text-indigo-100"
              key={index}
            >
              {inlineMarkdown(line.slice(2))}
            </blockquote>
          )
        return <p key={index}>{inlineMarkdown(line)}</p>
      })}
    </div>
  )
}

export default function MarkdownDialog({
  title,
  source,
  onClose,
  actions,
  ariaLabel = title,
}: MarkdownDialogProps) {
  const [content, setContent] = useState("")
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(source, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error()
        const text = await response.text()
        if (!cancelled) setContent(text)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [source])

  return (
    <div
      aria-label={ariaLabel}
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
      role="dialog"
    >
      <div className="flex max-h-[min(44rem,90vh)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-white">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-7">
          <h2 className="text-xl font-black">{title}</h2>
          <button
            aria-label="닫기"
            className="flex size-10 items-center justify-center rounded-xl text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-white"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>
        <div className="min-h-48 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          {failed ? (
            <p className="rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
              내용을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
            </p>
          ) : content ? (
            <Markdown content={content} />
          ) : (
            <p className="py-12 text-center text-sm font-bold text-slate-400">
              내용을 불러오는 중...
            </p>
          )}
        </div>
        <footer className="border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/50 sm:px-7">
          {actions}
        </footer>
      </div>
    </div>
  )
}
