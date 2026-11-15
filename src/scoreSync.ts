import type { UserData } from "./userDataApi"

export const TEST_SCHOOL_KEY = "testschool-2-2"
export const TEST_SCHOOL_ID = `custom:${TEST_SCHOOL_KEY}`

export function cloudScoresOnly(data: UserData): UserData {
  return Object.fromEntries(
    Object.entries(data).filter(([schoolId]) => schoolId !== TEST_SCHOOL_ID),
  )
}

export function mergeCloudScores(
  local: UserData,
  cloud: UserData | null,
): UserData {
  const remote = cloudScoresOnly(cloud || {})
  const ids = new Set([...Object.keys(local), ...Object.keys(remote)])
  return Object.fromEntries(
    [...ids].map((id) => [id, { ...local[id], ...remote[id] }]),
  )
}
