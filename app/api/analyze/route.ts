import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

// Models tried in order — if one is overloaded, we fall back to the next
const MODEL_FALLBACK_CHAIN = [
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-1.5-flash",
];

const PROMPT_TEMPLATE = (story: string) => `Analyze the following story critically and honestly.

Return ONLY valid JSON with NO markdown, NO code fences, NO extra text, NO commentary.
The response must start with { and end with }.

JSON format:
{
  "overallScore": number (1-10),
  "grammar": number (1-10),
  "plot": number (1-10),
  "characters": number (1-10),
  "pacing": number (1-10),
  "originality": number (1-10),
  "emotionalImpact": number (1-10),
  "strengths": [array of strings],
  "weaknesses": [array of strings],
  "suggestions": [array of strings]
}

Be direct and critical. Point out genuine flaws.

Story:
${story}`;

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithFallback(prompt: string) {
  let lastError: unknown;

  for (const model of MODEL_FALLBACK_CHAIN) {
    try {
      console.log(`Trying model: ${model}`);
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });
      console.log(`Success with model: ${model}`);
      return response;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const shouldTryNext =
        errMsg.includes("UNAVAILABLE") ||
        errMsg.includes("RESOURCE_EXHAUSTED") ||
        errMsg.includes("high demand") ||
        errMsg.includes("overloaded") ||
        errMsg.includes("quota") ||
        errMsg.includes("503") ||
        errMsg.includes("429");

      console.warn(`Model ${model} failed:`, errMsg.slice(0, 200));
      lastError = err;

      if (shouldTryNext) {
        await delay(1500);
        continue;
      }
      // Non-retriable error — rethrow immediately
      throw err;
    }
  }

  throw lastError;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { story } = body;

    if (!story || typeof story !== "string" || story.trim() === "") {
      return NextResponse.json(
        { error: "Story is required" },
        { status: 400 }
      );
    }

    const prompt = PROMPT_TEMPLATE(story);
    const response = await generateWithFallback(prompt);
    const raw = response.text ?? "";

    // Extract the first JSON object block — handles thinking output, markdown fences, etc.
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error("No JSON object found in Gemini response. Raw:", raw);
      return NextResponse.json(
        { error: "Failed to analyze story." },
        { status: 500 }
      );
    }

    const parsedJson = JSON.parse(match[0]);
    return NextResponse.json(parsedJson);

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Gemini analysis error:", errMsg);

    const isOverloaded =
      errMsg.includes("UNAVAILABLE") ||
      errMsg.includes("high demand") ||
      errMsg.includes("overloaded");

    return NextResponse.json(
      {
        error: isOverloaded
          ? "AI is currently busy. Please try again in a moment."
          : "Failed to analyze story.",
      },
      { status: 503 }
    );
  }
}
