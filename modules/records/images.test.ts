import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => ({}) }));

const { isPathOfBusiness, sniffImageType } = await import("./images");

describe("imágenes de registros", () => {
  it("detecta el tipo real por magic bytes", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImageType(new TextEncoder().encode("GIF89a"))).toBe("image/gif");
    expect(sniffImageType(new TextEncoder().encode("RIFF1234WEBP"))).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });

  it("solo se firman rutas dentro de la carpeta del negocio", () => {
    expect(isPathOfBusiness("biz1/mod/rec/f.png", "biz1")).toBe(true);
    expect(isPathOfBusiness("biz2/mod/rec/f.png", "biz1")).toBe(false);
    expect(isPathOfBusiness("biz1/../biz2/f.png", "biz1")).toBe(false);
    expect(isPathOfBusiness("biz10/x.png", "biz1")).toBe(false);
  });
});
