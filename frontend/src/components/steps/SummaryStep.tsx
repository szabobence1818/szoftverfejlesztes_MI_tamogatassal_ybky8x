import React, { useState } from 'react';
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
    saveCurrentConfiguration,
    loadSavedConfiguration,
    removeSavedConfiguration,
  } = useConfigurator();

  const [configName, setConfigName] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [probeConfigId, setProbeConfigId] = useState<string>('');

  const selectedEngine = options.find((o) => o.id === engineOptionId);
  const selectedItems = options.filter((o) => selectedOptionIds.includes(o.id));

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
        `Sikeres mentés (HTTP 201): „${saved.name}” (ID: #${saved.id}, Mentett ár: ${formatHuf(
          saved.savedTotalPrice
        )}).`
      );
      setConfigName('');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Hiba történt a mentés során.');
    } finally {
      setIsSaving(false);
    }
  };

  // Segédfüggvény a backend POST /api/configurations 400/401 és GET/DELETE 403 válaszainak közvetlen kipróbálásához
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
      setConfigName('');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Backend hiba.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadByIdProbe = async () => {
    setStatusMessage(null);
    setErrorMessage(null);
    const idNum = Number(probeConfigId);
    if (!Number.isInteger(idNum) || idNum <= 0) {
      setErrorMessage('Kérjük, adjon meg egy pozitív egész konfiguráció-azonosítót (pl. 1).');
      return;
    }

    try {
      const loaded = await loadSavedConfiguration(idNum);
      setStatusMessage(`Sikeresen betöltve: „${loaded.name}” (#${loaded.id}).`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Hiba a konfiguráció betöltésekor.');
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">5. Lépés: Összegzés és Mentés</h2>
        <p className="text-sm text-slate-600 mt-1">
          Tekintse át a kiválasztott opciókat és a végső árat. A konfiguráció a backend{' '}
          <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
            POST /api/configurations
          </code>{' '}
          végpontján keresztül menthető el.
        </p>
      </div>

      {/* Ha a konfigurációban szabályütközés van (IsValid = false), jól látható figyelmeztetést jelenítünk meg */}
      {evaluation && !evaluation.isValid && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 border-2 border-red-300 p-4 space-y-2 text-red-900"
        >
          <div className="text-sm font-extrabold flex items-center gap-2">
            <span>⛔ A konfiguráció jelenleg érvénytelen (`IsValid = false`) – a mentés tiltott!</span>
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

      {/* Mentési űrlap és hibakezelés */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-800">Konfiguráció mentése</h3>
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
              disabled={!evaluation?.canSave || currentUser.isGuest || isSaving}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                evaluation?.canSave && !currentUser.isGuest && !isSaving
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer'
                  : 'bg-slate-200 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isSaving ? 'Mentés folyamatban...' : 'Konfiguráció mentése'}
            </button>
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

        {/* Sikeres mentés visszajelzés */}
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

      {/* Saját mentések listája + Más felhasználó mentésének (403 Forbidden) tesztelése */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-800">
            Mentett konfigurációk kezelése és visszatöltése
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={probeConfigId}
              onChange={(e) => setProbeConfigId(e.target.value)}
              placeholder="Konfig ID (pl. 1)"
              className="w-32 rounded border border-slate-300 px-2.5 py-1 text-xs"
            />
            <button
              type="button"
              onClick={() => void handleLoadByIdProbe()}
              className="text-xs px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold cursor-pointer"
            >
              ID lekérése (401/403 teszt)
            </button>
          </div>
        </div>

        {loadedConfiguration && (
          <div className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg p-2.5">
            Betöltött mentés: <strong>{loadedConfiguration.name}</strong> (#{loadedConfiguration.id})
            | Mentéskori ár: <strong>{formatHuf(loadedConfiguration.savedTotalPrice)}</strong> |
            Újraszámolt ár:{' '}
            <strong>
              {formatHuf(
                loadedConfiguration.currentEvaluation?.totalPrice ??
                  loadedConfiguration.savedTotalPrice
              )}
            </strong>
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
                    onClick={() => void loadSavedConfiguration(saved.id)}
                    className="text-xs px-3 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold cursor-pointer"
                  >
                    Visszatöltés
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeSavedConfiguration(saved.id)}
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
