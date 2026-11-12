import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import test from "node:test"
import ts from "typescript"

// Run the actual TS modules without initializing live Firebase or calling the Worker.
const require = createRequire(import.meta.url)
function moduleUrl(source) {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  })
  return `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
}
globalThis.__schoolConfigTestAuth = { currentUser: null }
const apiSource = (
  await readFile(new URL("../src/schoolConfigApi.ts", import.meta.url), "utf8")
).replace(
  'import { auth } from "./firebase"',
  "const auth = globalThis.__schoolConfigTestAuth",
)
const apiUrl = moduleUrl(apiSource)
const { parseSchoolConfig, deletePublishedSchool, SchoolConfigApiError } =
  await import(apiUrl)
const importSource = (
  await readFile(new URL("../src/schoolImport.ts", import.meta.url), "utf8")
)
  .replace('"./schoolConfigApi"', JSON.stringify(apiUrl))
  .replace(
    '"json5"',
    JSON.stringify(pathToFileURL(require.resolve("json5")).href),
  )
const { parseSubjectPlans } = await import(moduleUrl(importSource))

const config = (semester = 1, period = "") => ({
  schoolCode: "1234567",
  schoolName: "테스트중학교",
  grade: 2,
  semester,
  subjects: [
    {
      id: "math",
      name: "수학",
      color: "bg-indigo-500",
      assessments: [
        {
          id: "final",
          type: "지필평가",
          title: "기말고사",
          period,
          weight: 100,
        },
      ],
    },
  ],
})

test("missing or blank periods default to the selected semester; explicit periods survive", () => {
  for (const semester of [1, 2]) {
    for (const period of ["", "  ", undefined]) {
      assert.equal(
        parseSchoolConfig(config(semester, period)).subjects[0].assessments[0]
          .period,
        `${semester}학기`,
      )
    }
    assert.equal(
      parseSchoolConfig(config(semester, "10월")).subjects[0].assessments[0]
        .period,
      "10월",
    )
  }
})

test("legacy hide flags are stripped, while pass-only subjects remain supported", () => {
  const value = config()
  value.subjects[0].hideAssessmentDetails = true
  value.subjects.push({
    id: "career",
    name: "진로",
    color: "bg-slate-400",
    assessments: [],
    passOnly: true,
  })
  const parsed = parseSchoolConfig(value)
  assert.equal("hideAssessmentDetails" in parsed.subjects[0], false)
  assert.equal(parsed.subjects[1].passOnly, true)
})

test("the exact attached format imports two separate plans, including pass-only subjects", async () => {
  const fixture = await readFile(
    new URL("./fixtures/subject-plans.txt", import.meta.url),
    "utf8",
  )
  const plans = parseSubjectPlans(fixture)
  assert.deepEqual(
    plans.map((plan) => plan.length),
    [11, 14],
  )
  assert.equal(plans[0][0].assessments[0].period, "10. 2.(금) · 4교시")
  assert.equal(plans[1].filter((subject) => subject.passOnly).length, 3)
})

test("strict JSON, JSON5, adjacent arrays, and nested plan arrays are supported", () => {
  const plan = config().subjects
  assert.equal(
    parseSubjectPlans(JSON.stringify(plan))[0][0].assessments[0].period,
    "",
  )
  assert.equal(parseSubjectPlans(JSON.stringify([plan, plan])).length, 2)
  const json5 = `/* start */ [{id:'math',name:'문자 ] [ \\' 검사',color:'bg-indigo-500',assessments:[
    {id:'final',type:'지필평가',title:'기말고사',weight:100,},
  ],},] // end`
  assert.equal(parseSubjectPlans(json5)[0][0].name, "문자 ] [ ' 검사")
})

