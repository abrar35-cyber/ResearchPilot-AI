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
        throw new Error("Wrote a test value but could not read it back.");
      }
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Storage check failed." };
  }
}

async function checkAi(config: ServerConfig): Promise<Record<string, unknown>> {
  const budget = new BudgetManager(config.budget);
  try {
    const result = await groqChat(config, budget, {
      purpose: "work",
      maxOutputTokens: 10,
      messages: [
        { role: "system", content: "Reply with the single word OK." },
        { role: "user", content: "ping" },
      ],
    });
    return { ok: true, reply: result.text.slice(0, 40), model: result.model, usage: budget.snapshot() };
  } catch (error) {
    return {
      ok: false,
      code: error instanceof AppError ? error.code : "error",
      message: error instanceof Error ? error.message : "AI check failed.",
      usage: budget.snapshot(),
    };
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const check = url.searchParams.get("check");
    const config = getConfig();

    const body: Record<string, unknown> = {
      ok: true,
      time: new Date().toISOString(),
      config: {
        groqConfigured: Boolean(config.groqApiKey),
        groqModel: config.groqModel,
        openAlexConfigured: Boolean(config.openAlexApiKey),
        adminTokenConfigured: Boolean(config.adminToken),
        manualBlobsConfig: Boolean(config.blobs),
        aiCallTimeoutMs: config.aiCallTimeoutMs,
        budget: config.budget,
        warnings: config.warnings,
      },
    };

    if (check === "storage") body.storage = await checkStorage();
    if (check === "ai") {
      requireAdmin(url, config);
      body.ai = await checkAi(config);
    }

    return jsonOk(body);
  } catch (error) {
    return handleError(error);
  }
}
