# Egyedi Autó Konfigurátor

## 1. Cél és architektúra
Egyetlen autómodellre épülő webes konfigurátor, ahol a felhasználó összeállíthatja a járművet (motor, szín, felni, kárpit, extrák), látja a 2D rétegelt előnézetet és a valós idejű árat, valamint elmentheti és visszatöltheti konfigurációit.
- **Frontend (React, TypeScript):** Lépésekre bontott felület (Motor → Külső → Belső → Extrák → Összegzés), állapotkezelés, átlátszó 2D PNG/SVG rétegek dinamikus cseréje.
- **Backend (C#, ASP.NET Core Web API):** REST végpontok (opciók, validálás, árkalkuláció, mentés), üzleti szabályok validálása (`ConfigurationService`), EF Core (SQLite/InMemory) adattárolás, xUnit automatizált egységtesztek.

## 2. Szerepkörök és forgatókönyvek
**Szerepkörök:**
- **Vendég:** Összeállíthatja az autót, látja a 2D előnézetet, a validációt és az árat, de nem menthet.
- **Bejelentkezett felhasználó:** Elmentheti az érvényes konfigurációkat; saját mentéseit listázhatja, visszatöltheti, módosíthatja és törölheti.

**Fő forgatókönyvek:**
1. **Összeállítás és árkalkuláció:** Minden választáskor lefut a validáció, frissülnek a 2D rétegek és az ár (alapár + opciók – kedvezmények).
2. **Szabályellenőrzés:** Függőségi hiány vagy kizárás esetén a rendszer jelzi az ütközést, és tiltja a mentést.
3. **Mentés és visszatöltés:** Bejelentkezett felhasználó az Összegzés fülön névvel elmenti az érvényes konfigurációt, amit később visszatölthet vagy törölhet.

## 3. Elfogadási feltételek és ellenőrzésük
1. **[Normál – Árkalkuláció]** Alapmotor (10M Ft), metál szín (250e Ft) és 18" felni (350e Ft) ütközésmentes választásakor az állapot érvényes (`IsValid=true`), az ár 10 600 000 Ft. *Ellenőrzés:* xUnit teszt az árkalkulációra.
2. **[Normál/Határeset – Függőség]** A „Prémium hangrendszer” választása a kötelező „Nagy navigáció” nélkül érvénytelen (`IsValid=false`) állapotot és hiányzó előfeltétel hibát ad. *Ellenőrzés:* xUnit teszt a függőségre.
3. **[Határeset – Kizárás]** Kizáró opciók („Alap motor”+„Sportfutómű” vagy „Sport diffúzor”+„Vonóhorog”) választásakor a validáció ütközési hibát ad (`IsValid=false`), a mentés tiltott. *Ellenőrzés:* xUnit teszt a kizárásokra.
4. **[Határeset – Csomagkedvezmény]** A „Téli csomag” mindhárom elemének (Ülésfűtés: 150e, Kormányfűtés: 100e, Fűthető szélvédő: 150e Ft) választásakor 20% (80e Ft) kedvezmény jár (320e Ft); bármelyik kivételekor a kedvezmény megszűnik, a maradó elemek teljes áron számolódnak. *Ellenőrzés:* xUnit határeset-teszt.
5. **[Hibás bemenet – Érvénytelen adatok]** Hiányzó motor-ID, nem létező opció-ID (`-1`), duplikált opciók vagy üres név esetén az API `400 Bad Request` hibát ad, mentés nélkül. *Ellenőrzés:* xUnit teszt hibás DTO-kkal.
6. **[Jogosulatlan művelet – Védelem]** Más felhasználó mentésének lekérése, módosítása vagy törlése `403 Forbidden` (vendég mentése `401 Unauthorized`) választ ad. *Ellenőrzés:* xUnit jogosultsági teszt.
7. **[Vizuális – 2D rétegek]** Külső opció váltásakor a 2D rétegek azonnal frissülnek és fülváltáskor is megmaradnak. *Ellenőrzés (kézi):* 1. A „Külső” fülön válassz „Tűzpiros” színt és „19" Sport” felnit (mindkét réteg frissül). 2. Lépj a „Belső”, majd vissza a „Külső” fülre (a rétegek és az ár változatlan).

## 4. Bizonytalanságok és feloldásuk
- **Utólagos ütközés:** Ha egy alap-opció (pl. motor) cseréje miatt egy már kiválasztott extra érvénytelenné válik, a rendszer nem törli némán, hanem jelzi az ütközést, és a feloldásig tiltja a mentést.
- **Mentések konzisztenciája:** Az adatbázis az opció-ID-kat és a mentéskori árat is tárolja; visszatöltéskor a backend újra-validálja és újraszámolja a konfigurációt.
- **2D vizualizáció:** Csak a külső opciók (szín, felni, optikai elemek) kapnak külön PNG/SVG réteget (fix `z-index`); a belső/kényelmi extrák listában és ikonokkal jelennek meg.
- **Hitelesítés:** Lokális, JWT/session alapú azonosítás készül külső OAuth nélkül, a fókusz az üzleti és jogosultsági szabályokon van.