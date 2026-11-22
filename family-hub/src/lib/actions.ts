"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireUser } from "./auth/session";
import { getDb, schema } from "./db";
import { aiConfigured } from "./ai/client";
import { parseQuickAdd } from "./ai/tasks";
import { ruleQuickAdd } from "./rules/extract";
import { applyDrafts, deleteItem, getItem, insertItem, updateItem } from "./items/repo";
import { getFamily, getPrefs, saveFamily, savePrefs } from "./kv";
import { normalizeFamily } from "./family/normalize";
import { googleConnection } from "./google/oauth";
import { syncCalendarFor } from "./sync/run";
import { addEpisodeToPlaylist, parsePlaylistId, searchEpisode } from "./spotify";
import { deleteToken } from "./tokens";
import { isHHMM, isISODate, todayISO } from "./time";
import type { Preferences } from "./family/types";

function refreshAll() {
  revalidatePath("/", "layout");
}

async function maybeCalendar(ids: string[]) {
  const [prefs, conn] = await Promise.all([getPrefs(), googleConnection()]);
  if (!prefs.autoCalendar || !conn.hasCalendar) return;
  try {
    await syncCalendarFor(ids);
  } catch {
    // calendar errors are stored on the item; never block the UI action
  }
}

export async function toggleDone(id: string, done: boolean) {
  await requireUser();
  const item = await updateItem(id, { status: done ? "done" : "open", completedAt: done ? new Date() : null });
  if (item && (item.type === "payment" || item.type === "bill")) {
    await updateItem(id, { paidAt: done ? new Date() : null });
  }
  await maybeCalendar([id]);
  refreshAll();
}

export async function setStatus(id: string, status: "open" | "waiting" | "done" | "dismissed") {
  await requireUser();
  await updateItem(id, { status, completedAt: status === "done" ? new Date() : null, needsReview: false });
  await maybeCalendar([id]);
  refreshAll();
}

export async function approveItem(id: string) {
  await requireUser();
  const item = await getItem(id);
  if (!item) return;
  await updateItem(id, { needsReview: false, confidence: Math.max(item.confidence ?? 0, 0.95) });
  await maybeCalendar([id]);
  refreshAll();
}

export async function pushToCalendar(id: string) {
  await requireUser();
  await updateItem(id, { needsReview: false });
  await syncCalendarFor([id], { force: true });
  refreshAll();
}

export async function removeItem(id: string) {
  await requireUser();
  await setStatus(id, "dismissed");
  await deleteItem(id);
  refreshAll();
}

const TYPES = ["task", "event", "reminder", "assessment", "payment", "bill"];

/** Create or edit an item from the editor dialog. */
export async function saveItemForm(formData: FormData) {
  const user = await requireUser();
  const family = await getFamily();
  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  const id = get("id");
  const type = TYPES.includes(get("type") ?? "") ? get("type")! : "task";
  const kidIds = formData.getAll("kidIds").map(String).filter((k) => family.kids.some((x) => x.id === k));
  const date = isISODate(get("date")) ? get("date") : null;
  const amountRaw = get("amount");
  const amount = amountRaw ? Number(amountRaw.replace(/\s/g, "").replace(",", ".")) : null;
  const values = {
    type,
    area: get("area") ?? (type === "bill" ? "finance" : kidIds.length ? "school" : "home"),
    title: get("title") ?? "Új teendő",
    details: get("details"),
    kidIds,
    category: get("category"),
    subject: get("subject"),
    assessmentKind: type === "assessment" ? (get("assessmentKind") ?? "egyeb") : null,
    topics: get("topics"),
    date,
    time: date && isHHMM(get("time")) ? get("time") : null,
    endDate: isISODate(get("endDate")) ? get("endDate") : null,
    datePrecision: date ? (get("datePrecision") ?? "exact") : "unknown",
    priority: get("priority") ?? "normal",
    amount: amount != null && Number.isFinite(amount) ? amount : null,
    currency: amount != null ? (get("currency") ?? "HUF") : null,
    payee: get("payee"),
    paymentInfo: get("account") || get("reference") ? { account: get("account"), reference: get("reference") } : null,
    needsReview: false,
  };
  let itemId = id;
  if (id) {
    await updateItem(id, values);
  } else {
    const row = await insertItem({ ...values, source: "manual", createdBy: user.email, confidence: 1 });
    itemId = row.id;
  }
  if (itemId) await maybeCalendar([itemId]);
  refreshAll();
}

