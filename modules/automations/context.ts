import { AsyncLocalStorage } from "node:async_hooks";

// Contexto de una cadena de automatizaciones. Cuando una acción escribe un
// registro ("Actualizar campo", "Actualizar relacionados"), esa escritura
// vuelve a pasar por los servicios de dominio y puede disparar otras
// reglas. AsyncLocalStorage lleva, sin cambiar firmas, la profundidad y las
// reglas ya ejecutadas en la cadena:
// - una regla que ya corrió en la cadena no vuelve a correr (sin ciclos);
// - más allá de MAX_CHAIN_DEPTH no se dispara nada (sin recursión infinita);
// - las validaciones "antes de guardar" no se aplican a escrituras hechas
//   por automatizaciones (son de la persona que edita, no del sistema).

export interface AutomationChain {
  depth: number;
  ruleIds: ReadonlySet<string>;
  actorUserId: string | null;
}

const storage = new AsyncLocalStorage<AutomationChain>();

export function currentChain(): AutomationChain | undefined {
  return storage.getStore();
}

export function runInChain<T>(chain: AutomationChain, fn: () => Promise<T>): Promise<T> {
  return storage.run(chain, fn);
}
