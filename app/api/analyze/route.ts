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
  "charactersScore": number (1-10),
  "pacing": number (1-10),
  "originality": number (1-10),
  "emotionalImpact": number (1-10),
  "strengths": [array of strings],
  "weaknesses": [array of strings],
  "suggestions": [array of strings],
  "summary": "a 2-3 sentence critical summary of the story",
  "themes": ["theme1", "theme2", "theme3"],
  "characters": [
    { "name": "Character Name", "mentions": number, "role": "protagonist|antagonist|supporting|minor" }
  ],
  "timeline": [
    "Event 1 description",
    "Event 2 description"
  ],
  "readability": {
    "flesch_reading_ease": number (0-100),
    "grade_level": number,
    "word_count": number,
    "sentence_count": number
  },
  "sentiment": [
    { "section": "Opening", "score": number (-1 to 1) },
    { "section": "Inciting Incident", "score": number (-1 to 1) },
    { "section": "Rising Action", "score": number (-1 to 1) },
    { "section": "Climax", "score": number (-1 to 1) },
    { "section": "Falling Action", "score": number (-1 to 1) },
    { "section": "Resolution", "score": number (-1 to 1) }
  ],
  "relationshipGraph": {
    "nodes": [{ "id": "Character Name", "type": "protagonist|antagonist|supporting" }],
    "links": [{ "source": "Char A", "target": "Char B", "type": "friend|enemy|family|romantic|rival" }]
  }
}

Rules:
- Be direct and critical. Point out genuine flaws.
- For readability, calculate these yourself based on the story text.
- For timeline, list 3-6 key plot events in chronological order.
- For characters, only include characters that actually appear in the story.
- "charactersScore" is a numeric rating 1-10 of how well-written the characters are.
- For sentiment, provide a score for each narrative phase based on the story's tone.
- For relationshipGraph, only include significant character dynamics found in the text.

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

    // Gemini returns both a numeric "characters" score AND a "characters" array.
    // Remap the array to "characterList" so the numeric score field is preserved.
    if (Array.isArray(parsedJson.characters)) {
      parsedJson.characterList = parsedJson.characters;
      // Try to recover the numeric score from a sibling field if present
      parsedJson.characters = typeof parsedJson.charactersScore === "number"
        ? parsedJson.charactersScore
        : 5; // fallback neutral score
    }

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
