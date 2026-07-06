import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import hintRoutes from "./routes/hint.routes.js"

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/hint", hintRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "HintFlow Backend Running 🚀",
  });
});


const PORT = process.env.PORT || 3000;


app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});