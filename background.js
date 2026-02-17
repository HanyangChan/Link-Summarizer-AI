console.log("[Background] Service Worker started!");

// We will try several model/version combinations to find one that works for your API key.
const MODEL_COMBINATIONS = [
    { version: "v1beta", model: "gemini-flash-latest" },
    { version: "v1beta", model: "gemini-1.5-flash" },
    { version: "v1beta", model: "gemini-1.5-flash-latest" },
    { version: "v1", model: "gemini-1.5-flash" },
    { version: "v1beta", model: "gemini-1.5-flash-001" },
    { version: "v1beta", model: "gemini-1.5-flash-002" },
    { version: "v1beta", model: "gemini-1.5-pro" },
    { version: "v1beta", model: "gemini-1.0-pro" },
    { version: "v1beta", model: "gemini-2.0-flash-exp" }
];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "summarize") {
        console.log("[Background] Analyzing URL:", request.url);
        handleSummarize(request.url)
            .then(response => {
                console.log("[Background] Analysis result:", response);
                sendResponse(response);
            })
            .catch(err => {
                console.error("[Background] Message handler error:", err);
                sendResponse({ error: "Internal error: " + err.message });
            });
        return true;
    }
});

async function handleSummarize(url) {
    try {
        const { aiProvider, geminiApiKey, groqApiKey } = await chrome.storage.local.get(['aiProvider', 'geminiApiKey', 'groqApiKey']);
        const provider = aiProvider || 'groq'; // Default to groq

        if (provider === 'gemini' && !geminiApiKey) {
            return { error: "Gemini API Key is missing. Click 'Options' to set it." };
        }
        if (provider === 'groq' && !groqApiKey) {
            return { error: "Groq API Key is missing. Click 'Options' to set it." };
        }

        console.log("[Background] Fetching page content...");
        const html = await fetchPageContent(url);

        console.log("[Background] Extracting text...");
        const textToSummarize = extractText(html);

        if (!textToSummarize || textToSummarize.trim().length < 50) {
            return { error: "Page content is too short or protected (e.g. login required) to summarize." };
        }

        console.log(`[Background] Calling ${provider} API...`);
        let summary;
        if (provider === 'gemini') {
            summary = await callGemini(geminiApiKey, textToSummarize);
        } else {
            summary = await callGroq(groqApiKey, textToSummarize);
        }
        return { summary, provider: provider === 'groq' ? 'Groq Llama 3' : 'Gemini Flash' };
    } catch (err) {
        console.error("[Background] Summarization process failed:", err);
        return { error: err.message };
    }
}

async function callGroq(apiKey, text) {
    const url = "https://api.groq.com/openai/v1/chat/completions";
    const cleanApiKey = apiKey.trim();

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${cleanApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [
                    {
                        role: "system",
                        content: `You are a professional web page summarizer. Your goal is to provide a strictly concise summary in 1-2 ${chrome.i18n.getUILanguage()} sentences. Do NOT include any original text, do NOT include meta-comments like '(Translation:)', and do NOT repeat yourself. Output ONLY the summary in ${chrome.i18n.getUILanguage()}.`
                    },
                    {
                        role: "user",
                        content: `Summarize this content in ${chrome.i18n.getUILanguage()}:\n\n${text}`
                    }
                ],
                temperature: 0.3,
                max_tokens: 200
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || `Groq API Error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content.trim();
    } catch (err) {
        console.error("[Background] Groq API failed:", err);
        throw err;
    }
}

async function fetchPageContent(url) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        return await response.text();
    } catch (e) {
        clearTimeout(id);
        if (e.name === 'AbortError') throw new Error("Page request timed out (10s).");
        throw e;
    }
}

function extractText(html) {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";

    const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i) ||
        html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["'][^>]*>/i);
    const metaDesc = metaDescMatch ? metaDescMatch[1].trim() : "";

    let cleanText = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    return `Title: ${title}\nDescription: ${metaDesc}\nContent: ${cleanText.substring(0, 3000)}`.substring(0, 4000);
}

async function callGemini(apiKey, text) {
    let lastError = null;
    const cleanApiKey = apiKey.trim();

    for (const combo of MODEL_COMBINATIONS) {
        try {
            const url = `https://generativelanguage.googleapis.com/${combo.version}/models/${combo.model}:generateContent?key=${cleanApiKey}`;
            console.log(`[Background] Trying Gemini API (${combo.version}/${combo.model})...`);

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Summarize the following web page content in 2-3 concise sentences. Focus on the core message. Use a friendly but informative tone. Translate to ${chrome.i18n.getUILanguage()} if the content is in other languages.\n\nContent:\n${text}`
                        }]
                    }]
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                const errMsg = errData.error?.message || `HTTP ${response.status}`;
                console.warn(`[Background] Failed with ${combo.model}: ${errMsg}`);
                lastError = errMsg;
                continue;
            }

            const data = await response.json();
            if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts[0].text) {
                console.log(`[Background] Success with ${combo.model}!`);
                return data.candidates[0].content.parts[0].text;
            }
        } catch (err) {
            console.warn(`[Background] Error with ${combo.model}:`, err);
            lastError = err.message;
        }
    }

    throw new Error(lastError || "All Gemini API attempts failed. Please check your API key and network.");
}
