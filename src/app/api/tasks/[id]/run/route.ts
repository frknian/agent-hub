import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { idInput } from "@/lib/validation";
import { latestTaskRun } from "@/services/task-runs";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await params;
  if (!idInput.safeParse(id).success)
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(await latestTaskRun(user.id, id));
}