test("invalid weights, duplicate IDs, excessive performances, malformed data and executable input are rejected", () => {
  const invalid = config().subjects
  invalid[0].assessments[0].weight = 40
  assert.throws(() => parseSubjectPlans(JSON.stringify(invalid)))
  invalid[0].assessments[0].weight = 100
  assert.throws(() =>
    parseSubjectPlans(JSON.stringify([invalid[0], invalid[0]])),
  )
  invalid[0].assessments = Array.from({ length: 6 }, (_, index) => ({
    id: String(index),
    type: "수행평가",
    title: "과제",
    weight: index === 0 ? 100 : 0,
  }))
  assert.throws(() => parseSubjectPlans(JSON.stringify(invalid)))
  for (const value of [
    "",
    "[]",
    "[{",
    "[]; alert('x')",
    "[{id: (() => 1)()}]",
    "[[]]",
  ]) {
    assert.throws(() => parseSubjectPlans(value))
  }
  assert.throws(() => parseSubjectPlans(" ".repeat(1024 * 1024 + 1)), /1MB/)
})

test("unauthenticated deletion never calls the server", async () => {
  await assert.rejects(
    deletePublishedSchool("1234567-2-1"),
    (error) => error.status === 401,
  )
})

test("DELETE sends a fresh bearer token and accepts explicit completion responses", async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => {
    globalThis.fetch = originalFetch
    globalThis.__schoolConfigTestAuth.currentUser = null
  })
  globalThis.__schoolConfigTestAuth.currentUser = {
    getIdToken: async (force) => {
      assert.equal(force, true)
      return "mock-token"
    },
  }
  for (const [status, body] of [
    [204, null],
    [200, { deleted: true }],
    [200, { success: true }],
    [200, { ok: true }],
  ]) {
    globalThis.fetch = async (url, options) => {
      assert.match(url, /\/api\/schools\/school%2Fkey$/)
      assert.equal(options.method, "DELETE")
      assert.equal(options.headers.Authorization, "Bearer mock-token")
      assert.ok(options.signal instanceof AbortSignal)
      return new Response(body ? JSON.stringify(body) : null, { status })
    }
    await deletePublishedSchool("school/key")
  }
})

test("HTTP failures, false acknowledgements and HTML fallback never report deletion success", async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => {
    globalThis.fetch = originalFetch
    globalThis.__schoolConfigTestAuth.currentUser = null
  })
  globalThis.__schoolConfigTestAuth.currentUser = {
    getIdToken: async () => "mock-token",
  }
  for (const status of [401, 403, 404, 405, 500, 501]) {
    globalThis.fetch = async () => new Response("{}", { status })
    await assert.rejects(
      deletePublishedSchool("test"),
      (error) =>
        error instanceof SchoolConfigApiError && error.status === status,
    )
  }
  for (const body of [
    '{"deleted":false}',
    '{"success":true,"deleted":false}',
    "<html>fallback</html>",
    "",
    "{}",
  ]) {
    globalThis.fetch = async () => new Response(body, { status: 200 })
    await assert.rejects(
      deletePublishedSchool("test"),
      (error) => error.status === 502,
    )
  }
  globalThis.fetch = async () =>
    new Response('{"success":true}', { status: 202 })
  await assert.rejects(
    deletePublishedSchool("test"),
    (error) => error.status === 502,
  )
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch")
  }
  await assert.rejects(deletePublishedSchool("test"), /CORS/)
})

test("timed-out deletions report uncertainty rather than removing the school", async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => {
    globalThis.fetch = originalFetch
    globalThis.__schoolConfigTestAuth.currentUser = null
    t.mock.timers.reset()
  })
  globalThis.__schoolConfigTestAuth.currentUser = {
    getIdToken: async () => "mock-token",
  }
  t.mock.timers.enable({ apis: ["setTimeout"] })
  globalThis.fetch = async (_url, options) =>
    new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () =>
        reject(new Error("aborted")),
      )
    })
  const request = deletePublishedSchool("test")
  const assertion = assert.rejects(request, /실제 삭제 여부/)
  await Promise.resolve()
  t.mock.timers.tick(15000)
  await assertion
})
