import {
  ApiClientError,
  deleteConsoleStore,
  getConsoleStore,
  listConsoleAudit,
  reactivateConsoleStore,
  suspendConsoleStore,
} from "@tucatalogo/api-client";
import type { ConsoleAuditList } from "@tucatalogo/types";
import { Button, buttonVariants, cn } from "@tucatalogo/ui";
import { data, Form, Link, redirect, useActionData, useLoaderData, useNavigation } from "react-router";

import { Alert } from "../components/alert";
import { ConfirmDialog } from "../components/confirm-dialog";
import { TextAreaField, TextField } from "../components/field";
import { PageHeader } from "../components/page-header";
import { ProtectedRouteError } from "../components/route-error";
import { CodeBadge, StoreStatusBadge } from "../components/status-badge";
import { apiContext, getApi } from "../lib/api.server";
import {
  formatAuditAction,
  formatAuditActorType,
  summarizeMetadata,
} from "../lib/audit";
import { describeApiError, fieldErrorsFrom, statusFromApiError } from "../lib/errors";
import {
  validateSlugConfirmation,
  validateSuspendReason,
} from "../lib/validation.server";
import {
  describeSuspendedBy,
  formatCount,
  formatDate,
  formatDateTime,
} from "../lib/format";
import { consoleResponseHeaders } from "../lib/http.server";
import { requireConsoleSession, rethrowAuthRedirect } from "../lib/session.server";
import type { Route } from "./+types/store-detail";

type StoreIntent = "suspend" | "reactivate" | "delete";

interface ActionFailure {
  ok: false;
  intent: StoreIntent;
  message: string;
  fieldErrors?: Record<string, string>;
}

interface ActionSuccess {
  ok: true;
  intent: "suspend" | "reactivate";
  message: string;
}

type StoreActionData = ActionFailure | ActionSuccess;

function parseIntent(raw: FormDataEntryValue | null): StoreIntent | null {
  return raw === "suspend" || raw === "reactivate" || raw === "delete" ? raw : null;
}

function actionFailure(error: unknown, intent: StoreIntent) {
  rethrowAuthRedirect(error);
  return data<StoreActionData>(
    {
      ok: false,
      intent,
      message: describeApiError(error, "No pudimos completar la acción."),
      fieldErrors: fieldErrorsFrom(error),
    },
    { status: statusFromApiError(error) },
  );
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const id = params.id;
  if (!id) throw new Response("Falta el identificador de la tienda.", { status: 400 });

  const api = getApi();
  const context = apiContext(request);
  const session = await requireConsoleSession(api, context);

  let detail;
  try {
    detail = await getConsoleStore(api, context, id);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      throw new Response("La tienda no existe o se ha eliminado.", { status: 404 });
    }
    rethrowAuthRedirect(error);
    throw error;
  }

  // La auditoría no debe tumbar la ficha: si falla se muestra un aviso explícito.
  let audit: ConsoleAuditList | null = null;
  let auditError: string | null = null;
  try {
    audit = await listConsoleAudit(api, context, { storeId: id, page: 1 });
  } catch (error) {
    rethrowAuthRedirect(error);
    auditError = describeApiError(error, "No pudimos cargar la auditoría de la tienda.");
    console.error(
      JSON.stringify({
        level: "error",
        app: "console",
        message: "Fallo al cargar auditoría de tienda",
        storeId: id,
      }),
    );
  }

  return data(
    {
      detail,
      recentAudit: audit?.items.slice(0, 8) ?? [],
      auditError,
    },
    { headers: consoleResponseHeaders(session.setCookies) },
  );
}

