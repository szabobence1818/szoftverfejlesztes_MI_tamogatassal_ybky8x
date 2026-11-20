# Egyedi Autó Konfigurátor (`szoftverfejlesztes_MI_tamogatassal_ybky8x`)

BME – **Szoftverfejlesztés MI támogatással** házi feladat dokumentáció és forráskód.

---

## 1. A projekt bemutatása

Az **Egyedi Autó Konfigurátor** egyetlen autómodellre épülő, valós idejű szabály- és árkalkulációt, valamint 2D rétegelt vizuális előnézetet nyújtó full-stack webalkalmazás, amely a [`SPECIFICATION.md`](./SPECIFICATION.md) és az [`AGENTS.md`](./AGENTS.md) előírásai alapján készült.

### Cél és fő funkciók
- **5 lépéses konfigurációs folyamat:** A felhasználó lépésről lépésre állíthatja össze járművét (**1. Motor → 2. Külső → 3. Belső → 4. Extrák → 5. Összegzés**).
- **Valós idejű árkalkuláció és csomagkedvezmények:** Minden választáskor azonnal frissül az ár (`Alapár + Választott opciók − Csomagkedvezmények`), beleértve a **Téli csomag** (Ülésfűtés + Kormányfűtés + Fűthető szélvédő) 20%-os (`-80 000 Ft`) kedvezményét.
- **Szigorú üzleti szabálymotor (néma törlés nélkül):** A rendszer ellenőrzi az opciók közötti függőségeket (pl. *Prémium hangrendszer → Nagy navigáció*) és kizárásokat (pl. *Alap motor ↔ Sportfutómű*, *Sport diffúzor ↔ Vonóhorog*). Ütközés esetén a rendszer **nem törli némán** a korábban választott extrát, hanem `IsValid = false` állapottal jelzi a konfliktust és a feloldásig tiltja a mentést.
- **2D rétegelt jármű-előnézet (`CarPreview`):** A külső opciók (alap karosszéria, fényezés, felnik, optikai elemek) áttetsző SVG rétegei fix CSS `z-index` hierarchiában (`z:10 → z:20 → z:30 → z:40`) jelennek meg, és fülváltáskor is megmaradnak.
- **Szerepkörök és mentések kezelése (CRUD + újra-validálás):**
  - **Vendég (`isGuest`):** Összeállíthatja az autót, látja a 2D előnézetet és az árat, de nem menthet (`401 Unauthorized`).
  - **Bejelentkezett felhasználó:** Elmentheti az érvényes konfigurációkat (`POST`), saját mentéseit listázhatja (`GET`), visszatöltheti (`GET {id}` – automatikus újra-validálással és újra-árazással), módosíthatja (`PUT {id}`) és törölheti (`DELETE {id}`). Más felhasználó mentésének elérése `403 Forbidden` választ ad.

### Architektúra és technológiák
- **Backend (`backend/CarConfigurator.Api`):** C#, .NET 10, ASP.NET Core Web API, tiszta rétegződés (`Models`, `Dtos`, `Repositories`, `Services`, `Controllers`), szálbiztos memóriabeli perzisztencia (`InMemoryConfigurationRepository`).
- **Automatizált tesztek (`backend/CarConfigurator.Tests`):** C#, xUnit egység- és integrációs tesztcsomag (33 teszteset).
- **Frontend (`frontend/`):** React 19, TypeScript, Vite 6, Tailwind CSS 4, React Context API (`ConfiguratorContext`) + memoizált 2D SVG réteg-renderelő (`CarPreview`).

---

## 2. Indítási útmutató

Az alkalmazás futtatásához **.NET 10 SDK** és **Node.js (v20+ / v24+)** szükséges. A backendet és a frontendet két külön terminálablakban célszerű elindítani a projekt gyökérkönyvtárából (`szoftverfejlesztes_MI_tamogatassal_ybky8x`).

### 2.1. Backend (ASP.NET Core Web API) indítása

1. Nyiss egy terminált a projekt gyökerében, és lépj be a Web API projekt mappájába:
   ```bash
   cd backend/CarConfigurator.Api
   ```
2. Indítsd el a backend szervert:
   ```bash
   dotnet run
   ```
