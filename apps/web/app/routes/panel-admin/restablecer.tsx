/**
 * Alias de `/panel-admin/reset-password` (el API emite ese path; este alias
 * existe para enlaces antiguos y para quien escribe "restablecer" en español).
 * Mismo loader/action/componente: el token se valida igual y nunca se guarda.
 */
export { action, loader, meta } from "./reset-password";
export { default } from "./reset-password";
