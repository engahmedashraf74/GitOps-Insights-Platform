import { apiFetch } from "./api";

export async function getOverview(
  applicationId: number,
) {
  return apiFetch(
    `/dashboard/overview/${applicationId}`,
  );
}
