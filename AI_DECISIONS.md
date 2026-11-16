# MI Fejlesztési Döntések Naplója (AI_DECISIONS.md)

Ez a dokumentum rögzíti az „Egyedi Autó Konfigurátor” fejlesztése során meghozott érdemi architekturális és technikai döntéseket a BME *Szoftverfejlesztés MI támogatással* tárgy követelményeinek megfelelően.

---

## 1. Döntési eset: Backend alaparchitektúra, entitás/DTO szétválasztás és a `ConfigurationService` struktúrája

### 1.1. A kiadott feladat / prompt lényege
Az `AGENTS.md` és a `SPECIFICATION.md` elolvasása után ellenőrizni kellett, hogy az `agent` branchen állunk-e, majd felépíteni a C# ASP.NET Core backend alapstruktúráját: létrehozni az entitásokat és DTO-kat, a `ConfigurationService` vázát (amely a 7 elfogadási feltétel mentén végzi az árkalkulációt és a validációt), valamint megírni és lefuttatni az első alapvető xUnit teszteket a normál árkalkulációra.

### 1.2. Meghozott architekturális és technikai döntések (és indoklásuk)
1. **Git munkafolyamat védelme (`main` vs. `agent` branch):**
   - Az induló ellenőrzés (`git status`, `git branch`) kimutatta, hogy a munkakönyvtár a `main` ágon állt, miközben az `agent` branch már létezett ugyanazon a commiton (`77aea27`). Az `AGENTS.md` 2. pontja alapján a `main` ág módosítása tilos, ezért a kódgenerálás megkezdése előtt átváltottunk az `agent` branchre (`git checkout agent`), így a `main` ág teljesen érintetlen maradt.
2. **Tiszta rétegződés és DTO-k szigorú szétválasztása a domain entitásoktól:**
   - A domain modellek (`CarOption`, `OptionRule`, `PackageDiscount`, `SavedConfiguration`) a `Models/` névtérbe, míg az API kommunikációért felelős adatátviteli objektumok (`ConfigurationRequestDto`, `ConfigurationEvaluationResultDto`, `ValidationIssueDto`, `LayerPreviewDto`, `OptionDto`, `SaveConfigurationRequestDto`, `SavedConfigurationDto`) a `Dtos/` névtérbe kerültek.
   - **Miért:** Ez biztosítja a vékony kontrollerek és a vastag üzleti logikai réteg (`ConfigurationService`) elválasztását, valamint lehetővé teszi, hogy egy visszatöltött mentés (`SavedConfigurationDto`) egyszerre tartalmazza a mentéskori árat (`SavedTotalPrice`) és a frissen újraszámolt, újra-validált állapotot (`CurrentEvaluation`).
3. **Adatvezérelt szabálymotor (`OptionRule` és `PackageDiscount`) a `ConfigurationService`-ben:**
   - Ahelyett, hogy az egyes opciók függőségeit (pl. Prémium hangrendszer → Nagy navigáció) és kizárásait (pl. Alap motor ↔ Sportfutómű, Sport diffúzor ↔ Vonóhorog) beégetett `if-else` ágakkal kezelnénk, általánosított `OptionRule` (`RuleType.Requires`, `RuleType.Excludes`) és `PackageDiscount` szabályokat vezettünk be.
   - **Miért:** Könnyen bővíthető új szabályokkal (különösen a Mérföldkő 3 során érkező változtatási igényekhez és regressziós teszteléshez), és nem töröl némán ütköző opciókat, hanem strukturált `ValidationIssueDto` hibalistát és `IsValid = false` állapotot ad vissza.
4. **Külön `EngineOptionId` mező a kérés DTO-ban:**
   - A `ConfigurationRequestDto`-ban a motor azonosítója (`int? EngineOptionId`) külön mezőt kapott a többi opció listája (`List<int> SelectedOptionIds`) mellett.
   - **Miért:** Az 5. elfogadási feltétel kifejezetten előírja a hiányzó motor-ID detektálását, ami így egyértelműen és típusbiztosan validálható.

### 1.3. Elvetett alternatívák
- **Elvetett alternatíva 1 – Beégetett (`if-else`) validációs logika az egyes opciókra:** Bár kezdetben rövidebb kódot eredményezett volna, egy későbbi módosítási igénynél (új opció vagy új csomagkedvezmény) a szolgáltatás belső vezérlési logikáját kellett volna átírni, növelve a regressziós hibák kockázatát.
- **Elvetett alternatíva 2 – Ütköző opciók automatikus kivétele a listából:** A `SPECIFICATION.md` 4. pontja és az `AGENTS.md` 6. pontja kifejezetten tiltja a néma törlést; a felhasználónak látnia kell az ütközési hibát (`IsValid = false`), és a mentést kell blokkolni a feloldásig.
- **Elvetett alternatíva 3 – Domain entitások közvetlen visszaadása az API-ból DTO-k nélkül:** Sértené az `AGENTS.md` 4. pontjában előírt tiszta rétegződést, és megnehezítené a mentések visszatöltésekor kötelező újra-validálási eredmények strukturált átadását a frontendnek.


