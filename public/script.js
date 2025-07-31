// Function to get or create a unique user ID
function getUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('userId', userId);
    }
    return userId;
}

async function sendMessage() {
    const input = document.getElementById('userInput');
    const message = input.value.trim();
    if (!message) return;

    addMessageToChat('You', message);
    input.value = '';

    // ✅ Show typing indicator
    document.getElementById('typing-indicator').style.display = 'block';

    try {
        const response = await fetch('/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              message,
              userId: getUserId() 
            })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        addMessageToChat('HumorHealer', data.reply);
    } catch (error) {
        addMessageToChat('HumorHealer', "Sorry, something went wrong.");
        console.error('Error sending message:', error);
    } finally {
        // ✅ Hide typing indicator
        document.getElementById('typing-indicator').style.display = 'none';
    }
}


// Helper to add messages to the chat div
function addMessageToChat(sender, message) {
    const chat = document.getElementById('chat');
    const messageElem = document.createElement('p');
    messageElem.innerHTML = `<strong>${sender}:</strong> ${message}`;
    chat.appendChild(messageElem);
    chat.scrollTop = chat.scrollHeight;
}

// Reset button method - updated to include userId
document.getElementById('resetBtn').addEventListener('click', async () => {
    try {
      const response = await fetch('/reset', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: getUserId()  // Added userId here
        })
      });
      const data = await response.json();
      alert(data.message || "Conversation reset.");
  
      // Clear chat and input after reset
      document.getElementById('chat').innerHTML = '';
      document.getElementById('userInput').value = '';
    } catch (error) {
      alert('Failed to reset conversation.');
      console.error(error);
    }
});

// Optional: Load conversation history when page loads
async function loadConversationHistory() {
    try {
        const response = await fetch(`/history/${getUserId()}`);
        const data = await response.json();
        
        // Display previous messages
        data.messages.forEach(msg => {
            const sender = msg.role === 'user' ? 'You' : 'HumorHealer';
            addMessageToChat(sender, msg.content);
        });
        
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

// Load history when page loads
window.addEventListener('DOMContentLoaded', () => {
    loadConversationHistory();
});

// Allow pressing Enter to send message
document.getElementById('userInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // Prevents newline
        sendMessage();
    }
});
