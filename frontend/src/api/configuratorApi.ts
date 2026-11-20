import {
  ConfigurationEvaluationResultDto,
  ConfigurationRequestDto,
  OptionDto,
  SaveConfigurationRequestDto,
  SavedConfigurationDto,
  UserSession,
} from '../types/configurator';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/configurations';

export class ApiHttpError extends Error {
  public readonly statusCode: number;
  public readonly validationResult?: ConfigurationEvaluationResultDto;

  constructor(
    statusCode: number,
    message: string,
    validationResult?: ConfigurationEvaluationResultDto
  ) {
    super(message);
    this.name = 'ApiHttpError';
    this.statusCode = statusCode;
    this.validationResult = validationResult;
  }
}

function buildAuthHeaders(session: UserSession): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (session.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
  }
  if (session.userId) {
    headers['X-User-Id'] = session.userId;
  }

  return headers;
}

function normalizeEvaluationResult(raw: unknown): ConfigurationEvaluationResultDto {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Partial<ConfigurationEvaluationResultDto>;
  return {
    isValid: Boolean(obj.isValid),
    hasInvalidInput: Boolean(obj.hasInvalidInput),
    canSave: Boolean(obj.canSave),
    engineOptionId: typeof obj.engineOptionId === 'number' ? obj.engineOptionId : null,
    selectedOptionIds: Array.isArray(obj.selectedOptionIds) ? obj.selectedOptionIds : [],
    basePrice: typeof obj.basePrice === 'number' ? obj.basePrice : 0,
    optionsPrice: typeof obj.optionsPrice === 'number' ? obj.optionsPrice : 0,
    discountAmount: typeof obj.discountAmount === 'number' ? obj.discountAmount : 0,
    totalPrice: typeof obj.totalPrice === 'number' ? obj.totalPrice : 0,
    appliedDiscounts: Array.isArray(obj.appliedDiscounts) ? obj.appliedDiscounts : [],
    errors: Array.isArray(obj.errors)
      ? obj.errors.map((e) => ({
          code: String(e?.code ?? 'VALIDATION_ERROR'),
          message: String(e?.message ?? 'Érvénytelen konfiguráció.'),
          affectedOptionIds: Array.isArray(e?.affectedOptionIds) ? e.affectedOptionIds : [],
        }))
      : [],
    visualLayers: Array.isArray(obj.visualLayers) ? obj.visualLayers : [],
  };
}

async function parseErrorResponse(response: Response, fallbackPrefix: string): Promise<never> {
  const payload = await response.json().catch(() => null);

  if (payload && Array.isArray(payload.errors) && payload.errors.length > 0) {
    const normalized = normalizeEvaluationResult(payload);
    const combinedMessages = normalized.errors.map((e) => e.message).join(' | ');
    throw new ApiHttpError(
      response.status,
      `HTTP ${response.status}: ${combinedMessages}`,
      normalized
    );
  }

  const serverError = payload?.error ?? `${fallbackPrefix} (HTTP ${response.status}).`;
  throw new ApiHttpError(response.status, `HTTP ${response.status}: ${serverError}`);
}

export async function fetchAvailableOptions(): Promise<OptionDto[]> {
  const response = await fetch(`${API_BASE_URL}/options`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    await parseErrorResponse(response, 'Nem sikerült betölteni az opciókat');
  }

  const data = await response.json();
  return Array.isArray(data) ? (data as OptionDto[]) : [];
}

export async function evaluateConfiguration(
  request: ConfigurationRequestDto
): Promise<ConfigurationEvaluationResultDto> {
  const response = await fetch(`${API_BASE_URL}/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok && response.status !== 400) {
    await parseErrorResponse(response, 'Hiba a konfiguráció kiértékelésekor');
  }

  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    throw new ApiHttpError(
      response.status,
      `Érvénytelen válasz érkezett a kiértékelési végponttól (HTTP ${response.status}).`
    );
  }

  return normalizeEvaluationResult(payload);
}

export async function saveConfiguration(
  request: SaveConfigurationRequestDto,
  session: UserSession
): Promise<SavedConfigurationDto> {
  const response = await fetch(API_BASE_URL, {
    method: 'POST',
    headers: buildAuthHeaders(session),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    await parseErrorResponse(response, 'Mentési hiba');
  }

  return (await response.json()) as SavedConfigurationDto;
}

export async function fetchUserConfigurations(
  session: UserSession
): Promise<SavedConfigurationDto[]> {
  const response = await fetch(API_BASE_URL, {
    method: 'GET',
    headers: buildAuthHeaders(session),
  });

  if (!response.ok) {
    await parseErrorResponse(response, 'Lekérési hiba');
  }

  return (await response.json()) as SavedConfigurationDto[];
}

export async function fetchSavedConfigurationById(
  id: number,
  session: UserSession
): Promise<SavedConfigurationDto> {
  const response = await fetch(`${API_BASE_URL}/${id}`, {
    method: 'GET',
    headers: buildAuthHeaders(session),
  });

  if (!response.ok) {
    await parseErrorResponse(response, 'Betöltési hiba');
  }

  return (await response.json()) as SavedConfigurationDto;
}

export async function updateSavedConfiguration(
  id: number,
  request: SaveConfigurationRequestDto,
  session: UserSession
): Promise<SavedConfigurationDto> {
  const response = await fetch(`${API_BASE_URL}/${id}`, {
    method: 'PUT',
    headers: buildAuthHeaders(session),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    await parseErrorResponse(response, 'Módosítási hiba');
  }

  return (await response.json()) as SavedConfigurationDto;
}

export async function deleteSavedConfiguration(
  id: number,
  session: UserSession
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/${id}`, {
    method: 'DELETE',
    headers: buildAuthHeaders(session),
  });

  if (!response.ok) {
    await parseErrorResponse(response, 'Törlési hiba');
  }
}
