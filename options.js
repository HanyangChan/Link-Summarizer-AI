const aiProviderSelect = document.getElementById('aiProvider');
const geminiGroup = document.getElementById('gemini-group');
const groqGroup = document.getElementById('groq-group');

function updateVisibility() {
    const provider = aiProviderSelect.value;
    if (provider === 'gemini') {
        geminiGroup.classList.remove('hidden');
        groqGroup.classList.add('hidden');
    } else {
        geminiGroup.classList.add('hidden');
        groqGroup.classList.remove('hidden');
    }
}

aiProviderSelect.addEventListener('change', updateVisibility);

document.getElementById('save').addEventListener('click', () => {
    const aiProvider = aiProviderSelect.value;
    const geminiApiKey = document.getElementById('apiKey').value.trim();
    const groqApiKey = document.getElementById('groqApiKey').value.trim();

    if (aiProvider === 'gemini' && !geminiApiKey) {
        showStatus(chrome.i18n.getMessage('missingKey'), 'red');
        return;
    }
    if (aiProvider === 'groq' && !groqApiKey) {
        showStatus(chrome.i18n.getMessage('missingKey'), 'red');
        return;
    }

    chrome.storage.local.set({
        aiProvider,
        geminiApiKey,
        groqApiKey
    }, () => {
        showStatus(chrome.i18n.getMessage('settingsSaved'), 'lightgreen');
    });
});

// Load existing settings
chrome.storage.local.get(['aiProvider', 'geminiApiKey', 'groqApiKey'], (result) => {
    aiProviderSelect.value = result.aiProvider || 'groq';
    if (result.geminiApiKey) {
        document.getElementById('apiKey').value = result.geminiApiKey;
    }
    if (result.groqApiKey) {
        document.getElementById('groqApiKey').value = result.groqApiKey;
    }
    updateVisibility();
});

function showStatus(message, color) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.style.color = color;
    setTimeout(() => {
        status.textContent = '';
    }, 3000);
}