export async function action({ request, params }: Route.ActionArgs) {
  const id = params.id;
  if (!id) throw new Response("Falta el identificador de la tienda.", { status: 400 });

  const api = getApi();
  const context = apiContext(request);
  await requireConsoleSession(api, context);

  const form = await request.formData();
  const intent = parseIntent(form.get("intent"));
  if (!intent) {
    return data<StoreActionData>(
      { ok: false, intent: "reactivate", message: "Acción no reconocida." },
      { status: 400 },
    );
  }

  if (intent === "suspend") {
    const reason = validateSuspendReason(form.get("reason"));
    if (!reason.ok) {
      return data<StoreActionData>(
        {
          ok: false,
          intent,
          message: "Revisa el motivo de la suspensión.",
          fieldErrors: { reason: reason.message },
        },
        { status: 400 },
      );
    }

    try {
      await suspendConsoleStore(api, context, id, { reason: reason.value });
      return data<StoreActionData>(
        { ok: true, intent, message: "Tienda suspendida. El storefront devolverá 404." },
        { headers: consoleResponseHeaders() },
      );
    } catch (error) {
      return actionFailure(error, intent);
    }
  }

  if (intent === "reactivate") {
    try {
      await reactivateConsoleStore(api, context, id);
      return data<StoreActionData>(
        { ok: true, intent, message: "Tienda reactivada." },
        { headers: consoleResponseHeaders() },
      );
    } catch (error) {
      return actionFailure(error, intent);
    }
  }

  // delete: el slug esperado se lee de D1, nunca de un campo del navegador.
  let detail;
  try {
    detail = await getConsoleStore(api, context, id);
  } catch (error) {
    return actionFailure(error, intent);
  }

  const confirmation = validateSlugConfirmation(form.get("confirmSlug"), detail.slug);
  if (!confirmation.ok) {
    return data<StoreActionData>(
      {
        ok: false,
        intent,
        message: "Revisa la confirmación.",
        fieldErrors: { confirmSlug: confirmation.message },
      },
      { status: 400 },
    );
  }

  try {
    await deleteConsoleStore(api, context, id, { confirmSlug: confirmation.value });
  } catch (error) {
    return actionFailure(error, intent);
  }

  return redirect(`/?eliminada=${encodeURIComponent(detail.slug)}`, {
    headers: consoleResponseHeaders(),
  });
}

export function meta() {
  return [{ title: "Detalle de tienda · Console TuCatálogo" }];
}

function Panel({
  title,
  description,
  actions,
  tone = "default",
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  tone?: "default" | "danger";
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "grid gap-3 rounded-[var(--radius-md)] border bg-surface p-4 shadow-[var(--shadow-sm)]",
        tone === "danger" ? "border-danger/35" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2
            className={cn(
              "text-sm font-semibold tracking-tight",
              tone === "danger" ? "text-danger" : "text-text",
            )}
          >
            {title}
          </h2>
          {description ? <p className="mt-0.5 text-xs text-text-muted">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-border bg-surface-2 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.08em] text-text-muted">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{formatCount(value)}</p>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-[11px] uppercase tracking-[0.08em] text-text-muted">{label}</dt>
      <dd className="break-words text-sm">{children}</dd>
    </div>
  );
}

