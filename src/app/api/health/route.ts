
import { AppError } from "@/lib/server/errors";
import { getConfig, type ServerConfig } from "@/lib/server/env";
import { requireAdmin } from "@/lib/server/adminAuth";
import { BudgetManager } from "@/lib/server/budget/budgetManager";
import { groqChat } from "@/lib/server/ai/groqClient";
import { openStore, withStorageErrors } from "@/lib/server/storage/blobs";
import { handleError, jsonOk } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function checkStorage(): Promise<Record<string, unknown>> {
  try {
    const stamp = new Date().toISOString();

    await withStorageErrors(async () => {
      const store = openStore("rp-health");
      await store.setJSON("ping", { stamp });

      const back: unknown = await store.get("ping", { type: "json" });

      if (!back || (back as { stamp?: string }).stamp !== stamp) {
        throw new Error("Storage check failed.");
      }
    });

    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "Storage check failed. Review the server configuration.",
    };
  }
}

async function checkAi(
  config: ServerConfig
): Promise<Record<string, unknown>> {
  const budget = new BudgetManager(config.budget);

  try {
    const result = await groqChat(config, budget, {
      purpose: "work",
      maxOutputTokens: 10,
      messages: [
        {
          role: "system",
          content: "Reply with the single word OK.",
        },
        {
          role: "user",
          content: "ping",
        },
      ],
    });

    return {
      ok: true,
      reply: result.text.slice(0, 40),
      model: result.model,
      usage: budget.snapshot(),
    };
  } catch (error) {
    return {
      ok: false,
      code: error instanceof AppError ? error.code : "error",
      message:
        error instanceof Error
          ? error.message
          : "AI check failed.",
      usage: budget.snapshot(),
    };
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const check = url.searchParams.get("check");

    // Public endpoint: return only basic availability information.
    if (!check) {
      return jsonOk({
        ok: true,
        time: new Date().toISOString(),
      });
    }

    // Detailed diagnostics are private.
    const config = getConfig();
    requireAdmin(request, config);

    if (check === "storage") {
      return jsonOk({
        ok: true,
        storage: await checkStorage(),
      });
    }

    if (check === "ai") {
      return jsonOk({
        ok: true,
        ai: await checkAi(config),
      });
    }

    throw new AppError(
      "invalid_check",
      "Unsupported health check. Use storage or ai.",
      400
    );
  } catch (error) {
    return handleError(error);
  }
}
