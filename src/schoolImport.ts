import { parseSchoolConfig, type ConfigSubject } from "./schoolConfigApi"

export function parseSubjectPlan(text: string): ConfigSubject[] {
  if (text.length > 1024 * 1024)
    throw new Error("파일은 최대 1MB까지 불러올 수 있습니다.")
  let subjects: unknown
  try {
    subjects = (JSON.parse(text) as unknown)
  } catch {
    throw new Error("첨부 양식과 같은 올바른 JSON 파일을 선택해 주세요.")
  }

  const config = parseSchoolConfig({
    schoolCode: "import",
    schoolName: "가져오기",
    grade: 1,
    semester: 1,
    subjects,
  })
  if (!config) {
    throw new Error(
      "과목·평가 ID, 이름, 색상, 평가 유형, 반영비율 합계(100%)를 확인해 주세요. 수행평가는 과목당 최대 5개입니다.",
    )
  }

  // Keep optional periods blank until the user chooses a semester and publishes.
  return config.subjects.map((subject, subjectIndex) => ({
    ...subject,
    assessments: subject.assessments.map((assessment, assessmentIndex) => ({
      ...assessment,
      period: (
        (subjects as ConfigSubject[])[subjectIndex].assessments[assessmentIndex]
          .period ?? ""
      ).trim(),
    })),
  }))
}
