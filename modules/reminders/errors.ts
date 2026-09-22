import { NextResponse } from "next/server";

const STATUS: Record<string, number> = {
  invalid_date: 400,
  target_required: 400,
  task_not_found: 404,
  activity_not_found: 404,
  user_not_in_business: 400,
};

export function reminderErrorResponse(err: unknown): NextResponse {
  if (err instanceof Error && err.message in STATUS) {
    return NextResponse.json({ error: err.message }, { status: STATUS[err.message] });
  }
  throw err;
}
