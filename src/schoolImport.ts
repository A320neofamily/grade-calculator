import JSON5 from "json5"
import { parseSchoolConfig, type ConfigSubject } from "./schoolConfigApi"

// The supplied format contains multiple adjacent JSON5 arrays, not one JSON document.
// Split only at top-level boundaries; never execute imported source code.
export function parseSubjectPlans(text: string): ConfigSubject[][] {
  if (text.length > 1024 * 1024)
    throw new Error("파일은 최대 1MB까지 불러올 수 있습니다.")
  const documents: unknown[] = []
  let start = 0
  let depth = 0
  let quote = ""
  let comment: "line" | "block" | "" = ""
  let escaped = false
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    const next = text[index + 1]
    if (comment === "line") {
      if (char === "\n" || char === "\r") comment = ""
      continue
    }
    if (comment === "block") {
      if (char === "*" && next === "/") {
        comment = ""
        index++
      }
      continue
    }
    if (quote) {
      if (escaped) escaped = false
      else if (char === "\\") escaped = true
      else if (char === quote) quote = ""
      continue
    }
    if (char === "/" && next === "/") {
      comment = "line"
      index++
      continue
    }
    if (char === "/" && next === "*") {
      comment = "block"
      index++
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === "[" || char === "{") depth++
    if (char === "]" || char === "}") {
      depth--
      if (depth === 0) {
        documents.push(JSON5.parse(text.slice(start, index + 1)))
        start = index + 1
      }
      if (depth < 0) throw new Error("파일의 괄호가 올바르지 않습니다.")
    }
  }
  // Allow trailing comments, but reject incomplete documents or executable expressions.
  if (
    depth ||
    quote ||
    comment === "block" ||
    text
      .slice(start)
      .replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, "")
      .trim()
  ) {
    throw new Error(
      "과목 배열 형식이 올바르지 않습니다. 괄호와 파일 끝을 확인해 주세요.",
    )
  }
  if (documents.length === 0) throw new Error("파일에 과목 배열이 없습니다.")
  const plans =
    documents.length === 1 &&
    Array.isArray(documents[0]) &&
    documents[0].length > 0 &&
    documents[0].every(Array.isArray)
      ? documents[0]
      : documents
  return plans.map((subjects, index) => {
    const config = parseSchoolConfig({
      schoolCode: "import",
      schoolName: "가져오기",
      grade: 1,
      semester: 1,
      subjects,
    })
    if (!config) {
      throw new Error(
        `평가계획 ${index + 1}: 과목·평가 ID, 이름, 색상, 평가 유형, 반영비율 합계(100%)를 확인해 주세요. 수행평가는 과목당 최대 5개입니다.`,
      )
    }
    // Keep optional periods blank until the user chooses a semester and publishes.
    return config.subjects.map((subject, subjectIndex) => ({
      ...subject,
      assessments: subject.assessments.map((assessment, assessmentIndex) => ({
        ...assessment,
        period: (
          (subjects as ConfigSubject[])[subjectIndex].assessments[
            assessmentIndex
          ].period ?? ""
        ).trim(),
      })),
    }))
  })
}
