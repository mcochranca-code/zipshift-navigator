export interface LoginResponsePayload {
  sessionId?: string;
  error?: string;
}

export interface ParsedLoginResponse {
  data: LoginResponsePayload | null;
  error: string | null;
}

export async function readLoginResponse(
  response: Pick<Response, "text">
): Promise<ParsedLoginResponse> {
  const raw = await response.text();

  if (!raw.trim()) {
    return {
      data: null,
      error: "The sign-in service returned an empty response. Please try again.",
    };
  }

  try {
    return { data: JSON.parse(raw) as LoginResponsePayload, error: null };
  } catch {
    return {
      data: null,
      error: "The sign-in service returned an unexpected response. Please try again.",
    };
  }
}
