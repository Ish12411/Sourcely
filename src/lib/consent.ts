/**
 * Version of the AI data-sharing consent people agree to in AiConsentDialog.
 * Bump it when the wording changes materially (a new provider, a new kind of
 * data sent), and everyone is asked again. Shared by client and server, so it
 * lives outside the server-only Supabase helpers.
 */
export const AI_CONSENT_VERSION = 1;
