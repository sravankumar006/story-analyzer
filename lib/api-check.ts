
import { GoogleGenAI } from "@google/genai";

/**
 * Verifies Gemini API connectivity and lists available models.
 * Useful for debugging environment issues.
 */
export async function checkApiHealth() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return { 
      status: "error", 
      message: "GEMINI_API_KEY is missing from environment variables." 
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const modelsResponse = await ai.models.list();
    
    // In @google/genai, models.list() is an async iterator
    const availableModels: string[] = [];
    for await (const model of modelsResponse) {
      if (model.name) {
        availableModels.push(model.name);
      }
    }


    return {
      status: "ok",
      modelsCount: availableModels.length,
      availableModels: availableModels.slice(0, 10), // Return first 10 for brevity
      message: "API connectivity verified successfully."
    };
  } catch (error: any) {
    return {
      status: "error",
      message: error.message || "Failed to connect to Gemini API",
      error: error
    };
  }
}
