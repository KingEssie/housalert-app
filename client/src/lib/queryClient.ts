import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getApiBase } from "./api-base";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const fullUrl = url.startsWith("/api") ? getApiBase() + url : url;
  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const path = queryKey.join("/") as string;
    const fullUrl = path.startsWith("/api") ? getApiBase() + path : path;
    const res = await fetch(fullUrl, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

let _lastAuthUserId: string | null = null;

export function getLastAuthUserId(): string | null {
  return _lastAuthUserId;
}

export function setLastAuthUserId(id: string | null) {
  _lastAuthUserId = id;
}

const USER_LOCAL_STORAGE_KEYS = [
  "housalert_match_viewed",
  "housalert_match_applied",
  "housalert_tips_read",
];

export function clearAllUserData() {
  console.log("[IDENTITY] clearAllUserData: removing all cached queries and user localStorage");
  queryClient.removeQueries();
  _lastAuthUserId = null;
  for (const key of USER_LOCAL_STORAGE_KEYS) {
    try { localStorage.removeItem(key); } catch {}
  }
}
