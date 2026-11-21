import "server-only";
import { gfetch } from "./oauth";
import { TZ } from "../time";

const BASE = "https://www.googleapis.com/calendar/v3";

export type CalendarListEntry = { id: string; summary: string; primary?: boolean; backgroundColor?: string; accessRole?: string };

export type GEventTime = { date?: string; dateTime?: string; timeZone?: string };
export type GEvent = {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  start: GEventTime;
  end: GEventTime;
  colorId?: string;
  htmlLink?: string;
  status?: string;
  transparency?: "opaque" | "transparent";
  reminders?: { useDefault: boolean; overrides?: { method: "popup" | "email"; minutes: number }[] };
  extendedProperties?: { private?: Record<string, string> };
  source?: { title: string; url: string };
};

export async function listCalendars(): Promise<CalendarListEntry[]> {
  const res = await gfetch<{ items?: CalendarListEntry[] }>(`${BASE}/users/me/calendarList?minAccessRole=reader`);
  return res.items ?? [];
}

export async function listEvents(calendarId: string, timeMin: Date, timeMax: Date): Promise<GEvent[]> {
  const p = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
    timeZone: TZ,
  });
  const res = await gfetch<{ items?: GEvent[] }>(`${BASE}/calendars/${encodeURIComponent(calendarId)}/events?${p}`);
  return (res.items ?? []).filter((e) => e.status !== "cancelled");
}

export async function freeBusy(calendarIds: string[], timeMin: Date, timeMax: Date): Promise<{ start: Date; end: Date }[]> {
  const res = await gfetch<{ calendars: Record<string, { busy?: { start: string; end: string }[] }> }>(`${BASE}/freeBusy`, {
    method: "POST",
    body: JSON.stringify({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      timeZone: TZ,
      items: calendarIds.map((id) => ({ id })),
    }),
  });
  return Object.values(res.calendars ?? {}).flatMap((c) =>
    (c.busy ?? []).map((b) => ({ start: new Date(b.start), end: new Date(b.end) })),
  );
}

export async function insertEvent(calendarId: string, ev: GEvent): Promise<GEvent> {
  return gfetch<GEvent>(`${BASE}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    body: JSON.stringify(ev),
  });
}

export async function patchEvent(calendarId: string, eventId: string, ev: Partial<GEvent>): Promise<GEvent> {
  return gfetch<GEvent>(`${BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    body: JSON.stringify(ev),
  });
}

export async function deleteEvent(calendarId: string, eventId: string): Promise<void> {
  try {
    await gfetch<void>(`${BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: "DELETE",
    });
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status !== 404 && status !== 410) throw e;
  }
}
