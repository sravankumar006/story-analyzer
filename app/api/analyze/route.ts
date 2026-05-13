import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

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

    const prompt = `Analyze the following story critically and honestly.

Return ONLY valid JSON in this format:
{
  "overallScore": number,
  "grammar": number,
  "plot": number,
  "characters": number,
  "pacing": number,
  "originality": number,
  "emotionalImpact": number,
  "strengths": [string],
  "weaknesses": [string],
  "suggestions": [string]
}

Be direct and critical.
Do not be overly positive.
Point out genuine flaws.

Story:
${story}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const text = response.text || "";

    // Clean up potential markdown formatting block if the model outputs ```json
    const cleanedText = text.replace(/```json/gi, "").replace(/```/gi, "").trim();

    const parsedJson = JSON.parse(cleanedText);

    return NextResponse.json(parsedJson);
  } catch (error) {
    console.error("Gemini analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze story." },
      { status: 500 }
    );
  }
}
