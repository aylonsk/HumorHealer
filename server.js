// server.js
const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();
const { OpenAI } = require('openai');
const fs = require('fs');

const THREADS_FILE = './threads.json';

const app = express();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  defaultHeaders: {
    "OpenAI-Beta": "assistants=v2",
  },
});

app.use(bodyParser.json());
app.use(express.static('public'));

// Store thread IDs for different users/sessions
let threads = {};

// Load existing threads from file
if (fs.existsSync(THREADS_FILE)) {
  threads = JSON.parse(fs.readFileSync(THREADS_FILE, 'utf-8'));
  console.log("📂 Loaded threads from disk:", threads);
}

// Create or get assistant
let assistantId = null;

async function getOrCreateAssistant() {
  try {
    // You can store the assistant ID in an env variable to reuse it
    if (process.env.ASSISTANT_ID) {
      assistantId = process.env.ASSISTANT_ID;
      return assistantId;
    }

    // Create a new assistant
    const assistant = await openai.beta.assistants.create({
      name: "Therapy Assistant",
      instructions: "You are a helpful, empathetic therapy assistant. You provide supportive and understanding responses to help users with their emotional well-being.",
      model: "gpt-4o",
    });

    assistantId = assistant.id;
    console.log("✅ Created new assistant:", assistantId);
    console.log("💡 Add ASSISTANT_ID=" + assistantId + " to your .env file to reuse this assistant");
    
    return assistantId;
  } catch (error) {
    console.error("❌ Error creating/getting assistant:", error);
    throw error;
  }
}

// Initialize assistant on startup
getOrCreateAssistant();

app.post('/ask', async (req, res) => {
    const userMessage = req.body.message;
    const userId = req.body.userId || 'default';
    
    console.log("📥 Received request - userId:", userId, "message:", userMessage);
  
    try {
      // Ensure we have an assistant
      if (!assistantId) {
        await getOrCreateAssistant();
      }
  
      // Create or retrieve thread for this user
      let threadId = threads[userId];
      console.log("🔍 Looking up thread for userId:", userId, "Found:", threadId);
      
      if (!threadId) {
        const thread = await openai.beta.threads.create();
        threadId = thread.id;
        threads[userId] = threadId;
        
        // Save threads to file
        fs.writeFileSync(THREADS_FILE, JSON.stringify(threads, null, 2));
        console.log("🆕 Created new thread for user:", userId, "Thread ID:", threadId);
      }
  
      // Add message to thread
      await openai.beta.threads.messages.create(threadId, {
        role: "user",
        content: userMessage
      });
  
      // Create a run
      console.log("🏃 Creating run with threadId:", threadId, "assistantId:", assistantId);
      const run = await openai.beta.threads.runs.create(threadId, {
        assistant_id: assistantId
      });
      
      console.log("✅ Run created:", run);
      const runId = run.id;
      console.log("🆔 Run ID:", runId, "Thread ID:", threadId);
    
      // Poll for completion - Try using the client directly
      console.log("🔄 About to poll - threadId:", threadId, "runId:", runId);
      
      // Alternative approach - use the full client path
      let runStatus = await openai.get(`/threads/${threadId}/runs/${runId}`, {
        headers: { "OpenAI-Beta": "assistants=v2" }
      }).catch(async (err) => {
        // If that fails, try the original method but with explicit string conversion
        console.log("First attempt failed, trying alternative...");
        return await openai.beta.threads.runs.retrieve(
          String(threadId), 
          String(runId)
        );
      });
      
      console.log("📊 Initial run status:", runStatus.status || runStatus.data?.status);
    
      while ((runStatus.status || runStatus.data?.status) !== 'completed') {
          await new Promise(resolve => setTimeout(resolve, 1000));
          console.log("🔄 Polling again - threadId:", threadId, "runId:", runId);
          
          runStatus = await openai.get(`/threads/${threadId}/runs/${runId}`, {
            headers: { "OpenAI-Beta": "assistants=v2" }
          }).catch(async (err) => {
            return await openai.beta.threads.runs.retrieve(
              String(threadId), 
              String(runId)
            );
          });
          
          const status = runStatus.status || runStatus.data?.status;
          console.log("📊 Run status:", status);
          
          // Add timeout to prevent infinite loops
          if (status === 'failed' || status === 'cancelled') {
            throw new Error(`Run ${status}: ${runStatus.last_error?.message || 'Unknown error'}`);
          }
      }
  
      // Get messages
      const messages = await openai.beta.threads.messages.list(threadId);
      const assistantReply = messages.data.find(msg => msg.role === "assistant")?.content[0].text.value || "No assistant response found.";

  
      console.log("💬 Assistant reply:", assistantReply);
  
      res.json({ reply: assistantReply });
  
    } catch (error) {
      console.error("❌ Error:", error);
      res.status(500).json({ reply: "Sorry, something went wrong." });
    }
  });

app.post('/reset', async (req, res) => {
  const userId = req.body.userId || 'default';
  
  try {
    if (threads[userId]) {
      try {
        await openai.beta.threads.del(threads[userId]);
        console.log("🗑️ Deleted thread:", threads[userId]);
      } catch (error) {
        console.log("⚠️ Could not delete thread (may already be deleted):", error.message);
      }
    }

    // Create a new thread
    const thread = await openai.beta.threads.create();
    threads[userId] = thread.id;
    
    // Save threads to file
    fs.writeFileSync(THREADS_FILE, JSON.stringify(threads, null, 2));
    
    console.log("🔄 Reset conversation for user:", userId, "New thread:", thread.id);
    res.json({ message: "Conversation reset." });
    
  } catch (error) {
    console.error("❌ Error resetting conversation:", error);
    res.status(500).json({ message: "Error resetting conversation." });
  }
});

// Get conversation history
app.get('/history/:userId', async (req, res) => {
  const userId = req.params.userId || 'default';
  const threadId = threads[userId];
  
  if (!threadId) {
    return res.json({ messages: [] });
  }
  
  try {
    const messages = await openai.beta.threads.messages.list(threadId);
    const formattedMessages = messages.data.reverse().map(msg => ({
      role: msg.role,
      content: msg.content[0].text.value,
      created_at: msg.created_at
    }));
    
    res.json({ messages: formattedMessages });
  } catch (error) {
    console.error("❌ Error fetching history:", error);
    res.status(500).json({ messages: [] });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});