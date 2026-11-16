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
