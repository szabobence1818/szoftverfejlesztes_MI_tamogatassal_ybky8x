import React from 'react';
import { CarPreview } from './components/CarPreview';
import { StepNavigator } from './components/StepNavigator';
import { EngineStep } from './components/steps/EngineStep';
import { ExteriorStep } from './components/steps/ExteriorStep';
import { ExtrasStep } from './components/steps/ExtrasStep';
import { InteriorStep } from './components/steps/InteriorStep';
import { SummaryStep } from './components/steps/SummaryStep';
import { ConfiguratorProvider, useConfigurator } from './context/ConfiguratorContext';
import { CONFIGURATOR_STEPS } from './types/configurator';

const ConfiguratorShell: React.FC = () => {
  const {
    activeStep,
    nextStep,
    prevStep,
    isLoadingOptions,
    apiError,
    currentUser,
    loginAsMockUser,
    logoutToGuest,
  } = useConfigurator();

  const currentStepIndex = CONFIGURATOR_STEPS.findIndex((s) => s.id === activeStep);

  const renderActiveStep = () => {
    switch (activeStep) {
      case 'engine':
        return <EngineStep />;
      case 'exterior':
        return <ExteriorStep />;
      case 'interior':
        return <InteriorStep />;
      case 'extras':
        return <ExtrasStep />;
      case 'summary':
        return <SummaryStep />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Fejléc és Mock Bejelentkezés szimuláció (Vendég vs. Bejelentkezett felhasználók JWT tokennel) */}
      <header className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-extrabold tracking-tight">Egyedi Autó Konfigurátor</h1>
            <p className="text-xs text-slate-400">
              5 lépéses konfigurátor 2D rétegelt előnézettel és valós idejű validációval
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="mr-2 flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded border border-slate-700">
              <span className="text-slate-400">Státusz:</span>
              <span className="font-bold text-white">{currentUser.displayName}</span>
              {currentUser.token && (
                <span className="font-mono text-[10px] text-emerald-400 ml-1">
                  [{currentUser.token}]
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={logoutToGuest}
              className={`px-2.5 py-1 rounded font-semibold cursor-pointer transition-colors ${
                currentUser.isGuest
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Vendég mód (401 teszt)
            </button>

            <button
              type="button"
              onClick={() => loginAsMockUser('user-1', 'Kovács János (user-1)')}
              className={`px-2.5 py-1 rounded font-semibold cursor-pointer transition-colors ${
                currentUser.userId === 'user-1'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Mock Belépés: Kovács János
            </button>

            <button
              type="button"
              onClick={() => loginAsMockUser('user-2', 'Nagy Anna (user-2)')}
              className={`px-2.5 py-1 rounded font-semibold cursor-pointer transition-colors ${
                currentUser.userId === 'user-2'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Mock Belépés: Nagy Anna (403 teszt)
            </button>
          </div>
        </div>
      </header>

      {/* 5 lépéses navigációs sáv */}
      <StepNavigator />

      {/* Fő tartalom: Bal oldalon az aktív lépés, jobb oldalon a fixen látható CarPreview komponens */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {apiError && (
          <div className="mb-4 rounded-lg bg-amber-50 border border-amber-300 px-4 py-3 text-xs text-amber-900">
            <strong>Backend kapcsolat információ:</strong> {apiError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
            {isLoadingOptions ? (
              <div className="py-12 text-center text-sm text-slate-500">
                Opciók betöltése a backendről...
              </div>
            ) : (
              renderActiveStep()
            )}

            {/* Előző / Következő lépés gombok */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={prevStep}
                disabled={currentStepIndex <= 0}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  currentStepIndex > 0
                    ? 'bg-slate-100 text-slate-800 hover:bg-slate-200 cursor-pointer'
                    : 'bg-slate-50 text-slate-400 cursor-not-allowed'
                }`}
              >
                ← Előző lépés
              </button>

              <button
                type="button"
                onClick={nextStep}
                disabled={currentStepIndex >= CONFIGURATOR_STEPS.length - 1}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  currentStepIndex < CONFIGURATOR_STEPS.length - 1
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer'
                    : 'bg-slate-50 text-slate-400 cursor-not-allowed'
                }`}
              >
                Következő lépés →
              </button>
            </div>
          </div>

          <div className="lg:col-span-5">
            <CarPreview />
          </div>
        </div>
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ConfiguratorProvider>
      <ConfiguratorShell />
    </ConfiguratorProvider>
  );
};

export default App;
