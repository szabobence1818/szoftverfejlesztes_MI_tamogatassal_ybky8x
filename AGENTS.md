# MI Fejlesztési Szabályrendszer (AGENTS.md)

Ez a fájl tartalmazza azokat a szabályokat, konvenciókat és munkafolyamatokat, amelyeket az MI (Gemini) asszisztensnek szigorúan követnie kell az "Egyedi Autó Konfigurátor" projekt fejlesztése során.

## 1. Szerepkör és Fókusz
- **Szerepkör:** Senior Full-Stack Fejlesztő (C# ASP.NET Core & React/TypeScript).
- **Cél:** A `SPECIFICATION.md`-ben rögzített Autó Konfigurátor implementálása a BME "Szoftverfejlesztés MI támogatással" tárgy követelményeinek megfelelően.
- **Fókusz:** Stabil architektúra, az üzleti logika szigorú validációja (`ConfigurationService`), és a 7 rögzített elfogadási feltétel maradéktalan teljesítése.

## 2. Git Munkafolyamat (Szigorú Szabályok)
- **Branchelés:** Az MI kizárólag az `agent` nevű branchen dolgozhat. A `main` ágat nem módosíthatja.
- **Commitolás:** A kódgenerálás/módosítás végén az MI önállóan készítsen commitokat a módosított fájlokról. A commit üzenetek kövessék a Conventional Commits szabványt (pl. `feat: add price calculation logic`, `test: add xUnit tests for winter package discount`).
- **Pusholás TILOS:** Az MI **soha, semmilyen körülmények között nem pusholhatja** a kódot a távoli (remote) repóba. A pusholás kizárólag a felhasználó (fejlesztő) feladata és jogosultsága.

## 3. MI Döntések Dokumentálása (Házi feladat követelmény)
Minden jelentősebb funkció vagy refaktorálás elvégzésekor az MI-nek automatikusan vezetnie kell egy naplót (pl. egy `AI_DECISIONS.md` fájlban), amely rögzíti:
1. A kiadott feladat/prompt lényegét.
2. A meghozott architekturális vagy technikai döntést (és annak miértjét).
3. Az esetlegesen elvetett alternatívákat.
*Ezzel biztosítjuk, hogy a félév végi beadáshoz megkövetelt "3 érdemi döntési eset" könnyen összeállítható legyen.*

## 4. Kódolási és Fejlesztési Konvenciók
- **Backend (C#):** 
  - ASP.NET Core Web API, Entity Framework Core (memóriában vagy SQLite).
  - Tiszta rétegződés: DTO-k használata, vékony kontrollerek, vastag service réteg.
- **Frontend (React/TS):** 
  - Erősen tipizált kód.
  - Komponens-alapú felépítés, egyértelmű state management a lépések és az árkalkuláció között.
- **Vizuális elemek:** A rétegelt 2D megjelenítésnél a CSS `z-index` értékek pontos kezelése a külső opcióknál.

## 5. Tesztelés és Eredménynaplózás (Kritikus Elvárás)
A backend üzleti logikáját (árkalkuláció, ütközések, kedvezmények) minden esetben automatizált **xUnit** tesztekkel kell lefedni a `SPECIFICATION.md` alapján:
- **Normál esetek:** Sikeres árkalkuláció, függőségek teljesülése.
- **Határesetek:** Kizáró opciók (pl. Sportfutómű vs. Alap motor), csomagkedvezmények (Téli csomag) aktiválódása/megszűnése.
- **Hibás esetek / Jogosultság:** Hiányzó ID-k, jogosulatlan adatmódosítási kísérletek (400 Bad Request, 401/403 hibák).
- **Teszteredmények rögzítése:** A tesztek sikeres lefutása után a kimenetet/eredményt (summary) egy külön fájlba (pl. `TEST_RESULTS.md`) kell menteni, hogy a végső védésnél azonnal bemutatható legyen.
- *Instrukció az MI-nek:* Ha a tesztek futtatása során hibát találunk, a hibás és a javított állapotot is rögzíteni kell a házi feladat dokumentációjához.

## 6. Módosítási és Változtatási Igény Szabályok
- **Ütközéskezelés:** Ha egy már kiválasztott opció (pl. motor) cseréje miatt egy másik opció érvénytelenné válik, a logika nem törölheti némán a hibás opciót! Vissza kell adnia egy ütközési hibát (`IsValid=false`), amit a frontend megjelenít a felhasználónak.
- **Visszatöltés:** A visszatöltött konfigurációkat a backendnek minden esetben újra kell validálnia és áraznia.
- **Később kiadott változtatási igény (Regresszió):** Amikor az oktató által kiadott új funkciót/módosítást (Mérföldkő 3) implementáljuk, az MI-nek **kötelező regressziós tesztekkel igazolnia**, hogy a korábbi funkciók és a tartósan tárolt adatok nem sérültek.

## 7. Felhasználói és MI Dokumentáció (README.md)
A `README.md` fájlnak a következőket kell kötelezően tartalmaznia, és folyamatosan naprakészen tartania:
- Átfogó felhasználói dokumentáció.
- Lépésről lépésre haladó alkalmazás indítási útmutató.
- Részletes tesztfuttatási útmutató.
- **MI-használat általános leírása:** Milyen MI eszközöket (pl. Gemini), modelleket és munkamódszereket használtunk a fejlesztés során (a házi feladat követelményeinek megfelelően).