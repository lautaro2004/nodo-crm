// `next`: a dónde volver después de entrar (ej. una invitación). Solo rutas
// internas ("/algo"), nunca una URL externa: evita open redirects.
export function safeNext(next: string | undefined | null): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : null;
}
