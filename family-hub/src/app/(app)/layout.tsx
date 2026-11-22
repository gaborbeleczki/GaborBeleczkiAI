import { and, count, eq, inArray } from "drizzle-orm";
import { MobileNav, Sidebar } from "@/components/nav/Nav";
import { requireUser } from "@/lib/auth/session";
import { dbMode, getDb, schema } from "@/lib/db";
import { getFamily } from "@/lib/kv";
import { KID_STYLES } from "@/lib/ui";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const family = await getFamily();
  const db = await getDb();
  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.items)
    .where(and(eq(schema.items.needsReview, true), inArray(schema.items.status, ["open", "waiting"])));

  return (
    <div className="paper-grain flex min-h-dvh">
      <Sidebar
        reviewCount={n}
        kids={family.kids.map((k) => ({ id: k.id, name: k.name, dot: KID_STYLES[k.color].dot }))}
        user={{ name: user.name, email: user.email }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav reviewCount={n} />
        {dbMode() === "ephemeral" && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
            Teszt üzemmód: ideiglenes adatbázis – a rögzített adatok egy újraindításkor elveszhetnek. Állandó tároláshoz állíts be <b>DATABASE_URL</b>-t.
          </div>
        )}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">{children}</main>
      </div>
    </div>
  );
}
