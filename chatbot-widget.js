  // AI Chatbot Widget Script
// Injects a chatbot widget into web pages and handles Gemini (Generative Language) API integration

(function () {
  'use strict';

  // Configuration - User needs to set their Gemini (Generative Language) API key
  const CONFIG = {
    apiKey: '',
    // Use v1 base endpoint; model is appended per-request
    apiBase: 'https://generativelanguage.googleapis.com/v1',
    // default to a Gemini model available in your project
    model: 'gemini-2.5-flash',
    // For Gemini API this represents maxOutputTokens
    maxTokens: 5000,
    temperature: 0.7
  };

  let chatHistory = [];
  let isWaitingForResponse = false;
  let isInitialized = false;

  // Load configuration from storage
  function loadConfig() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        ['geminiApiKey', 'geminiModel', 'geminiTemperature', 'geminiMaxTokens'],
        (result) => {
          if (result.geminiApiKey) {
            CONFIG.apiKey = result.geminiApiKey;
          }
          if (result.geminiModel) {
            CONFIG.model = result.geminiModel;
          }
          if (result.geminiTemperature) {
            CONFIG.temperature = result.geminiTemperature;
          }
          if (result.geminiMaxTokens) {
            CONFIG.maxTokens = result.geminiMaxTokens;
          }
          resolve();
        }
      );
    });
  }

  // Initialize the widget
  async function initChatbot() {
    // Load API key from chrome storage
    await loadConfig();

    // Insert styles
    injectStyles();

    // Insert HTML
    injectHTML();

    // Attach event listeners
    attachEventListeners();

    // Add initial greeting message
    addMessage('Hello! I\'m your AI Assistant. How can I help you today?', 'bot');

    // Listen for settings updates
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync') {
        if (
          changes.chatgptApiKey ||
          changes.chatgptModel ||
          changes.chatgptTemperature ||
          changes.chatgptMaxTokens
        ) {
          loadConfig().then(() => {
            addMessage('Settings updated. You can continue chatting!', 'bot');
          });
        }
      }
    });

    isInitialized = true;
  }

  // Inject CSS styles
  function injectStyles() {
    const styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    styleLink.href = chrome.runtime.getURL('chatbot-widget.css');
    document.head.appendChild(styleLink);
  }

  // Inject HTML widget
  function injectHTML() {
    const container = document.createElement('div');
    container.innerHTML = `
      <div id="chatbot-widget-container">
        <button id="chatbot-trigger-button" title="Chat with AI Assistant">
          💬
        </button>

        <div id="chatbot-window">
          <div id="chatbot-header">
            <h3>AI Assistant</h3>
            <button id="chatbot-close-btn" title="Close chat">×</button>
          </div>

          <div id="chatbot-messages"></div>

          <div id="chatbot-error"></div>

          <div id="chatbot-input-area">
            <input
              type="text"
              id="chatbot-input"
              placeholder="Type your message..."
              autocomplete="off"
            />
            <button id="chatbot-send-btn" title="Send message">↑</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(container);

    // Inject styles
    const style = document.createElement('style');
    style.textContent = getStyleCSS();
    document.head.appendChild(style);
  }

  // Get CSS styles as string
  function getStyleCSS() {
    return `
      #chatbot-widget-container {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      }

      #chatbot-trigger-button {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        transition: all 0.3s ease;
        color: white;
        font-size: 28px;
      }

      #chatbot-trigger-button:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 16px rgba(102, 126, 234, 0.6);
      }

      #chatbot-trigger-button:active {
        transform: scale(0.95);
      }

      #chatbot-window {
        position: fixed;
        bottom: 90px;
        right: 20px;
        width: 380px;
        height: 500px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 5px 40px rgba(0, 0, 0, 0.16);
        display: none;
        flex-direction: column;
        z-index: 10001;
        overflow: hidden;
      }

      #chatbot-window.open {
        display: flex;
      }

      #chatbot-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      }

      #chatbot-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }

      #chatbot-close-btn {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        font-size: 24px;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        transition: transform 0.2s;
      }

      #chatbot-close-btn:hover {
        transform: rotate(90deg);
      }

      #chatbot-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: #f7f7f7;
      }

      .chatbot-message {
        display: flex;
        margin-bottom: 8px;
        animation: slideIn 0.3s ease;
      }

      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .chatbot-message.user {
        justify-content: flex-end;
      }

      .chatbot-message.bot {
        justify-content: flex-start;
      }

      .chatbot-message-content {
        max-width: 75%;
        padding: 10px 14px;
        border-radius: 12px;
        word-wrap: break-word;
        font-size: 14px;
        line-height: 1.4;
      }

      .chatbot-message.user .chatbot-message-content {
        background: #667eea;
        color: white;
        border-bottom-right-radius: 4px;
      }

      .chatbot-message.bot .chatbot-message-content {
        background: white;
        color: #333;
        border: 1px solid #e0e0e0;
        border-bottom-left-radius: 4px;
      }

      .chatbot-loading {
        display: flex;
        gap: 4px;
        align-items: center;
      }

      .chatbot-loading span {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #667eea;
        animation: bounce 1.4s infinite;
      }

      .chatbot-loading span:nth-child(2) {
        animation-delay: 0.2s;
      }

      .chatbot-loading span:nth-child(3) {
        animation-delay: 0.4s;
      }

      @keyframes bounce {
        0%, 80%, 100% {
          opacity: 0.3;
          transform: translateY(0);
        }
        40% {
          opacity: 1;
          transform: translateY(-10px);
        }
      }

      #chatbot-input-area {
        padding: 12px;
        border-top: 1px solid #e0e0e0;
        display: flex;
        gap: 8px;
        background: white;
      }

      #chatbot-input {
        flex: 1;
        border: 1px solid #e0e0e0;
        border-radius: 20px;
        padding: 10px 16px;
        font-size: 14px;
        font-family: inherit;
        outline: none;
        transition: border-color 0.2s;
      }

      #chatbot-input:focus {
        border-color: #667eea;
      }

      #chatbot-send-btn {
        background: #667eea;
        border: none;
        color: white;
        border-radius: 50%;
        width: 36px;
        height: 36px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        transition: background 0.2s;
      }

      #chatbot-send-btn:hover:not(:disabled) {
        background: #5568d3;
      }

      #chatbot-send-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      #chatbot-error {
        color: #d32f2f;
        font-size: 12px;
        padding: 8px 12px;
        background: #ffebee;
        border-radius: 4px;
        margin: 8px;
        display: none;
      }

      #chatbot-error.show {
        display: block;
      }
    `;
  }

  // Attach event listeners
  function attachEventListeners() {
    const triggerBtn = document.getElementById('chatbot-trigger-button');
    const closeBtn = document.getElementById('chatbot-close-btn');
    const sendBtn = document.getElementById('chatbot-send-btn');
    const input = document.getElementById('chatbot-input');

    if (triggerBtn) {
      triggerBtn.addEventListener('click', toggleChatWindow);
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', closeChatWindow);
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', sendMessage);
    }

    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
    }
  }

  // Toggle chat window visibility
  function toggleChatWindow() {
    const chatWindow = document.getElementById('chatbot-window');
    if (chatWindow) {
      chatWindow.classList.toggle('open');
      if (chatWindow.classList.contains('open')) {
        document.getElementById('chatbot-input')?.focus();
      }
    }
  }

  // Close chat window
  function closeChatWindow() {
    const chatWindow = document.getElementById('chatbot-window');
    if (chatWindow) {
      chatWindow.classList.remove('open');
    }
  }

// Add message to chat (updated for HTML support)
function addMessage(text, sender = 'user') {
  const messagesContainer = document.getElementById('chatbot-messages');
  if (!messagesContainer) return;

  const messageDiv = document.createElement('div');
  messageDiv.className = `chatbot-message ${sender}`;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'chatbot-message-content';
  
  // Use innerHTML for bot messages (to render formatting)
  if (sender === 'bot') {
    contentDiv.innerHTML = text;
  } else {
    contentDiv.textContent = text; // User messages stay as plain text
  }

  messageDiv.appendChild(contentDiv);
  messagesContainer.appendChild(messageDiv);

  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Store in history (store original text, not HTML)
  chatHistory.push({
    role: sender === 'user' ? 'user' : 'assistant',
    content: text.replace(/<[^>]*>/g, '') // Store plain text version
  });
}

  // Show loading indicator
  function showLoadingIndicator() {
    const messagesContainer = document.getElementById('chatbot-messages');
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'chatbot-message bot';
    messageDiv.id = 'loading-indicator';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'chatbot-message-content chatbot-loading';
    contentDiv.innerHTML = '<span></span><span></span><span></span>';

    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Remove loading indicator
  function removeLoadingIndicator() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.remove();
    }
  }

  // Show error message
  function showError(errorMsg) {
    const errorElement = document.getElementById('chatbot-error');
    if (errorElement) {
      errorElement.textContent = errorMsg;
      errorElement.classList.add('show');
      setTimeout(() => {
        errorElement.classList.remove('show');
      }, 5000);
    }
  }
// Function to format Gemini responses with proper HTML
function formatGeminiResponse(text) {
  // If text is short, just return it
  if (text.length < 100) return text;
  
  let formatted = text;
  
  // 1. Fix numbered lists (like "1. **Purpose**" becomes proper list)
  formatted = formatted.replace(/^(\d+\.\s+)/gm, '<br>$1');
  
  // 2. Fix bullet points (ensure they're on new lines)
  formatted = formatted.replace(/^(\*\s+)/gm, '<br>• ');
  formatted = formatted.replace(/^(-\s+)/gm, '<br>• ');
  
  // 3. Add paragraph breaks for long sections
  formatted = formatted.replace(/\n\n+/g, '</p><p>');
  formatted = formatted.replace(/\n/g, '<br>');
  
  // 4. Wrap in paragraph tags
  formatted = '<p>' + formatted + '</p>';
  
  // 5. Make bold text stand out (for markdown-style **bold**)
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // 6. Fix headers (like "Key Definitions:")
  formatted = formatted.replace(/^([A-Z][a-z]+ [A-Z][a-z]+:)/gm, '<br><strong>$1</strong><br>');
  formatted = formatted.replace(/^([A-Z][a-z]+:)/gm, '<br><strong>$1</strong><br>');
  
  return formatted;
}
// Send message to Gemini API
async function sendMessage() {
  if (isWaitingForResponse) return;

  const input = document.getElementById('chatbot-input');
  const sendBtn = document.getElementById('chatbot-send-btn');
  if (!input) return;

  const message = input.value.trim();
  if (!message) return;

  if (!CONFIG.apiKey) {
    showError('API key not configured. Please set it in the extension options.');
    return;
  }

  // Add user message
  addMessage(message, 'user');
  input.value = '';

  // Show loading
  isWaitingForResponse = true;
  sendBtn.disabled = true;
  showLoadingIndicator();

  try {
    // Prepare the request for Gemini API
    const url = `${CONFIG.apiBase}/models/${CONFIG.model}:generateContent?key=${CONFIG.apiKey}`;
    
    // Build the conversation history in Gemini format
    const contents = chatHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));
    
    // Add the current user message
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const requestBody = {
      contents: contents,
      generationConfig: {
        temperature: CONFIG.temperature,
        maxOutputTokens: CONFIG.maxTokens,
        topP: 0.95,
        topK: 40
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    };

    console.log('Sending request to Gemini API:', url);
    console.log('Request body:', requestBody);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

  // In your sendMessage() function, after getting the response:
// After getting the response:
const data = await response.json();
removeLoadingIndicator();

// Extract the text
let botMessage = '';
if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
  botMessage = data.candidates[0].content.parts[0].text;
} else if (data.error) {
  botMessage = `Error: ${data.error.message}`;
} else {
  botMessage = 'No response received.';
}

// Format the message before displaying
const formattedMessage = formatGeminiResponse(botMessage);
addMessage(formattedMessage, 'bot');  
  } catch (error) {
    removeLoadingIndicator();
    console.error('Chatbot error:', error);

    // Provide helpful error messages
    const msg = error.message || 'Unknown error';
    
    if (msg.includes('API key not valid') || msg.includes('invalid API key')) {
      showError('Invalid API key. Please check your Gemini API key in the extension settings.');
    } else if (msg.includes('Permission denied') || msg.includes('not enabled')) {
      showError('Generative Language API not enabled. Please enable it in Google AI Studio.');
    } else if (msg.includes('model not found')) {
      showError(`Model "${CONFIG.model}" not found. Try "gemini-1.5-flash" or "gemini-1.5-pro".`);
    } else if (msg.includes('quota')) {
      showError('API quota exceeded. Check your Google Cloud quota.');
    } else {
      showError(`Error: ${msg}`);
    }

    // Remove the failed user message from history for retry
    chatHistory.pop();
  } finally {
    isWaitingForResponse = false;
    sendBtn.disabled = false;
    input.focus();
  }
}

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatbot);
  } else {
    initChatbot();
  }
})();
