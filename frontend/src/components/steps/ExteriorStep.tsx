import React from 'react';
import { formatHuf, useConfigurator } from '../../context/ConfiguratorContext';
import { OptionCategory } from '../../types/configurator';

export const ExteriorStep: React.FC = () => {
  const {
    options,
    isOptionSelected,
    isOptionConflicting,
    getOptionConflictMessages,
    selectSingleCategoryOption,
    toggleMultiCategoryOption,
  } = useConfigurator();

  const colors = options.filter((o) => o.category === OptionCategory.ExteriorColor);
  const rims = options.filter((o) => o.category === OptionCategory.Rim);
  const opticalExtras = options.filter((o) => o.category === OptionCategory.ExteriorOptical);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">2. Lépés: Külső megjelenés</h2>
        <p className="text-sm text-slate-600 mt-1">
          Válasszon fényezést, felnit és opcionális külső optikai elemeket. A külső opciók azonnal
          frissítik a jobb oldali 2D előnézet rétegeit.
        </p>
      </div>

      {/* Fényezés (Egyszeres választás, z-index: 20) */}
      <div className="space-y-2.5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Fényezés (1 választható, z-index: 20)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {colors.map((color) => {
            const selected = isOptionSelected(color.id);
            const hasConflict = isOptionConflicting(color.id);
            return (
              <button
                key={color.id}
                type="button"
                onClick={() => selectSingleCategoryOption(OptionCategory.ExteriorColor, color.id)}
                className={`text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                  selected && hasConflict
                    ? 'border-red-500 bg-red-50/70'
                    : selected
                    ? 'border-indigo-600 bg-indigo-50/60'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="font-bold text-slate-900">{color.name}</div>
                <div className="text-sm font-semibold text-indigo-700 mt-1">
                  {color.price === 0 ? 'Alapárban (0 Ft)' : `+ ${formatHuf(color.price)}`}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Felnik (Egyszeres választás, z-index: 30) */}
      <div className="space-y-2.5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Felnik (1 választható, z-index: 30)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {rims.map((rim) => {
            const selected = isOptionSelected(rim.id);
            const hasConflict = isOptionConflicting(rim.id);
            return (
              <button
                key={rim.id}
                type="button"
                onClick={() => selectSingleCategoryOption(OptionCategory.Rim, rim.id)}
                className={`text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                  selected && hasConflict
                    ? 'border-red-500 bg-red-50/70'
                    : selected
                    ? 'border-indigo-600 bg-indigo-50/60'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="font-bold text-slate-900">{rim.name}</div>
                <div className="text-sm font-semibold text-indigo-700 mt-1">
                  {rim.price === 0 ? 'Alapárban (0 Ft)' : `+ ${formatHuf(rim.price)}`}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Külső optikai elemek (Többszörös választás, kizárás ellenőrzéssel, z-index: 40) */}
      <div className="space-y-2.5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Külső optikai és funkcionális elemek (z-index: 40)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {opticalExtras.map((opt) => {
            const selected = isOptionSelected(opt.id);
            const hasConflict = isOptionConflicting(opt.id);
            const conflictMessages = getOptionConflictMessages(opt.id);

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleMultiCategoryOption(opt.id)}
                className={`text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                  selected && hasConflict
                    ? 'border-red-500 bg-red-50/70'
                    : selected
                    ? 'border-indigo-600 bg-indigo-50/60'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900">{opt.name}</span>
                  {hasConflict ? (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-red-200 text-red-900">
                      ⚠ Kizáró ütközés
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-slate-500">
                      {selected ? 'Kiválasztva' : 'Választható'}
                    </span>
                  )}
                </div>
                <div className="text-sm font-semibold text-indigo-700 mt-1">
                  + {formatHuf(opt.price)}
                </div>
                {conflictMessages.length > 0 && (
                  <div className="mt-1.5 text-xs text-red-700 font-medium">
                    {conflictMessages.join(' ')}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
