const BASE = import.meta.env.VITE_API_BASE ?? "/api";

async function post<T>(path: string, body: unknown): Promise<{ status: number; data: T | { error: string } }> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "omit",
    body: JSON.stringify(body),
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data: data as T | { error: string } };
}

export type CreateMessageReq = {
  ciphertext: string;
  nonce: string;
  kServer: string;
  email: string;
  expirySeconds: number;
  hasPassphrase: boolean;
  captchaToken: string;
};

export type CreateMessageRes = { token: string };

export type VerifyRes = {
  ciphertext: string;
  nonce: string;
  kServer: string;
  hasPassphrase: boolean;
};

export const api = {
  createMessage: (req: CreateMessageReq) => post<CreateMessageRes>("/messages", req),
  requestOtp: (token: string, email: string) =>
    post<{ status: string }>(`/messages/${encodeURIComponent(token)}/request-otp`, { email }),
  verify: (token: string, email: string, otp: string) =>
    post<VerifyRes>(`/messages/${encodeURIComponent(token)}/verify`, { email, otp }),
};
