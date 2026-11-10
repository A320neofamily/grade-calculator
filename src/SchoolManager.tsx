import { useEffect, useMemo, useState } from "react"
import type { User } from "firebase/auth"
import {
  getPublishedSchool,
  getSchoolKey,
  listPublishedSchools,
  publishSchoolConfig,
  SchoolConfigApiError,
  updateSchoolConfig,
  type ConfigAssessment,
  type ConfigSubject,
  type PublishedSchoolSummary,
  type SchoolConfig,
} from "./schoolConfigApi"

type SchoolInfo = {
  schoolcode: string
  name: string
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
  onClose: () => void
  onSave: (
    config: SchoolConfig,
    sourceKey?: string,
    previousId?: string,
  ) => void
  onDelete: (id: string) => void
  onOpen: (id: string) => void
  onRequestSignIn: () => void
}

const COLORS = [
  "bg-rose-500",
  "bg-amber-500",
  "bg-orange-500",
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-blue-500",
  "bg-red-500",
  "bg-cyan-500",
  "bg-violet-500",
  "bg-fuchsia-500",
  "bg-sky-500",
  "bg-slate-400",
]

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-900/40"
const secondaryButton =
  "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-500 dark:hover:text-white"
const primaryButton =
  "rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function emptySubject(index: number): ConfigSubject {
  return {
    id: createId("subject"),
    name: `새 과목 ${index + 1}`,
    color: COLORS[index % COLORS.length],
    assessments: [],
  }
}

function emptyAssessment(
  type: ConfigAssessment["type"],
  index: number,
): ConfigAssessment {
  return {
    id: createId("assessment"),
    type,
    title: type === "지필평가" ? `시험 ${index + 1}` : `수행평가 ${index + 1}`,
    period: "",
    weight: 0,
  }
}

function cloneConfig(config: SchoolConfig): SchoolConfig {
  return {
    ...config,
    subjects: config.subjects.map((subject) => ({
      ...subject,
      assessments: subject.assessments.map((assessment) => ({ ...assessment })),
    })),
  }
}

