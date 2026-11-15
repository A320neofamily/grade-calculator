import { useEffect, useRef } from "react"

export const TEST_INVITATION_SEEN_KEY = "grade-calculator-test-invitation-seen"

type Props = {
  busy: boolean
  error: string
  onClose: () => void
  onTry: () => void
}

export default function TestInvitationDialog({
  busy,
  error,
  onClose,
  onTry,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    localStorage.setItem(TEST_INVITATION_SEEN_KEY, "true")
    return () => dialog?.close()
  }, [])

  return (
    <dialog
      aria-labelledby="test-invitation-title"
      aria-describedby="test-invitation-description"
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 text-center text-slate-900 shadow-2xl backdrop:bg-slate-950/65 backdrop:backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
      ref={dialogRef}
    >
      <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
        <svg
          aria-hidden="true"
          className="size-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
        >
          <rect x="5" y="3" width="14" height="18" rx="3" />
          <path d="M9 7h6M9 11h1m4 0h1m-6 4h1m4 0h1" />
        </svg>
      </div>
      <h2
        className="text-lg font-extrabold tracking-tight"
        id="test-invitation-title"
      >
        테스트 열람을 해보시겠어요?
      </h2>
      <p
        className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400"
        id="test-invitation-description"
      >
        테스트중학교 2-2 평가계획으로 먼저 체험해 보세요.
        <br />
        입력한 점수는 이 기기에만 저장되며 계정에 동기화되지 않습니다.
      </p>
      {error && (
        <p
          className="mt-4 text-sm font-semibold text-rose-600 dark:text-rose-300"
          role="alert"
        >
          {error}
        </p>
      )}
      <button
        className="mt-6 min-h-12 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        disabled={busy}
        onClick={onTry}
        type="button"
      >
        {busy ? "불러오는 중..." : "테스트 해보기"}
      </button>
      <button
        className="mt-2 min-h-10 w-full rounded-xl text-sm font-semibold text-slate-500 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
        disabled={busy}
        onClick={onClose}
        type="button"
      >
        나중에 할게요
      </button>
    </dialog>
  )
}
