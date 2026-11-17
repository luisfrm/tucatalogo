import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("registro", "routes/registro.tsx"),
  route("registro/slug-check", "routes/registro.slug-check.ts"),
  route("terminos", "routes/terminos.tsx"),
  route("privacidad", "routes/privacidad.tsx"),
  route("favicon.ico", "routes/favicon.ts"),
  route("health", "routes/health.ts"),
] satisfies RouteConfig;
