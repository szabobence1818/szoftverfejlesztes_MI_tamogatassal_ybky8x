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

---

## 3. Döntési eset: Független Review Agent Kódvizsgálat, Validációs Kiskapuk és Tesztlefedettségi Audit (QA)

> **Szerepkör nyilatkozat:** Ezt a kódvizsgálatot, logikai auditot és tesztlefedettségi kritikát a `REVIEW_PROTOCOL.md` előírásai alapján **független Review Agent**-ként végeztem el. A protokoll értelmében a Review Agent kódot nem módosít, kizárólag kíméletlen diagnózist, hibalistát és javítási javaslatokat rögzít.

### 3.1. A kiadott feladat / prompt lényege
A `REVIEW_PROTOCOL.md` 1. pontja alapján független Review Agent szerepbe lépve át kellett vizsgálni a jelenlegi C# backend kódbázist (`ConfigurationService.cs`, `Program.cs`, DTO-k, modellek és `ConfigurationServiceTests.cs`) a `SPECIFICATION.md` és az `AGENTS.md` követelményeivel szemben, feltárva a funkcionális hiányosságokat, a validációs kiskapukat és a hiányzó határeset-teszteket.

### 3.2. Elfogadási feltételek (1–7.) teljesülésének tételes auditja

| # | Elfogadási feltétel (`SPECIFICATION.md`) | Állapot | Review Agent megállapítás |
|---|---|---|---|
| **1.** | **[Normál – Árkalkuláció]** Alapmotor + metál szín + 18" felni = 10,6M Ft (`IsValid=true`) | ⚠️ Részben teljesül | Az alapösszeadás működik és tesztelt, de a kategóriák közötti kizárólagosság hiánya miatt több szín/felni is összeadódhat. |
| **2.** | **[Normál/Határeset – Függőség]** Prémium hangrendszer → Nagy navigáció | ✅ Teljesül | A `RuleType.Requires` szabály és az xUnit teszt megfelelő. |
| **3.** | **[Határeset – Kizárás]** Alap motor + Sportfutómű; Sport diffúzor + Vonóhorog (`IsValid=false`, nincs néma törlés) | ✅ Teljesül | A `RuleType.Excludes` szabály és az állapotmegőrzés (`SelectedOptionIds`) működik. |
| **4.** | **[Határeset – Csomagkedvezmény]** Téli csomag 3 elem = 20% (80e Ft) kedvezmény; bármelyik kivételekor 0 Ft | ⚠️ Részben teljesül | A számítás működik, de hiányoznak kritikus peremtesztek (pl. 1 elem választása, csomagon kívüli extrák árának szétválasztása, motor-komponensű csomagok kezelése). |
| **5.** | **[Hibás bemenet – Érvénytelen adatok]** Hiányzó motor-ID, `-1` opció-ID, duplikáció, üres név → API `400 Bad Request` mentés nélkül | ❌ Hiányos | A `ConfigurationService` szintjén a validáció megvan, de **nincs API Controller / HTTP végpont implementálva**, így a `400 Bad Request` HTTP státuszkód és a tényleges mentés megakadályozása nincs bekötve. |
| **6.** | **[Jogosulatlan művelet – Védelem]** Más felhasználó mentésének elérése `403 Forbidden`, vendég mentése `401 Unauthorized` + visszatöltéskori újra-validálás | ❌ Kritikus hiány | **Teljesen hiányzik!** Nincs adatbázis/perzisztencia réteg (EF Core `DbContext`), nincs mentés/lekérés/módosítás/törlés szolgáltatás és végpont, nincs jogosultságkezelés, és 0 db xUnit teszt létezik rá. |
| **7.** | **[Vizuális – 2D rétegek]** Külső opciók rétegeinek `z-index` szerinti kezelése | ⚠️ Részben teljesül | A `BuildVisualLayers` rendez `ZIndex` szerint, de kategória-egyediség híján több azonos `ZIndex`-ű szín vagy felni réteget is visszaadhat egyszerre. |

---

### 3.3. Feltárt logikai hibák, validációs kiskapuk és architekturális gyengeségek

