async function sendMessage() {
    const input = document.getElementById('userInput');
    const message = input.value.trim();
    if (!message) return;
  
    addMessageToChat('You', message);
    input.value = '';
  
    try {
      const response = await fetch('/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })  // sending to /ask endpoint
      });
  
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
  
      const data = await response.json();
      addMessageToChat('HumorHealer', data.reply); // show bot reply
    } catch (error) {
      addMessageToChat('HumorHealer', "Sorry, something went wrong.");
      console.error('Error sending message:', error);
    }
  }
  
  
  
  // Helper to add messages to the chat div
  function addMessageToChat(sender, message) {
    const chat = document.getElementById('chat');
    const messageElem = document.createElement('p');
    messageElem.innerHTML = `<strong>${sender}:</strong> ${message}`;
    chat.appendChild(messageElem);
    chat.scrollTop = chat.scrollHeight; // scroll to bottom
  }
  
  //Reset button method
  document.getElementById('resetBtn').addEventListener('click', async () => {
    try {
      const response = await fetch('/reset', { method: 'POST' });
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
  
  