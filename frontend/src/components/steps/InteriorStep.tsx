import React from 'react';
import { formatHuf, useConfigurator } from '../../context/ConfiguratorContext';
import { OptionCategory } from '../../types/configurator';

export const InteriorStep: React.FC = () => {
  const { options, isOptionSelected, selectSingleCategoryOption } = useConfigurator();
  const interiors = options.filter((o) => o.category === OptionCategory.Interior);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">3. Lépés: Belső tér és kárpitozás</h2>
        <p className="text-sm text-slate-600 mt-1">
          Válassza ki az utastér kárpitozását (egyszerre egy kárpitozás választható).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {interiors.map((item) => {
          const selected = isOptionSelected(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => selectSingleCategoryOption(OptionCategory.Interior, item.id)}
              className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                selected
                  ? 'border-indigo-600 bg-indigo-50/60'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="font-bold text-slate-900">{item.name}</div>
              <div className="text-sm font-semibold text-indigo-700 mt-1">
                {item.price === 0 ? 'Alapárban (0 Ft)' : `+ ${formatHuf(item.price)}`}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
