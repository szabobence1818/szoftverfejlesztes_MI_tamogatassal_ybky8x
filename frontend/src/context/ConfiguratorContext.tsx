import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteSavedConfiguration,
  evaluateConfiguration,
  fetchAvailableOptions,
  fetchSavedConfigurationById,
  fetchUserConfigurations,
  saveConfiguration,
  updateSavedConfiguration,
} from '../api/configuratorApi';
import {
  CONFIGURATOR_STEPS,
  ConfigurationEvaluationResultDto,
  ConfiguratorStepId,
  LayerPreviewDto,
  OptionCategory,
  OptionDto,
  SavedConfigurationDto,
  UserSession,
} from '../types/configurator';

interface ConfiguratorContextValue {
  // Lépéskezelés
  activeStep: ConfiguratorStepId;
  setActiveStep: (step: ConfiguratorStepId) => void;
  nextStep: () => void;
  prevStep: () => void;

  // Katalógus és választott állapot
  options: OptionDto[];
  engineOptionId: number | null;
  selectedOptionIds: number[];
  evaluation: ConfigurationEvaluationResultDto | null;
  visualLayers: LayerPreviewDto[];
  isLoadingOptions: boolean;
  isEvaluating: boolean;
  apiError: string | null;

  // Opcióválasztó műveletek (Néma törlés nélkül!) és ütközés-lekérdezők
  selectEngine: (engineId: number) => void;
  selectSingleCategoryOption: (category: OptionCategory, optionId: number) => void;
  toggleMultiCategoryOption: (optionId: number) => void;
  isOptionSelected: (optionId: number) => boolean;
  isOptionConflicting: (optionId: number) => boolean;
  getOptionConflictMessages: (optionId: number) => string[];
  doesStepHaveConflict: (stepId: ConfiguratorStepId) => boolean;

  // Mock Bejelentkezés szimuláció (Vendég vs. Bejelentkezett felhasználó tokennel) és mentések CRUD
  currentUser: UserSession;
  loginAsMockUser: (userId: string, displayName: string) => void;
  logoutToGuest: () => void;
  savedConfigurations: SavedConfigurationDto[];
  loadedConfiguration: SavedConfigurationDto | null;
  isLoadedConfigDirty: boolean;
  saveCurrentConfiguration: (name: string) => Promise<SavedConfigurationDto>;
  updateCurrentConfiguration: (id: number, name: string) => Promise<SavedConfigurationDto>;
  loadSavedConfiguration: (id: number) => Promise<SavedConfigurationDto>;
  removeSavedConfiguration: (id: number) => Promise<void>;
  refreshSavedConfigurations: () => Promise<void>;
}

const ConfiguratorContext = createContext<ConfiguratorContextValue | undefined>(undefined);

const FALLBACK_ENGINE_ID = 1;
const FALLBACK_SELECTED_OPTION_IDS = [10, 20, 40];

function areLayersEqual(a: LayerPreviewDto[], b: LayerPreviewDto[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].optionId !== b[i].optionId ||
      a[i].zIndex !== b[i].zIndex ||
      a[i].layerImageUrl !== b[i].layerImageUrl
    ) {
      return false;
    }
  }
  return true;
}

function preloadLayerImages(loadedOptions: OptionDto[]): void {
  if (typeof window === 'undefined' || typeof Image === 'undefined') return;
  const urls = new Set<string>(['/layers/base-body.svg']);
  for (const opt of loadedOptions) {
    if (opt.layerImageUrl) {
      urls.add(opt.layerImageUrl);
    }
  }
  urls.forEach((url) => {
    const img = new Image();
    img.src = url;
  });
}

