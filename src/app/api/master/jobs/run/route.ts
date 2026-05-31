import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError, ok } from "@/lib/api/errors";
import { requireSuperAdmin } from "@/lib/security/auth";
import { assertSameOrigin } from "@/lib/security/csrf";
import { processReminders } from "@/lib/services/bot-reminder";

const KNOWN_JOBS = ["bot-reminders"] as const;
type KnownJob = (typeof KNOWN_JOBS)[number];

const bodySchema = z.object({
  job: z.enum(KNOWN_JOBS)
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await requireSuperAdmin(request);
    const { job } = bodySchema.parse(await request.json());

    const startedAt = Date.now();
    const result = await runJob(job);
    const durationMs = Date.now() - startedAt;

    return ok({ job, durationMs, result });
  } catch (error) {
    return handleApiError(error);
  }
}

async function runJob(job: KnownJob) {
  switch (job) {
    case "bot-reminders":
      return processReminders();
    default:
      throw new ApiError(400, `Job desconhecido: ${job}`);
  }
}
