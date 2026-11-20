import React from 'react';
import { formatHuf, useConfigurator } from '../../context/ConfiguratorContext';
import { OptionCategory } from '../../types/configurator';

export const EngineStep: React.FC = () => {
  const {
    options,
    engineOptionId,
    selectEngine,
    isOptionConflicting,
    getOptionConflictMessages,
  } = useConfigurator();

  const engines = options.filter((o) => o.category === OptionCategory.Engine);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">1. Lépés: Motor kiválasztása</h2>
        <p className="text-sm text-slate-600 mt-1">
          Válassza ki a jármű hajtásláncát. Motorcserénél a rendszer megőrzi a korábban kiválasztott
          extrákat, és azonnal jelzi az esetleges kompatibilitási ütközéseket.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {engines.map((engine) => {
          const selected = engineOptionId === engine.id;
          const hasConflict = isOptionConflicting(engine.id);
          const conflictMessages = getOptionConflictMessages(engine.id);

          return (
            <button
              key={engine.id}
              type="button"
              onClick={() => selectEngine(engine.id)}
              className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                selected && hasConflict
                  ? 'border-red-500 bg-red-50/70 shadow-xs'
                  : selected
                  ? 'border-indigo-600 bg-indigo-50/60 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-900">{engine.name}</span>
                {hasConflict ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-red-200 text-red-900">
                    ⚠ Ütközés
                  </span>
                ) : (
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    ID: {engine.id}
                  </span>
                )}
              </div>
              <div className="text-lg font-extrabold text-indigo-700 mt-2">
                {formatHuf(engine.price)}
              </div>
              {conflictMessages.length > 0 && (
                <div className="mt-2 text-xs text-red-700 font-medium">
                  {conflictMessages.join(' ')}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
};
