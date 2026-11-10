import { auth } from "./firebase"

export const SCHOOL_CONFIG_API_URL =
  "https://grade-calculator-user-data.grade-calculator.workers.dev"

export type ConfigAssessment = {
  id: string
  type: "지필평가" | "수행평가"
  title: string
  period: string
  weight: number
}

export type ConfigSubject = {
  id: string
  name: string
  color: string
  assessments: ConfigAssessment[]
  passOnly?: boolean
}

export type SchoolConfig = {
  schoolCode: string
  schoolName: string
  grade: number
  semester: number
  subjects: ConfigSubject[]
}

export type PublishedSchoolSummary = {
  schoolKey: string
  schoolCode: string
  schoolName: string
  grade: number
  semester: number
  createdAt?: string
  updatedAt?: string
}

export class SchoolConfigApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readString(
  record: Record<string, unknown>,
  camel: string,
  snake = camel,
) {
  const value = record[camel] ?? record[snake]
  return typeof value === "string" ? value : ""
}

function readNumber(record: Record<string, unknown>, key: string) {
  const value = Number(record[key])
  return Number.isFinite(value) ? value : NaN
}

export function getSchoolKey(
  config: Pick<SchoolConfig, "schoolCode" | "grade" | "semester">,
) {
  return `${config.schoolCode}-${config.grade}-${config.semester}`
}

export function parseSchoolConfig(value: unknown): SchoolConfig | null {
  if (typeof value === "string") {
    try {
      return parseSchoolConfig(JSON.parse(value) as unknown)
    } catch {
      return null
    }
  }
  if (!isRecord(value)) return null

  const schoolCode = readString(value, "schoolCode", "school_code")
  const schoolName = readString(value, "schoolName", "school_name")
  const grade = readNumber(value, "grade")
  const semester = readNumber(value, "semester")
  if (
    !schoolCode ||
    !schoolName ||
    !Number.isInteger(grade) ||
    !Number.isInteger(semester)
  )
    return null
  if (
    grade < 1 ||
    grade > 3 ||
    (semester !== 1 && semester !== 2) ||
    !Array.isArray(value.subjects) ||
    value.subjects.length === 0
  )
    return null

  const subjects: ConfigSubject[] = []
  const subjectIds = new Set<string>()
  for (const item of value.subjects) {
    if (!isRecord(item)) return null
    const id = readString(item, "id")
    const name = readString(item, "name")
    const color = readString(item, "color")
    const passOnly = item.passOnly === true
    if (
      !id ||
      !name ||
      !color ||
      subjectIds.has(id) ||
      !Array.isArray(item.assessments)
    )
      return null
    subjectIds.add(id)

    const assessments: ConfigAssessment[] = []
    const assessmentIds = new Set<string>()
    for (const assessment of item.assessments) {
      if (!isRecord(assessment)) return null
      const assessmentId = readString(assessment, "id")
      const type = assessment.type
      const title = readString(assessment, "title")
      const period = readString(assessment, "period")
      const weight = readNumber(assessment, "weight")
      if (
        !assessmentId ||
        (type !== "지필평가" && type !== "수행평가") ||
        assessmentIds.has(assessmentId) ||
        !title ||
        !period ||
        !Number.isFinite(weight) ||
        weight < 0 ||
        weight > 100
      ) {
        return null
      }
      assessmentIds.add(assessmentId)
      assessments.push({ id: assessmentId, type, title, period, weight })
    }

    if (passOnly && assessments.length > 0) return null
    if (
      !passOnly &&
      (assessments.length === 0 ||
        Math.abs(
          assessments.reduce((sum, assessment) => sum + assessment.weight, 0) -
            100,
        ) > 0.001)
    )
      return null
    subjects.push({
      id,
      name,
      color,
      assessments,
      ...(passOnly ? { passOnly: true } : {}),
    })
  }

  return { schoolCode, schoolName, grade, semester, subjects }
}

