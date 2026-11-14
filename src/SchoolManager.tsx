import { useEffect, useMemo, useRef, useState } from "react"
import { parseSubjectPlan } from "./schoolImport"
import type { User } from "firebase/auth"
import {
  deletePublishedSchool,
  getPublishedSchool,
  getSchoolKey,
  listPublishedSchools,
  publishSchoolConfig,
  SchoolConfigApiError,
  updateSchoolConfig,
  type ConfigAssessment,
  type ConfigSubject,
  type SchoolConfig,
} from "./schoolConfigApi"

type SchoolInfo = {
  schoolcode: string
  name: string
  shortname?: string
  cityname?: string
  address?: string
}

type ManagedSchool = SchoolConfig & {
  id: string
  sourceKey?: string
}

type SchoolManagerProps = {
  schools: ManagedSchool[]
  user: User | null
  isAdmin: boolean
  onClose: () => void
  onSave: (
    config: SchoolConfig,
    sourceKey?: string,
    previousId?: string,
  ) => void
  onDelete: (id: string) => void
  onPublishedDeleted: (schoolKey: string) => void
  onOpen: (id: string) => void
  onOpenPublished: (schoolKey: string) => void
  onShare: (id: string) => void
  onRequestSignIn: () => void
  initialView?: "mine" | "editor"
}

const COLORS = [
  { value: "bg-red-500", label: "빨강" },
  { value: "bg-orange-500", label: "주황" },
  { value: "bg-amber-500", label: "노랑" },
  { value: "bg-emerald-500", label: "초록" },
  { value: "bg-teal-500", label: "청록" },
  { value: "bg-sky-500", label: "하늘" },
  { value: "bg-blue-500", label: "파랑" },
  { value: "bg-indigo-500", label: "남색" },
  { value: "bg-violet-500", label: "보라" },
  { value: "bg-fuchsia-500", label: "자홍" },
  { value: "bg-rose-500", label: "장미" },
  { value: "bg-slate-400", label: "회색" },
]

const WRITTEN_EXAMS = [
  { id: "midterm", title: "중간고사" },
  { id: "final", title: "기말고사" },
] as const

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-900/40"
const secondaryButton =
  "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-500 dark:hover:text-white"
const primaryButton =
  "rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"

function emptySubject(index: number): ConfigSubject {
  return {
    id: `subject-${index + 1}`,
    name: `새 과목 ${index + 1}`,
    color: COLORS[index % COLORS.length].value,
    assessments: [],
  }
}

function draftStorageKey(uid: string) {
  return `grade-calculator-school-draft-v1:${uid}`
}

function readDraft(uid: string): SchoolConfig | null {
  try {
    const value = JSON.parse(
      localStorage.getItem(draftStorageKey(uid)) || "null",
    ) as unknown
    if (
      typeof value !== "object" ||
      value === null ||
      !Array.isArray((value as SchoolConfig).subjects)
    ) {
      return null
    }
    return value as SchoolConfig
  } catch {
    return null
  }
}

function emptyAssessment(
  type: ConfigAssessment["type"],
  index: number,
): ConfigAssessment {
  return {
    id: type === "지필평가" ? "" : `performance-${index + 1}`,
    type,
    title: "",
    period: "",
    weight: Number.NaN,
  }
}

function normalizeConfigIds(config: SchoolConfig): SchoolConfig {
  return {
    ...config,
    subjects: config.subjects.map((subject, subjectIndex) => {
      let performanceIndex = 0
      return {
        ...subject,
        id: `subject-${subjectIndex + 1}`,
        assessments: subject.assessments.map((assessment) => ({
          ...assessment,
          period: assessment.period.trim() || `${config.semester}학기`,
          id:
            assessment.type === "지필평가"
              ? assessment.title === "중간고사"
                ? "midterm"
                : assessment.title === "기말고사"
                  ? "final"
                  : ""
              : `performance-${++performanceIndex}`,
        })),
      }
    }),
  }
}

function cloneConfig(config: SchoolConfig): SchoolConfig {
  return normalizeConfigIds({
    ...config,
    subjects: config.subjects.map((subject) => ({
      ...subject,
      assessments: subject.assessments.map((assessment) => ({ ...assessment })),
    })),
  })
}

