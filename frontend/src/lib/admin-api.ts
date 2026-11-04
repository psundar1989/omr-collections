"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, ApiError } from "./client-api";
import { adminTokenStore, useAdminToken } from "./store";

/** Authenticated admin API calls. A 401 clears the token and returns to the login page. */
export function useAdminApi() {
  const token = useAdminToken();
  const router = useRouter();

  return useCallback(
    async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
      try {
        return await apiRequest<T>(`/admin${path}`, { ...init, token: adminTokenStore.get() });
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          adminTokenStore.set(null);
          router.replace("/admin/login");
        }
        throw e;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, router],
  );
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const first = Object.values(e.errors)[0]?.[0];
    return first || e.message;
  }
  return e instanceof Error ? e.message : "Something went wrong.";
}

export function fieldErrors(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError)) return {};
  return Object.fromEntries(Object.entries(e.errors).map(([k, v]) => [k, v[0]]));
}

/** Build multipart form data; booleans become 1/0 for Laravel. */
export function toFormData(values: Record<string, unknown>): FormData {
  const fd = new FormData();
  Object.entries(values).forEach(([k, v]) => {
    if (v === undefined) return;
    if (v === null) fd.append(k, "");
    else if (typeof v === "boolean") fd.append(k, v ? "1" : "0");
    else if (v instanceof File) fd.append(k, v);
    else fd.append(k, String(v));
  });
  return fd;
}