1. **[KRITIKUS KISKAPU] Egyértelműen egyszeres választású kategóriák (`ExteriorColor`, `Rim`, `Interior`) többszörözhetősége:**
   - **Diagnózis:** A `ValidateInput` kizárólag az azonos opció-ID duplikációját (`[11, 11]`) szűri ki, de nem ellenőrzi, hogy egy adott kategóriából (Fényezés, Felni, Belső kárpit) legfeljebb egy opció választható-e.
   - **Következmény:** Ha a kliens beküldi egyszerre az *Alap fehér (`10`) + Metál szín (`11`) + Tűzpiros (`12`)* opciókat és mindhárom felnit (`20, 21, 22`), a `ConfigurationService` **`IsValid = true` és `CanSave = true`** eredményt ad! Az összes szín és felni árát felszámítja, a `VisualLayers` listába pedig több, egymást felülíró (`ZIndex = 10` és `ZIndex = 30`) réteget tesz be.
   - **Javítási javaslat:** Kategória-szintű kardinalitási szabály bevezetése: `ExteriorColor`, `Rim` és `Interior` kategóriákból kategóriánként legfeljebb (illetve teljes konfigurációnál pontosan) 1 darab opció szerepelhet a `SelectedOptionIds`-ben; ellenkező esetben validációs hibát kell visszaadni.

