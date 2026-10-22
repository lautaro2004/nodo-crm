"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { signIn, signUp } from "@/lib/auth/auth-client";
import { Button, Input, Label } from "@/components/ui/primitives";
import { safeNext } from "@/lib/safe-next";
import { authErrorMessage, validateAuthFields } from "@/lib/auth/auth-errors";

type Field = "email" | "password" | "name";

// Login y registro.
//
// Causa del "no pasa nada" al iniciar sesión: el estado de carga se apagaba
// apenas respondía /api/auth/sign-in y RECIÉN AHÍ empezaba la navegación al
// dashboard (que en el servidor resuelve sesión, negocio y workspace). En
// ese intervalo —1 a 3 s, más con red lenta— el botón volvía a decir
// "Iniciar sesión", habilitado, sobre la misma pantalla. Ahora la navegación
// corre dentro de una transición y el botón sigue en "Ingresando…" hasta que
// el dashboard reemplaza a esta pantalla. Si algo falla, se recupera el
// estado y se muestra el motivo.
export function AuthForm({ mode, next, defaultEmail }: { mode: "login" | "registro"; next?: string | null; defaultEmail?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [navigating, startNavigation] = useTransition();
  const inFlight = useRef(false);
  const refs = {
    name: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
  };

  const busy = submitting || navigating;
  const isLogin = mode === "login";

  function clearFieldError(field: Field) {
    if (fieldErrors[field]) setFieldErrors((f) => ({ ...f, [field]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Doble click / Enter repetido: una sola solicitud.
    if (inFlight.current || busy) return;

    const errors = validateAuthFields(mode, { email, password, name });
    setFieldErrors(errors);
    setError(null);
    const firstInvalid = (["name", "email", "password"] as const).find((f) => errors[f]);
    if (firstInvalid) {
      refs[firstInvalid].current?.focus();
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    try {
      const result = isLogin
        ? await signIn.email({ email: email.trim(), password })
        : await signUp.email({ email: email.trim(), password, name: name.trim() });

      if (result.error) {
        console.warn("[auth]", result.error.status, result.error.code, result.error.message);
        setError(authErrorMessage(result.error));
        if (isLogin && (result.error.code === "INVALID_EMAIL_OR_PASSWORD" || result.error.status === 401)) {
          setPassword("");
          refs.password.current?.focus();
        }
        return;
      }

      // Éxito real (cookie de sesión emitida por el servidor): navegar
      // manteniendo el estado de carga hasta que llegue el dashboard.
      const destination = safeNext(next) ?? "/dashboard";
      startNavigation(() => {
        router.push(destination);
      });
    } catch (err) {
      // Sin conexión, CORS, respuesta no-JSON, etc.
      console.error("[auth]", err);
      setError("No pudimos conectar con el servidor. Revisá tu conexión y probá de nuevo.");
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  const label = navigating ? "Ingresando…" : submitting ? (isLogin ? "Verificando…" : "Creando cuenta…") : isLogin ? "Iniciar sesión" : "Crear cuenta";

  return (
    // method="post": si se envía antes de que cargue el JS, las credenciales
    // nunca viajan en la URL (el default de un <form> es GET).
    <form method="post" onSubmit={handleSubmit} noValidate className="space-y-4" aria-busy={busy}>
      {mode === "registro" && (
        <FieldShell id="name" label="Nombre" error={fieldErrors.name}>
          <Input
            ref={refs.name}
            id="name"
            name="name"
            autoComplete="name"
            value={name}
            readOnly={busy}
            aria-invalid={!!fieldErrors.name || undefined}
            aria-describedby={fieldErrors.name ? "name-error" : undefined}
            onChange={(e) => {
              setName(e.target.value);
              clearFieldError("name");
            }}
          />
        </FieldShell>
      )}
      <FieldShell id="email" label="Email" error={fieldErrors.email}>
        <Input
          ref={refs.email}
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete={isLogin ? "username" : "email"}
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          readOnly={busy}
          aria-invalid={!!fieldErrors.email || undefined}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
          onChange={(e) => {
            setEmail(e.target.value);
            clearFieldError("email");
          }}
        />
      </FieldShell>
      <FieldShell id="password" label="Contraseña" error={fieldErrors.password} hint={!isLogin && !fieldErrors.password ? "Al menos 8 caracteres." : undefined}>
        <div className="relative">
          <Input
            ref={refs.password}
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={isLogin ? "current-password" : "new-password"}
            value={password}
            readOnly={busy}
            className="pr-20"
            aria-invalid={!!fieldErrors.password || undefined}
            aria-describedby={fieldErrors.password ? "password-error" : !isLogin ? "password-hint" : undefined}
            onChange={(e) => {
              setPassword(e.target.value);
              clearFieldError("password");
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-1 right-1 rounded-lg px-2.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-pressed={showPassword}
            aria-controls="password"
          >
            {showPassword ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </FieldShell>
      <div aria-live="assertive">
        {error && (
          <p className="animate-fade-in rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}
      </div>
      <Button type="submit" className="w-full" loading={busy}>
        {label}
      </Button>
    </form>
  );
}

function FieldShell({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 animate-fade-in text-xs text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
