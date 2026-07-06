import express from "express";
import { generateHint } from "../controllers/hint.controller.js";

const router = express.Router();

router.post("/", generateHint);

export default router;