import React from 'react';
import { formatHuf, useConfigurator } from '../../context/ConfiguratorContext';
import { OptionCategory } from '../../types/configurator';

const WINTER_PACKAGE_CODES = new Set([
  'EXT_WINTER_SEATS',
  'EXT_WINTER_WHEEL',
  'EXT_WINTER_WINDSHIELD',
]);

export const ExtrasStep: React.FC = () => {
  const {
    options,
    isOptionSelected,
    isOptionConflicting,
    getOptionConflictMessages,
    toggleMultiCategoryOption,
    evaluation,
  } = useConfigurator();

  const allExtras = options.filter((o) => o.category === OptionCategory.Extra);
  const standardExtras = allExtras.filter((o) => !WINTER_PACKAGE_CODES.has(o.code));
  const winterExtras = allExtras.filter((o) => WINTER_PACKAGE_CODES.has(o.code));

  const isWinterDiscountActive =
    (evaluation?.appliedDiscounts.includes('Téli csomag') ?? false) &&
    (evaluation?.discountAmount ?? 0) > 0;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          4. Lépés: Kényelmi és technológiai extrák
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Válassza ki a kívánt kiegészítőket. Figyelem: a „Prémium hangrendszer” a „Nagy navigáció”
          meglétét igényli, a „Sportfutómű” pedig nem kombinálható az „Alap motorral”.
        </p>
      </div>

      {/* Technológiai és futómű extrák */}
      <div className="space-y-2.5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Multimédia és futómű
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {standardExtras.map((extra) => {
            const selected = isOptionSelected(extra.id);
            const hasConflict = isOptionConflicting(extra.id);
            const conflictMessages = getOptionConflictMessages(extra.id);

            return (
              <button
                key={extra.id}
                type="button"
                onClick={() => toggleMultiCategoryOption(extra.id)}
                className={`text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                  selected && hasConflict
                    ? 'border-red-500 bg-red-50/70'
                    : !selected && hasConflict
                    ? 'border-amber-400 bg-amber-50/60'
                    : selected
                    ? 'border-indigo-600 bg-indigo-50/60'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-bold text-slate-900">{extra.name}</span>
                  {hasConflict && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        selected
                          ? 'bg-red-200 text-red-900'
                          : 'bg-amber-200 text-amber-900'
                      }`}
                    >
                      {selected ? '⚠ Ütközés' : '⚠ Kötelező előfeltétel'}
                    </span>
                  )}
                </div>
                <div className="text-sm font-semibold text-indigo-700 mt-1">
                  + {formatHuf(extra.price)}
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

      {/* Téli csomag szekció (dinamikus kedvezménykijelzéssel az evaluation.discountAmount alapján) */}
      <div className="rounded-xl border-2 border-sky-200 bg-sky-50/50 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-sky-950">Téli csomag opciók</h3>
            <p className="text-xs text-sky-800">
              Mindhárom elem együttes kiválasztásakor 20% csomagkedvezmény jár!
            </p>
          </div>
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              isWinterDiscountActive
                ? 'bg-emerald-600 text-white'
                : 'bg-sky-200/80 text-sky-900'
            }`}
          >
            {isWinterDiscountActive && evaluation
              ? `✓ Téli csomag kedvezmény aktív (- ${formatHuf(evaluation.discountAmount)})`
              : 'Válassza ki mindhármat a 20% kedvezményhez'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {winterExtras.map((item) => {
            const selected = isOptionSelected(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleMultiCategoryOption(item.id)}
                className={`text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                  selected
                    ? 'border-sky-600 bg-white shadow-xs'
                    : 'border-slate-200 bg-white/80 hover:border-slate-300'
                }`}
              >
                <div className="font-bold text-slate-900">{item.name}</div>
                <div className="text-sm font-semibold text-sky-700 mt-1">
                  + {formatHuf(item.price)}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
