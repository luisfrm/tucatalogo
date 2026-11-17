import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("producto/:slug", "routes/product.tsx"),
  route("color-mode", "routes/color-mode.ts"),
  route("sitemap.xml", "routes/sitemap.ts"),
  route("robots.txt", "routes/robots.ts"),
  route("favicon.ico", "routes/favicon.ts"),
  route("panel-admin", "routes/panel-admin.tsx", [
    route("login", "routes/panel-admin/login.tsx"),
    route("recuperar", "routes/panel-admin/recuperar.tsx"),
    route("reset-password", "routes/panel-admin/reset-password.tsx"),
    route("restablecer", "routes/panel-admin/restablecer.tsx"),
    route("eliminada", "routes/panel-admin/eliminada.tsx"),
    route("mode", "routes/panel-admin/mode.ts"),
    route("logout", "routes/panel-admin/logout.ts"),
    layout("routes/panel-admin/app-layout.tsx", [
      index("routes/panel-admin/dashboard.tsx"),
      route("productos", "routes/panel-admin/products.tsx"),
      route("productos/nuevo", "routes/panel-admin/product-new.tsx"),
      route("productos/:id", "routes/panel-admin/product-edit.tsx"),
      route("categorias", "routes/panel-admin/categories.tsx"),
      route("hero", "routes/panel-admin/hero.tsx"),
      route("settings", "routes/panel-admin/settings.tsx"),
    ]),
  ]),
  route("health", "routes/health.ts"),
] satisfies RouteConfig;
