export const metadata = { title: "Adatvédelem" };

/** Public privacy notice (required by Google's OAuth consent screen). */
export default function PrivacyPage() {
  return (
    <main className="paper-grain min-h-dvh px-4 py-12">
      <article className="card mx-auto max-w-2xl space-y-4 p-8 text-[15px] leading-relaxed text-ink-2">
        <h1 className="font-display text-3xl font-semibold text-ink">Adatvédelmi tájékoztató</h1>
        <p>
          A Családi Hub egyetlen család privát szervező alkalmazása. Csak a család által engedélyezett fiókok léphetnek be; az
          alkalmazás nem nyilvános és nem gyűjt adatot más felhasználóktól.
        </p>
        <h2 className="font-semibold text-ink">Milyen adatokat használ?</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Gmail (csak olvasás): az iskolai, számla- és egyéb levelekből teendőket, határidőket és befizetéseket nyer ki.</li>
          <li>Google Naptár: a kinyert eseményeket és időblokkokat a család naptárába írja; a szabad idősávokat olvassa.</li>
          <li>Spotify (opcionális): podcast-epizódot ad a család lejátszási listájához.</li>
        </ul>
        <h2 className="font-semibold text-ink">Hol tárolódnak?</h2>
        <p>
          A kinyert tételek és a levelek rövid kivonata a család saját, hozzáférés-védett adatbázisában tárolódik. A Google- és
          Spotify-tokenek titkosítva tárolódnak. A levelek tartalmát a feldolgozáshoz az Anthropic Claude API kapja meg; egyszer
          használatos kódokat és belépési értesítőket az alkalmazás nem küld el.
        </p>
        <h2 className="font-semibold text-ink">Megosztás, törlés</h2>
        <p>
          Az adatokat harmadik félnek nem adjuk el és nem osztjuk meg. A Google-hozzáférés bármikor visszavonható a
          myaccount.google.com/permissions oldalon vagy az alkalmazás Beállítások oldalán; kérésre minden tárolt adat törlődik.
        </p>
        <p className="text-sm text-muted">Kapcsolat: az alkalmazás tulajdonosa (a Google-fiók e-mail címén).</p>
      </article>
    </main>
  );
}