---

## 2. Döntési eset: Üzleti szabályok (Függőség, Kizárás, Téli csomag kedvezmény), strukturális vs. üzleti hibák szétválasztása és xUnit határeset-tesztelés

### 2.1. A kiadott feladat / prompt lényege
A `SPECIFICATION.md` 2., 3., 4. és 5. elfogadási feltételeinek maradéktalan implementálása a `ConfigurationService`-ben:
- Függőségek ellenőrzése („Prémium hangrendszer” kizárólag „Nagy navigáció” mellett érvényes).
- Kizárások ellenőrzése („Alap motor” + „Sportfutómű”, valamint „Sport diffúzor” + „Vonóhorog” ütközése, az opciók néma törlése nélkül).
- „Téli csomag” 20%-os csomagkedvezményének számítása (mindhárom elem meglétekor 80 000 Ft kedvezmény, bármelyik kivételekor 0 Ft kedvezmény és teljes árú elszámolás).
- Bemeneti validáció hibás DTO-kra (hiányzó motor-ID, `-1` opció-ID, duplikációk, üres mentési név) és mindezek lefedése xUnit határeset- és hibatesztekkel.

### 2.2. Meghozott architekturális és technikai döntések (és indoklásuk)
1. **Strukturális bemeneti hibák (`HasInvalidInput`) és üzleti szabályütközések (`IsValid` / `CanSave`) explicitté tétele a `ConfigurationEvaluationResultDto`-ban:**
   - Bevezettük a `HasInvalidInput` és a `CanSave` jelzőket, valamint a `ValidateSaveRequest(SaveConfigurationRequestDto)` metódust és a tipizált `ConfigurationService.ErrorCodes` konstansokat (`MISSING_ENGINE`, `INVALID_ENGINE_ID`, `INVALID_OPTION_ID`, `DUPLICATE_OPTIONS`, `EMPTY_CONFIGURATION_NAME`, `DEPENDENCY_MISSING`, `EXCLUSION_CONFLICT`).
   - **Miért:** A `SPECIFICATION.md` különbséget tesz a strukturálisan hibás API kérések (5. elfogadási feltétel: `400 Bad Request`, mentés nélkül) és a felhasználói konfigurálás közben fellépő üzleti ütközések (2. és 3. elfogadási feltétel: érvénytelen konfigurációs állapot `IsValid = false`, ahol az API válasz maga érvényes kiértékelési eredményt ad vissza a frontendnek, de a mentést letiltja: `CanSave = false`) között.
2. **Néma törlés tilalmának garantálása állapotmegőrzéssel (`SelectedOptionIds` visszaadása):**
   - A `ConfigurationEvaluationResultDto` változatlan formában visszaadja a bemeneti `SelectedOptionIds` listát még akkor is, ha kizárási ütközés (`EXCLUSION_CONFLICT`) lép fel (pl. „Alap motor” és „Sportfutómű” együttes választásakor).
   - **Miért:** Az `AGENTS.md` 6. pontja szigorúan előírja, hogy motor- vagy opciócserénél a rendszer nem törölheti némán az érvénytelenné vált opciót; ezt külön xUnit assert (`Assert.Contains(SportSuspension, result.SelectedOptionIds)`) is ellenőrzi.
3. **Paraméterezett (`[Theory]` / `[InlineData]`) xUnit határeset-tesztek a Téli csomag részleges kiválasztására:**
   - A 4. elfogadási feltétel előírja, hogy a „Téli csomag” (Ülésfűtés: 150e, Kormányfűtés: 100e, Fűthető szélvédő: 150e Ft) *bármelyik* elemének kivételekor a 20%-os kedvezmény megszűnik.
   - **Miért:** Egyetlen önkényes részhalmaz tesztelése helyett `[Theory]` teszttel mindhárom lehetséges 2-elemű kombinációt (150e+100e=250e, 150e+150e=300e, 100e+150e=250e) automatizáltan ellenőriztük.

### 2.3. Elvetett alternatívák
- **Elvetett alternatíva 1 – Kivétel (`ArgumentException`) dobása minden bemeneti és üzleti hibára:** Ha a `ConfigurationService` kivételt dobna függőségi vagy kizárási ütközéskor, a kontrollernek try-catch blokkokból kellene rekonstruálnia a részletes validációs hibalistát és az aktuális árat. A strukturált eredmény-DTO (`ConfigurationEvaluationResultDto`) sokkal tisztább, tesztelhetőbb vezérlést ad.
- **Elvetett alternatíva 2 – A mentési név validációjának kizárólag Controller attribútumra (`[Required]`) bízása:** Bár az ASP.NET Core modellvalidáció is képes `400 Bad Request`-et adni, az üzleti rétegbe (`ValidateSaveRequest`) emelve a szabály közvetlenül, HTTP pipeline indítása nélkül is 100%-ban tesztelhető xUnitból az 5. elfogadási feltétel szerint.
