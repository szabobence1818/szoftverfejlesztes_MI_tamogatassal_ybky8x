import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteSavedConfiguration,
  evaluateConfiguration,
  fetchAvailableOptions,
  fetchSavedConfigurationById,
  fetchUserConfigurations,
  saveConfiguration,
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

  // Opcióválasztó műveletek (Néma törlés nélkül!)
  selectEngine: (engineId: number) => void;
  selectSingleCategoryOption: (category: OptionCategory, optionId: number) => void;
  toggleMultiCategoryOption: (optionId: number) => void;
  isOptionSelected: (optionId: number) => boolean;

  // Mock Bejelentkezés szimuláció (Vendég vs. Bejelentkezett felhasználó tokennel) és mentések
  currentUser: UserSession;
  loginAsMockUser: (userId: string, displayName: string) => void;
  logoutToGuest: () => void;
  savedConfigurations: SavedConfigurationDto[];
  loadedConfiguration: SavedConfigurationDto | null;
  saveCurrentConfiguration: (name: string) => Promise<SavedConfigurationDto>;
  loadSavedConfiguration: (id: number) => Promise<SavedConfigurationDto>;
  removeSavedConfiguration: (id: number) => Promise<void>;
  refreshSavedConfigurations: () => Promise<void>;
}

const ConfiguratorContext = createContext<ConfiguratorContextValue | undefined>(undefined);

const DEFAULT_ENGINE_ID = 1; // Alap motor (10 000 000 Ft)
const DEFAULT_SELECTED_OPTION_IDS = [10, 20, 40]; // Alap fehér szín (z:20), 17" Alap felni (z:30), Szövet kárpit

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

export const ConfiguratorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeStep, setActiveStep] = useState<ConfiguratorStepId>('engine');
  const [options, setOptions] = useState<OptionDto[]>([]);
  const [engineOptionId, setEngineOptionId] = useState<number | null>(DEFAULT_ENGINE_ID);
  const [selectedOptionIds, setSelectedOptionIds] = useState<number[]>(DEFAULT_SELECTED_OPTION_IDS);
  const [evaluation, setEvaluation] = useState<ConfigurationEvaluationResultDto | null>(null);
  const [visualLayers, setVisualLayers] = useState<LayerPreviewDto[]>([]);
  const previousLayersRef = useRef<LayerPreviewDto[]>([]);

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

  // 1. Elérhető opciók betöltése induláskor
  useEffect(() => {
    let isMounted = true;
    setIsLoadingOptions(true);
    fetchAvailableOptions()
      .then((loadedOptions) => {
        if (!isMounted) return;
        setOptions(loadedOptions);
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
  // Referencia-stabilitás: a visualLayers tömb referenciája csak akkor frissül, ha a külső 2D rétegek ténylegesen változtak!
  useEffect(() => {
    let isMounted = true;
    setIsEvaluating(true);

    evaluateConfiguration({
      engineOptionId,
      selectedOptionIds,
    })
      .then((evalResult) => {
        if (!isMounted) return;
        setEvaluation(evalResult);
        const nextLayers = evalResult.visualLayers ?? [];
        if (!areLayersEqual(previousLayersRef.current, nextLayers)) {
          previousLayersRef.current = nextLayers;
          setVisualLayers(nextLayers);
        }
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
  }, [engineOptionId, selectedOptionIds]);

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

  const loadSavedConfiguration = useCallback(
    async (id: number): Promise<SavedConfigurationDto> => {
      const loaded = await fetchSavedConfigurationById(id, currentUser);
      setLoadedConfiguration(loaded);
      setEngineOptionId(loaded.engineOptionId);
      setSelectedOptionIds(loaded.selectedOptionIds);
      if (loaded.currentEvaluation) {
        setEvaluation(loaded.currentEvaluation);
      }
      return loaded;
    },
    [currentUser]
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
      currentUser,
      loginAsMockUser,
      logoutToGuest,
      savedConfigurations,
      loadedConfiguration,
      saveCurrentConfiguration,
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
      currentUser,
      loginAsMockUser,
      logoutToGuest,
      savedConfigurations,
      loadedConfiguration,
      saveCurrentConfiguration,
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
