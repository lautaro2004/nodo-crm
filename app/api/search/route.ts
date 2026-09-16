import { NextResponse } from "next/server";

import { requireWorkspace } from "@/lib/api-guard";
import { globalSearch } from "@/modules/search/service";

export async function GET(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  return NextResponse.json(await globalSearch(ctx.businessId, q));
}
