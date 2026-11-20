# Automatizált Teszteredmények Naplója (TEST_RESULTS.md)

Ez a fájl az `AGENTS.md` 5. pontja alapján rögzíti az xUnit egységtesztek futtatási eredményeit.

## 1. futtatás – Backend alapstruktúra és normál árkalkuláció tesztek

- **Dátum:** 2026-11-16
- **Branch:** `agent`
- **Parancs:** `dotnet test --no-restore`
- **Cél:** A `ConfigurationService` alapstruktúrájának és az 1. elfogadási feltételnek (*[Normál – Árkalkuláció] Alapmotor 10M Ft + Metál szín 250e Ft + 18" felni 350e Ft = 10 600 000 Ft, `IsValid=true`*) ellenőrzése.

### Lefuttatott tesztesetek (`ConfigurationServiceTests`)
1. `EvaluateConfiguration_NormalPriceCalculation_ReturnsValidAndCorrectTotalPrice` – **PASSED**
   - Ellenőrzi, hogy az Alap motor (10 000 000 Ft), Metál szín (250 000 Ft) és 18" felni (350 000 Ft) együttes választásakor `IsValid = true`, nincs validációs hiba, és a `TotalPrice = 10 600 000 Ft`.
2. `EvaluateConfiguration_BaseEngineWithZeroCostDefaults_ReturnsBasePriceOnly` – **PASSED**
   - Ellenőrzi az alapmotor és a felár nélküli alap külső opciók (Alap fehér szín, 17" Alap felni) árkalkulációját (10 000 000 Ft), valamint a 2D vizuális rétegek `ZIndex` szerinti rendezettségét.

### Konzol kimenet (Summary)
```text
Test run for backend\CarConfigurator.Tests\bin\Debug\net10.0\CarConfigurator.Tests.dll (.NETCoreApp,Version=v10.0)
A total of 1 test files matched the specified pattern.

Passed!  - Failed:     0, Passed:     2, Skipped:     0, Total:     2, Duration: 36 ms - CarConfigurator.Tests.dll (net10.0)
```


---

## 2. futtatás – 2., 3., 4. és 5. elfogadási feltételek (Függőség, Kizárás, Téli csomag, Hibás bemenet) xUnit tesztek

- **Dátum:** 2026-11-16
- **Branch:** `agent`
- **Parancs:** `dotnet test --no-restore`
- **Cél:** A `SPECIFICATION.md` 1–5. elfogadási feltételeinek teljes körű ellenőrzése normál, határeset- és hibás bemeneti tesztekkel.

### Lefuttatott tesztesetek (`ConfigurationServiceTests` – összesen 16 teszteset)
1. **1. Elfogadási feltétel [Normál – Árkalkuláció]:**
   - `EvaluateConfiguration_NormalPriceCalculation_ReturnsValidAndCorrectTotalPrice` – **PASSED**
   - `EvaluateConfiguration_BaseEngineWithZeroCostDefaults_ReturnsBasePriceOnly` – **PASSED**
2. **2. Elfogadási feltétel [Normál/Határeset – Függőség]:**
   - `EvaluateConfiguration_PremiumSoundWithoutLargeNavigation_ReturnsInvalidAndDependencyError` – **PASSED**
   - `EvaluateConfiguration_PremiumSoundWithLargeNavigation_ReturnsValidAndCalculatesBothPrices` – **PASSED**
3. **3. Elfogadási feltétel [Határeset – Kizárás és néma törlés tilalma]:**
   - `EvaluateConfiguration_BaseEngineWithSportSuspension_ReturnsInvalidAndDoesNotSilentlyRemoveOption` – **PASSED**
   - `EvaluateConfiguration_SportEngineWithSportSuspension_ReturnsValid` – **PASSED**
   - `EvaluateConfiguration_SportDiffuserWithTowHook_ReturnsInvalidAndExclusionError` – **PASSED**
4. **4. Elfogadási feltétel [Határeset – Csomagkedvezmény (Téli csomag 20%)]:**
   - `EvaluateConfiguration_FullWinterPackageSelected_Applies20PercentDiscount` – **PASSED** (400 000 Ft -> 80 000 Ft kedvezmény -> 320 000 Ft nettó csomagár)
   - `EvaluateConfiguration_PartialWinterPackageSelected_RemovesDiscountAndChargesFullPrice` (3× `[InlineData]` kombináció mindhárom elem elhagyására) – **PASSED** (0 Ft kedvezmény, maradó elemek teljes áron)
5. **5. Elfogadási feltétel [Hibás bemenet – Érvénytelen adatok]:**
   - `EvaluateConfiguration_MissingEngineId_ReturnsInvalidInputError` – **PASSED**
   - `EvaluateConfiguration_NonExistentOptionIdMinusOne_ReturnsInvalidInputError` – **PASSED**
   - `EvaluateConfiguration_DuplicateOptions_ReturnsInvalidInputError` – **PASSED**
   - `ValidateSaveRequest_EmptyOrWhitespaceName_ReturnsInvalidInputError` (2× `[InlineData]`: `""` és `"   "`) – **PASSED**

### Konzol kimenet (Summary)
```text
Test run for backend\CarConfigurator.Tests\bin\Debug\net10.0\CarConfigurator.Tests.dll (.NETCoreApp,Version=v10.0)
A total of 1 test files matched the specified pattern.

Passed!  - Failed:     0, Passed:    16, Skipped:     0, Total:    16, Duration: 70 ms - CarConfigurator.Tests.dll (net10.0)
```


---

## 3. futtatás – Review Agent visszajelzések javítása utáni teljes xUnit tesztcsomag (1–7. elfogadási feltételek)

- **Dátum:** 2026-11-17
- **Branch:** `agent`
- **Parancs:** `dotnet test --no-restore`
- **Cél:** A független Review Agent által feltárt összes validációs kiskapu, jogosultsági/CRUD szabály (400/401/403), visszatöltéskori újra-validálás és 2D réteg-rendezés ellenőrzése.

### Újonnan hozzáadott / bővített tesztesetek (`ConfigurationServiceTests` – összesen 33 teszteset)
- **Többszörös egyidejű üzleti szabályütközés:**
  - `EvaluateConfiguration_SimultaneousDependencyAndExclusionConflicts_ReturnsBothErrors` – **PASSED**
- **Téli csomag (4. elfogadási feltétel) peremtesztek és motor-komponensű csomag:**
  - `EvaluateConfiguration_SingleWinterPackageItemSelected_NoDiscountApplied` (3× `[InlineData]`) – **PASSED**
  - `EvaluateConfiguration_FullWinterPackagePlusOtherPaidOptions_AppliesDiscountOnlyToWinterPackageItems` – **PASSED**
  - `EvaluateConfiguration_PackageDiscountIncludingEngineOption_IncludesEnginePriceInDiscountCalculation` – **PASSED**
- **Bemeneti validáció, kategória-kardinalitás és nem-rövidzáras hibagyűjtés (5. elfogadási feltétel):**
  - `EvaluateConfiguration_InvalidOrNonEngineIdPassedAsEngine_ReturnsInvalidEngineIdError` (3× `[InlineData]`: `-1`, `999`, `MetallicColor`) – **PASSED**
  - `EvaluateConfiguration_EngineIdPassedInSelectedOptions_ReturnsEngineInSelectedOptionsError` – **PASSED**
  - `EvaluateConfiguration_MultipleInvalidInputs_CollectsAllStructuralErrorsWithoutShortCircuiting` – **PASSED**
  - `EvaluateConfiguration_MultipleColorsOrRimsOrInteriorsSelected_ReturnsMultipleCategorySelectionError` – **PASSED**
  - `ValidateSaveRequest_NullRequestOrNameTooLong_ReturnsAppropriateInputErrors` – **PASSED**
- **Jogosultságkezelés (401/403), CRUD és visszatöltéskori újra-validálás (5. és 6. elfogadási feltétel):**
  - `Controller_GuestSaveAttempt_Returns401Unauthorized` – **PASSED**
  - `Controller_OtherUserAccessModifyOrDelete_Returns403Forbidden` – **PASSED**
  - `Controller_SaveInvalidOrConflictingConfiguration_Returns400BadRequestWithoutSaving` – **PASSED**
  - `GetSavedConfigurationById_ReloadAfterPriceAndRuleChange_PreservesSavedPriceAndRevalidates` – **PASSED**
- **2D vizuális rétegek szűrése és `ZIndex` sorrendje (7. elfogadási feltétel):**
  - `EvaluateConfiguration_VisualLayers_ExcludesInteriorAndExtrasAndOrdersByZIndexAscending` – **PASSED**

### Konzol kimenet (Summary)
```text
Test run for backend\CarConfigurator.Tests\bin\Debug\net10.0\CarConfigurator.Tests.dll (.NETCoreApp,Version=v10.0)
A total of 1 test files matched the specified pattern.

Passed!  - Failed:     0, Passed:    33, Skipped:     0, Total:    33, Duration: 124 ms - CarConfigurator.Tests.dll (net10.0)
```