3. A backend alapértelmezetten a **`http://localhost:5203`** címen indul el (a [`launchSettings.json`](./backend/CarConfigurator.Api/Properties/launchSettings.json) alapján).
   - Elérhető végpontok:
     - `GET http://localhost:5203/api/configurations/options` – Opciós katalógus lekérése
     - `POST http://localhost:5203/api/configurations/evaluate` – Konfiguráció validálása és árkalkulációja
     - `GET / POST / PUT / DELETE http://localhost:5203/api/configurations` – Mentések CRUD műveletei

### 2.2. Frontend (React + TypeScript + Vite) indítása

1. Nyiss egy második terminált a projekt gyökerében, és lépj be a `frontend` mappába:
   ```bash
   cd frontend
   ```
2. Telepítsd a függőségeket (Windows PowerShell esetén, ha a script-futtatási házirend korlátozott, használd az `npm.cmd` parancsot):
   ```bash
   npm install
   ```
3. Indítsd el a Vite fejlesztői szervert:
   ```bash
   npm run dev
   ```
4. Nyisd meg a böngészőben a **`http://localhost:5173`** címet.
   - A Vite dev szerver a [`frontend/vite.config.ts`](./frontend/vite.config.ts) beállítása alapján minden `/api` kérést automatikusan továbbít (proxyz) a `http://localhost:5203` címen futó C# backendnek.
   - Produkciós build ellenőrzése:
     ```bash
     npm run build
     ```

### 2.3. Rövid felhasználói útmutató a felülethez
- **Lépések közötti navigáció:** A felső sávban (`1. Motor` → `2. Külső` → `3. Belső` → `4. Extrák` → `5. Összegzés`) vagy az alsó *Előző / Következő lépés* gombokkal válthatsz a fülek között. A jobb oldali **Élő 2D Rétegelt Előnézet (`CarPreview`)** és az árkalkuláció végig fixen látható marad.
- **Mock Bejelentkezés szimuláció (Fejléc):** A jobb felső sarokban egyetlen kattintással válthatsz:
  - **Vendég mód (`401 teszt`):** Kijelentkezett állapot.
  - **Mock Belépés: Kovács János (`user-1`):** Beállítja a `Bearer mock-jwt-token-user-1` tokent.
  - **Mock Belépés: Nagy Anna (`user-2`, `403 teszt`):** Beállítja a `Bearer mock-jwt-token-user-2` tokent, amellyel az *Összegzés* fülön letesztelhető, hogy Kovács János mentésének lekérése (`GET`), módosítása (`PUT`) vagy törlése (`DELETE`) `403 Forbidden` hibát ad.

---

## 3. Tesztfuttatási útmutató

A backend üzleti logikáját, a 7 elfogadási feltételt, a peremfeltételeket és a jogosultsági szabályokat **33 automatizált xUnit teszteset** ellenőrzi.

### 3.1. A tesztek futtatása parancssorból

A projekt gyökérkönyvtárából (`szoftverfejlesztes_MI_tamogatassal_ybky8x`) futtasd az alábbi parancsot:

```bash
dotnet test
```

*(Ha a NuGet csomagok már fel vannak oldva, a gyorsabb futtatáshoz a `dotnet test --no-restore` parancs is használható.)*

### 3.2. Mit ellenőriznek a tesztek és hol találhatók az eredmények?

