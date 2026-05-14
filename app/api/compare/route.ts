import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { analysisA, analysisB } = await req.json();

    const prompt = `
      You are a senior literary critic. Compare these two story analyses and provide a concise summary.
      
      Analysis A:
      - Score: ${analysisA.overallScore}
      - Summary: ${analysisA.summary}
      - Themes: ${analysisA.themes?.join(", ")}
      
      Analysis B:
      - Score: ${analysisB.overallScore}
      - Summary: ${analysisB.summary}
      - Themes: ${analysisB.themes?.join(", ")}
      
      Please provide:
      1. Which version is stronger and why?
      2. What specifically improved from A to B (or vice versa if A is better)?
      3. What still needs work in the stronger version?
      
      Respond in a concise, bulleted format. Use a professional but encouraging tone.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });
    
    const text = response.text || "";

    return NextResponse.json({ summary: text });
  } catch (error) {
    console.error("Comparison AI failed:", error);
    return NextResponse.json({ error: "Failed to generate comparison summary" }, { status: 500 });
  }
}
