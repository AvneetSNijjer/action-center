/**
 * POST /api/insights/explain
 * Streams a Claude haiku analysis of an insight.
 * Only called when user explicitly clicks "Get AI Analysis".
 *
 * Requires ANTHROPIC_API_KEY in .env.local
 */
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface InsightContext {
  type: string;
  title: string;
  description: string;
  hotelName: string;
  hotelId: string;
  affectedDates?: string[];
  compLabel?: string;
  confidenceScore?: number | null;
  // Extra context for specific types
  meta?: Record<string, string | number | boolean | null>;
}

const SYSTEM_PROMPT = `You are an expert hotel revenue management analyst for Ampliphi, an AI-powered revenue management platform. You provide concise, actionable insights to revenue managers.

When analysing an insight:
1. Explain WHY this matters in plain business English (2-3 sentences max)
2. Give a SPECIFIC recommended action with exact numbers where possible
3. Explain the REASONING behind the recommendation (1-2 sentences)
4. Mention any RISKS of not acting

Keep your response under 200 words. Be direct. Use dollar signs and percentages. No bullet lists — write in flowing paragraphs. Never use jargon like "leverage" or "synergise".`;

function buildUserPrompt(ctx: InsightContext): string {
  const dateStr = ctx.affectedDates?.length
    ? `Affected dates: ${ctx.affectedDates.join(", ")}.`
    : "";

  const metaStr = ctx.meta
    ? Object.entries(ctx.meta)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ")
    : "";

  return `Hotel: ${ctx.hotelName} (${ctx.hotelId})
Insight type: ${ctx.type}
Title: ${ctx.title}
Details: ${ctx.description}
${dateStr}
${metaStr ? `Additional context: ${metaStr}` : ""}
Comparison baseline: ${ctx.compLabel ?? "30d avg"}
Confidence: ${ctx.confidenceScore != null ? `${(ctx.confidenceScore * 100).toFixed(0)}%` : "unknown"}

Provide your revenue management analysis.`;
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: "ANTHROPIC_API_KEY not configured. Add it to .env.local to enable AI analysis.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  let ctx: InsightContext;
  try {
    ctx = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const client = new Anthropic({ apiKey });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const stream = await client.messages.stream({
          model: "claude-haiku-4-5",
          max_tokens: 400,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildUserPrompt(ctx) }],
        });

        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "AI analysis failed";
        controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
