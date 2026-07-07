import dotenv from "dotenv";
dotenv.config();

export const getHintFromGemini = async (
  apiKey: string,
  model: string,
  persona: string,
  mode: string,
  problem: any,
  codeState: any,
  userPrompt: string,
  history: any[],
  action: string
) => {
  const selectedModel = model || "gemini-2.5-flash";
  
  const systemInstruction = `You are HintFlow, a premium mock interviewer and AI coding coach.
Your goal is to guide the user to solve their coding problem without giving direct code solutions.
DO NOT WRITE COMPLETE CODE BLOCKS for the solution. If the user asks for code, guide them conceptually or write small pseudocode snippets instead.

Current Mode: ${mode === 'interviewer' ? 'FAANG Interviewer Mode (Act like an interviewer, ask approach, time/space complexity, edge cases, probe code bugs)' : 'Supportive Coding Tutor Mode (Provide progressive hints, explain concepts)'}
Persona setting: ${persona}

IMPORTANT: You must return your response STRICTLY as a JSON object matching this schema. Do not wrap it in any other text.
{
  "chatMessage": "The text message you say to the user.",
  "progress": 75,
  "progressDesc": "Short encouraging progress description",
  "currentApproach": "Description of user's current approach, e.g. Brute Force or Two Pointers",
  "betterApproach": "The next better approach they should aim for, e.g. Binary Search, or 'None (Optimal)'",
  "userCodeTimeComplexity": "Time complexity of user's code, e.g. O(n²)",
  "userCodeSpaceComplexity": "Space complexity of user's code, e.g. O(1)",
  "canImproveComplexity": true,
  "hintLevel": 2,
  "hintText": "A short conceptual hint (no code) for their current stage."
}`;

  const promptText = `
PROBLEM CONTEXT:
Title: ${problem.title}
Difficulty: ${problem.difficulty}
Description: ${problem.description}
Constraints: ${problem.constraints}

USER CODE CONTEXT:
Language: ${codeState.language}
Current Code:
\`\`\`
${codeState.code}
\`\`\`

USER TRIGGER ACTION: ${action ? `User triggered action: ${action}` : 'None'}
USER MESSAGE: ${userPrompt}

Please evaluate the code and conversation, and respond with the required JSON payload.`;

  // Map history to standard roles for Gemini, starting with user and alternating strictly
  const contents: any[] = [];
  let expectedRole = 'user';
  
  for (const msg of history) {
    if (contents.length === 0 && msg.role === 'model') {
      continue; // Skip initial welcome message from model
    }
    const role = msg.role === 'model' ? 'model' : 'user';
    if (role === expectedRole) {
      contents.push({
        role,
        parts: [{ text: msg.text }]
      });
      expectedRole = expectedRole === 'user' ? 'model' : 'user';
    }
  }
  
  // Append current prompt (always from user, alternating correctly)
  contents.push({
    role: 'user',
    parts: [{ text: promptText }]
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents,
      system_instruction: {
        parts: [{ text: systemInstruction }]
      },
      generation_config: {
        response_mime_type: "application/json",
        response_schema: {
          type: "OBJECT",
          properties: {
            chatMessage: { type: "STRING" },
            progress: { type: "INTEGER" },
            progressDesc: { type: "STRING" },
            currentApproach: { type: "STRING" },
            betterApproach: { type: "STRING" },
            userCodeTimeComplexity: { type: "STRING" },
            userCodeSpaceComplexity: { type: "STRING" },
            canImproveComplexity: { type: "BOOLEAN" },
            hintLevel: { type: "INTEGER" },
            hintText: { type: "STRING" }
          },
          required: ["chatMessage", "progress", "currentApproach", "betterApproach", "userCodeTimeComplexity", "userCodeSpaceComplexity", "canImproveComplexity", "hintLevel", "hintText"]
        }
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!responseText) {
    throw new Error("Empty response from Gemini API");
  }

  return JSON.parse(responseText);
};
export const getHintFromGroq = async (
  apiKey: string,
  model: string,
  persona: string,
  mode: string,
  problem: any,
  codeState: any,
  userPrompt: string,
  history: any[],
  action: string
) => {
  const selectedModel = model || "llama-3.3-70b-versatile";
  
  const systemInstruction = `You are HintFlow, a premium mock interviewer and AI coding coach.
Your goal is to guide the user to solve their coding problem without giving direct code solutions.
DO NOT WRITE COMPLETE CODE BLOCKS for the solution. If the user asks for code, guide them conceptually or write small pseudocode snippets instead.

Current Mode: ${mode === 'interviewer' ? 'FAANG Interviewer Mode (Act like an interviewer, ask approach, time/space complexity, edge cases, probe code bugs)' : 'Supportive Coding Tutor Mode (Provide progressive hints, explain concepts)'}
Persona setting: ${persona}

IMPORTANT: You must return your response STRICTLY as a JSON object matching this schema. Do not wrap it in any other text or markdown blocks (e.g. do not wrap in \`\`\`json).
{
  "chatMessage": "The text message you say to the user.",
  "progress": 75,
  "progressDesc": "Short encouraging progress description",
  "currentApproach": "Description of user's current approach, e.g. Brute Force or Two Pointers",
  "betterApproach": "The next better approach they should aim for, e.g. Binary Search, or 'None (Optimal)'",
  "userCodeTimeComplexity": "Time complexity of user's code, e.g. O(n²)",
  "userCodeSpaceComplexity": "Space complexity of user's code, e.g. O(1)",
  "canImproveComplexity": true,
  "hintLevel": 2,
  "hintText": "A short conceptual hint (no code) for their current stage."
}`;

  const promptText = `
PROBLEM CONTEXT:
Title: ${problem.title}
Difficulty: ${problem.difficulty}
Description: ${problem.description}
Constraints: ${problem.constraints}

USER CODE CONTEXT:
Language: ${codeState.language}
Current Code:
\`\`\`
${codeState.code}
\`\`\`

USER TRIGGER ACTION: ${action ? `User triggered action: ${action}` : 'None'}
USER MESSAGE: ${userPrompt}

Please evaluate the code and conversation, and respond with the required JSON payload.`;

  // Map history to standard OpenAI roles ('user' or 'assistant')
  const messages = [
    { role: 'system', content: systemInstruction }
  ];

  for (const msg of history) {
    if (messages.length === 1 && msg.role === 'model') {
      continue; // Skip initial welcome message
    }
    messages.push({
      role: msg.role === 'model' ? 'assistant' : 'user',
      content: msg.text
    });
  }

  // Append current prompt
  messages.push({
    role: 'user',
    content: promptText
  });

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: selectedModel,
      messages: messages,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API Error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const responseText = result.choices?.[0]?.message?.content;
  if (!responseText) {
    throw new Error("Empty response from Groq API");
  }

  return JSON.parse(responseText);
};