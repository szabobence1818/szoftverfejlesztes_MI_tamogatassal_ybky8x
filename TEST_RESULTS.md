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
