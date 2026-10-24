// Kept free of imports so the proxy can use it without loading the database.
export const AUTH_COOKIE_PREFIX = "aranyam";
/** Better Auth's session cookie. Sites served over HTTPS add the __Secure- prefix. */
export const SESSION_COOKIE = `${AUTH_COOKIE_PREFIX}.session_token`;
export const SESSION_COOKIE_NAMES = [`__Secure-${SESSION_COOKIE}`, SESSION_COOKIE] as const;
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
