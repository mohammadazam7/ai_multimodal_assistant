import { SessionSchema, type Session } from "./schema";

export class SessionError extends Error {}

/** Fetch and validate the recorded session; a malformed file fails loudly, never half-renders. */
export async function loadSession(url = `${import.meta.env.BASE_URL}data/session.json`): Promise<Session> {
  const res = await fetch(url);
  if (!res.ok) throw new SessionError(`could not load ${url}: HTTP ${res.status}`);
  const parsed = SessionSchema.safeParse(await res.json());
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new SessionError(`session.json is invalid at ${issue?.path.join(".")}: ${issue?.message}`);
  }
  return parsed.data;
}
