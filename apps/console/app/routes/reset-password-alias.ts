import { redirect } from "react-router";

import type { Route } from "./+types/reset-password-alias";

/**
 * El correo de recuperación del API enlaza a `/reset-password?token=…`
 * (`PASSWORD_RESET_PATH.console`). La UI vive en `/restablecer`; este alias
 * conserva el token y el resto de la query.
 */
export function loader({ request }: Route.LoaderArgs) {
  const search = new URL(request.url).search;
  return redirect(`/restablecer${search}`);
}