export async function quickAdd(text: string): Promise<{ ok: boolean; count: number; message?: string }> {
  const user = await requireUser();
  const t = text.trim();
  if (!t) return { ok: false, count: 0 };
  const family = await getFamily();
  if (!aiConfigured()) {
    const prefs = await getPrefs();
    const { created } = await applyDrafts({
      drafts: [ruleQuickAdd(t, family)],
      emailId: null,
      contactName: null,
      knownKidIds: family.kids.map((k) => k.id),
      minConfidence: prefs.minConfidenceForAuto,
      source: "manual",
      createdBy: user.email,
    });
    await maybeCalendar(created);
    refreshAll();
    return { ok: true, count: created.length };
  }
  try {
    const res = await parseQuickAdd(t, family);
    const prefs = await getPrefs();
    const { created } = await applyDrafts({
      drafts: res.items.map((d) => ({ ...d, confidence: Math.max(d.confidence, 0.9), existing_item_id: "" })),
      emailId: null,
      contactName: null,
      knownKidIds: family.kids.map((k) => k.id),
      minConfidence: prefs.minConfidenceForAuto,
      source: "manual",
      createdBy: user.email,
    });
    await maybeCalendar(created);
    refreshAll();
    return { ok: true, count: created.length };
  } catch (e) {
    return { ok: false, count: 0, message: (e as Error).message };
  }
}

export async function addPodcastToSpotify(id: string): Promise<{ ok: boolean; message: string; url?: string }> {
  await requireUser();
  const item = await getItem(id);
  if (!item) return { ok: false, message: "Nem található." };
  const query = item.meta?.spotifyQuery || `${item.meta?.show ?? ""} ${item.title}`.trim();
  try {
    const hit = await searchEpisode(query);
    if (!hit) return { ok: false, message: "Nem találtam ezt az epizódot a Spotify-on." };
    await addEpisodeToPlaylist(hit.uri);
    await updateItem(id, {
      meta: { ...item.meta, spotifyUri: hit.uri, spotifyAddedAt: new Date().toISOString() },
      url: item.url ?? hit.url,
    });
    refreshAll();
    return { ok: true, message: `Hozzáadva: ${hit.name}`, url: hit.url ?? undefined };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function saveFamilyJson(json: string): Promise<{ ok: boolean; message: string }> {
  await requireUser();
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const current = await getFamily();
    const fam = normalizeFamily({ ...parsed, aiNotes: typeof parsed.aiNotes === "string" ? parsed.aiNotes : current.aiNotes });
    await saveFamily(fam);
    refreshAll();
    return { ok: true, message: `Mentve: ${fam.kids.length} gyerek, ${fam.contacts.length} kapcsolat.` };
  } catch (e) {
    return { ok: false, message: `Hibás JSON: ${(e as Error).message}` };
  }
}

export async function savePreferencesForm(formData: FormData) {
  await requireUser();
  const g = (k: string) => (typeof formData.get(k) === "string" ? String(formData.get(k)).trim() : "");
  const patch: Partial<Preferences> = {};
  if (g("calendarId")) patch.calendarId = g("calendarId");
  const read = formData.getAll("readCalendarIds").map(String).filter(Boolean);
  if (formData.has("readCalendarIdsPresent")) patch.readCalendarIds = read.length ? read : ["primary"];
  if (formData.has("autoCalendarPresent")) patch.autoCalendar = formData.get("autoCalendar") === "on";
  for (const k of ["studyWindowWeekdayFrom", "studyWindowWeekdayTo", "studyWindowWeekendFrom", "studyWindowWeekendTo", "eveningPrepTime"]) {
    if (g(k) && !isHHMM(g(k))) return;
  }
  if (g("studyWindowWeekdayFrom") && g("studyWindowWeekdayTo")) patch.studyWindowWeekday = [g("studyWindowWeekdayFrom"), g("studyWindowWeekdayTo")];
  if (g("studyWindowWeekendFrom") && g("studyWindowWeekendTo")) patch.studyWindowWeekend = [g("studyWindowWeekendFrom"), g("studyWindowWeekendTo")];
  if (g("eveningPrepTime")) patch.eveningPrepTime = g("eveningPrepTime");
  if (g("studyBlockMinutes")) patch.studyBlockMinutes = Math.max(10, Math.min(120, Number(g("studyBlockMinutes")) || 30));
  if (formData.has("spotifyPlaylistId")) patch.spotifyPlaylistId = parsePlaylistId(g("spotifyPlaylistId"));
  await savePrefs(patch);
  refreshAll();
}

export async function saveAiNotes(notes: string) {
  await requireUser();
  const fam = await getFamily();
  await saveFamily({ ...fam, aiNotes: notes.slice(0, 4000) });
  refreshAll();
}

export async function disconnect(provider: "google" | "spotify") {
  await requireUser();
  await deleteToken(provider);
  refreshAll();
}

export async function resyncCalendarAll() {
  await requireUser();
  await syncCalendarFor(undefined, { force: true });
  refreshAll();
}

export async function retryEmail(id: string) {
  await requireUser();
  const db = await getDb();
  await db.update(schema.emails).set({ status: "pending", error: null }).where(eq(schema.emails.id, id));
  refreshAll();
}

export async function snoozeToTomorrow(id: string) {
  await requireUser();
  const tomorrow = new Date(Date.now() + 86_400_000);
  const iso = todayISO(tomorrow);
  await updateItem(id, { date: iso, datePrecision: "exact" });
  await maybeCalendar([id]);
  refreshAll();
}
