import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

const MODEL_FALLBACK_CHAIN = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-flash-latest",
  "gemini-2.5-pro",
  "gemini-2.0-pro",
  "gemini-1.5-pro",
  "gemini-pro-latest"
];



const QUICK_PROMPT = (story: string) => `Analyze the following story concisely.
Return ONLY valid JSON.

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
  "suggestions": [array of strings],
  "summary": "a 2-sentence summary",
  "themes": ["theme1", "theme2"]
}

Story:
${story}`;

const DEEP_PROMPT = (story: string) => `Analyze the following story critically and honestly.
Return ONLY valid JSON.

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
  "summary": "a 3-sentence summary",
  "themes": [array of strings],
  "characters": [
    { "name": "Name", "mentions": number, "role": "role" }
  ],
  "timeline": [array of events],
  "readability": {
    "flesch_reading_ease": number,
    "grade_level": number,
    "word_count": number,
    "sentence_count": number,
    "average_sentence_length": number
  },
  "sentiment": [{ "section": 1, "score": number }],
  "relationshipGraph": {
    "nodes": [{ "id": "Name", "type": "type" }],
    "links": [{ "source": "A", "target": "B", "type": "type" }]
  }
}

Story:
${story}`;

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithFallback(prompt: string) {
  let lastError: unknown;
  for (const model of MODEL_FALLBACK_CHAIN) {
    try {
      const response = await ai.models.generateContent({ model, contents: prompt });
      return response;
    } catch (err: any) {
      lastError = err;
      await delay(1000);
      continue;
    }
  }
  throw lastError;
}

export async function POST(req: Request) {
  try {
    const { story, analysisMode = "deep" } = await req.json();

    if (!story?.trim()) {
      return NextResponse.json({ error: "Story is required" }, { status: 400 });
    }

    const prompt = analysisMode === "quick" ? QUICK_PROMPT(story) : DEEP_PROMPT(story);
    
    let response;
    try {
      response = await generateWithFallback(prompt);
    } catch (err: any) {
      console.error("Gemini API Error:", err);
      return NextResponse.json({ 
        error: "AI Generation failed", 
        details: err.message || "Unknown API error" 
      }, { status: 500 });
    }

    const raw = response.text ?? "";
    if (!raw) {
      return NextResponse.json({ error: "Empty response from AI" }, { status: 500 });
    }

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error("No JSON found in AI response:", raw);
      return NextResponse.json({ error: "Invalid AI response format" }, { status: 500 });
    }

    let parsedJson;
    try {
      parsedJson = JSON.parse(match[0]);
    } catch (err: any) {
      console.error("JSON Parse Error:", err, "Raw match:", match[0]);
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    parsedJson.analysisMode = analysisMode;

    // Fix character score field mapping
    if (parsedJson.charactersScore !== undefined) {
      const charList = Array.isArray(parsedJson.characters) ? parsedJson.characters : [];
      parsedJson.characterList = charList;
      parsedJson.characters = parsedJson.charactersScore;
    } else if (Array.isArray(parsedJson.characters)) {
      parsedJson.characterList = parsedJson.characters;
      parsedJson.characters = 5; // fallback
    } else if (typeof parsedJson.characters === 'number') {
      parsedJson.characterList = [];
    }

    return NextResponse.json(parsedJson);

  } catch (error: any) {
    console.error("Analysis error:", error);
    return NextResponse.json({ 
      error: "Analysis failed", 
      details: error.message || "Unknown error" 
    }, { status: 500 });
  }
}

