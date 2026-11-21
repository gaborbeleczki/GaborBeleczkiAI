import "server-only";
import { env } from "./env";
import { loadToken, saveToken } from "./tokens";
import { getPrefs, savePrefs } from "./kv";

export const SPOTIFY_SCOPES = ["playlist-modify-private", "playlist-modify-public", "playlist-read-private", "user-library-modify"];
const API = "https://api.spotify.com/v1";

export function spotifyConfigured() {
  return Boolean(env.spotifyClientId && env.spotifyClientSecret);
}

export function spotifyAuthUrl(redirectUri: string, state: string) {
  const p = new URLSearchParams({
    client_id: env.spotifyClientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SPOTIFY_SCOPES.join(" "),
    state,
  });
  return `https://accounts.spotify.com/authorize?${p}`;
}

function basicAuth() {
  return `Basic ${Buffer.from(`${env.spotifyClientId}:${env.spotifyClientSecret}`).toString("base64")}`;
}

export async function exchangeSpotifyCode(code: string, redirectUri: string) {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { authorization: basicAuth(), "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
  });
  const json = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number; scope: string; error?: string };
  if (!res.ok) throw new Error(json.error ?? "Spotify token exchange failed");
  const me = await fetch(`${API}/me`, { headers: { authorization: `Bearer ${json.access_token}` } }).then((r) => (r.ok ? r.json() : null));
  await saveToken("spotify", {
    account: me?.display_name ?? me?.id ?? null,
    refreshToken: json.refresh_token ?? null,
    accessToken: json.access_token,
    expiresIn: json.expires_in,
    scope: json.scope,
  });
}

async function accessToken(): Promise<string> {
  const t = await loadToken("spotify");
  if (!t?.refreshToken) throw new Error("A Spotify nincs összekapcsolva.");
  if (t.accessToken && t.expiresAt && t.expiresAt.getTime() > Date.now() + 60_000) return t.accessToken;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { authorization: basicAuth(), "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: t.refreshToken }),
  });
  const json = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number; error?: string };
  if (!res.ok) throw new Error(`Spotify: ${json.error ?? res.status} – kapcsold össze újra.`);
  await saveToken("spotify", { accessToken: json.access_token, refreshToken: json.refresh_token ?? null, expiresIn: json.expires_in });
  return json.access_token;
}

async function sfetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken();
  return fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

export async function spotifyStatus() {
  const t = await loadToken("spotify");
  const prefs = await getPrefs();
  return { configured: spotifyConfigured(), connected: Boolean(t?.refreshToken), account: t?.account ?? null, playlistId: prefs.spotifyPlaylistId || null };
}

export type EpisodeHit = { uri: string; name: string; url: string | null; showName: string | null; durationMin: number | null };

export async function searchEpisode(query: string): Promise<EpisodeHit | null> {
  const p = new URLSearchParams({ q: query, type: "episode", limit: "5", market: "HU" });
  const res = await sfetch(`/search?${p}`);
  if (!res.ok) throw new Error(`Spotify keresés hiba (${res.status})`);
  const json = (await res.json()) as {
    episodes?: { items: ({ uri: string; name: string; duration_ms?: number; external_urls?: { spotify?: string }; show?: { name?: string } } | null)[] };
  };
  const hit = json.episodes?.items?.find(Boolean);
  if (!hit) return null;
  return {
    uri: hit.uri,
    name: hit.name,
    url: hit.external_urls?.spotify ?? null,
    showName: hit.show?.name ?? null,
    durationMin: hit.duration_ms ? Math.round(hit.duration_ms / 60000) : null,
  };
}

async function ensurePlaylist(): Promise<string> {
  const prefs = await getPrefs();
  if (prefs.spotifyPlaylistId) return prefs.spotifyPlaylistId;
  const body = JSON.stringify({ name: prefs.spotifyPlaylistName, public: false, description: "Family Hub által javasolt podcast epizódok" });
  let res = await sfetch(`/me/playlists`, { method: "POST", body });
  if (res.status === 404 || res.status === 405) {
    const me = (await (await sfetch(`/me`)).json()) as { id: string };
    res = await sfetch(`/users/${encodeURIComponent(me.id)}/playlists`, { method: "POST", body });
  }
  if (!res.ok) throw new Error(`Nem sikerült lejátszási listát létrehozni (${res.status}). Add meg a lista azonosítóját a Beállításokban.`);
  const pl = (await res.json()) as { id: string };
  await savePrefs({ spotifyPlaylistId: pl.id });
  return pl.id;
}

export async function addEpisodeToPlaylist(uri: string): Promise<string> {
  const playlistId = await ensurePlaylist();
  const body = JSON.stringify({ uris: [uri] });
  let res = await sfetch(`/playlists/${encodeURIComponent(playlistId)}/items`, { method: "POST", body });
  if (res.status === 404 || res.status === 405) {
    res = await sfetch(`/playlists/${encodeURIComponent(playlistId)}/tracks`, { method: "POST", body });
  }
  if (!res.ok) throw new Error(`Spotify: nem sikerült hozzáadni (${res.status}).`);
  return playlistId;
}

export function spotifySearchUrl(query: string) {
  return `https://open.spotify.com/search/${encodeURIComponent(query)}/episodes`;
}

/** Accepts a playlist URL, URI or bare id. */
export function parsePlaylistId(input: string): string {
  const s = input.trim();
  const m = s.match(/playlist[/:]([A-Za-z0-9]+)/);
  return m ? m[1] : s.replace(/[^A-Za-z0-9]/g, "");
}
