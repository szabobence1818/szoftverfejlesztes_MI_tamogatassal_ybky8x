export enum OptionCategory {
  Engine = 1,
  ExteriorColor = 2,
  Rim = 3,
  ExteriorOptical = 4,
  Interior = 5,
  Extra = 6,
}

export type ConfiguratorStepId = 'engine' | 'exterior' | 'interior' | 'extras' | 'summary';

export interface StepDefinition {
  id: ConfiguratorStepId;
  order: number;
  label: string;
  description: string;
}

export const CONFIGURATOR_STEPS: StepDefinition[] = [
  { id: 'engine', order: 1, label: '1. Motor', description: 'Hajtáslánc kiválasztása' },
  { id: 'exterior', order: 2, label: '2. Külső', description: 'Fényezés, felnik és optikai elemek' },
  { id: 'interior', order: 3, label: '3. Belső', description: 'Utastér kárpitozása' },
  { id: 'extras', order: 4, label: '4. Extrák', description: 'Kényelmi csomagok és technológia' },
  { id: 'summary', order: 5, label: '5. Összegzés', description: 'Áttekintés, validáció és mentés' },
];

export interface OptionDto {
  id: number;
  code: string;
  name: string;
  category: OptionCategory;
  price: number;
  layerImageUrl?: string | null;
  zIndex?: number | null;
}

export interface ConfigurationRequestDto {
  engineOptionId: number | null;
  selectedOptionIds: number[];
}

export interface ValidationIssueDto {
  code: string;
  message: string;
  affectedOptionIds: number[];
}

export interface LayerPreviewDto {
  optionId: number;
  optionName: string;
  category: OptionCategory;
  layerImageUrl: string;
  zIndex: number;
}

export interface ConfigurationEvaluationResultDto {
  isValid: boolean;
  hasInvalidInput: boolean;
  canSave: boolean;
  engineOptionId: number | null;
  selectedOptionIds: number[];
  basePrice: number;
  optionsPrice: number;
  discountAmount: number;
  totalPrice: number;
  appliedDiscounts: string[];
  errors: ValidationIssueDto[];
  visualLayers: LayerPreviewDto[];
}

export interface SaveConfigurationRequestDto {
  name: string;
  engineOptionId: number | null;
  selectedOptionIds: number[];
}

export interface SavedConfigurationDto {
  id: number;
  name: string;
  userId: string;
  engineOptionId: number;
  selectedOptionIds: number[];
  savedTotalPrice: number;
  currentEvaluation?: ConfigurationEvaluationResultDto | null;
}

export interface UserSession {
  userId: string | null;
  displayName: string;
  token: string | null;
  isGuest: boolean;
}
