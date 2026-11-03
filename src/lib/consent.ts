/**
 * Version of the AI data-sharing consent people agree to in AiConsentDialog.
 * Bump it when the wording changes materially (a new provider, a new kind of
 * data sent), and everyone is asked again. Shared by client and server, so it
 * lives outside the server-only Supabase helpers.
 */
// 2: added agreement to the Terms (no tolerance for objectionable content),
// so accounts created before the Terms existed agree to them too.
export const AI_CONSENT_VERSION = 2;