function validateConfig(config: SchoolConfig) {
  if (!config.schoolCode || !config.schoolName)
    return "학교 검색 결과에서 학교를 선택해 주세요."
  if (!Number.isInteger(config.grade) || config.grade < 1 || config.grade > 3)
    return "중학교 학년을 선택해 주세요."
  if (config.semester !== 1 && config.semester !== 2)
    return "학기를 선택해 주세요."
  if (config.subjects.length === 0) return "과목을 한 개 이상 추가해 주세요."
  if (config.subjects.length > 20)
    return "과목은 최대 20개까지 추가할 수 있습니다."
  for (const subject of config.subjects) {
    if (!subject.name.trim()) return "모든 과목의 이름을 입력해 주세요."
    if (subject.passOnly) {
      if (subject.assessments.length > 0)
        return `${subject.name}: 원점수 미산출 과목에는 평가 항목을 둘 수 없습니다.`
      continue
    }
    if (subject.assessments.length === 0)
      return `${subject.name}: 평가 항목을 한 개 이상 추가해 주세요.`
    if (
      subject.assessments.filter((assessment) => assessment.type === "수행평가")
        .length > 5
    )
      return `${subject.name}: 수행평가는 최대 5개까지 추가할 수 있습니다.`
    const assessmentIds = new Set<string>()
    for (const assessment of subject.assessments) {
      if (!assessment.id.trim() || !assessment.title.trim()) {
        return `${subject.name}: 모든 평가의 ID와 이름을 입력해 주세요.`
      }
      if (
        assessment.type === "지필평가" &&
        !WRITTEN_EXAMS.some(
          (exam) =>
            exam.id === assessment.id && exam.title === assessment.title,
        )
      ) {
        return `${subject.name}: 지필평가는 중간고사 또는 기말고사만 선택할 수 있습니다.`
      }
      if (assessmentIds.has(assessment.id))
        return `${subject.name}: 같은 지필평가는 한 번만 추가할 수 있습니다.`
      assessmentIds.add(assessment.id)
      if (
        !Number.isFinite(assessment.weight) ||
        assessment.weight < 0 ||
        assessment.weight > 100
      ) {
        return `${subject.name}: 반영 비율은 0~100 사이여야 합니다.`
      }
    }
    const total = subject.assessments.reduce(
      (sum, assessment) => sum + assessment.weight,
      0,
    )
    if (Math.abs(total - 100) > 0.001)
      return `${subject.name}: 반영 비율 합계가 ${total}%입니다. 100%로 맞춰 주세요.`
  }
  return null
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= items.length) return items
  const next = [...items]
  ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
  return next
}

