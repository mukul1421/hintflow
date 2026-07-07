import { Request, Response } from "express";
import { getHintFromGemini, getHintFromGroq } from "../services/ai.service.js";

export const generateHint = async (req: Request, res: Response): Promise<void> => {
  try {
    const { problem, codeState, userPrompt, history, action, settings } = req.body;
    const provider = settings?.provider || "gemini";

    let result;
    if (provider === "groq") {
      const apiKey = (req.headers["authorization"]?.toString().replace("Bearer ", "") || 
                      req.headers["x-api-key"]?.toString() || 
                      settings?.groqApiKey ||
                      process.env.GROQ_API_KEY) as string;

      if (!apiKey) {
        res.status(400).json({ error: "Groq API key is required. Provide it in settings, X-API-KEY header, or as BEARER token." });
        return;
      }

      result = await getHintFromGroq(
        apiKey,
        settings?.groqModel,
        settings?.persona,
        settings?.mode,
        problem,
        codeState,
        userPrompt,
        history || [],
        action || ""
      );
    } else {
      const apiKey = (req.headers["authorization"]?.toString().replace("Bearer ", "") || 
                      req.headers["x-api-key"]?.toString() || 
                      settings?.geminiApiKey ||
                      process.env.GEMINI_API_KEY) as string;

      if (!apiKey) {
        res.status(400).json({ error: "Gemini API key is required. Provide it in settings, X-API-KEY header, or as BEARER token." });
        return;
      }

      result = await getHintFromGemini(
        apiKey,
        settings?.geminiModel,
        settings?.persona,
        settings?.mode,
        problem,
        codeState,
        userPrompt,
        history || [],
        action || ""
      );
    }

    res.json(result);
  } catch (error: any) {
    console.error("[HintController Error]:", error);
    res.status(500).json({ error: error.message || "Failed to generate hint" });
  }
};