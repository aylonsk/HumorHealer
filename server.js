// server.js
const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();
const { OpenAI } = require('openai');
const fs = require('fs');
const HISTORY_FILE = './history.json';


const app = express();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  defaultHeaders: {
    "OpenAI-Beta": "assistants=v2",
  },
});

app.use(bodyParser.json());
app.use(express.static('public'));

let fullHistory = [];
let summary = "You are a helpful, empathetic therapy assistant.";

if (fs.existsSync(HISTORY_FILE)) {
  fullHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
  console.log("📂 Loaded fullHistory from disk:", fullHistory);
}

app.post('/ask', async (req, res) => {
  const userMessage = req.body.message;

  try {
    // Add user message to history
    fullHistory.push({ role: "user", content: userMessage });

    // Construct messages payload with summary
    const messages = [
      { role: "system", content: summary },
      { role: "user", content: userMessage }
    ];

    console.log("\uD83D\uDC40 Final messages payload:", JSON.stringify(messages, null, 2));

    const chatResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages
    });

    const assistantReply = chatResponse.choices[0].message.content;
    fullHistory.push({ role: "assistant", content: assistantReply });

    // Periodically summarize last 4 turns
    if (fullHistory.length >= 6) {
      const recentTurns = fullHistory.slice(-6); // 3 rounds of conversation
      const summarizationPrompt = [
        { role: "system", content: "Summarize this conversation in 1-3 sentences." },
        ...recentTurns
      ];
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(fullHistory, null, 2));


      const summaryResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: summarizationPrompt
      });

      summary = summaryResponse.choices[0].message.content;
      console.log("\uD83D\uDCDD New summary:", summary);
    }

    res.json({ reply: assistantReply });

  } catch (error) {
    console.error("\u274C Final catch:", error);
    res.status(500).json({ reply: "Sorry, something went wrong." });
  }
});

app.post('/reset', (req, res) => {
  fullHistory = [];
  summary = "You are a helpful, empathetic therapy assistant.";
  res.json({ message: "Conversation reset." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

