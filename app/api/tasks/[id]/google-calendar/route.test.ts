import { beforeEach, describe, expect, it, vi } from "vitest";

// Permisos de /api/tasks/[id]/google-calendar: sesión + negocio de la sesión.

const resolveWorkspaceContext = vi.fn();
vi.mock("@/lib/workspace", () => ({ resolveWorkspaceContext: () => resolveWorkspaceContext() }));

const addTaskToGoogleCalendar = vi.fn();
const removeTaskFromGoogleCalendar = vi.fn();
const getTaskGoogleLink = vi.fn();
vi.mock("@/modules/tasks/google-calendar", () => ({
  addTaskToGoogleCalendar: (...a: unknown[]) => addTaskToGoogleCalendar(...a),
  removeTaskFromGoogleCalendar: (...a: unknown[]) => removeTaskFromGoogleCalendar(...a),
  getTaskGoogleLink: (...a: unknown[]) => getTaskGoogleLink(...a),
}));

const { GET, POST, DELETE } = await import("./route");
const params = { params: Promise.resolve({ id: "task-1" }) };
const req = () => new Request("http://t/api/tasks/task-1/google-calendar", { method: "POST" });

beforeEach(() => {
  vi.clearAllMocks();
  resolveWorkspaceContext.mockResolvedValue({ status: "ok", userId: "user-a", businessId: "biz-a", role: "owner" });
});

describe("/api/tasks/[id]/google-calendar", () => {
  it("sin sesión responde 401 y no llama a nada", async () => {
    resolveWorkspaceContext.mockResolvedValue({ status: "unauthenticated" });
    expect((await GET(req(), params)).status).toBe(401);
    expect((await POST(req(), params)).status).toBe(401);
    expect((await DELETE(req(), params)).status).toBe(401);
    expect(addTaskToGoogleCalendar).not.toHaveBeenCalled();
    expect(removeTaskFromGoogleCalendar).not.toHaveBeenCalled();
  });

  it("agrega usando el usuario y el negocio de la sesión (201 al crear, 200 al actualizar)", async () => {
    addTaskToGoogleCalendar.mockResolvedValue({ created: true });
    const created = await POST(req(), params);
    expect(created.status).toBe(201);
    expect(addTaskToGoogleCalendar).toHaveBeenCalledWith("biz-a", "user-a", "task-1");

    addTaskToGoogleCalendar.mockResolvedValue({ created: false });
    expect((await POST(req(), params)).status).toBe(200);
  });

  it("una tarea de otro negocio responde 404", async () => {
    addTaskToGoogleCalendar.mockRejectedValue(new Error("task_not_found"));
    expect((await POST(req(), params)).status).toBe(404);
    removeTaskFromGoogleCalendar.mockRejectedValue(new Error("task_not_found"));
    expect((await DELETE(req(), params)).status).toBe(404);
  });

  it("sin fecha de vencimiento responde 400; sin conexión de Google, 409; revocada, 409; error de Google, 502", async () => {
    addTaskToGoogleCalendar.mockRejectedValue(new Error("task_without_due_date"));
    expect((await POST(req(), params)).status).toBe(400);
    addTaskToGoogleCalendar.mockRejectedValue(new Error("google_not_connected"));
    expect((await POST(req(), params)).status).toBe(409);
    addTaskToGoogleCalendar.mockRejectedValue(new Error("google_needs_reconnect"));
    expect((await POST(req(), params)).status).toBe(409);
    addTaskToGoogleCalendar.mockRejectedValue(new Error("google_sync_failed"));
    expect((await POST(req(), params)).status).toBe(502);
  });

  it("el evento de otro usuario no se puede modificar: 403", async () => {
    removeTaskFromGoogleCalendar.mockRejectedValue(new Error("google_event_forbidden"));
    expect((await DELETE(req(), params)).status).toBe(403);
  });

  it("consulta el vínculo con el usuario y negocio de la sesión", async () => {
    getTaskGoogleLink.mockResolvedValue({ linked: true, eventId: "evt-1" });
    const res = await GET(req(), params);
    expect(await res.json()).toEqual({ linked: true, eventId: "evt-1" });
    expect(getTaskGoogleLink).toHaveBeenCalledWith("biz-a", "user-a", "task-1");
  });

  it("no filtra tokens ni datos internos en las respuestas", async () => {
    addTaskToGoogleCalendar.mockResolvedValue({ created: true, event: { googleEventId: "g-1", refreshTokenEnc: "SECRETO" } });
    const body = JSON.stringify(await (await POST(req(), params)).json());
    expect(body).not.toContain("SECRETO");
    expect(body).not.toMatch(/token/i);
  });
});