function validateConfig(config: SchoolConfig) {
  if (!config.schoolCode || !config.schoolName)
    return "학교 검색 결과에서 학교를 선택해 주세요."
  if (config.subjects.length === 0) return "과목을 한 개 이상 추가해 주세요."
  const subjectIds = new Set<string>()
  for (const subject of config.subjects) {
    if (!subject.id.trim() || !subject.name.trim())
      return "모든 과목의 ID와 이름을 입력해 주세요."
    if (subjectIds.has(subject.id))
      return `과목 ID '${subject.id}'가 중복되었습니다.`
    subjectIds.add(subject.id)
    if (subject.passOnly) {
      if (subject.assessments.length > 0)
        return `${subject.name}: 원점수 미산출 과목에는 평가 항목을 둘 수 없습니다.`
      continue
    }
    if (subject.assessments.length === 0)
      return `${subject.name}: 평가 항목을 한 개 이상 추가해 주세요.`
    const assessmentIds = new Set<string>()
    for (const assessment of subject.assessments) {
      if (
        !assessment.id.trim() ||
        !assessment.title.trim() ||
        !assessment.period.trim()
      ) {
        return `${subject.name}: 모든 평가의 ID, 이름, 시기를 입력해 주세요.`
      }
      if (assessmentIds.has(assessment.id))
        return `${subject.name}: 평가 ID '${assessment.id}'가 중복되었습니다.`
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
  onCancel,
  onSaved,
  onRequestSignIn,
}: {
  initial?: SchoolConfig
  sourceKey?: string
  user: User | null
  onCancel: () => void
  onSaved: (config: SchoolConfig, sourceKey?: string) => void
  onRequestSignIn: () => void
}) {
  const [config, setConfig] = useState<SchoolConfig>(
    initial
      ? cloneConfig(initial)
      : { schoolCode: "", schoolName: "", grade: 2, semester: 2, subjects: [] },
  )
  const [schoolQuery, setSchoolQuery] = useState(initial?.schoolName ?? "")
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo[]>([])
  const [schoolInfoStatus, setSchoolInfoStatus] =
    useState<"idle" | "loading" | "ready" | "error">("idle")
  const [message, setMessage] = useState<{
    tone: "error" | "success" | "info"
    text: string
  } | null>(null)
  const [busy, setBusy] = useState<"publish" | "update" | null>(null)

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
            typeof item.name === "string",
        )
        setSchoolInfo(valid)
        setSchoolInfoStatus("ready")
      })
      .catch(() => setSchoolInfoStatus("error"))
  }, [initial?.schoolCode])

  const schoolResults = useMemo(() => {
    const query = schoolQuery.trim().toLocaleLowerCase("ko")
    if (query.length < 2 || config.schoolCode) return []
    return schoolInfo
      .filter((school) => school.name.toLocaleLowerCase("ko").includes(query))
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

  const saveLocally = () => {
    const error = validateConfig(config)
    if (error) {
      setMessage({ tone: "error", text: error })
      return
    }
    onSaved(config, sourceKey)
    setMessage({
      tone: "success",
      text: "내 계산기에 학교 설정을 저장했습니다.",
    })
  }

  const sendConfig = async (mode: "publish" | "update") => {
    const error = validateConfig(config)
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
        await publishSchoolConfig(config)
      } else {
        await updateSchoolConfig(sourceKey || getSchoolKey(config), config)
      }
      onSaved(config, getSchoolKey(config))
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
                  placeholder="학교명 2글자 이상 입력"
                  value={schoolQuery}
                />
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
              {[1, 2, 3, 4, 5, 6].map((grade) => (
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
              <option value={1}>1학기</option>
              <option value={2}>2학기</option>
            </select>
          </label>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold">2. 과목과 평가 계획</h3>
            <p className="mt-1 text-xs text-slate-400">
              화살표로 과목과 평가 순서를 바꿀 수 있습니다.
            </p>
          </div>
          <button
            className={primaryButton}
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
          >
            과목 추가
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
              (sum, assessment) => sum + assessment.weight,
              0,
            )
            return (
              <article
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/50 sm:p-5"
                key={subject.id}
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

                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
                  <label>
                    <span className="mb-1 block text-xs font-bold text-slate-500">
                      과목 ID
                    </span>
                    <input
                      className={inputClass}
                      onChange={(event) =>
                        updateSubject(subjectIndex, (current) => ({
                          ...current,
                          id: event.target.value.trim(),
                        }))
                      }
                      value={subject.id}
                    />
                  </label>
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
                        <option key={color} value={color}>
                          {color}
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
                      <div className="flex gap-2">
                        {(["지필평가", "수행평가"] as const).map((type) => (
                          <button
                            className={secondaryButton}
                            key={type}
                            onClick={() =>
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
                            }
                            type="button"
                          >
                            {type} 추가
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="mt-3 space-y-3">
                      {subject.assessments.map(
                        (assessment, assessmentIndex) => (
                          <div
                            className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
                            key={assessment.id}
                          >
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)_7rem]">
                              <select
                                className={inputClass}
                                onChange={(event) =>
                                  updateSubject(subjectIndex, (current) => ({
                                    ...current,
                                    assessments: current.assessments.map(
                                      (item, index) =>
                                        index === assessmentIndex
                                          ? {
                                              ...item,
                                              type: event.target
                                                .value as ConfigAssessment["type"],
                                            }
                                          : item,
                                    ),
                                  }))
                                }
                                value={assessment.type}
                              >
                                <option>지필평가</option>
                                <option>수행평가</option>
                              </select>
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
                                placeholder="평가명"
                                value={assessment.title}
                              />
                              <input
                                aria-label="평가 시기"
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
                                placeholder="예: 10월"
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
                                                  Number(event.target.value),
                                                ),
                                              ),
                                            }
                                          : item,
                                    ),
                                  }))
                                }
                                type="number"
                                value={assessment.weight}
                              />
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <label className="min-w-48 flex-1">
                                <span className="sr-only">평가 ID</span>
                                <input
                                  className={`${inputClass} h-9 text-xs`}
                                  onChange={(event) =>
                                    updateSubject(subjectIndex, (current) => ({
                                      ...current,
                                      assessments: current.assessments.map(
                                        (item, index) =>
                                          index === assessmentIndex
                                            ? {
                                                ...item,
                                                id: event.target.value.trim(),
                                              }
                                            : item,
                                      ),
                                    }))
                                  }
                                  value={assessment.id}
                                />
                              </label>
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
        <button className={secondaryButton} onClick={saveLocally} type="button">
          내 계산기에 저장
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
  onClose,
  onSave,
  onDelete,
  onOpen,
  onRequestSignIn,
}: SchoolManagerProps) {
  const [view, setView] = useState<"mine" | "browse" | "editor">("mine")
  const [editing, setEditing] = useState<{
    config?: SchoolConfig
    sourceKey?: string
    id?: string
  } | null>(null)
  const [published, setPublished] = useState<PublishedSchoolSummary[]>([])
  const [browseStatus, setBrowseStatus] =
    useState<"idle" | "loading" | "ready" | "error">("idle")
  const [query, setQuery] = useState("")
  const [grade, setGrade] = useState("")
  const [semester, setSemester] = useState("")
  const [detail, setDetail] = useState<{
    key: string
    config: SchoolConfig
  } | null>(null)
  const [detailBusy, setDetailBusy] = useState<string | null>(null)
  const [browseError, setBrowseError] = useState("")

  const loadPublished = async () => {
    setBrowseStatus("loading")
    setBrowseError("")
    try {
      setPublished(await listPublishedSchools())
      setBrowseStatus("ready")
    } catch (error) {
      setBrowseStatus("error")
      setBrowseError(
        error instanceof Error
          ? error.message
          : "학교 목록을 불러오지 못했습니다.",
      )
    }
  }

  useEffect(() => {
    if (view === "browse" && browseStatus === "idle") void loadPublished()
  }, [browseStatus, view])

  const filteredPublished = useMemo(
    () =>
      published.filter(
        (school) =>
          school.schoolName
            .toLocaleLowerCase("ko")
            .includes(query.trim().toLocaleLowerCase("ko")) &&
          (!grade || school.grade === Number(grade)) &&
          (!semester || school.semester === Number(semester)),
      ),
    [grade, published, query, semester],
  )

  const showEditor = (
    config?: SchoolConfig,
    sourceKey?: string,
    id?: string,
  ) => {
    setEditing({ config, sourceKey, id })
    setView("editor")
  }

  return (
    <div
      aria-label="내 학교 관리"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
    >
      <div className="mx-auto min-h-full max-w-6xl rounded-3xl bg-white text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-white">
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
            <button
              className={view === "browse" ? primaryButton : secondaryButton}
              onClick={() => setView("browse")}
              type="button"
            >
              배포된 학교 둘러보기
            </button>
            <button
              className={secondaryButton}
              onClick={() => showEditor()}
              type="button"
            >
              학교 추가
            </button>
            <button className={secondaryButton} onClick={onClose} type="button">
              닫기
            </button>
          </div>
        </header>

        <main className="p-5 sm:p-8">
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
            />
          )}

          {view === "mine" && (
            <div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-black">내가 추가한 학교</h2>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    설정과 개인 점수는 분리되어 저장됩니다. 삭제해도 서버의 공유
                    설정은 삭제되지 않습니다.
                  </p>
                </div>
                <button
                  className={primaryButton}
                  onClick={() => showEditor()}
                  type="button"
                >
                  새 학교 만들기
                </button>
              </div>
              {schools.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
                  <p className="font-extrabold">추가한 학교가 없습니다.</p>
                  <p className="mt-2 text-sm text-slate-400">
                    직접 만들거나 배포된 학교를 둘러보세요.
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
                          <h3
                            className="truncate text-lg font-black"
                            title={school.schoolName}
                          >
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
                        {school.sourceKey && (
                          <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                            공유 설정
                          </span>
                        )}
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
                          onClick={() =>
                            showEditor(school, school.sourceKey, school.id)
                          }
                          type="button"
                        >
                          편집
                        </button>
                        <button
                          className="rounded-xl px-4 py-2.5 text-sm font-extrabold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                          onClick={() => {
                            if (
                              window.confirm(
                                `'${school.schoolName} ${school.grade}학년 ${school.semester}학기'를 내 계산기에서 삭제할까요? 개인 점수도 이 기기에서 삭제됩니다.`,
                              )
                            )
                              onDelete(school.id)
                          }}
                          type="button"
                        >
                          삭제
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === "browse" && (
            <div>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-2xl font-black">배포된 학교 둘러보기</h2>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    다른 사용자가 공유한 평가 계획을 미리 보고 내 계산기에
                    추가할 수 있습니다.
                  </p>
                </div>
                <button
                  className={secondaryButton}
                  disabled={browseStatus === "loading"}
                  onClick={loadPublished}
                  type="button"
                >
                  목록 새로고침
                </button>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_9rem]">
                <input
                  className={inputClass}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="학교명 검색"
                  value={query}
                />
                <select
                  className={inputClass}
                  onChange={(event) => setGrade(event.target.value)}
                  value={grade}
                >
                  <option value="">전체 학년</option>
                  {[1, 2, 3, 4, 5, 6].map((item) => (
                    <option key={item} value={item}>
                      {item}학년
                    </option>
                  ))}
                </select>
                <select
                  className={inputClass}
                  onChange={(event) => setSemester(event.target.value)}
                  value={semester}
                >
                  <option value="">전체 학기</option>
                  <option value="1">1학기</option>
                  <option value="2">2학기</option>
                </select>
              </div>
              {browseStatus === "loading" && (
                <div className="py-16 text-center font-bold text-slate-400">
                  학교 목록을 불러오는 중...
                </div>
              )}
              {browseStatus === "error" && (
                <div className="mt-5 rounded-xl bg-rose-50 p-4 font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
                  {browseError}
                </div>
              )}
              {browseStatus === "ready" && (
                <div className="mt-5 space-y-3">
                  {filteredPublished.length === 0 && (
                    <div className="py-14 text-center text-slate-400">
                      조건에 맞는 학교 설정이 없습니다.
                    </div>
                  )}
                  {filteredPublished.map((school) => (
                    <article
                      className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700"
                      key={school.schoolKey}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-black">
                            {school.schoolName}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {school.grade}학년 {school.semester}학기 · 학교 코드{" "}
                            {school.schoolCode}
                          </p>
                        </div>
                        <button
                          className={secondaryButton}
                          disabled={detailBusy === school.schoolKey}
                          onClick={async () => {
                            setDetailBusy(school.schoolKey)
                            setBrowseError("")
                            try {
                              setDetail({
                                key: school.schoolKey,
                                config: await getPublishedSchool(
                                  school.schoolKey,
                                ),
                              })
                            } catch (error) {
                              setBrowseError(
                                error instanceof Error
                                  ? error.message
                                  : "상세 설정을 불러오지 못했습니다.",
                              )
                            } finally {
                              setDetailBusy(null)
                            }
                          }}
                          type="button"
                        >
                          {detailBusy === school.schoolKey
                            ? "불러오는 중..."
                            : "과목 정보 보기"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
              {detail && (
                <div className="mt-6 rounded-2xl border-2 border-indigo-200 bg-indigo-50/40 p-5 dark:border-indigo-500/30 dark:bg-indigo-500/5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-black text-indigo-600 dark:text-indigo-300">
                        학교 설정 상세
                      </p>
                      <h3 className="mt-1 text-xl font-black">
                        {detail.config.schoolName} · {detail.config.grade}학년{" "}
                        {detail.config.semester}학기
                      </h3>
                    </div>
                    <button
                      className={secondaryButton}
                      onClick={() => setDetail(null)}
                      type="button"
                    >
                      상세 닫기
                    </button>
                  </div>
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {detail.config.subjects.map((subject) => (
                      <div
                        className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
                        key={subject.id}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`size-2.5 rounded-full ${subject.color}`}
                          />
                          <p className="font-extrabold">{subject.name}</p>
                          <span className="ml-auto text-xs font-bold text-slate-400">
                            {subject.passOnly
                              ? "원점수 미산출"
                              : `${subject.assessments.length}개 평가`}
                          </span>
                        </div>
                        {!subject.passOnly && (
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            {subject.assessments
                              .map((item) => `${item.title} ${item.weight}%`)
                              .join(" · ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <button
                      className={secondaryButton}
                      onClick={() => showEditor(detail.config, detail.key)}
                      type="button"
                    >
                      내 설정이면 수정 시도
                    </button>
                    <button
                      className={primaryButton}
                      onClick={() => {
                        onSave(detail.config, detail.key)
                        setView("mine")
                      }}
                      type="button"
                    >
                      내 계산기에 추가하기
                    </button>
                  </div>
                  <p className="mt-3 text-right text-xs text-slate-400">
                    소유 여부는 서버의 수정 응답으로 확인합니다.
                  </p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
