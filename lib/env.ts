export interface RuntimeConfigStatus {
  aiApiKeyConfigured: boolean;
  aiBaseUrlConfigured: boolean;
  aiModelConfigured: boolean;
  rapidApiConfigured: boolean;
}

export function getRuntimeConfigStatus(): RuntimeConfigStatus {
  return {
    aiApiKeyConfigured: Boolean(process.env.STEP_API_KEY),
    aiBaseUrlConfigured: Boolean(process.env.AI_BASE_URL),
    aiModelConfigured: Boolean(process.env.AI_MODEL),
    rapidApiConfigured: Boolean(process.env.RAPIDAPI_KEY),
  };
}