- **Teszt forráskód:** [`backend/CarConfigurator.Tests/ConfigurationServiceTests.cs`](./backend/CarConfigurator.Tests/ConfigurationServiceTests.cs)
  - **1. Elfogadási feltétel (Normál árkalkuláció):** Alap motor (10M) + Metál szín (250e) + 18" felni (350e) = `10 600 000 Ft` (`IsValid = true`).
  - **2. Elfogadási feltétel (Függőség):** Prémium hangrendszer választása Nagy navigáció nélkül (`DEPENDENCY_MISSING`, `IsValid = false`) és Nagy navigációval együtt (`IsValid = true`).
  - **3. Elfogadási feltétel (Kizárás és néma törlés tilalma):** Alap motor + Sportfutómű, valamint Sport diffúzor + Vonóhorog (`EXCLUSION_CONFLICT`, `IsValid = false`, a `SelectedOptionIds` érintetlen marad).
  - **4. Elfogadási feltétel (Téli csomag 20% kedvezmény):** Mindhárom elem választásakor `-80 000 Ft` (`320 000 Ft` csomagár); bármelyik 1 vagy 2 elem elhagyásakor `[Theory]` tesztekkel igazoltan `0 Ft` kedvezmény és teljes árú elszámolás; egyéb fizetős opciók mellett a 20% kizárólag a Téli csomag 400e Ft-os alapjára vetül.
  - **5. Elfogadási feltétel (Hibás bemenet / `400 Bad Request`):** Hiányzó motor-ID, érvénytelen motor-ID (`-1`, `999`, nem-motor kategória), nem létező opció-ID (`-1`, `-2`), duplikált opciók, több szín/felni/kárpit egyidejű választása (`MULTIPLE_CATEGORY_SELECTION`), üres vagy túl hosszú név.
  - **6. Elfogadási feltétel (Jogosultság `401`/`403` és Visszatöltéskori újra-validálás):** Vendég mentése (`401 Unauthorized`), más felhasználó mentésének elérése/módosítása/törlése (`403 Forbidden`), valamint mentett konfiguráció visszatöltése árváltozás és szabályváltozás után (`SavedTotalPrice` megőrzése + `CurrentEvaluation` újraszámolása).
  - **7. Elfogadási feltétel (2D Vizuális rétegek):** Belső/extra opciók kiszűrése a `VisualLayers`-ből és a külső rétegek szigorú `ZIndex` (`20 → 30 → 40`) szerinti rendezése.
- **Mentett teszteredmények naplója:** A tesztfuttatások pontos kimenetei és összegzései a [`TEST_RESULTS.md`](./TEST_RESULTS.md) fájlban találhatók.
- **MI döntések és QA auditok naplója:** A fejlesztés során vezetett teljes döntési és kódvizsgálati napló az [`AI_DECISIONS.md`](./AI_DECISIONS.md) fájlban érhető el.

---

## 4. MI használat és döntések

A fejlesztés során a **Google Antigravity (Gemini)** ágens-alapú fejlesztőkörnyezetet használtuk két szigorúan szétválasztott szerepkörben:
1. **Senior Full-Stack Fejlesztő szerepkör** ([`AGENTS.md`](./AGENTS.md) alapján): A C# ASP.NET Core backend, az xUnit tesztek és a React/TypeScript frontend implementálása az `agent` branchen.
2. **Független Review Agent (QA) szerepkör** ([`REVIEW_PROTOCOL.md`](./REVIEW_PROTOCOL.md) alapján): Kódírási jogosultság nélkül, kizárólag a `SPECIFICATION.md` alapján végzett tételes logikai, biztonsági és tesztlefedettségi auditot mind a backendre, mind a frontendre.

Az alábbiakban a fejlesztés során meghozott **3 legértékesebb architekturális és minőségbiztosítási döntést** mutatjuk be az [`AI_DECISIONS.md`](./AI_DECISIONS.md) napló alapján:

---

### 1. Döntési eset: Adatvezérelt szabálymotor, néma törlés tilalma és a Téli csomag kedvezmény validációja

- **Probléma:**
  A `SPECIFICATION.md` 2., 3., 4. és 5. elfogadási feltétele komplex, egymással is kölcsönhatásba lépő üzleti szabályokat ír elő: opciós függőséget (*Prémium hangrendszer → Nagy navigáció*), kölcsönös kizárásokat (*Alap motor ↔ Sportfutómű*, *Sport diffúzor ↔ Vonóhorog*), 3-elemű csomagkedvezményt (*Téli csomag 20%*), valamint azt a szigorú megkötést (`AGENTS.md` 6. pont), hogy motor- vagy opciócserénél érvénytelenné váló extrát a rendszer **nem törölhet némán**, és különbséget kell tennie a strukturális bemeneti hibák (`400 Bad Request`) és az üzleti szabályütközések (`IsValid = false`, `CanSave = false`) között.

- **Eszköz és kontextus:**
  Google Antigravity (Gemini) – *Senior Full-Stack Fejlesztő* szerepkörben. A promptban átadtuk a `SPECIFICATION.md` 1–5. elfogadási feltételeit és az `AGENTS.md` ütközéskezelési szabályait, kérve a `ConfigurationService` üzleti szabályainak és határeset-tesztjeinek megvalósítását.

