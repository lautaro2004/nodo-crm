import { describe, expect, it, vi, beforeEach } from "vitest";

const taskFindFirst = vi.fn();
const attachmentCreate = vi.fn();
const attachmentFindFirst = vi.fn();
const attachmentFindMany = vi.fn();
const attachmentDelete = vi.fn();
const activityCreate = vi.fn();

const listBuckets = vi.fn();
const createBucket = vi.fn();
const upload = vi.fn();
const createSignedUrl = vi.fn();
const remove = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: { findFirst: (...args: unknown[]) => taskFindFirst(...args) },
    taskAttachment: {
      create: (...args: unknown[]) => attachmentCreate(...args),
      findFirst: (...args: unknown[]) => attachmentFindFirst(...args),
      findMany: (...args: unknown[]) => attachmentFindMany(...args),
      delete: (...args: unknown[]) => attachmentDelete(...args),
    },
    activity: { create: (...args: unknown[]) => activityCreate(...args) },
  },
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    storage: {
      listBuckets: (...args: unknown[]) => listBuckets(...args),
      createBucket: (...args: unknown[]) => createBucket(...args),
      from: () => ({
        upload: (...args: unknown[]) => upload(...args),
        createSignedUrl: (...args: unknown[]) => createSignedUrl(...args),
        remove: (...args: unknown[]) => remove(...args),
      }),
    },
  }),
}));

const { uploadTaskAttachment, listTaskAttachments, getAttachmentDownloadUrl, deleteTaskAttachment } = await import(
  "./attachments"
);

beforeEach(() => {
  taskFindFirst.mockReset();
  attachmentCreate.mockReset();
  attachmentFindFirst.mockReset();
  attachmentFindMany.mockReset();
  attachmentDelete.mockReset();
  activityCreate.mockReset();
  activityCreate.mockResolvedValue({ id: "activity_1" });
  listBuckets.mockReset();
  listBuckets.mockResolvedValue({ data: [{ name: "task-attachments" }], error: null });
  createBucket.mockReset();
  upload.mockReset();
  upload.mockResolvedValue({ error: null });
  createSignedUrl.mockReset();
  remove.mockReset();
  remove.mockResolvedValue({ error: null });
});

describe("uploadTaskAttachment", () => {
  it("sube el archivo y registra Activity 'attachment_added' cuando la tarea es de este Business", async () => {
    taskFindFirst.mockResolvedValue({ id: "task_1" });
    attachmentCreate.mockResolvedValue({ id: "att_1", fileName: "factura.pdf" });

    const result = await uploadTaskAttachment("biz_1", {
      taskId: "task_1",
      fileName: "factura.pdf",
      mimeType: "application/pdf",
      bytes: Buffer.from("hola"),
      uploadedById: "user_1",
    });

    expect(taskFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "task_1", businessId: "biz_1" } }));
    expect(upload).toHaveBeenCalled();
    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "attachment_added", relatedId: "task_1" }) })
    );
    expect(result).toEqual({ id: "att_1", fileName: "factura.pdf" });
  });

  it("rechaza subir un adjunto a una tarea de OTRO Business", async () => {
    taskFindFirst.mockResolvedValue(null);
    await expect(
      uploadTaskAttachment("biz_A", {
        taskId: "task_de_biz_B",
        fileName: "x.pdf",
        mimeType: "application/pdf",
        bytes: Buffer.from("x"),
        uploadedById: "user_1",
      })
    ).rejects.toThrow("task_not_found");
    expect(upload).not.toHaveBeenCalled();
  });

  it("rechaza un tipo de archivo no permitido", async () => {
    taskFindFirst.mockResolvedValue({ id: "task_1" });
    await expect(
      uploadTaskAttachment("biz_1", {
        taskId: "task_1",
        fileName: "script.exe",
        mimeType: "application/x-msdownload",
        bytes: Buffer.from("x"),
        uploadedById: "user_1",
      })
    ).rejects.toThrow("file_type_not_allowed");
    expect(upload).not.toHaveBeenCalled();
  });

  it("rechaza un archivo demasiado grande", async () => {
    taskFindFirst.mockResolvedValue({ id: "task_1" });
    const bigBuffer = Buffer.alloc(21 * 1024 * 1024);
    await expect(
      uploadTaskAttachment("biz_1", {
        taskId: "task_1",
        fileName: "grande.pdf",
        mimeType: "application/pdf",
        bytes: bigBuffer,
        uploadedById: "user_1",
      })
    ).rejects.toThrow("file_too_large");
    expect(upload).not.toHaveBeenCalled();
  });
});

describe("aislamiento multi-tenant", () => {
  it("listTaskAttachments siempre filtra por businessId", async () => {
    attachmentFindMany.mockResolvedValue([]);
    await listTaskAttachments("biz_A", "task_1");
    expect(attachmentFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: "biz_A", taskId: "task_1" } }));
  });

  it("getAttachmentDownloadUrl devuelve null para un adjunto de OTRO Business", async () => {
    attachmentFindFirst.mockResolvedValue(null);
    const url = await getAttachmentDownloadUrl("biz_A", "att_de_biz_B");
    expect(url).toBeNull();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("deleteTaskAttachment devuelve false para un adjunto de OTRO Business", async () => {
    attachmentFindFirst.mockResolvedValue(null);
    const ok = await deleteTaskAttachment("biz_A", "att_de_biz_B");
    expect(ok).toBe(false);
    expect(remove).not.toHaveBeenCalled();
    expect(attachmentDelete).not.toHaveBeenCalled();
  });
});