function parseSummary(value: unknown): PublishedSchoolSummary | null {
  if (!isRecord(value)) return null
  const schoolKey = readString(value, "schoolKey", "school_key")
  const schoolCode = readString(value, "schoolCode", "school_code")
  const schoolName = readString(value, "schoolName", "school_name")
  const grade = readNumber(value, "grade")
  const semester = readNumber(value, "semester")
  if (
    !schoolKey ||
    !schoolCode ||
    !schoolName ||
    !Number.isInteger(grade) ||
    !Number.isInteger(semester)
  )
    return null
  return {
    schoolKey,
    schoolCode,
    schoolName,
    grade,
    semester,
    createdAt: readString(value, "createdAt", "created_at") || undefined,
    updatedAt: readString(value, "updatedAt", "updated_at") || undefined,
  }
}

async function parseResponse(response: Response) {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function responseMessage(status: number, fallback: string) {
  if (status === 401)
    return "Google 로그인이 필요하거나 로그인이 만료되었습니다."
  if (status === 403) return "이 학교 설정을 수정할 권한이 없습니다."
  if (status === 409)
    return "같은 학교·학년·학기 설정이 이미 등록되어 있습니다."
  if (status >= 500)
    return "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
  return fallback
}

async function authorizedRequest(
  path: string,
  method: "POST" | "PUT",
  config: SchoolConfig,
) {
  const user = auth.currentUser
  if (!user)
    throw new SchoolConfigApiError(
      401,
      "학교 설정을 배포하려면 Google 로그인이 필요합니다.",
    )
  const token = await user.getIdToken()
  const response = await fetch(`${SCHOOL_CONFIG_API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(config),
  })
  const body = await parseResponse(response)
  if (!response.ok) {
    const serverMessage =
      isRecord(body) && typeof body.message === "string" ? body.message : ""
    throw new SchoolConfigApiError(
      response.status,
      responseMessage(
        response.status,
        serverMessage || "학교 설정 요청을 처리하지 못했습니다.",
      ),
    )
  }
  return body
}

export async function publishSchoolConfig(config: SchoolConfig) {
  return authorizedRequest("/api/schools/publish", "POST", config)
}

export async function updateSchoolConfig(
  schoolKey: string,
  config: SchoolConfig,
) {
  return authorizedRequest(
    `/api/schools/${encodeURIComponent(schoolKey)}`,
    "PUT",
    config,
  )
}

export async function listPublishedSchools(): Promise<PublishedSchoolSummary[]> {
  const response = await fetch(`${SCHOOL_CONFIG_API_URL}/api/schools`, {
    cache: "no-store",
  })
  const body = await parseResponse(response)
  if (!response.ok) {
    throw new SchoolConfigApiError(
      response.status,
      responseMessage(response.status, "학교 목록을 불러오지 못했습니다."),
    )
  }
  if (!isRecord(body) || !Array.isArray(body.schools)) {
    throw new SchoolConfigApiError(
      502,
      "학교 목록 응답 형식이 올바르지 않습니다.",
    )
  }
  return body.schools
    .map(parseSummary)
    .filter((item): item is PublishedSchoolSummary => item !== null)
}

export async function getPublishedSchool(
  schoolKey: string,
): Promise<SchoolConfig> {
  const response = await fetch(
    `${SCHOOL_CONFIG_API_URL}/api/schools/${encodeURIComponent(schoolKey)}`,
    {
      cache: "no-store",
    },
  )
  const body = await parseResponse(response)
  if (!response.ok) {
    throw new SchoolConfigApiError(
      response.status,
      responseMessage(response.status, "학교 설정을 불러오지 못했습니다."),
    )
  }
  const candidate =
    isRecord(body) && isRecord(body.school)
      ? (body.school.config ?? body.school)
      : body
  const config = parseSchoolConfig(candidate)
  if (!config)
    throw new SchoolConfigApiError(
      502,
      "학교 설정 응답 형식이 올바르지 않습니다.",
    )
  return config
}
