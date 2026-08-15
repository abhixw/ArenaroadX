// Thin fetch wrapper around the FastAPI backend. Every response is wrapped as
// {"data": ...} (or {"data": [...], "pagination": ...}) on success and
// {"error": {"code", "message"}} on failure -- this is the one place that unwraps
// that envelope, so callers in src/api/*.ts just get plain values or a thrown ApiError.
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = "UNKNOWN_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// The backend session is an HTTP-only cookie -- a 401 means "not logged in (anymore)".
// AuthContext registers a handler here at startup so this module can react without a
// circular import back into contexts/.
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;
export function registerUnauthorizedHandler(handler: UnauthorizedHandler): void {
  onUnauthorized = handler;
}

type QueryValue = string | number | boolean | undefined | null;

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue>;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  // Second arg is only used when the first is relative -- if VITE_API_URL is empty (the
  // production setup, proxied same-origin through Vercel to dodge cross-site cookie
  // blocking), this resolves against the current page's own origin instead of throwing.
  const url = new URL(API_URL.replace(/\/$/, "") + path, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string };
  // FastAPI's built-in request-validation errors (422) bypass our AppError envelope and use
  // this shape instead -- a list of {loc, msg} entries, one per invalid field.
  detail?: { loc?: (string | number)[]; msg?: string }[] | string;
}

export interface Pagination {
  page: number;
  page_size: number;
  total: number;
}

interface DataEnvelope<T> {
  data?: T;
  pagination?: Pagination;
}

interface Envelope<T> {
  data: T;
  pagination: Pagination | null;
}

async function requestEnvelope<T>(path: string, options: RequestOptions = {}): Promise<Envelope<T>> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? "GET",
      credentials: "include",
      headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(
      "Can't reach the server. Check your connection and try again.",
      0,
      "NETWORK_ERROR",
    );
  }

  if (response.status === 204) {
    return { data: undefined as T, pagination: null };
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const errPayload = payload as ErrorEnvelope | null;
    let message = errPayload?.error?.message;
    if (!message && errPayload?.detail) {
      message = Array.isArray(errPayload.detail)
        ? errPayload.detail.map((d) => d.msg).filter(Boolean).join(" ")
        : errPayload.detail;
    }
    message ??= `Request failed (${response.status}).`;
    const code = errPayload?.error?.code ?? "UNKNOWN_ERROR";
    if (response.status === 401) {
      onUnauthorized?.();
    }
    throw new ApiError(message, response.status, code);
  }

  const okPayload = payload as DataEnvelope<T> | null;
  return {
    data: (okPayload && "data" in okPayload ? okPayload.data : payload) as T,
    pagination: okPayload?.pagination ?? null,
  };
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { data } = await requestEnvelope<T>(path, options);
  return data;
}

export const http = {
  get: <T>(path: string, query?: Record<string, QueryValue>) => request<T>(path, { method: "GET", query }),
  // Like `get`, but also surfaces the envelope's `pagination` field instead of discarding it --
  // use this for admin list endpoints that support page/page_size query params.
  getPage: <T>(path: string, query?: Record<string, QueryValue>) =>
    requestEnvelope<T[]>(path, { method: "GET", query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
