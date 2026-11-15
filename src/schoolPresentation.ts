export type SchoolDisplayInfo = {
  schoolcode: string
  name: string
  shortname?: string
}

export function schoolShortName(
  name: string,
  code: string | undefined,
  directory: SchoolDisplayInfo[],
) {
  const school = directory.find(
    (item) => (code && item.schoolcode === code) || item.name === name,
  )
  return (
    school?.shortname?.trim() ||
    name.replace(/여자중학교$/, "여중").replace(/중학교$/, "중")
  )
}

export function oneTapShareUrl(
  href: string,
  baseUrl: string,
  schoolId: string,
) {
  const url = new URL(baseUrl, href)
  url.pathname = `${url.pathname.replace(/\/$/, "")}/onetap`
  url.search = ""
  url.hash = ""
  url.searchParams.set("schoolid", schoolId)
  return url.toString()
}
