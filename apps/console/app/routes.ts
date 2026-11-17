import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  // Públicas
  route("init", "routes/init.tsx"),
  route("login", "routes/login.tsx"),
  route("2fa", "routes/two-factor.tsx"),
  route("favicon.ico", "routes/favicon.ts"),
  route("recuperar", "routes/forgot-password.tsx"),
  route("restablecer", "routes/reset-password.tsx"),
  // El correo del API enlaza a `/reset-password`; se conserva como alias.
  route("reset-password", "routes/reset-password-alias.ts"),
  route("logout", "routes/logout.ts"),

  // Autenticadas (layout con guard + navegación)
  layout("routes/app-layout.tsx", [
    index("routes/stores-list.tsx"),
    route("tiendas/:id", "routes/store-detail.tsx"),
    route("auditoria", "routes/audit.tsx"),
  ]),

  // Smoke (PLAN §13.6)
  route("health", "routes/health.ts"),
] satisfies RouteConfig;