- **MI javaslata:**
  Az MI három fő architekturális megoldást javasolt a beégetett `if-else` elágazások és a kivételdobás (`ArgumentException`) helyett:
  1. Adatvezérelt szabálymodellek (`OptionRule` a `RuleType.Requires` és `RuleType.Excludes` típusokkal, valamint `PackageDiscount` a `RequiredOptionIds` listával és `DiscountPercentage` értékkel) alkalmazása.
  2. A strukturális bemeneti hibák (`HasInvalidInput = true`) és az üzleti konfliktusok (`IsValid = false`, `CanSave = false`) szétválasztása a `ConfigurationEvaluationResultDto`-ban, a bemeneti `SelectedOptionIds` lista érintetlen visszaadásával.
  3. Paraméterezett (`[Theory]` / `[InlineData]`) xUnit tesztek használata a Téli csomag részhalmazainak (2-elemű és 1-elemű kombinációk) teljes körű tesztelésére.

- **Saját döntés és indoklás:**
  **Elfogadtam és kiegészítettem a javaslatot.** Mérnöki szempontból az adatvezérelt `OptionRule` és `PackageDiscount` struktúra azért kritikus, mert egy későbbi változtatási igénynél (Mérföldkő 3 regresszió) új függőségi szabály vagy új csomagkedvezmény a kiértékelő algoritmus (`CheckDependencies`, `CheckExclusions`, `CalculateDiscounts`) módosítása nélkül, pusztán szabály-hozzáadással (`AddRule`, `AddPackageDiscount`) bevezethető. A `HasInvalidInput` jelző bevezetésével a Controller pontosan tudja, mikor kell a `POST /api/configurations/evaluate` hívásra `400 Bad Request`-et adnia (pl. `-1` opció-ID), és mikor `200 OK`-t `IsValid = false` tartalommal (amikor a felhasználó a UI-on épp egy ütköző kombinációt próbál ki).

- **Bizonyíték:**
  - Szabálymotor és kedvezmény-kalkuláció: [`backend/CarConfigurator.Api/Services/ConfigurationService.cs`](./backend/CarConfigurator.Api/Services/ConfigurationService.cs) (`EvaluateConfiguration`, `CheckDependencies`, `CheckExclusions`, `CalculateDiscounts` metódusok).
  - Kiértékelési eredmény DTO: [`backend/CarConfigurator.Api/Dtos/ConfigurationDtos.cs`](./backend/CarConfigurator.Api/Dtos/ConfigurationDtos.cs) (`ConfigurationEvaluationResultDto`).
  - Határeset xUnit tesztek: [`backend/CarConfigurator.Tests/ConfigurationServiceTests.cs`](./backend/CarConfigurator.Tests/ConfigurationServiceTests.cs) (`EvaluateConfiguration_BaseEngineWithSportSuspension_ReturnsInvalidAndDoesNotSilentlyRemoveOption`, `EvaluateConfiguration_FullWinterPackageSelected_Applies20PercentDiscount`, `EvaluateConfiguration_TwoWinterPackageItemsSelected_RemovesDiscountAndChargesFullPrice`).
  - Részletes naplóbejegyzés: [`AI_DECISIONS.md` – 1. és 2. Döntési eset](./AI_DECISIONS.md).

---

### 2. Döntési eset: Független Backend QA Kódvizsgálat – Kategória-kardinalitási kiskapu, nem-rövidzáras validáció és visszatöltéskori újra-validálás

- **Probléma:**
  Az első backend implementáció után ellenőrizni kellett, hogy a `ConfigurationService` valóban véd-e minden érvénytelen bemeneti kombinációtól, valamint maradéktalanul teljesül-e az 5. és 6. elfogadási feltétel (HTTP `400`/`401`/`403` védelem és a mentett konfigurációk visszatöltéskori újra-validálása).

- **Eszköz és kontextus:**
  Google Antigravity (Gemini) – előbb a [`REVIEW_PROTOCOL.md`](./REVIEW_PROTOCOL.md) szerinti **független Review Agent** szerepkörben (kódírási tilalommal, kizárólag hibafeltárási feladattal), majd a feltárt hibák javításához visszalépve **Senior Full-Stack Fejlesztő** szerepkörbe.

