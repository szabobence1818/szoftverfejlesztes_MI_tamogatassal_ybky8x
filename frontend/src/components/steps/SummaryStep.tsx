import React, { useEffect, useState } from 'react';
import { formatHuf, useConfigurator } from '../../context/ConfiguratorContext';

export const SummaryStep: React.FC = () => {
  const {
    options,
    engineOptionId,
    selectedOptionIds,
    evaluation,
    currentUser,
    savedConfigurations,
    loadedConfiguration,
    isLoadedConfigDirty,
    saveCurrentConfiguration,
    updateCurrentConfiguration,
    loadSavedConfiguration,
    removeSavedConfiguration,
  } = useConfigurator();

  const [configName, setConfigName] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [probeConfigId, setProbeConfigId] = useState<string>('');

  // Betöltött mentés esetén a név mező automatikus előtöltése (Review Agent #4 javítás)
  useEffect(() => {
    if (loadedConfiguration) {
      setConfigName(loadedConfiguration.name);
    }
  }, [loadedConfiguration]);

  const selectedEngine = options.find((o) => o.id === engineOptionId);
  const selectedItems = options.filter((o) => selectedOptionIds.includes(o.id));
  const isNameValid = configName.trim().length > 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setErrorMessage(null);

    if (evaluation && !evaluation.isValid) {
      setErrorMessage(
        `A konfiguráció nem menthető (IsValid = false): ${evaluation.errors
          .map((err) => err.message)
          .join(' | ')}`
      );
      return;
    }

    setIsSaving(true);
    try {
      const saved = await saveCurrentConfiguration(configName);
      setStatusMessage(
        `Sikeres új mentés (HTTP 201): „${saved.name}” (ID: #${saved.id}, Mentett ár: ${formatHuf(
          saved.savedTotalPrice
        )}).`
      );
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Hiba történt a mentés során.');
    } finally {
      setIsSaving(false);
    }
  };

  // Meglévő, betöltött mentés felülírása (PUT /api/configurations/{id})
  const handleUpdateLoaded = async () => {
    if (!loadedConfiguration) return;
    setStatusMessage(null);
    setErrorMessage(null);
    setIsSaving(true);
    try {
      const updated = await updateCurrentConfiguration(loadedConfiguration.id, configName);
      setStatusMessage(
        `Sikeres módosítás (HTTP 200 PUT): „${updated.name}” (ID: #${
          updated.id
        }, Új mentett ár: ${formatHuf(updated.savedTotalPrice)}).`
      );
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Hiba történt a módosítás során.');
    } finally {
      setIsSaving(false);
    }
  };

  // Listából történő visszatöltés try/catch hibakezeléssel (Review Agent #2 javítás)
  const handleLoadSaved = async (id: number) => {
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const loaded = await loadSavedConfiguration(id);
      setStatusMessage(
        `Konfiguráció visszatöltve (HTTP 200 GET): „${loaded.name}” (#${loaded.id}).`
      );
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Hiba a mentett konfiguráció visszatöltésekor.'
      );
    }
  };

  // Listából történő törlés try/catch hibakezeléssel (Review Agent #2 javítás)
  const handleDeleteSaved = async (id: number) => {
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      await removeSavedConfiguration(id);
      setStatusMessage(`A(z) #${id} azonosítójú konfiguráció sikeresen törölve (HTTP 204 DELETE).`);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Hiba a mentett konfiguráció törlésekor.'
      );
    }
  };

  // Segédfüggvény a backend POST /api/configurations 400/401 válaszainak közvetlen kipróbálásához
  const handleForceBackendPost = async () => {
    setStatusMessage(null);
    setErrorMessage(null);
    setIsSaving(true);
    try {
      const saved = await saveCurrentConfiguration(configName);
      setStatusMessage(
        `Sikeres mentés (HTTP 201): „${saved.name}” (ID: #${saved.id}, Mentett ár: ${formatHuf(
          saved.savedTotalPrice
        )}).`
      );
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Backend hiba.');
    } finally {
      setIsSaving(false);
    }
  };

  // Segédfüggvények a 6. elfogadási feltétel (401/403 GET, PUT, DELETE) közvetlen teszteléséhez
  const parseProbeId = (): number | null => {
    const idNum = Number(probeConfigId);
    if (!Number.isInteger(idNum) || idNum <= 0) {
      setErrorMessage('Kérjük, adjon meg egy pozitív egész konfiguráció-azonosítót (pl. 1).');
      return null;
    }
    return idNum;
  };

  const handleProbeGet = async () => {
    setStatusMessage(null);
    setErrorMessage(null);
    const idNum = parseProbeId();
    if (idNum === null) return;
    await handleLoadSaved(idNum);
  };

  const handleProbePut = async () => {
    setStatusMessage(null);
    setErrorMessage(null);
    const idNum = parseProbeId();
    if (idNum === null) return;
    try {
      const updated = await updateCurrentConfiguration(
        idNum,
        configName.trim() || 'Módosított név'
      );
      setStatusMessage(`Sikeres módosítás (HTTP 200 PUT): „${updated.name}” (#${updated.id}).`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Hiba a módosítási próbahívás során.');
    }
  };

  const handleProbeDelete = async () => {
    setStatusMessage(null);
    setErrorMessage(null);
    const idNum = parseProbeId();
    if (idNum === null) return;
    await handleDeleteSaved(idNum);
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">5. Lépés: Összegzés és Mentés</h2>
        <p className="text-sm text-slate-600 mt-1">
          Tekintse át a kiválasztott opciókat és a végső árat. A konfiguráció a backend{' '}
          <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
            POST / PUT / DELETE /api/configurations
          </code>{' '}
          végpontjain keresztül kezelhető.
        </p>
      </div>

      {/* Ha a konfigurációban szabályütközés van (IsValid = false), jól látható figyelmeztetést jelenítünk meg */}
      {evaluation && !evaluation.isValid && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 border-2 border-red-300 p-4 space-y-2 text-red-900"
        >
          <div className="text-sm font-extrabold flex items-center gap-2">
            <span>
              ⛔ A konfiguráció jelenleg érvénytelen (`IsValid = false`) – a mentés tiltott!
            </span>
          </div>
          <ul className="list-disc list-inside text-xs text-red-800 space-y-1">
            {evaluation.errors.map((err, index) => (
              <li key={`${err.code}-${index}`}>
                <strong>[{err.code}]</strong> {err.message}
              </li>
            ))}
          </ul>
          <p className="text-xs text-red-700 pt-1">
            Kérjük, oldja fel a fenti függőségi vagy kizárási ütközést az előző füleken a szabályos
            mentéshez!
          </p>
        </div>
      )}

      {/* Választott opciók és végső ár tételes összegzése */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-800">
          Kiválasztott opciók és tételes árkalkuláció
        </h3>
        <ul className="divide-y divide-slate-200 text-sm">
          {selectedEngine && (
            <li className="py-2 flex justify-between font-semibold text-slate-900">
              <span>Motor: {selectedEngine.name}</span>
              <span>{formatHuf(selectedEngine.price)}</span>
            </li>
          )}
          {selectedItems.map((item) => (
            <li key={item.id} className="py-2 flex justify-between text-slate-700">
              <span>
                {item.name}
                {item.zIndex ? (
                  <span className="ml-2 text-[11px] font-mono text-slate-400">
                    [2D réteg z:{item.zIndex}]
                  </span>
                ) : null}
              </span>
              <span className="font-medium">
                {item.price === 0 ? 'Alapárban (0 Ft)' : `+ ${formatHuf(item.price)}`}
              </span>
            </li>
          ))}
        </ul>

        {evaluation && (
          <div className="pt-3 border-t-2 border-slate-200 space-y-1 text-sm">
            {evaluation.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Csomagkedvezmény ({evaluation.appliedDiscounts.join(', ')}):</span>
                <span>- {formatHuf(evaluation.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-1">
              <span className="font-bold text-slate-900">Fizetendő végösszeg:</span>
              <span className="text-xl font-extrabold text-indigo-700">
                {formatHuf(evaluation.totalPrice)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Mentési és Módosítási (POST / PUT) űrlap */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-800">
            Konfiguráció mentése (POST) / Módosítása (PUT)
          </h3>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
            Aktív státusz: {currentUser.displayName}
          </span>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
              placeholder="Konfiguráció neve (pl. Saját Sport Konfiguráció)"
              className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={!evaluation?.canSave || !isNameValid || currentUser.isGuest || isSaving}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                evaluation?.canSave && isNameValid && !currentUser.isGuest && !isSaving
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer'
                  : 'bg-slate-200 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isSaving ? 'Mentés...' : 'Mentés újként (POST)'}
            </button>

            {loadedConfiguration && !currentUser.isGuest && (
              <button
                type="button"
                onClick={() => void handleUpdateLoaded()}
                disabled={!evaluation?.canSave || !isNameValid || isSaving}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  evaluation?.canSave && isNameValid && !isSaving
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer'
                    : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                }`}
              >
                #{loadedConfiguration.id} Felülírása (PUT)
              </button>
            )}
          </div>

          {/* Tesztelő gomb a backend 400 Bad Request / 401 Unauthorized válaszainak közvetlen kipróbálásához */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-500">
            <span>
              {currentUser.isGuest
                ? 'Vendégként a normál mentés gomb inaktív. A backend 401/400 válasz közvetlen teszteléséhez:'
                : 'Üres névvel vagy ütközéssel történő 400 Bad Request válasz teszteléséhez:'}
            </span>
            <button
              type="button"
              onClick={() => void handleForceBackendPost()}
              disabled={isSaving}
              className="px-3 py-1 rounded border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold cursor-pointer"
            >
              POST küldése közvetlenül a backendnek (400/401 teszt)
            </button>
          </div>
        </form>

        {/* Sikeres művelet visszajelzés */}
        {statusMessage && (
          <div
            role="status"
            className="text-xs bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg p-3 font-medium"
          >
            ✓ {statusMessage}
          </div>
        )}

        {/* Jól látható backend / validációs hibaüzenet (400 Bad Request, 401 Unauthorized, 403 Forbidden, IsValid=false) */}
        {errorMessage && (
          <div
            role="alert"
            className="text-xs bg-red-50 border-2 border-red-300 text-red-900 rounded-lg p-3 font-semibold"
          >
            ❌ Hiba: {errorMessage}
          </div>
        )}
      </div>

      {/* Saját mentések listája + Más felhasználó mentésének (403 Forbidden GET/PUT/DELETE) tesztelése */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-800">
            Mentett konfigurációk kezelése (GET / PUT / DELETE)
          </h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              type="number"
              min={1}
              value={probeConfigId}
              onChange={(e) => setProbeConfigId(e.target.value)}
              placeholder="Konfig ID (pl. 1)"
              className="w-28 rounded border border-slate-300 px-2.5 py-1 text-xs"
            />
            <button
              type="button"
              onClick={() => void handleProbeGet()}
              className="text-xs px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold cursor-pointer"
            >
              GET (401/403)
            </button>
            <button
              type="button"
              onClick={() => void handleProbePut()}
              className="text-xs px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold cursor-pointer"
            >
              PUT (401/403)
            </button>
            <button
              type="button"
              onClick={() => void handleProbeDelete()}
              className="text-xs px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 text-red-800 font-semibold cursor-pointer"
            >
              DELETE (401/403)
            </button>
          </div>
        </div>

        {loadedConfiguration && (
          <div className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              Betöltött mentés: <strong>{loadedConfiguration.name}</strong> (#
              {loadedConfiguration.id}) | Mentéskori ár:{' '}
              <strong>{formatHuf(loadedConfiguration.savedTotalPrice)}</strong> | Visszatöltéskori
              ár:{' '}
              <strong>
                {formatHuf(
                  loadedConfiguration.currentEvaluation?.totalPrice ??
                    loadedConfiguration.savedTotalPrice
                )}
              </strong>{' '}
              | Jelenlegi ár:{' '}
              <strong>{formatHuf(evaluation?.totalPrice ?? loadedConfiguration.savedTotalPrice)}</strong>
            </div>
            <span
              className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                isLoadedConfigDirty
                  ? 'bg-amber-200 text-amber-900'
                  : 'bg-emerald-200 text-emerald-900'
              }`}
            >
              {isLoadedConfigDirty ? 'Módosítva a betöltés óta' : 'Mentett állapot'}
            </span>
          </div>
        )}

        {currentUser.isGuest ? (
          <p className="text-xs text-slate-500 italic">
            Jelentkezzen be a fejlécben található Mock Bejelentkezés gombokkal a saját mentések
            listázásához!
          </p>
        ) : savedConfigurations.length === 0 ? (
          <p className="text-xs text-slate-500 italic">
            Még nincs elmentett konfigurációja ezzel a felhasználóval ({currentUser.displayName}).
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 text-sm">
            {savedConfigurations.map((saved) => (
              <li
                key={saved.id}
                className="py-2.5 flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <span className="font-bold text-slate-900">
                    #{saved.id} – {saved.name}
                  </span>
                  <span className="text-xs text-slate-500 ml-2">
                    (Mentett ár: {formatHuf(saved.savedTotalPrice)})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleLoadSaved(saved.id)}
                    className="text-xs px-3 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold cursor-pointer"
                  >
                    Visszatöltés
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteSaved(saved.id)}
                    className="text-xs px-3 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 font-semibold cursor-pointer"
                  >
                    Törlés
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};