function Editor({
  initial,
  sourceKey,
  user,
  isAdmin,
  onCancel,
  onSaved,
  onRequestSignIn,
}: {
  initial?: SchoolConfig
  sourceKey?: string
  user: User | null
  isAdmin: boolean
  onCancel: () => void
  onSaved: (config: SchoolConfig, sourceKey?: string) => void
  onRequestSignIn: () => void
}) {
  const savedDraft = !initial && user ? readDraft(user.uid) : null
  const [config, setConfig] = useState<SchoolConfig>(() =>
    initial
      ? cloneConfig(initial)
      : savedDraft || {
          schoolCode: "",
          schoolName: "",
          grade: 0,
          semester: 0,
          subjects: [],
        },
  )
  const [schoolQuery, setSchoolQuery] = useState(initial?.schoolName ?? "")
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo[]>([])
  const [schoolInfoStatus, setSchoolInfoStatus] =
    useState<"idle" | "loading" | "ready" | "error">("idle")
  const [message, setMessage] = useState<{
    tone: "error" | "success" | "info"
    text: string
  } | null>(
    savedDraft
      ? { tone: "info", text: "이 기기에 저장된 임시 저장본을 불러왔습니다." }
      : null,
  )
  const [busy, setBusy] = useState<"publish" | "update" | null>(null)
  const [importPlan, setImportPlan] = useState<ConfigSubject[]>([])
  const [importName, setImportName] = useState("")
  const [importBusy, setImportBusy] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({})

  useEffect(() => {
    if (initial?.schoolCode) return
    setSchoolInfoStatus("loading")
    fetch(`${import.meta.env.BASE_URL}schoolinfo.json`)
      .then(async (response) => {
        if (!response.ok) throw new Error()
        const data = (await response.json()) as unknown
        if (!Array.isArray(data)) throw new Error()
        const valid = data.filter(
          (item): item is SchoolInfo =>
            typeof item === "object" &&
            item !== null &&
            typeof item.schoolcode === "string" &&
            typeof item.name === "string" &&
            (isAdmin || item.schoolcode !== "0000000"),
        )
        setSchoolInfo(valid)
        setSchoolInfoStatus("ready")
      })
      .catch(() => setSchoolInfoStatus("error"))
  }, [initial?.schoolCode, isAdmin])

  const schoolResults = useMemo(() => {
    const query = schoolQuery.trim().toLocaleLowerCase("ko")
    const isCodeQuery = /^\d+$/.test(query)
    const canSearch = isCodeQuery ? query.length >= 7 : query.length >= 2
    if (!canSearch || config.schoolCode) return []
    return schoolInfo
      .filter((school) =>
        isCodeQuery
          ? school.schoolcode.includes(query)
          : school.name.toLocaleLowerCase("ko").includes(query),
      )
      .slice(0, 20)
  }, [config.schoolCode, schoolInfo, schoolQuery])

  const updateSubject = (
    index: number,
    update: (subject: ConfigSubject) => ConfigSubject,
  ) => {
    setConfig((current) => ({
      ...current,
      subjects: current.subjects.map((subject, subjectIndex) =>
        subjectIndex === index ? update(subject) : subject,
      ),
    }))
  }

  const sendConfig = async (mode: "publish" | "update") => {
    const normalizedConfig = normalizeConfigIds(config)
    const error = validateConfig(normalizedConfig)
    if (error) {
      setMessage({ tone: "error", text: error })
      return
    }
    if (!user) {
      setMessage({
        tone: "info",
        text: "학교 설정을 서버에 배포하려면 Google 로그인이 필요합니다.",
      })
      onRequestSignIn()
      return
    }
    setBusy(mode)
    setMessage(null)
    try {
      if (mode === "publish") {
        await publishSchoolConfig(normalizedConfig)
      } else {
        await updateSchoolConfig(
          sourceKey || getSchoolKey(normalizedConfig),
          normalizedConfig,
        )
      }
      setConfig(normalizedConfig)
      if (user) localStorage.removeItem(draftStorageKey(user.uid))
      onSaved(normalizedConfig, getSchoolKey(normalizedConfig))
      setMessage({
        tone: "success",
        text:
          mode === "publish"
            ? "학교 설정을 배포했습니다."
            : "학교 설정을 수정했습니다.",
      })
    } catch (error) {
      setMessage({
        tone: "error",
        text:
          error instanceof SchoolConfigApiError
            ? error.message
            : "요청에 실패했습니다. 다시 시도해 주세요.",
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.15em] text-indigo-600 dark:text-indigo-300">
            학교 설정 편집
          </p>
          <h2 className="mt-1 text-2xl font-black">
            {initial ? "평가 계획 수정" : "새 학교 추가"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            학교는 교육기관 검색 결과에서만 선택할 수 있습니다. 과목별 반영
            비율은 100%여야 합니다.
          </p>
        </div>
        <button className={secondaryButton} onClick={onCancel} type="button">
          목록으로
        </button>
      </div>

      <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700 sm:p-5">
        <h3 className="font-extrabold">1. 학교와 학기</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-bold">학교 검색</label>
            {config.schoolCode ? (
              <div className="flex flex-col gap-3 rounded-xl bg-indigo-50 p-4 dark:bg-indigo-500/10 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-extrabold">{config.schoolName}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    학교 코드 {config.schoolCode}
                  </p>
                </div>
                {!initial && (
                  <button
                    className={secondaryButton}
                    onClick={() => {
                      setConfig((current) => ({
                        ...current,
                        schoolCode: "",
                        schoolName: "",
                      }))
                      setSchoolQuery("")
                    }}
                    type="button"
                  >
                    다시 선택
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                <input
                  className={inputClass}
                  onChange={(event) => setSchoolQuery(event.target.value)}
                  placeholder="학교명 2글자 이상 또는 학교 코드 7자리 이상"
                  value={schoolQuery}
                />
                {/^\d+$/.test(schoolQuery.trim()) &&
                  schoolQuery.trim().length < 7 && (
                    <p className="mt-2 text-xs text-slate-400">
                      학교 코드는 7자리 이상 입력해 주세요.
                    </p>
                  )}
                {schoolInfoStatus === "loading" && (
                  <p className="mt-2 text-xs text-slate-400">
                    학교 목록을 불러오는 중...
                  </p>
                )}
                {schoolInfoStatus === "error" && (
                  <p className="mt-2 text-xs font-bold text-rose-600">
                    학교 목록을 불러오지 못했습니다.
                  </p>
                )}
                {schoolResults.length > 0 && (
                  <div className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    {schoolResults.map((school) => (
                      <button
                        className="block w-full rounded-lg px-3 py-3 text-left transition hover:bg-indigo-50 dark:hover:bg-slate-800"
                        key={school.schoolcode}
                        onClick={() => {
                          setConfig((current) => ({
                            ...current,
                            schoolCode: school.schoolcode,
                            schoolName: school.name,
                          }))
                          setSchoolQuery(school.name)
                        }}
                        type="button"
                      >
                        <span className="block font-bold">{school.name}</span>
                        <span className="mt-1 block truncate text-xs text-slate-400">
                          {[school.cityname, school.address, school.schoolcode]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <label>
            <span className="mb-2 block text-sm font-bold">학년</span>
            <select
              className={inputClass}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  grade: Number(event.target.value),
                }))
              }
              value={config.grade}
            >
              <option disabled value={0}>
                학년을 입력하세요
              </option>
              {[1, 2, 3].map((grade) => (
                <option key={grade} value={grade}>
                  {grade}학년
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-sm font-bold">학기</span>
            <select
              className={inputClass}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  semester: Number(event.target.value),
                }))
              }
              value={config.semester}
            >
              <option disabled value={0}>
                학기를 입력하세요
              </option>
              <option value={1}>1학기</option>
              <option value={2}>2학기</option>
            </select>
          </label>
        </div>
      </section>

      {isAdmin && (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/5 sm:p-5">
          <h3 className="font-extrabold">JSON으로 평가계획 가져오기</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            첨부 양식과 같은 하나의 JSON 과목 배열을 선택해 주세요.
            학교·학년·학기는 위에서 선택하고, 가져온 내용을 확인한 뒤 배포해야
            서버에 저장됩니다.
          </p>
          <input
            aria-label="평가계획 JSON 파일"
            accept=".json,application/json"
            className="mt-4 block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-indigo-600 file:px-4 file:py-2.5 file:font-bold file:text-white"
            disabled={busy !== null || importBusy}
            type="file"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (!file) return
              setImportBusy(true)
              setImportPlan([])
              setImportName("")
              try {
                if (file.size > 1024 * 1024)
                  throw new Error("파일은 최대 1MB까지 불러올 수 있습니다.")
                const plan = parseSubjectPlan(await file.text())
                setImportPlan(plan)
                setImportName(file.name)
                setMessage({
                  tone: "info",
                  text: `${plan.length}개 과목을 불러왔습니다. 내용을 확인한 뒤 편집기에 적용해 주세요.`,
                })
              } catch (error) {
                setMessage({
                  tone: "error",
                  text:
                    error instanceof Error
                      ? error.message
                      : "파일을 읽지 못했습니다.",
                })
              } finally {
                setImportBusy(false)
              }
            }}
          />
          {importBusy && (
            <p className="mt-3 text-sm" role="status">
              파일을 읽는 중...
            </p>
          )}
          {importPlan.length > 0 && (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-bold">
                {importName} · {importPlan.length}과목
              </p>
              <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                {importPlan.map((subject) => subject.name).join(" · ")}
              </p>
              <button
                className={secondaryButton}
                disabled={busy !== null}
                type="button"
                onClick={() => {
                  if (
                    config.subjects.length > 0 &&
                    !window.confirm(
                      "현재 편집 중인 과목을 선택한 평가계획으로 교체할까요?",
                    )
                  )
                    return
                  setConfig((current) => ({
                    ...current,
                    subjects: importPlan,
                  }))
                  setCollapsed({})
                  setMessage({
                    tone: "success",
                    text: `${importPlan.length}과목을 편집기에 적용했습니다. 학교·학년·학기를 확인한 후 배포해 주세요.`,
                  })
                }}
              >
                평가계획 적용
                {config.subjects.length > 0 ? " (현재 과목 교체)" : ""}
              </button>
            </div>
          )}
        </section>
      )}

      <section>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold">2. 과목과 평가 계획</h3>
            <p className="mt-1 text-xs text-slate-400">
              화살표로 순서를 바꾸고 과목별 지필·수행 평가를 접거나 펼칠 수
              있습니다. 평가 시기는 선택 사항이며 비우면 선택한 학기로
              저장됩니다.
            </p>
          </div>
          <button
            className={primaryButton}
            disabled={config.subjects.length >= 20}
            onClick={() =>
              setConfig((current) => ({
                ...current,
                subjects: [
                  ...current.subjects,
                  emptySubject(current.subjects.length),
                ],
              }))
            }
            type="button"
            title={
              config.subjects.length >= 20
                ? "과목은 최대 20개까지 추가할 수 있습니다."
                : undefined
            }
          >
            과목 추가 ({config.subjects.length}/20)
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {config.subjects.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400 dark:border-slate-700">
              아직 과목이 없습니다. 과목 추가를 눌러 시작하세요.
            </div>
          )}
          {config.subjects.map((subject, subjectIndex) => {
            const total = subject.assessments.reduce(
              (sum, assessment) =>
                sum +
                (Number.isFinite(assessment.weight) ? assessment.weight : 0),
              0,
            )
            return (
              <article
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/50 sm:p-5"
                key={`subject-${subjectIndex}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`size-3 rounded-full ${subject.color}`} />
                  <input
                    aria-label="과목명"
                    className={`${inputClass} min-w-40 flex-1`}
                    onChange={(event) =>
                      updateSubject(subjectIndex, (current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    value={subject.name}
                  />
                  <button
                    aria-label="위로 이동"
                    className={secondaryButton}
                    disabled={subjectIndex === 0}
                    onClick={() =>
                      setConfig((current) => ({
                        ...current,
                        subjects: moveItem(current.subjects, subjectIndex, -1),
                      }))
                    }
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    aria-label="아래로 이동"
                    className={secondaryButton}
                    disabled={subjectIndex === config.subjects.length - 1}
                    onClick={() =>
                      setConfig((current) => ({
                        ...current,
                        subjects: moveItem(current.subjects, subjectIndex, 1),
                      }))
                    }
                    type="button"
                  >
                    ↓
                  </button>
                  <button
                    className="rounded-xl px-3 py-2.5 text-sm font-bold text-rose-600 transition hover:bg-rose-50 dark:hover:bg-rose-500/10"
                    onClick={() => {
                      if (
                        window.confirm(`'${subject.name}' 과목을 삭제할까요?`)
                      ) {
                        setConfig((current) => ({
                          ...current,
                          subjects: current.subjects.filter(
                            (_, index) => index !== subjectIndex,
                          ),
                        }))
                      }
                    }}
                    type="button"
                  >
                    삭제
                  </button>
                </div>

                <div className="mt-3">
                  <label>
                    <span className="mb-1 block text-xs font-bold text-slate-500">
                      표시 색상
                    </span>
                    <select
                      className={inputClass}
                      onChange={(event) =>
                        updateSubject(subjectIndex, (current) => ({
                          ...current,
                          color: event.target.value,
                        }))
                      }
                      value={subject.color}
                    >
                      {COLORS.map((color) => (
                        <option key={color.value} value={color.value}>
                          {color.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="mt-4 flex items-center gap-3 rounded-xl bg-white p-3 text-sm font-bold dark:bg-slate-900">
                  <input
                    checked={subject.passOnly === true}
                    className="size-4 accent-indigo-600"
                    onChange={(event) =>
                      updateSubject(subjectIndex, (current) => ({
                        ...current,
                        passOnly: event.target.checked || undefined,
                        assessments: event.target.checked
                          ? []
                          : current.assessments,
                      }))
                    }
                    type="checkbox"
                  />
                  원점수 미산출 과목
                  <span className="font-normal text-slate-400">
                    평가 항목 없이 P로 표시됩니다.
                  </span>
                </label>

                {!subject.passOnly && (
                  <div className="mt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p
                        className={`text-sm font-extrabold ${
                          total === 100 ? "text-emerald-600" : "text-amber-600"
                        }`}
                      >
                        반영 비율 합계 {total}%
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          aria-expanded={!collapsed[subjectIndex]}
                          aria-controls={`assessments-${subjectIndex}`}
                          className={secondaryButton}
                          type="button"
                          onClick={() =>
                            setCollapsed((current) => ({
                              ...current,
                              [subjectIndex]: !current[subjectIndex],
                            }))
                          }
                        >
                          지필·수행{" "}
                          {collapsed[subjectIndex] ? "펼치기" : "접기"} (
                          {subject.assessments.length})
                        </button>
                        {(["지필평가", "수행평가"] as const).map((type) => (
                          <button
                            className={secondaryButton}
                            disabled={
                              type === "수행평가" &&
                              subject.assessments.filter(
                                (assessment) => assessment.type === "수행평가",
                              ).length >= 5
                            }
                            key={type}
                            onClick={() => {
                              setCollapsed((current) => ({
                                ...current,
                                [subjectIndex]: false,
                              }))
                              updateSubject(subjectIndex, (current) => ({
                                ...current,
                                assessments: [
                                  ...current.assessments,
                                  emptyAssessment(
                                    type,
                                    current.assessments.length,
                                  ),
                                ],
                              }))
                            }}
                            type="button"
                          >
                            {type} 추가
                            {type === "수행평가"
                              ? ` (${subject.assessments.filter((assessment) => assessment.type === "수행평가").length}/5)`
                              : ""}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div
                      className="mt-3 space-y-3"
                      id={`assessments-${subjectIndex}`}
                      hidden={collapsed[subjectIndex]}
                    >
                      {subject.assessments.map(
                        (assessment, assessmentIndex) => (
                          <div
                            className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
                            key={`assessment-${assessmentIndex}`}
                          >
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)_7rem]">
                              <select
                                className={inputClass}
                                onChange={(event) => {
                                  const nextType = event.target
                                    .value as ConfigAssessment["type"]
                                  updateSubject(subjectIndex, (current) => ({
                                    ...current,
                                    assessments: current.assessments.map(
                                      (item, index) =>
                                        index === assessmentIndex
                                          ? {
                                              ...item,
                                              type: nextType,
                                              id:
                                                nextType === "지필평가"
                                                  ? ""
                                                  : `performance-${assessmentIndex + 1}`,
                                              title: "",
                                            }
                                          : item,
                                    ),
                                  }))
                                }}
                                value={assessment.type}
                              >
                                <option>지필평가</option>
                                <option>수행평가</option>
                              </select>
                              {assessment.type === "지필평가" ? (
                                <select
                                  aria-label="지필평가명"
                                  className={inputClass}
                                  onChange={(event) => {
                                    const exam = WRITTEN_EXAMS.find(
                                      (item) => item.id === event.target.value,
                                    )
                                    updateSubject(subjectIndex, (current) => ({
                                      ...current,
                                      assessments: current.assessments.map(
                                        (item, index) =>
                                          index === assessmentIndex
                                            ? {
                                                ...item,
                                                id: exam?.id || "",
                                                title: exam?.title || "",
                                              }
                                            : item,
                                      ),
                                    }))
                                  }}
                                  value={
                                    WRITTEN_EXAMS.find(
                                      (exam) =>
                                        exam.id === assessment.id &&
                                        exam.title === assessment.title,
                                    )?.id || ""
                                  }
                                >
                                  <option disabled value="">
                                    시험을 선택하세요
                                  </option>
                                  {WRITTEN_EXAMS.map((exam) => (
                                    <option key={exam.id} value={exam.id}>
                                      {exam.title}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  aria-label="평가명"
                                  className={inputClass}
                                  onChange={(event) =>
                                    updateSubject(subjectIndex, (current) => ({
                                      ...current,
                                      assessments: current.assessments.map(
                                        (item, index) =>
                                          index === assessmentIndex
                                            ? {
                                                ...item,
                                                title: event.target.value,
                                              }
                                            : item,
                                      ),
                                    }))
                                  }
                                  placeholder="평가명을 입력하세요"
                                  value={assessment.title}
                                />
                              )}
                              <input
                                aria-label="평가 시기 (선택)"
                                className={inputClass}
                                onChange={(event) =>
                                  updateSubject(subjectIndex, (current) => ({
                                    ...current,
                                    assessments: current.assessments.map(
                                      (item, index) =>
                                        index === assessmentIndex
                                          ? {
                                              ...item,
                                              period: event.target.value,
                                            }
                                          : item,
                                    ),
                                  }))
                                }
                                placeholder={`선택 · 비우면 ${config.semester || "선택한 "}학기`}
                                value={assessment.period}
                              />
                              <input
                                aria-label="반영 비율"
                                className={inputClass}
                                max={100}
                                min={0}
                                onChange={(event) =>
                                  updateSubject(subjectIndex, (current) => ({
                                    ...current,
                                    assessments: current.assessments.map(
                                      (item, index) =>
                                        index === assessmentIndex
                                          ? {
                                              ...item,
                                              weight: Math.min(
                                                100,
                                                Math.max(
                                                  0,
                                                  event.target.value === ""
                                                    ? Number.NaN
                                                    : Number(
                                                        event.target.value,
                                                      ),
                                                ),
                                              ),
                                            }
                                          : item,
                                    ),
                                  }))
                                }
                                placeholder="반영비율"
                                type="number"
                                value={
                                  Number.isFinite(assessment.weight)
                                    ? assessment.weight
                                    : ""
                                }
                              />
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <button
                                className={secondaryButton}
                                disabled={assessmentIndex === 0}
                                onClick={() =>
                                  updateSubject(subjectIndex, (current) => ({
                                    ...current,
                                    assessments: moveItem(
                                      current.assessments,
                                      assessmentIndex,
                                      -1,
                                    ),
                                  }))
                                }
                                type="button"
                              >
                                ↑
                              </button>
                              <button
                                className={secondaryButton}
                                disabled={
                                  assessmentIndex ===
                                  subject.assessments.length - 1
                                }
                                onClick={() =>
                                  updateSubject(subjectIndex, (current) => ({
                                    ...current,
                                    assessments: moveItem(
                                      current.assessments,
                                      assessmentIndex,
                                      1,
                                    ),
                                  }))
                                }
                                type="button"
                              >
                                ↓
                              </button>
                              <button
                                className="rounded-lg px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `'${assessment.title}' 평가 항목을 삭제할까요?`,
                                    )
                                  ) {
                                    updateSubject(subjectIndex, (current) => ({
                                      ...current,
                                      assessments: current.assessments.filter(
                                        (_, index) => index !== assessmentIndex,
                                      ),
                                    }))
                                  }
                                }}
                                type="button"
                              >
                                평가 삭제
                              </button>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </section>

      {message && (
        <div
          className={`rounded-xl border p-4 text-sm font-bold ${
            message.tone === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
              : message.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                : "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 dark:border-slate-700 sm:flex-row sm:justify-end">
        <button
          className={secondaryButton}
          disabled={!user || busy !== null}
          onClick={() => {
            if (!user) return
            localStorage.setItem(
              draftStorageKey(user.uid),
              JSON.stringify(config),
            )
            setMessage({
              tone: "success",
              text: "현재 내용을 이 기기에 임시 저장했습니다.",
            })
          }}
          type="button"
        >
          임시 저장
        </button>
        {sourceKey && (
          <button
            className={secondaryButton}
            disabled={busy !== null}
            onClick={() => sendConfig("update")}
            type="button"
          >
            {busy === "update" ? "수정 중..." : "서버 설정 수정"}
          </button>
        )}
        <button
          className={primaryButton}
          disabled={busy !== null}
          onClick={() => sendConfig("publish")}
          type="button"
        >
          {busy === "publish" ? "배포 중..." : "새 설정으로 배포"}
        </button>
      </div>
    </div>
  )
}

export default function SchoolManager({
  schools,
  user,
  isAdmin,
  onClose,
  onSave,
  onDelete,
  onPublishedDeleted,
  onOpen,
  onOpenPublished,
  onShare,
  onRequestSignIn,
  initialView = "mine",
}: SchoolManagerProps) {
  const [view, setView] = useState<"mine" | "editor" | "admin">(
    initialView === "editor" && (isAdmin || schools.length === 0)
      ? "editor"
      : "mine",
  )
  const [editing, setEditing] = useState<{
    config?: SchoolConfig
    sourceKey?: string
    id?: string
  } | null>(null)
  const [published, setPublished] =
    useState<Awaited<ReturnType<typeof listPublishedSchools>>>([])
  const [adminStatus, setAdminStatus] =
    useState<"idle" | "loading" | "ready" | "error">("idle")
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [detailKey, setDetailKey] = useState<string | null>(null)
  const [detailConfig, setDetailConfig] = useState<SchoolConfig | null>(null)
  const [detailStatus, setDetailStatus] =
    useState<"idle" | "loading" | "ready" | "error">("idle")
  const [managerError, setManagerError] = useState("")
  const [pendingDelete, setPendingDelete] = useState<{
    label: string
    schoolKey?: string
    localId?: string
    localOnly?: boolean
  } | null>(null)
  const deleteLock = useRef(false)
  const deleteCancelRef = useRef<HTMLButtonElement>(null)
  const canCreate = Boolean(user) && (isAdmin || schools.length === 0)

  useEffect(() => {
    if (!pendingDelete) return
    const previousFocus = document.activeElement as HTMLElement | null
    deleteCancelRef.current?.focus()
    return () => previousFocus?.focus()
  }, [pendingDelete])

  const loadPublished = async () => {
    setAdminStatus("loading")
    setManagerError("")
    try {
      setPublished(await listPublishedSchools())
      setAdminStatus("ready")
    } catch (error) {
      setAdminStatus("error")
      setManagerError(
        error instanceof Error
          ? error.message
          : "학교 목록을 불러오지 못했습니다.",
      )
    }
  }

  useEffect(() => {
    if (view === "admin" && isAdmin && adminStatus === "idle") {
      void loadPublished()
    }
  }, [adminStatus, isAdmin, view])

  const showEditor = (
    config?: SchoolConfig,
    sourceKey?: string,
    id?: string,
  ) => {
    if (!user) {
      onRequestSignIn()
      return
    }
    if (!config && !canCreate) return
    setEditing({ config, sourceKey, id })
    setView("editor")
  }

  const confirmDeletion = async () => {
    if (!pendingDelete || deleteLock.current) return
    deleteLock.current = true
    setBusyKey(pendingDelete.schoolKey || pendingDelete.localId || "delete")
    setManagerError("")
    try {
      if (pendingDelete.schoolKey && !pendingDelete.localOnly) {
        await deletePublishedSchool(pendingDelete.schoolKey)
        setPublished((current) =>
          current.filter(
            (school) => school.schoolKey !== pendingDelete.schoolKey,
          ),
        )
        if (detailKey === pendingDelete.schoolKey) {
          setDetailKey(null)
          setDetailConfig(null)
          setDetailStatus("idle")
        }
        onPublishedDeleted(pendingDelete.schoolKey)
      } else if (pendingDelete.localId) {
        onDelete(pendingDelete.localId)
      }
      setPendingDelete(null)
    } catch (error) {
      setManagerError(
        error instanceof Error ? error.message : "학교를 삭제하지 못했습니다.",
      )
    } finally {
      deleteLock.current = false
      setBusyKey(null)
    }
  }

  const togglePublishedDetails = async (schoolKey: string) => {
    if (detailKey === schoolKey) {
      setDetailKey(null)
      setDetailConfig(null)
      setDetailStatus("idle")
      return
    }
    setDetailKey(schoolKey)
    setDetailConfig(null)
    setDetailStatus("loading")
    try {
      setDetailConfig(await getPublishedSchool(schoolKey))
      setDetailStatus("ready")
    } catch (error) {
      setDetailStatus("error")
      setManagerError(
        error instanceof Error
          ? error.message
          : "평가계획 내용을 불러오지 못했습니다.",
      )
    }
  }

  return (
    <div
      aria-label="내 학교 관리"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
    >
      <div className="max-h-[calc(100vh-1.5rem)] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-white sm:max-h-[calc(100vh-3rem)]">
        <header className="sticky top-0 z-30 flex flex-col gap-4 rounded-t-3xl border-b border-slate-200 bg-white/95 px-5 py-5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <p className="text-xs font-black tracking-[0.15em] text-indigo-600 dark:text-indigo-300">
              SCHOOL SETTINGS
            </p>
            <h1 className="mt-1 text-xl font-black">내 학교 관리</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className={view === "mine" ? primaryButton : secondaryButton}
              onClick={() => setView("mine")}
              type="button"
            >
              내 학교
            </button>
            {isAdmin && (
              <button
                className={view === "admin" ? primaryButton : secondaryButton}
                onClick={() => setView("admin")}
                type="button"
              >
                전체 학교 관리
              </button>
            )}
            <button
              className={secondaryButton}
              disabled={!canCreate}
              onClick={() => showEditor()}
              type="button"
            >
              {isAdmin
                ? "학교 추가"
                : schools.length > 0
                  ? "학교 추가 완료"
                  : "학교 추가"}
            </button>
            <button className={secondaryButton} onClick={onClose} type="button">
              닫기
            </button>
          </div>
        </header>

        <main className="p-5 sm:p-8">
          {pendingDelete && (
            <section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-school-title"
              aria-describedby="delete-school-description"
              className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/70 p-5 backdrop-blur-sm"
              onKeyDown={(event) => {
                if (event.key === "Escape" && !deleteLock.current) {
                  setPendingDelete(null)
                  setManagerError("")
                }
                if (event.key === "Tab") {
                  const buttons = [
                    ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
                      "button:not(:disabled)",
                    ),
                  ]
                  const first = buttons[0]
                  const last = buttons[buttons.length - 1]
                  if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault()
                    last?.focus()
                  }
                  if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault()
                    first?.focus()
                  }
                }
              }}
            >
              <div className="w-full max-w-lg rounded-2xl border border-rose-200 bg-white p-6 shadow-2xl dark:border-rose-500/30 dark:bg-slate-900">
                <h2 id="delete-school-title" className="font-black">
                  {pendingDelete.localOnly
                    ? "내 목록에서 제거할까요?"
                    : "학교 평가계획을 삭제할까요?"}
                </h2>
                <p className="mt-2 text-sm font-bold">{pendingDelete.label}</p>
                <p
                  id="delete-school-description"
                  className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400"
                >
                  {pendingDelete.schoolKey && !pendingDelete.localOnly
                    ? "서버에서 삭제하면 다른 사용자도 이 평가계획을 열 수 없습니다. 삭제 성공 후 내 목록과 검색 결과에서도 제거됩니다."
                    : "이 기기의 내 학교 목록에서만 제거합니다. 서버에 배포된 평가계획은 삭제하지 않습니다."}
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-40"
                    disabled={busyKey !== null}
                    onClick={() => void confirmDeletion()}
                    type="button"
                  >
                    {busyKey ? "처리 중..." : "확인 · 제거"}
                  </button>
                  <button
                    ref={deleteCancelRef}
                    className={secondaryButton}
                    disabled={busyKey !== null}
                    onClick={() => {
                      setPendingDelete(null)
                      setManagerError("")
                    }}
                    type="button"
                  >
                    취소
                  </button>
                </div>
                {managerError && (
                  <p
                    role="alert"
                    className="mt-4 text-sm font-bold leading-6 text-rose-600 dark:text-rose-300"
                  >
                    {managerError}
                  </p>
                )}
              </div>
            </section>
          )}
          {managerError && !pendingDelete && (
            <div className="mb-5 rounded-xl bg-rose-50 p-4 font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
              {managerError}
            </div>
          )}

          {view === "editor" && (
            <Editor
              initial={editing?.config}
              key={`${editing?.sourceKey || "new"}-${editing?.config?.schoolCode || ""}`}
              onCancel={() => setView("mine")}
              onRequestSignIn={onRequestSignIn}
              onSaved={(config, sourceKey) => {
                onSave(config, sourceKey, editing?.id)
                setEditing({
                  config,
                  sourceKey,
                  id: `custom:${getSchoolKey(config)}`,
                })
              }}
              sourceKey={editing?.sourceKey}
              user={user}
              isAdmin={isAdmin}
            />
          )}

          {view === "mine" && (
            <div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-black">내가 추가한 학교</h2>
                </div>
                <button
                  className={primaryButton}
                  disabled={!canCreate}
                  onClick={() => showEditor()}
                  type="button"
                >
                  {isAdmin
                    ? "새 학교 만들기"
                    : schools.length > 0
                      ? "학교 1개 등록 완료"
                      : "새 학교 만들기"}
                </button>
              </div>
              {schools.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
                  <p className="font-extrabold">추가한 학교가 없습니다.</p>
                  <p className="mt-2 text-sm text-slate-400">
                    학교를 추가해 평가계획을 배포하세요.
                  </p>
                </div>
              ) : (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {schools.map((school) => (
                    <article
                      className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700"
                      key={school.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-black">
                            {school.schoolName}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {school.grade}학년 {school.semester}학기 ·{" "}
                            {school.subjects.length}과목
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            학교 코드 {school.schoolCode}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          className={primaryButton}
                          onClick={() => onOpen(school.id)}
                          type="button"
                        >
                          계산기 열기
                        </button>
                        <button
                          className={secondaryButton}
                          onClick={() => onShare(school.id)}
                          type="button"
                        >
                          <svg
                            aria-hidden="true"
                            className="mr-1 inline size-4"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.8"
                            viewBox="0 0 24 24"
                          >
                            <circle cx="18" cy="5" r="3" />
                            <circle cx="6" cy="12" r="3" />
                            <circle cx="18" cy="19" r="3" />
                            <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
                          </svg>
                          공유
                        </button>
                        <button
                          className={secondaryButton}
                          onClick={() =>
                            showEditor(school, school.sourceKey, school.id)
                          }
                          type="button"
                        >
                          편집
                        </button>
                        <button
                          className="rounded-xl px-4 py-2.5 text-sm font-extrabold text-rose-600 hover:bg-rose-50 disabled:opacity-40 dark:hover:bg-rose-500/10"
                          disabled={busyKey !== null}
                          onClick={() =>
                            setPendingDelete({
                              label: `${school.schoolName} ${school.grade}학년 ${school.semester}학기`,
                              schoolKey: school.sourceKey,
                              localId: school.id,
                            })
                          }
                          type="button"
                        >
                          {busyKey === (school.sourceKey || school.id)
                            ? "삭제 중..."
                            : "삭제"}
                        </button>
                        {school.sourceKey && (
                          <button
                            className={secondaryButton}
                            disabled={busyKey !== null}
                            onClick={() =>
                              setPendingDelete({
                                label: school.schoolName,
                                localId: school.id,
                                localOnly: true,
                              })
                            }
                            type="button"
                          >
                            내 목록에서만 제거
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === "admin" && isAdmin && (
            <div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-black">전체 학교 관리</h2>
                </div>
                <button
                  className={secondaryButton}
                  disabled={adminStatus === "loading"}
                  onClick={() => void loadPublished()}
                  type="button"
                >
                  새로고침
                </button>
              </div>
              {adminStatus === "loading" && (
                <div className="py-16 text-center font-bold text-slate-400">
                  학교 목록을 불러오는 중...
                </div>
              )}
              {adminStatus === "ready" && (
                <div className="mt-6 space-y-3">
                  {published
                    .filter(
                      (school) => isAdmin || school.schoolCode !== "0000000",
                    )
                    .map((school) => (
                      <article
                        className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700"
                        key={school.schoolKey}
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h3 className="font-black">{school.schoolName}</h3>
                            <p className="mt-1 text-sm text-slate-400">
                              {school.grade}학년 {school.semester}학기 ·{" "}
                              {school.schoolKey}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              className={secondaryButton}
                              disabled={
                                detailStatus === "loading" &&
                                detailKey === school.schoolKey
                              }
                              onClick={() =>
                                void togglePublishedDetails(school.schoolKey)
                              }
                              type="button"
                            >
                              {detailKey === school.schoolKey
                                ? detailStatus === "loading"
                                  ? "불러오는 중..."
                                  : "내용 닫기"
                                : "내용 열람"}
                            </button>
                            <button
                              className={primaryButton}
                              onClick={() => onOpenPublished(school.schoolKey)}
                              type="button"
                            >
                              평가계획 열기
                            </button>
                            <button
                              className="rounded-xl px-4 py-2.5 text-sm font-extrabold text-rose-600 hover:bg-rose-50 disabled:opacity-40 dark:hover:bg-rose-500/10"
                              disabled={busyKey !== null}
                              onClick={() =>
                                setPendingDelete({
                                  label: `${school.schoolName} ${school.grade}학년 ${school.semester}학기`,
                                  schoolKey: school.schoolKey,
                                })
                              }
                              type="button"
                            >
                              {busyKey === school.schoolKey
                                ? "삭제 중..."
                                : "삭제"}
                            </button>
                          </div>
                        </div>
                        {detailKey === school.schoolKey &&
                          detailStatus === "ready" &&
                          detailConfig && (
                            <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-700">
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {detailConfig.subjects.map((subject) => (
                                  <div
                                    className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70"
                                    key={subject.id}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`size-2.5 rounded-full ${subject.color}`}
                                      />
                                      <h4 className="font-extrabold">
                                        {subject.name}
                                      </h4>
                                    </div>
                                    <ul className="mt-3 space-y-2 text-xs text-slate-500 dark:text-slate-400">
                                      {subject.passOnly ? (
                                        <li>원점수 미산출 과목</li>
                                      ) : (
                                        subject.assessments.map(
                                          (assessment) => (
                                            <li key={assessment.id}>
                                              <span className="font-bold text-slate-700 dark:text-slate-200">
                                                {assessment.title}
                                              </span>{" "}
                                              · {assessment.period} ·{" "}
                                              {assessment.weight}%
                                            </li>
                                          ),
                                        )
                                      )}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                      </article>
                    ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
