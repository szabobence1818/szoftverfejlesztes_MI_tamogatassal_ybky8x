import React from 'react';
import { useConfigurator } from '../context/ConfiguratorContext';
import { CONFIGURATOR_STEPS } from '../types/configurator';

export const StepNavigator: React.FC = () => {
  const { activeStep, setActiveStep, doesStepHaveConflict } = useConfigurator();

  return (
    <nav aria-label="Konfigurátor lépések" className="bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <ol className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {CONFIGURATOR_STEPS.map((step) => {
            const isActive = step.id === activeStep;
            const hasConflict = doesStepHaveConflict(step.id);

            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => setActiveStep(step.id)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-lg border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : hasConflict
                      ? 'bg-red-50 text-red-800 border-red-300 hover:bg-red-100'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="text-sm font-semibold flex items-center justify-between">
                    <span>{step.label}</span>
                    {hasConflict && (
                      <span
                        title="Ebben a lépésben szabályütközés vagy hiányzó előfeltétel található"
                        className="text-xs px-1.5 py-0.5 rounded bg-red-200 text-red-900 font-bold"
                      >
                        !
                      </span>
                    )}
                  </div>
                  <div
                    className={`text-xs truncate mt-0.5 ${
                      isActive ? 'text-indigo-100' : 'text-slate-500'
                    }`}
                  >
                    {step.description}
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
};
