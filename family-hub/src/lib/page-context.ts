import "server-only";
import { requireUser } from "./auth/session";
import { getFamily, getPrefs } from "./kv";
import { googleConnection } from "./google/oauth";

/** Common data every page needs; also enforces auth. */
export async function pageContext() {
  const user = await requireUser();
  const [family, prefs, google] = await Promise.all([getFamily(), getPrefs(), googleConnection()]);
  return { user, family, prefs, google, kids: family.kids, account: google.account, calendarEnabled: google.hasCalendar };
}
