// Options page script for AI Chatbot extension

document.addEventListener('DOMContentLoaded', loadSettings);
document.getElementById('options-form').addEventListener('submit', saveSettings);

function loadSettings() {
  // Load with chatgpt* keys (for backward compatibility)
  chrome.storage.sync.get(
    ['geminiApiKey', 'chatgptApiKey', 'geminiModel', 'chatgptModel', 'geminiTemperature', 'chatgptTemperature', 'geminiMaxTokens', 'chatgptMaxTokens'],
    (result) => {
      // Try gemini* keys first, fall back to chatgpt* keys for migration
      const apiKey = result.geminiApiKey || result.chatgptApiKey;
      const model = result.geminiModel || result.chatgptModel || 'gemini-2.5-flash';
      const temperature = result.geminiTemperature || result.chatgptTemperature || 0.7;
      const maxTokens = result.geminiMaxTokens || result.chatgptMaxTokens || 500;
      
      if (apiKey) document.getElementById('api-key').value = apiKey;
      document.getElementById('model').value = model;
      document.getElementById('temperature').value = temperature;
      document.getElementById('max-tokens').value = maxTokens;
    }
  );
}

function saveSettings(e) {
  e.preventDefault();

  const apiKey = document.getElementById('api-key').value.trim();
  const model = document.getElementById('model').value;
  const temperature = parseFloat(document.getElementById('temperature').value) || 0.7;
  const maxTokens = parseInt(document.getElementById('max-tokens').value) || 500;

  // Validation
  if (!apiKey) {
    showStatus('API key is required', 'error');
    return;
  }

  if (isNaN(temperature) || temperature < 0 || temperature > 2) {
    showStatus('Temperature must be between 0 and 2', 'error');
    return;
  }

  if (maxTokens < 1 || maxTokens > 8192) {  // Increased limit for Gemini
    showStatus('Max tokens must be between 1 and 8192', 'error');
    return;
  }

  // Save to chrome storage
  chrome.storage.sync.set(
    {
      geminiApiKey: apiKey,
      geminiModel: model,
      geminiTemperature: temperature,
      geminiMaxTokens: maxTokens
    },
    () => {
      showStatus('Settings saved successfully!', 'success');
      // Notify content scripts of the change
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs.sendMessage(tab.id, { 
            type: 'SETTINGS_UPDATED',
            settings: { apiKey, model, temperature, maxTokens }
          }).catch(() => {
            // Ignore errors for tabs that don't have content script
          });
        });
      });
    }
  );
}

function showStatus(message, type) {
  const statusDiv = document.getElementById('save-status');
  statusDiv.textContent = message;
  statusDiv.className = type;

  if (type === 'success') {
    setTimeout(() => {
      statusDiv.textContent = '';
      statusDiv.className = '';
    }, 3000);
  }
}