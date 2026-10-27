import { auth } from "./firebase";

const API_URL =
  "https://grade-calculator-user-data.grade-calculator.workers.dev";

export type UserData = Record<string, Record<string, string>>;

type LoadResponse = {
  data: UserData | null;
  updatedAt: string | null;
};

async function authorizedFetch(
  method: "GET" | "PUT",
  data?: UserData,
) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  const token = await user.getIdToken();

  const response = await fetch(`${API_URL}/api/me/data`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(method === "PUT"
        ? { "Content-Type": "application/json" }
        : {}),
    },
    ...(method === "PUT"
      ? { body: JSON.stringify({ data }) }
      : {}),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("로그인이 만료되었거나 인증에 실패했습니다.");
    }

    throw new Error(`데이터 요청 실패: HTTP ${response.status}`);
  }

  return response.json();
}

export async function loadUserData(): Promise<LoadResponse> {
  return authorizedFetch("GET") as Promise<LoadResponse>;
}

export async function saveUserData(data: UserData): Promise<void> {
  await authorizedFetch("PUT", data);
}