- **MI javaslata:**
  A független Review Agent ([`AI_DECISIONS.md` – 3. Döntési eset](./AI_DECISIONS.md)) 5 súlyos validációs és architekturális rést tárt fel a kezdeti kódban:
  1. **Kategória-kardinalitási kiskapu:** A `ValidateInput` csak az azonos ID-k duplikációját (`[11, 11]`) szűrte, de engedte több különböző szín (`10, 11, 12`), több felni (`20, 21, 22`) vagy több belső kárpit (`40, 41`) egyidejű beküldését (`IsValid = true` eredménnyel!).
  2. **Rövidzáras (`short-circuit`) hibakiértékelés:** A `ValidateInput` az első strukturális hibánál `return false;`-szal kilépett, elrejtve a további hibákat (pl. `[-1, -2]` esetén a második hibás ID-t).
  3. **Csomagkedvezmény inkonzisztencia:** A `CalculateDiscounts` a jogosultságot a motort is tartalmazó `allSelectedIds` halmazon ellenőrizte, de az összeget csak a motort nem tartalmazó `selectedOptions` listán számolta.
  4. **Hiányzó Controller / Repository réteg és visszatöltéskori újra-validálás:** Hiányzott a `401`/`403` jogosultságkezelés és a mentett konfigurációk betöltéskori újra-értékelése (`MapToDtoWithRevalidation`).

- **Saját döntés és indoklás:**
  **Mind az 5 Review Agent megállapítást elfogadtam és implementáltam.** Bevezettük a `SingleChoiceCategories` (`ExteriorColor`, `Rim`, `Interior`) kardinalitás-ellenőrzést (`MULTIPLE_CATEGORY_SELECTION`), átalakítottuk a `ValidateInput`-ot nem-rövidzáras hibagyűjtővé, a `CalculateDiscounts` metódust kiterjesztettük a motort is tartalmazó `allSelectedOptions` listára, valamint megvalósítottuk az `InMemoryConfigurationRepository`-t és a `ConfigurationsController`-t. Külön mérnöki döntésként a jogosultság-ellenőrzést (`401` vendégnek, `403` más felhasználó mentésére) nemcsak a Controllerben, hanem a `ConfigurationService` `ServiceResult<T>` rétegében is kikényszerítettük, a `MapToDtoWithRevalidation` pedig minden lekéréskor újra lefuttatja az `EvaluateConfiguration`-t, így árváltozás vagy új szabály bevezetése után a `SavedTotalPrice` és az új `CurrentEvaluation` egyszerre áll rendelkezésre.

- **Bizonyíték:**
  - Javított validáció, jogosultság és újra-validálás: [`backend/CarConfigurator.Api/Services/ConfigurationService.cs`](./backend/CarConfigurator.Api/Services/ConfigurationService.cs) (`SingleChoiceCategories`, `ValidateInput`, `MapToDtoWithRevalidation`, `SaveConfiguration`, `GetSavedConfigurationById`).
  - REST API végpontok: [`backend/CarConfigurator.Api/Controllers/ConfigurationsController.cs`](./backend/CarConfigurator.Api/Controllers/ConfigurationsController.cs).
  - Bővített (16 → 33) xUnit tesztek: [`backend/CarConfigurator.Tests/ConfigurationServiceTests.cs`](./backend/CarConfigurator.Tests/ConfigurationServiceTests.cs) (`EvaluateConfiguration_MultipleColorsOrRimsOrInteriorsSelected_ReturnsMultipleCategorySelectionError`, `EvaluateConfiguration_MultipleInvalidInputs_CollectsAllStructuralErrorsWithoutShortCircuiting`, `Controller_OtherUserAccessModifyOrDelete_Returns403Forbidden`, `GetSavedConfigurationById_ReloadAfterPriceAndRuleChange_PreservesSavedPriceAndRevalidates`).
  - Részletes naplóbejegyzés: [`AI_DECISIONS.md` – 3. és 4. Döntési eset](./AI_DECISIONS.md).

---

### 3. Döntési eset: 2D Rétegelt Vizualizáció (`CarPreview`) – Determinisztikus CSS `z-index` hierarchia és felesleges re-renderek kiküszöbölése

- **Probléma:**
  A 7. elfogadási feltétel előírja, hogy a külső opciók (fényezés, felnik, optikai elemek) 2D rétegei fix `z-index` sorrendben jelenjenek meg, azonnal frissüljenek külső opcióváltáskor, és fülváltáskor (`1. Motor` ↔ `2. Külső` ↔ `3. Belső` ↔ `4. Extrák` ↔ `5. Összegzés`) is változatlanul megmaradjanak. Emellett a kliensoldali QA review során kiderült, hogy ha minden fülváltás vagy belső/extra opciókattintás új tömbreferenciát ad a `visualLayers`-nek, a böngésző feleslegesen újra-rendereli az SVG DOM-fát, azonos `z-index: 40` értékű optikai elemeknél pedig a kattintási sorrendtől függhet a fedés.