export default function StoreDetail() {
  const { detail, recentAudit, auditError } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const isSuspended = detail.status === "suspended";
  const busyIntent =
    navigation.state === "submitting" ? navigation.formData?.get("intent") : null;

  const dialogFailure =
    actionData && !actionData.ok ? actionData.fieldErrors ?? null : null;
  const dialogResult = actionData ? { ok: actionData.ok, intent: actionData.intent } : null;

  return (
    <div className="grid gap-4">
      <div>
        <Link
          to="/"
          className="focus-ring rounded-[var(--radius-sm)] text-xs font-medium text-primary hover:underline"
        >
          ← Tiendas
        </Link>
      </div>

      <PageHeader
        eyebrow="Tienda"
        title={detail.name}
        description={<span className="font-mono text-xs">{detail.slug}</span>}
        actions={
          <>
            <StoreStatusBadge status={detail.status} />
            <Link
              to={`/auditoria?storeId=${encodeURIComponent(detail.id)}`}
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
            >
              Auditoría de la tienda
            </Link>
          </>
        }
      />

      {actionData?.ok ? (
        <Alert tone="success" title="Acción completada">
          {actionData.message}
        </Alert>
      ) : null}

      {actionData && !actionData.ok && actionData.intent === "reactivate" ? (
        <Alert tone="error" title="No se pudo reactivar">
          {actionData.message}
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-4 lg:col-span-2">
          <Panel title="Ficha de la tienda" description="Solo metadatos y conteos: el console no edita el catálogo.">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Meta label="ID">
                <span className="font-mono text-xs">{detail.id}</span>
              </Meta>
              <Meta label="Slug">
                <span className="font-mono text-xs">{detail.slug}</span>
              </Meta>
              <Meta label="Dueño">
                <span className="block">{detail.owner.name}</span>
                <span className="block text-xs text-text-muted">{detail.owner.email}</span>
              </Meta>
              <Meta label="Email de contacto">
                <span className="break-all">{detail.ownerEmail}</span>
              </Meta>
              <Meta label="Creada">{formatDateTime(detail.createdAt)}</Meta>
              <Meta label="Actualizada">{formatDateTime(detail.updatedAt)}</Meta>
              <Meta label="Moneda">{detail.currency}</Meta>
              <Meta label="Plan">{detail.plan}</Meta>
              <Meta label="Tema">{detail.themeId}</Meta>
              <Meta label="Modo por defecto">{detail.colorModeDefault === "dark" ? "Oscuro" : "Claro"}</Meta>
              <Meta label="Color principal">
                <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                  <span
                    aria-hidden="true"
                    className="inline-block size-3 rounded-[2px] border border-border"
                    style={{ backgroundColor: detail.primaryColor }}
                  />
                  {detail.primaryColor}
                </span>
              </Meta>
              <Meta label="WhatsApp">
                {detail.whatsappNumber ? (
                  <span className="font-mono text-xs">{detail.whatsappNumber}</span>
                ) : (
                  "Sin número configurado"
                )}
              </Meta>
            </dl>
          </Panel>

          <Panel title="Contenido" description="Conteos de la tienda; no hay acceso a productos ni imágenes editables.">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Productos" value={detail.productCount} />
              <Stat label="Categorías" value={detail.categoryCount} />
              <Stat label="Slides" value={detail.slideCount} />
              <Stat label="Imágenes" value={detail.imageCount} />
            </div>
          </Panel>

          <Panel
            title="Auditoría reciente"
            description="Últimos 8 movimientos de esta tienda."
            actions={
              <Link
                to={`/auditoria?storeId=${encodeURIComponent(detail.id)}`}
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Ver todo
              </Link>
            }
          >
            {auditError ? (
              <Alert tone="error" title="Auditoría no disponible">
                {auditError}
              </Alert>
            ) : recentAudit.length === 0 ? (
              <p className="rounded-[var(--radius-sm)] bg-surface-2 px-3 py-4 text-center text-sm text-text-muted">
                Todavía no hay movimientos registrados.
              </p>
            ) : (
              <div
                role="region"
                aria-label="Movimientos recientes de la tienda"
                tabIndex={0}
                className="focus-ring overflow-x-auto"
              >
                {/* La tabla no lleva elementos focusables: la región entra en el
                    orden de tabulación para poder desplazarla con el teclado a 390 px. */}
                <table className="w-full min-w-[560px] border-collapse text-[13px]">
                  <thead className="text-left text-[11px] uppercase tracking-[0.08em] text-text-muted">
                    <tr>
                      <th scope="col" className="py-1.5 pr-3 font-semibold">Fecha</th>
                      <th scope="col" className="py-1.5 pr-3 font-semibold">Acción</th>
                      <th scope="col" className="py-1.5 pr-3 font-semibold">Actor</th>
                      <th scope="col" className="py-1.5 font-semibold">Metadata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentAudit.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-t border-border align-top transition-colors hover:bg-surface-2/60"
                      >
                        <td className="whitespace-nowrap py-1.5 pr-3 text-text-muted">
                          {formatDateTime(entry.createdAt)}
                        </td>
                        <td className="py-1.5 pr-3">
                          <div className="font-medium">{formatAuditAction(entry.action)}</div>
                          <CodeBadge>{entry.action}</CodeBadge>
                        </td>
                        <td className="py-1.5 pr-3">{formatAuditActorType(entry.actorType)}</td>
                        <td className="py-1.5 font-mono text-[11px] text-text-muted">
                          {summarizeMetadata(entry.metadata)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <aside className="grid content-start gap-4">
          <Panel title="Estado y acciones">
            {isSuspended ? (
              <div className="grid gap-2">
                <Alert tone="warning" title="Tienda suspendida">
                  <p>
                    Motivo: {detail.suspendedReason ?? "sin motivo registrado"}
                  </p>
                  <p className="mt-1 text-xs">
                    Por {describeSuspendedBy(detail.suspendedBy)}
                    {detail.suspendedAt ? ` · ${formatDateTime(detail.suspendedAt)}` : ""}
                  </p>
                </Alert>
                <Form method="post">
                  <input type="hidden" name="intent" value="reactivate" />
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={busyIntent === "reactivate"}
                  >
                    {busyIntent === "reactivate" ? "Reactivando…" : "Reactivar tienda"}
                  </Button>
                </Form>
              </div>
            ) : (
              <div className="grid gap-2">
                <p className="text-sm text-text-muted">
                  Suspender oculta el storefront (404) y deja el panel del dueño accesible con
                  banner. El motivo es obligatorio y queda auditado.
                </p>
                <ConfirmDialog
                  intent="suspend"
                  triggerLabel="Suspender tienda"
                  title="Suspender tienda"
                  description="El storefront dejará de ser público. El dueño verá el motivo en su panel."
                  submitLabel="Suspender"
                  variant="danger"
                  result={dialogResult}
                >
                  <TextAreaField
                    id="suspend-reason"
                    name="reason"
                    label="Motivo (obligatorio)"
                    placeholder="Ej.: catálogo con contenido prohibido, impago, revisión interna…"
                    required
                    minLength={3}
                    maxLength={300}
                    error={
                      actionData && !actionData.ok && actionData.intent === "suspend"
                        ? dialogFailure?.reason
                        : undefined
                    }
                  />
                </ConfirmDialog>
                {actionData && !actionData.ok && actionData.intent === "suspend" ? (
                  <Alert tone="error" title="No se pudo suspender">
                    {actionData.message}
                  </Alert>
                ) : null}
              </div>
            )}

            <dl className="grid gap-2 border-t border-border pt-3 text-xs text-text-muted">
              <div className="flex justify-between gap-2">
                <dt>Creada</dt>
                <dd>{formatDate(detail.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Última actualización</dt>
                <dd>{formatDate(detail.updatedAt)}</dd>
              </div>
            </dl>
          </Panel>

          <Panel
            title="Zona de riesgo"
            description="Eliminar es definitivo y no se puede deshacer."
            tone="danger"
          >
            <div className="grid gap-2">
              <p className="text-sm text-text-muted">
                Borra D1, R2 y la cuenta del dueño. El slug queda en cuarentena 90 días.
              </p>
              <ConfirmDialog
                intent="delete"
                triggerLabel="Eliminar tienda"
                title={`Eliminar ${detail.name}`}
                description="Esta acción borra la tienda, sus productos, imágenes y el acceso del dueño."
                submitLabel="Eliminar definitivamente"
                variant="danger"
                result={dialogResult}
              >
                <Alert tone="warning" title="Confirmación obligatoria">
                  <p>
                    Escribe <code className="font-mono">{detail.slug}</code> para confirmar. El
                    API verificará el slug de nuevo antes de borrar.
                  </p>
                </Alert>
                <TextField
                  id="confirm-slug"
                  name="confirmSlug"
                  label="Slug de la tienda"
                  placeholder={detail.slug}
                  autoComplete="off"
                  spellCheck={false}
                  required
                  error={
                    actionData && !actionData.ok && actionData.intent === "delete"
                      ? dialogFailure?.confirmSlug
                      : undefined
                  }
                />
              </ConfirmDialog>
              {actionData && !actionData.ok && actionData.intent === "delete" ? (
                <Alert tone="error" title="No se pudo eliminar">
                  {actionData.message}
                </Alert>
              ) : null}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ProtectedRouteError error={error} />;
}