2. **[KRITIKUS HIÁNYOSSÁG] Perzisztencia, REST Controller réteg és Jogosultságkezelés (Elfogadási feltétel #5, #6 és `SPECIFICATION.md` 4. pont) teljes hiánya:**
   - **Diagnózis:** A `Program.cs` regisztrálja ugyan az `AddControllers()`-t, de a projektben egyetlen Controller osztály vagy Minimal API végpont sem létezik, és az `EntityFrameworkCore` csomag sincs hozzáadva a `CarConfigurator.Api.csproj`-hoz. A `SavedConfiguration` entitás és a `SavedConfigurationDto` árván állnak, nincsenek bekötve sehová.
   - **Következmény:**
     - Nem teljesül az 5. elfogadási feltétel HTTP szintű követelménye (`400 Bad Request`).
     - Nem teljesül a 6. elfogadási feltétel (`401 Unauthorized` vendég mentésére, `403 Forbidden` más felhasználó mentésének lekérésére/módosítására/törlésére).
     - Nem teljesül a `SPECIFICATION.md` 4. pontja és az `AGENTS.md` 6. pontja, miszerint a mentett konfigurációkat visszatöltéskor a backendnek újra kell validálnia és újra kell áraznia (`CurrentEvaluation` kitöltése a mentett `SavedTotalPrice` mellett).
   - **Javítási javaslat:** EF Core (SQLite / InMemory) `AppDbContext` vagy repository/service réteg bevezetése a mentésekhez (`Create`, `GetById`, `GetUserConfigurations`, `Update`, `Delete`), felhasználói azonosítás/jogosultság-ellenőrzés implementálása (401/403 státuszokkal), valamint a visszatöltéskori automatikus `EvaluateConfiguration` meghívás bekötése.

3. **[LOGIKAI HIBA / KISKAPU] Rövidzáras (short-circuit) kilépés a `ValidateInput` metódusban (`ConfigurationService.cs` 166–223. sor):**
   - **Diagnózis:** A `ValidateInput` minden egyes talált strukturális hiba (`MissingEngine`, `InvalidEngineId`, `DuplicateOptions`, `InvalidOptionId`) után azonnal `return false;`-szal kilép, és a `foreach (var id in selectedIds)` ciklus is megszakad az első érvénytelen opció-ID-nál.
   - **Következmény:** Ha a kliens több hibás adatot küld egyszerre (pl. `SelectedOptionIds = [-1, -2]`, vagy egyszerre hibás a `EngineOptionId` és duplikáltak az opciók), a válasz csak az elsőként vizsgált hibát tartalmazza, a többit elrejti a hívó elől.
   - **Javítási javaslat:** A `ValidateInput` gyűjtse össze az összes strukturális bemeneti hibát a `result.Errors` listába ahelyett, hogy az elsőnél kilépne, és a végén adjon vissza `result.Errors.Count == 0` értéket.

4. **[LOGIKAI PONTATLANSÁG] Csomagkedvezmény (`CalculateDiscounts`) vakfoltja motor-opciókat is tartalmazó csomagokra (`ConfigurationService.cs` 257–279. sor):**
   - **Diagnózis:** A 266. sorban a csomag aktiválódását az `allSelectedIds` halmazon ellenőrzi a kód (`discount.RequiredOptionIds.All(id => allSelectedIds.Contains(id))`), amely tartalmazza az `engineOption.Id`-t is. Azonban a 268. sorban a csomag alapárát (`packageSum`) már csak a `selectedOptions` listából számolja, amelyben a motor **nincs benne**!
   - **Következmény:** Ha a Mérföldkő 3 (változtatási igény) során bekerül egy olyan csomagkedvezmény, amelynek a motor is része (pl. „Sport csomag: Sport motor + Sportfutómű + 19" felni”), a kedvezmény %-a nem fog vetülni a motor árára, vagy inkonzisztens lesz a jogosultság és az összegzés halmaza.
   - **Javítási javaslat:** Ha a csomagkedvezmény csak extra/külső opciókra vonatkozhat, vagy ha a motorra is, akkor az ellenőrzött halmaz és az árszámítás alapjául szolgáló opciólista legyen konzisztens.

5. **[VALIDÁCIÓS KISKAPU] Motor ID beküldése a `SelectedOptionIds` listában félrevezető hibát okoz, és a `null` mentési kérés hibakódja pontatlan:**
   - **Diagnózis:** Ha a kliens a `SelectedOptionIds` tömbbe egy motor azonosítót (`1` vagy `2`) tesz, a 210. sor (`o.Category != OptionCategory.Engine`) miatt `INVALID_OPTION_ID` hibát kap, mintha az ID nem létezne, holott az egy motor kategória-sértés (vagy motor-duplikáció). Emellett a `ValidateSaveRequest(null)` hívás (127–143. sor) `EMPTY_CONFIGURATION_NAME` hibakódot ad vissza, amikor maga a teljes request objektum `null`, és nincs maximális névhossz-korlát sem.
   - **Javítási javaslat:** A `null` request külön kezelése, a mentési név maximális hosszának (pl. 100 karakter) validálása, és egyértelmű hibaüzenet, ha motor-kategóriájú ID kerül a `SelectedOptionIds` listába.

---

### 3.4. Hiányzó xUnit határeset-tesztek tételes listája (`ConfigurationServiceTests.cs`)

A jelenlegi 12 teszt (`14 lefutott teszteset` a `[Theory]`-val együtt) nem fedi le az alábbi kritikus határeseteket és elfogadási feltételeket:

1. **Jogosultsági és mentési (CRUD) tesztek (6. elfogadási feltétel):**
   - Vendég (nem hitelesített felhasználó) mentési kísérlete → `401 Unauthorized`.
   - Bejelentkezett felhasználó (`UserA`) által mentett konfiguráció lekérése, módosítása vagy törlése egy másik felhasználó (`UserB`) által → `403 Forbidden`.
   - Üzletileg érvénytelen (`IsValid = false`, pl. függőségi vagy kizárási hibás) konfiguráció mentési kísérlete → mentés elutasítása (`CanSave = false` / `400 Bad Request`).
2. **Mentett konfiguráció visszatöltése és újra-validálása (`SPECIFICATION.md` 4. pont / `AGENTS.md` 6. pont):**
   - Elmentett konfiguráció visszatöltésekor a backend újra-validálja és újraszámolja-e az árat (`CurrentEvaluation`), miközben megőrzi a mentéskori árat (`SavedTotalPrice`).
   - Mi történik visszatöltéskor, ha egy mentett konfiguráció egy későbbi szabályváltozás (Mérföldkő 3 regresszió) miatt ütközővé válik?
3. **Téli csomag (4. elfogadási feltétel) hiányzó peremfeltételei:**
   - **Csak 1 elem** kiválasztása a Téli csomagból (pl. csak Ülésfűtés: 150 000 Ft → 0 Ft kedvezmény). Jelenleg csak 2-elemű részhalmazokra van `[Theory]` teszt!
   - **Téli csomag + egyéb fizetős opciók együtt** (pl. Téli csomag 400e Ft + Metál szín 250e Ft + Bőr kárpit 450e Ft = 1 100 000 Ft opcióár): tesztelni kell, hogy a 20% kedvezmény **kizárólag** a Téli csomag 400e Ft-os összegére (80e Ft) számolódik-e, és véletlenül sem a teljes `OptionsPrice`-ra (220e Ft) vagy a `BasePrice`-ra!
4. **Érvénytelen `EngineOptionId` tesztek (5. elfogadási feltétel):**
   - Nem létező motor-ID (pl. `EngineOptionId = -1` vagy `999`) → `INVALID_ENGINE_ID` (jelenleg csak `EngineOptionId = null`-ra van teszt, a `ConfigurationService.cs` 179–188. sorában lévő `INVALID_ENGINE_ID` ág **0%-ban tesztelt**!).
   - Létező, de nem motor kategóriájú opció-ID megadása motorként (pl. `EngineOptionId = OptionIds.MetallicColor`) → `INVALID_ENGINE_ID`.
5. **Kategória-ütközések és többszörös egyidejű hibák tesztelése:**
   - Több szín (`BaseWhiteColor` + `FireRedColor`) vagy több felni (`Rim18` + `SportRim19`) egyidejű kiválasztása → `IsValid = false`.
   - Egyszerre fennálló függőségi ÉS kizárási hiba (pl. `BaseEngine` + `SportSuspension` + `PremiumSoundSystem` navigáció nélkül) → az `Errors` listának mindkét hibát (`DEPENDENCY_MISSING` és `EXCLUSION_CONFLICT`) tartalmaznia kell.
6. **2D Vizuális rétegek (7. elfogadási feltétel) backend szűrési és sorrendiségi tesztje:**
   - Annak tesztelése, hogy belső (`LeatherInterior`) és extra (`LargeNavigation`, `HeatedSeats`) opciók kiválasztásakor azok **nem** jelennek meg a `VisualLayers` listában, míg a 4 külső réteg (`ExteriorColor` z=10, `SportDiffuser` z=20, `TowHook` z=25, `Rim` z=30) szigorúan növekvő `ZIndex` sorrendben érkezik vissza.


---

## 4. Döntési eset: A független Review Agent által feltárt validációs kiskapuk, jogosultsági/perzisztencia hiányosságok és határeset-tesztek javítása (Minőségbiztosítási döntés)

### 4.1. A kiadott feladat / prompt lényege
A független Review Agent által a `REVIEW_PROTOCOL.md` és a `SPECIFICATION.md` alapján végzett kódvizsgálat (3. Döntési eset) 5 konkrét backend validációs/architekturális hibát és 6 hiányzó xUnit tesztkategóriát tárt fel. Feladatunk ezen hibák teljes körű kijavítása a backendben, a hiányzó perzisztencia-, jogosultság- és Controller-réteg pótlása, az összes hiányzó határeset-teszt megírása, valamint a minőségbiztosítási visszacsatolás dokumentálása.

### 4.2. Meghozott minőségbiztosítási és architekturális döntések (és indoklásuk)
1. **Egyszeres választású kategóriák (`ExteriorColor`, `Rim`, `Interior`) kardinalitás-validációja (`MULTIPLE_CATEGORY_SELECTION`):**
   - A `ConfigurationService.ValidateInput` metódusban bevezettük a `SingleChoiceCategories` halmazt (`ExteriorColor`, `Rim`, `Interior`). Ha a kliens egyazon kategóriából egynél több opciót küld be (pl. egyszerre két színt vagy két felnit), a rendszer `MULTIPLE_CATEGORY_SELECTION` hibakódot ad vissza az érintett opció-ID-kkal, és megakadályozza az érvénytelen konfiguráció mentését (`IsValid = false`, `HasInvalidInput = true`, `CanSave = false`).
   - **Miért:** Ezzel bezártuk azt a kritikus kiskaput, amelynél több fényezés vagy felni ára összeadódhatott, és azonos `ZIndex`-ű ütköző 2D rétegek kerülhettek a `VisualLayers` listába.
2. **Nem-rövidzáras (non-short-circuit) bemeneti validáció és pontosított hibakódok (`NULL_REQUEST`, `ENGINE_IN_SELECTED_OPTIONS`, `CONFIGURATION_NAME_TOO_LONG`):**
   - Átalakítottuk a `ValidateInput` metódust úgy, hogy az első strukturális hibánál nem lép ki (`return false`), hanem végigvizsgálja a teljes kérést (motor megléte/érvényessége, duplikációk, minden egyes érvénytelen opció-ID a `SelectedOptionIds`-ben, motor-kategória tiltása az extrák között, kategória-kardinalitás).
   - Emellett a `ValidateSaveRequest(null)` mostantól dedikált `NULL_REQUEST` hibakódot ad, és ellenőrzi a mentési név 100 karakteres maximális hosszát (`CONFIGURATION_NAME_TOO_LONG`).
3. **Csomagkedvezmény (`CalculateDiscounts`) kiterjesztése a teljes kiválasztott opcióhalmazra (`allSelectedOptions`):**
   - A `CalculateDiscounts` mostantól a motort is tartalmazó `allSelectedOptions` listán számolja a csomag részösszegét (`packageSum`), így a jogosultság-ellenőrzés (`allSelectedIds`) és az árszámítás alapja 100%-ban konzisztens maradt egy esetleges Mérföldkő 3-as (motort is magában foglaló) csomagkedvezmény esetére is.
4. **Repository réteg (`IConfigurationRepository` / `InMemoryConfigurationRepository`), `ConfigurationsController` és jogosultságkezelés (`400` / `401` / `403`) bevezetése + Visszatöltéskori újra-validálás:**
   - Létrehoztuk a szálbiztos `InMemoryConfigurationRepository`-t, a `ServiceResult<T>` eredményburkolót és a `ConfigurationsController` REST végpontokat (`GET /api/configurations/options`, `POST /api/configurations/evaluate`, `POST /api/configurations`, `GET /api/configurations`, `GET /api/configurations/{id}`, `PUT /api/configurations/{id}`, `DELETE /api/configurations/{id}`).
   - **Jogosultság (6. elfogadási feltétel):** Vendég (`currentUserId == null`) mentési vagy lekérési kísérlete `401 Unauthorized` választ ad; más felhasználó mentésének lekérése, módosítása vagy törlése `403 Forbidden` választ ad.
   - **Visszatöltéskori újra-validálás (`AGENTS.md` 6. pont és `SPECIFICATION.md` 4. pont):** A `MapToDtoWithRevalidation` minden lekéréskor újra lefuttatja az `EvaluateConfiguration`-t a tárolt opciókon, így a `SavedConfigurationDto` egyszerre tartalmazza a mentéskori `SavedTotalPrice` értéket és az aktuális szabályok/árak szerinti `CurrentEvaluation` eredményt.

### 4.3. Elvetett alternatívák
- **Elvetett alternatíva 1 – Jogosultság-ellenőrzés kizárólag Controller szinten:** Ha a `401`/`403` ellenőrzés csak a Controllerben lenne, akkor a `ConfigurationService` közvetlen hívásakor megkerülhető lenne a védelem. A `ServiceResult<T>`-vel a jogosultsági szabályok a szolgáltatásrétegben és a Controllerben egyaránt kikényszerítettek és tesztelhetők.
- **Elvetett alternatíva 2 – Mentett konfigurációk visszatöltése újra-validálás nélkül (csak a mentéskori állapot visszaadása):** Sértené a `SPECIFICATION.md` 4. pontját és az `AGENTS.md` 6. pontját; ha időközben változik egy opció ára vagy bekerül egy új kizárási szabály, a felhasználónak visszatöltéskor látnia kell a frissített árat és az esetleges új ütközést.
