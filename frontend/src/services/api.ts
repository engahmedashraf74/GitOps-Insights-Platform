const API_URL = "http://localhost:3000";

export async function apiFetch(
  endpoint: string,
  options?: RequestInit,
) {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token")
      : null;

  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token && {
          Authorization: `Bearer ${token}`,
        }),
        ...(options?.headers || {}),
      },
    },
  );

  if (!response.ok) {
    throw new Error("Request failed");
  }

  return response.json();
}