export const ConfiguratorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeStep, setActiveStep] = useState<ConfiguratorStepId>('engine');
  const [options, setOptions] = useState<OptionDto[]>([]);
  const [engineOptionId, setEngineOptionId] = useState<number | null>(FALLBACK_ENGINE_ID);
  const [selectedOptionIds, setSelectedOptionIds] = useState<number[]>(FALLBACK_SELECTED_OPTION_IDS);
  const [evaluation, setEvaluation] = useState<ConfigurationEvaluationResultDto | null>(null);
  const [visualLayers, setVisualLayers] = useState<LayerPreviewDto[]>([]);
  const previousLayersRef = useRef<LayerPreviewDto[]>([]);
  const skipNextEvaluationRef = useRef<boolean>(false);

  const [isLoadingOptions, setIsLoadingOptions] = useState<boolean>(true);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<UserSession>({
    userId: null,
    displayName: 'Vendég (Kijelentkezve)',
    token: null,
    isGuest: true,
  });

  const [savedConfigurations, setSavedConfigurations] = useState<SavedConfigurationDto[]>([]);
  const [loadedConfiguration, setLoadedConfiguration] = useState<SavedConfigurationDto | null>(null);

  const applyVisualLayersIfChanged = useCallback((nextLayers: LayerPreviewDto[]) => {
    if (!areLayersEqual(previousLayersRef.current, nextLayers)) {
      previousLayersRef.current = nextLayers;
      setVisualLayers(nextLayers);
    }
  }, []);

  // 1. Elérhető opciók betöltése induláskor + 2D SVG rétegek háttérbeli előtöltése (preload)
  useEffect(() => {
    let isMounted = true;
    setIsLoadingOptions(true);
    fetchAvailableOptions()
      .then((loadedOptions) => {
        if (!isMounted) return;
        setOptions(loadedOptions);
        preloadLayerImages(loadedOptions);
        setApiError(null);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setApiError(err instanceof Error ? err.message : 'Hiba az opciók lekérésekor.');
      })
      .finally(() => {
        if (isMounted) setIsLoadingOptions(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Valós idejű árkalkuláció és validáció minden opcióváltáskor
  useEffect(() => {
    if (skipNextEvaluationRef.current) {
      skipNextEvaluationRef.current = false;
      return;
    }

    let isMounted = true;
    setIsEvaluating(true);

    evaluateConfiguration({
      engineOptionId,
      selectedOptionIds,
    })
      .then((evalResult) => {
        if (!isMounted) return;
        setEvaluation(evalResult);
        applyVisualLayersIfChanged(evalResult.visualLayers ?? []);
        setApiError(null);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setApiError(err instanceof Error ? err.message : 'Hiba a konfiguráció kiértékelésekor.');
      })
      .finally(() => {
        if (isMounted) setIsEvaluating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [engineOptionId, selectedOptionIds, applyVisualLayersIfChanged]);

  const refreshSavedConfigurations = useCallback(async () => {
    if (currentUser.isGuest || !currentUser.userId) {
      setSavedConfigurations([]);
      return;
    }
    try {
      const list = await fetchUserConfigurations(currentUser);
      setSavedConfigurations(list);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Hiba a mentések lekérésekor.');
    }
  }, [currentUser]);

  useEffect(() => {
    void refreshSavedConfigurations();
  }, [refreshSavedConfigurations]);

  const nextStep = useCallback(() => {
    const currentIndex = CONFIGURATOR_STEPS.findIndex((s) => s.id === activeStep);
    if (currentIndex >= 0 && currentIndex < CONFIGURATOR_STEPS.length - 1) {
      setActiveStep(CONFIGURATOR_STEPS[currentIndex + 1].id);
    }
  }, [activeStep]);

  const prevStep = useCallback(() => {
    const currentIndex = CONFIGURATOR_STEPS.findIndex((s) => s.id === activeStep);
    if (currentIndex > 0) {
      setActiveStep(CONFIGURATOR_STEPS[currentIndex - 1].id);
    }
  }, [activeStep]);

  // Motor választása: SZIGORÚ SZABÁLY (AGENTS.md 6. pont) – nem töröljük némán a már kiválasztott extrákat!
  const selectEngine = useCallback((newEngineId: number) => {
    setEngineOptionId(newEngineId);
  }, []);

  // Egyszeres választású kategória (Szín, Felni, Belső kárpit) cseréje az adott kategórián belül
  const selectSingleCategoryOption = useCallback(
    (category: OptionCategory, optionId: number) => {
      setSelectedOptionIds((prev) => {
        const categoryOptionIds = new Set(
          options.filter((o) => o.category === category).map((o) => o.id)
        );
        const filtered = prev.filter((id) => !categoryOptionIds.has(id));
        return [...filtered, optionId];
      });
    },
    [options]
  );

  // Többszörös választású opciók (Külső optikai elemek, Extrák) ki/bekapcsolása néma törlés nélkül
  const toggleMultiCategoryOption = useCallback((optionId: number) => {
    setSelectedOptionIds((prev) =>
      prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
    );
  }, []);

  const isOptionSelected = useCallback(
    (optionId: number) => engineOptionId === optionId || selectedOptionIds.includes(optionId),
    [engineOptionId, selectedOptionIds]
  );

  // Ütköző opciók (affectedOptionIds) követése a kártyák és a StepNavigator vizuális jelöléséhez
  const conflictingOptionIds = useMemo(() => {
    const set = new Set<number>();
    if (!evaluation || evaluation.isValid) return set;
    for (const err of evaluation.errors) {
      for (const id of err.affectedOptionIds) {
        set.add(id);
      }
    }
    return set;
  }, [evaluation]);

  const isOptionConflicting = useCallback(
    (optionId: number) => conflictingOptionIds.has(optionId),
    [conflictingOptionIds]
  );

  const getOptionConflictMessages = useCallback(
    (optionId: number): string[] => {
      if (!evaluation || evaluation.isValid) return [];
      return evaluation.errors
        .filter((err) => err.affectedOptionIds.includes(optionId))
        .map((err) => err.message);
    },
    [evaluation]
  );

  const doesStepHaveConflict = useCallback(
    (stepId: ConfiguratorStepId): boolean => {
      if (!evaluation || evaluation.isValid) return false;
      if (stepId === 'summary') return true;

      for (const opt of options) {
        if (!conflictingOptionIds.has(opt.id)) continue;
        if (stepId === 'engine' && opt.category === OptionCategory.Engine) return true;
        if (
          stepId === 'exterior' &&
          (opt.category === OptionCategory.ExteriorColor ||
            opt.category === OptionCategory.Rim ||
            opt.category === OptionCategory.ExteriorOptical)
        ) {
          return true;
        }
        if (stepId === 'interior' && opt.category === OptionCategory.Interior) return true;
        if (stepId === 'extras' && opt.category === OptionCategory.Extra) return true;
      }

      return false;
    },
    [evaluation, options, conflictingOptionIds]
  );

  // Jelzi, ha a visszatöltött mentéshez képest a felhasználó módosított bármilyen opciót
  const isLoadedConfigDirty = useMemo(() => {
    if (!loadedConfiguration) return false;
    if (loadedConfiguration.engineOptionId !== engineOptionId) return true;
    const a = [...loadedConfiguration.selectedOptionIds].sort((x, y) => x - y);
    const b = [...selectedOptionIds].sort((x, y) => x - y);
    if (a.length !== b.length) return true;
    return a.some((val, idx) => val !== b[idx]);
  }, [loadedConfiguration, engineOptionId, selectedOptionIds]);

  const loginAsMockUser = useCallback((userId: string, displayName: string) => {
    setCurrentUser({
      userId,
      displayName,
      token: `mock-jwt-token-${userId}`,
      isGuest: false,
    });
    setLoadedConfiguration(null);
  }, []);

  const logoutToGuest = useCallback(() => {
    setCurrentUser({
      userId: null,
      displayName: 'Vendég (Kijelentkezve)',
      token: null,
      isGuest: true,
    });
    setLoadedConfiguration(null);
  }, []);

  const saveCurrentConfiguration = useCallback(
    async (name: string): Promise<SavedConfigurationDto> => {
      const saved = await saveConfiguration(
        {
          name,
          engineOptionId,
          selectedOptionIds,
        },
        currentUser
      );
      setLoadedConfiguration(saved);
      await refreshSavedConfigurations();
      return saved;
    },
    [engineOptionId, selectedOptionIds, currentUser, refreshSavedConfigurations]
  );

  const updateCurrentConfiguration = useCallback(
    async (id: number, name: string): Promise<SavedConfigurationDto> => {
      const updated = await updateSavedConfiguration(
        id,
        {
          name,
          engineOptionId,
          selectedOptionIds,
        },
        currentUser
      );
      setLoadedConfiguration(updated);
      if (updated.currentEvaluation) {
        setEvaluation(updated.currentEvaluation);
        applyVisualLayersIfChanged(updated.currentEvaluation.visualLayers ?? []);
      }
      await refreshSavedConfigurations();
      return updated;
    },
    [engineOptionId, selectedOptionIds, currentUser, refreshSavedConfigurations, applyVisualLayersIfChanged]
  );

  const loadSavedConfiguration = useCallback(
    async (id: number): Promise<SavedConfigurationDto> => {
      const loaded = await fetchSavedConfigurationById(id, currentUser);
      setLoadedConfiguration(loaded);

      if (loaded.currentEvaluation) {
        skipNextEvaluationRef.current = true;
        setEvaluation(loaded.currentEvaluation);
        applyVisualLayersIfChanged(loaded.currentEvaluation.visualLayers ?? []);
      }

      setEngineOptionId(loaded.engineOptionId);
      setSelectedOptionIds(loaded.selectedOptionIds);
      return loaded;
    },
    [currentUser, applyVisualLayersIfChanged]
  );

  const removeSavedConfiguration = useCallback(
    async (id: number): Promise<void> => {
      await deleteSavedConfiguration(id, currentUser);
      if (loadedConfiguration?.id === id) {
        setLoadedConfiguration(null);
      }
      await refreshSavedConfigurations();
    },
    [currentUser, loadedConfiguration, refreshSavedConfigurations]
  );

  const value = useMemo<ConfiguratorContextValue>(
    () => ({
      activeStep,
      setActiveStep,
      nextStep,
      prevStep,
      options,
      engineOptionId,
      selectedOptionIds,
      evaluation,
      visualLayers,
      isLoadingOptions,
      isEvaluating,
      apiError,
      selectEngine,
      selectSingleCategoryOption,
      toggleMultiCategoryOption,
      isOptionSelected,
      isOptionConflicting,
      getOptionConflictMessages,
      doesStepHaveConflict,
      currentUser,
      loginAsMockUser,
      logoutToGuest,
      savedConfigurations,
      loadedConfiguration,
      isLoadedConfigDirty,
      saveCurrentConfiguration,
      updateCurrentConfiguration,
      loadSavedConfiguration,
      removeSavedConfiguration,
      refreshSavedConfigurations,
    }),
    [
      activeStep,
      nextStep,
      prevStep,
      options,
      engineOptionId,
      selectedOptionIds,
      evaluation,
      visualLayers,
      isLoadingOptions,
      isEvaluating,
      apiError,
      selectEngine,
      selectSingleCategoryOption,
      toggleMultiCategoryOption,
      isOptionSelected,
      isOptionConflicting,
      getOptionConflictMessages,
      doesStepHaveConflict,
      currentUser,
      loginAsMockUser,
      logoutToGuest,
      savedConfigurations,
      loadedConfiguration,
      isLoadedConfigDirty,
      saveCurrentConfiguration,
      updateCurrentConfiguration,
      loadSavedConfiguration,
      removeSavedConfiguration,
      refreshSavedConfigurations,
    ]
  );

  return <ConfiguratorContext.Provider value={value}>{children}</ConfiguratorContext.Provider>;
};

export function useConfigurator(): ConfiguratorContextValue {
  const context = useContext(ConfiguratorContext);
  if (!context) {
    throw new Error('A useConfigurator hook csak ConfiguratorProvider-en belül használható.');
  }
  return context;
}

export function formatHuf(amount: number): string {
  return `${amount.toLocaleString('hu-HU')} Ft`;
}
