import { Request, Response } from "express";
import { getHint } from "../services/ai.service.js"

export const generateHint = (req: Request, res: Response) => {
    const hint = getHint();

    res.json({
        hint
    });
};