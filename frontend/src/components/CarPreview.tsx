import React, { useMemo } from 'react';
import { formatHuf, useConfigurator } from '../context/ConfiguratorContext';
import { LayerPreviewDto } from '../types/configurator';

/**
 * Memoizált egyedi 2D réteg képkomponens:
 * Csak akkor renderelődik újra, ha a réteg URL-je vagy z-index értéke változik.
 */
const CarLayerImage: React.FC<{
  src: string;
  alt: string;
  zIndex: number;
}> = React.memo(({ src, alt, zIndex }) => {
  return (
    <img
      src={src}
      alt={alt}
      style={{ zIndex }}
      className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none transition-opacity duration-200"
      draggable={false}
    />
  );
});
CarLayerImage.displayName = 'CarLayerImage';

/**
 * Memoizált 2D réteg-vászon (Canvas):
 * Fülváltáskor (activeStep változásakor) vagy belső/extra opciók kiválasztásakor
 * NEM renderelődik újra, mivel a visualLayers referenciája változatlan marad.
 *
 * Determinisztikus rétegsorrend (SPECIFICATION.md 7. elfogadási feltétel):
 * - alap_karosszéria [z-index: 10] (/layers/base-body.svg)
 * - fényezés         [z-index: 20] (/layers/color-*.svg)
 * - felnik           [z-index: 30] (/layers/rim-*.svg)
 * - optikai_extrák   [z-index: 40] (/layers/opt-*.svg, másodlagos kulcs: optionId)
 */
const LayeredCarCanvas: React.FC<{ layers: LayerPreviewDto[] }> = React.memo(({ layers }) => {
  const sortedLayers = useMemo(
    () =>
      [...layers].sort(
        (a, b) => a.zIndex - b.zIndex || a.optionId - b.optionId
      ),
    [layers]
  );

  return (
    <div className="space-y-3">
      <div
        data-testid="car-preview-canvas"
        className="relative w-full aspect-2/1 rounded-xl bg-gradient-to-b from-slate-100 via-slate-50 to-slate-200 border border-slate-200 overflow-hidden shadow-inner"
      >
        {/* Fix alap karosszéria réteg (z-index: 10) */}
        <CarLayerImage
          src="/layers/base-body.svg"
          alt="Alap karosszéria (z-index: 10)"
          zIndex={10}
        />

        {/* Dinamikus külső opciós rétegek (z-index: 20 -> 30 -> 40, determinisztikus sorrendben) */}
        {sortedLayers.map((layer) => (
          <CarLayerImage
            key={`${layer.optionId}-${layer.zIndex}`}
            src={layer.layerImageUrl}
            alt={`${layer.optionName} (z-index: ${layer.zIndex})`}
            zIndex={layer.zIndex}
          />
        ))}

        {/* Z-index rétegjelző badge a vászon sarkában */}
        <div
          style={{ zIndex: 50 }}
          className="absolute top-2.5 right-2.5 bg-slate-900/80 backdrop-blur-xs text-white text-[11px] font-mono px-2.5 py-1 rounded-md"
        >
          1 alap + {sortedLayers.length} dinamikus réteg
        </div>
      </div>

      {/* Aktív CSS z-index réteg-hierarchia áttekintés */}
      <div className="bg-slate-50 rounded-lg border border-slate-200 p-2.5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
          Aktív 2D réteg-hierarchia (CSS z-index)
        </div>
        <ul className="space-y-1 text-xs">
          <li className="flex items-center justify-between text-slate-600 bg-white px-2 py-1 rounded border border-slate-200">
            <span className="font-medium">Alap karosszéria</span>
            <span className="font-mono text-[11px] text-slate-500">
              z-index: 10 (/layers/base-body.svg)
            </span>
          </li>
          {sortedLayers.map((layer) => (
            <li
              key={layer.optionId}
              className="flex items-center justify-between text-slate-800 bg-white px-2 py-1 rounded border border-indigo-100"
            >
              <span className="font-semibold text-indigo-950">{layer.optionName}</span>
              <span className="font-mono text-[11px] text-indigo-700">
                z-index: {layer.zIndex} ({layer.layerImageUrl})
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
});
LayeredCarCanvas.displayName = 'LayeredCarCanvas';

export const CarPreview: React.FC = () => {
  const { visualLayers, evaluation, isEvaluating } = useConfigurator();

  return (
    <aside className="sticky top-6 space-y-4">
      {/* 2D Rétegelt Jármű Előnézet (Fixen látható a fülváltások során is) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Élő 2D Rétegelt Előnézet</h2>
            <p className="text-xs text-slate-500">
              Fülváltáskor is megmaradó, `z-index` alapú SVG rétegek
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
            z:10 → z:20 → z:30 → z:40
          </span>
        </div>

        <LayeredCarCanvas layers={visualLayers} />
      </div>

      {/* Valós idejű árkalkuláció és validációs státusz */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Valós idejű árkalkuláció</h2>
          {isEvaluating && (
            <span className="text-xs text-indigo-600 font-semibold animate-pulse">
              Kalkuláció...
            </span>
          )}
        </div>

        {evaluation && (
          <>
            <div className="space-y-1.5 text-sm border-t border-b border-slate-100 py-3">
              <div className="flex justify-between text-slate-600">
                <span>Alapár (Motor):</span>
                <span className="font-semibold text-slate-900">
                  {formatHuf(evaluation.basePrice)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Választott opciók:</span>
                <span className="font-semibold text-slate-900">
                  + {formatHuf(evaluation.optionsPrice)}
                </span>
              </div>
              {evaluation.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Kedvezmény ({evaluation.appliedDiscounts.join(', ')}):</span>
                  <span>- {formatHuf(evaluation.discountAmount)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-baseline pt-1">
              <span className="text-sm font-bold text-slate-700">Végösszeg:</span>
              <span className="text-2xl font-extrabold text-indigo-700">
                {formatHuf(evaluation.totalPrice)}
              </span>
            </div>

            {/* Validációs állapot jelzése */}
            {evaluation.isValid ? (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800 font-medium">
                ✓ A konfiguráció érvényes (`IsValid = true`).
              </div>
            ) : (
              <div className="rounded-lg bg-red-50 border border-red-300 p-3 space-y-1.5">
                <div className="text-xs font-bold text-red-800">
                  ⚠ Ütközés vagy hiányzó előfeltétel (`IsValid = false`):
                </div>
                <ul className="list-disc list-inside text-xs text-red-700 space-y-1">
                  {evaluation.errors.map((err, idx) => (
                    <li key={`${err.code}-${idx}`}>
                      <span className="font-mono font-semibold">[{err.code}]</span> {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
};