- **Eszköz és kontextus:**
  Google Antigravity (Gemini) – *Senior Full-Stack Fejlesztő* és *független Review Agent* szerepkörökben. A feladat a `CarPreview` komponens megtervezése volt a `z:10 (alap karosszéria) → z:20 (fényezés) → z:30 (felnik) → z:40 (optikai extrák)` hierarchiával, majd a kliensoldali Review Agent visszajelzései alapján a renderelési teljesítmény és a determinisztikus rétegsorrend tökéletesítése.

- **MI javaslata:**
  Az MI a HTML5 `<canvas>` imperatív újrarajzolása helyett deklaratív, kétszintű `React.memo` optimalizációt (`LayeredCarCanvas` és `CarLayerImage`), tartalmi referencia-stabilizálást (`areLayersEqual` + `previousLayersRef` a `ConfiguratorContext`-ben), másodlagos rendezési kulcsot (`a.zIndex - b.zIndex || a.optionId - b.optionId`) és a réteg-SVG-k háttérbeli előtöltését (`preloadLayerImages`) javasolta.

- **Saját döntés és indoklás:**
  **Elfogadtam a javaslatot, és elvetettem a `<canvas>` alapú, illetve az előre összerenderelt (flat) képes alternatívákat.**
  1. **Miért jobb a moduláris SVG + CSS `z-index`:** $1 \text{ alap} + 3 \text{ szín} + 3 \text{ felni} + 2 \text{ optikai elem} = 9$ darab kisméretű, áttetsző `viewBox="0 0 800 400"` SVG fájllal az összes ($3 \times 3 \times 4 = 36$) külső kombináció előállítható.
  2. **Miért kritikus a referencia-stabilizálás (`areLayersEqual`):** Amikor a felhasználó fület vált (`activeStep` módosul), vagy a 3–4. lépésben belső kárpitot / Téli csomagot választ, a backend új `ConfigurationEvaluationResultDto` objektumot küld vissza, de abban a külső rétegek tartalma nem változik. Az `areLayersEqual` ellenőrzés miatt ilyenkor a `visualLayers` state referenciája **nem változik meg**, így a `React.memo`-val védett `LayeredCarCanvas` **0 alkalommal** renderelődik újra.
  3. **Determinisztikus sorrend és előtöltés:** A másodlagos rendezési kulcs (`optionId`) mind backend (`BuildVisualLayers`), mind frontend (`CarPreview`) oldalon garantálja a kattintási sorrendtől független rétegsorrendet, a `preloadLayerImages` pedig 0 ms-ra csökkenti az első szín- vagy felniváltás képmegjelenítési idejét.

- **Bizonyíték:**
  - Memoizált 2D előnézet komponens: [`frontend/src/components/CarPreview.tsx`](./frontend/src/components/CarPreview.tsx) (`CarLayerImage`, `LayeredCarCanvas`, `sortedLayers`).
  - Referencia-stabilizálás és SVG előtöltés: [`frontend/src/context/ConfiguratorContext.tsx`](./frontend/src/context/ConfiguratorContext.tsx) (`areLayersEqual`, `preloadLayerImages`, `applyVisualLayersIfChanged`, `skipNextEvaluationRef`).
  - Áttetsző SVG rétegek (`z:10 → z:20 → z:30 → z:40`): [`frontend/public/layers/`](./frontend/public/layers/).
  - Backend oldali `ZIndex` rendezés és xUnit teszt: [`backend/CarConfigurator.Api/Services/ConfigurationService.cs`](./backend/CarConfigurator.Api/Services/ConfigurationService.cs) (`BuildVisualLayers`) és [`backend/CarConfigurator.Tests/ConfigurationServiceTests.cs`](./backend/CarConfigurator.Tests/ConfigurationServiceTests.cs) (`EvaluateConfiguration_VisualLayers_ExcludesInteriorAndExtrasAndOrdersByZIndexAscending`).
  - Részletes naplóbejegyzés: [`AI_DECISIONS.md` – 6., 7. és 8. Döntési eset](./AI_DECISIONS.md).
