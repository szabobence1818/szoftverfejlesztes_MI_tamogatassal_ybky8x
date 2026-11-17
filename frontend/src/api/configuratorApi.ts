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

async function parseErrorResponse(response: Response, fallbackPrefix: string): Promise<never> {
  const payload = await response.json().catch(() => null);

  if (payload && Array.isArray(payload.errors) && payload.errors.length > 0) {
    const combinedMessages = payload.errors
      .map((e: { message: string }) => e.message)
      .join(' | ');
    throw new ApiHttpError(
      response.status,
      `HTTP ${response.status}: ${combinedMessages}`,
      payload as ConfigurationEvaluationResultDto
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

  return (await response.json()) as OptionDto[];
}

export async function evaluateConfiguration(
  request: ConfigurationRequestDto
): Promise<ConfigurationEvaluationResultDto> {
  const response = await fetch(`${API_BASE_URL}/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(request),
  });

  const payload = (await response.json()) as ConfigurationEvaluationResultDto;
  return payload;
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
