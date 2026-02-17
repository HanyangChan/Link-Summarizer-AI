(function () {
    let popup = null;
    let fetchTimeout = null;
    let displayTimeout = null;
    let currentLink = null;
    let pendingResult = null;

    function createPopup() {
        if (popup) return;
        popup = document.createElement('div');
        popup.id = 'ai-link-summarizer-popup';
        popup.innerHTML = `
            <div class="summary-header">
                ${chrome.i18n.getMessage('extName')} <span id="summary-badge">${chrome.i18n.getMessage('loading')}</span>
            </div>
            <div class="summary-content" id="summary-text">
                ${chrome.i18n.getMessage('waitingPreview')}
            </div>
        `;
        document.body.appendChild(popup);
    }

    function startAnalysis(link) {
        console.log("[Content] Starting background fetch for:", link.href);
        pendingResult = "loading";

        chrome.runtime.sendMessage({ action: "summarize", url: link.href }, (response) => {
            console.log("[Content] Received background response.");
            pendingResult = response || { error: "No response from background" };

            // If the popup is already visible, update it immediately
            if (popup && popup.classList.contains('visible') && currentLink === link) {
                updatePopupContent(pendingResult);
            }
        });
    }

    function showPopup(link, x, y) {
        createPopup();
        const textElement = document.getElementById('summary-text');
        const badgeElement = document.getElementById('summary-badge');

        // Initial state
        if (pendingResult === "loading") {
            textElement.textContent = chrome.i18n.getMessage('analyzing');
            badgeElement.className = "loading-dots";
            badgeElement.textContent = chrome.i18n.getMessage('loading');
        } else if (pendingResult) {
            updatePopupContent(pendingResult);
        }

        // Position popup near the cursor
        popup.style.left = `${x + 15}px`;
        popup.style.top = `${y + 15}px`;
        popup.classList.add('visible');
    }

    function updatePopupContent(result) {
        const textElement = document.getElementById('summary-text');
        const badgeElement = document.getElementById('summary-badge');

        if (result.summary) {
            textElement.textContent = result.summary;
            badgeElement.className = "";
            badgeElement.textContent = result.provider || chrome.i18n.getMessage('extName');
        } else if (result.error) {
            textElement.textContent = chrome.i18n.getMessage('error') + ": " + result.error;
            badgeElement.className = "";
            badgeElement.textContent = chrome.i18n.getMessage('failed');
        }
    }

    function hidePopup() {
        if (popup) {
            popup.classList.remove('visible');
        }
        clearTimeout(fetchTimeout);
        clearTimeout(displayTimeout);
        currentLink = null;
        pendingResult = null;
    }

    document.addEventListener('mouseover', (e) => {
        const link = e.target.closest('a');
        if (link && link.href && link.href.startsWith('http')) {
            // Check if we are moving from/to an element within the same link
            if (currentLink === link) return;

            hidePopup(); // Reset previous state
            currentLink = link;

            // Step 1: Start fetching slightly early (500ms) to reduce perceived wait
            // Increased from 250ms to 500ms per user request to avoid accidental triggers
            fetchTimeout = setTimeout(() => {
                if (currentLink === link) {
                    startAnalysis(link);
                }
            }, 500);

            // Step 2: Show UI after a bit more delay (1200ms) to avoid accidental triggers
            displayTimeout = setTimeout(() => {
                if (currentLink === link) {
                    showPopup(link, e.pageX, e.pageY);
                }
            }, 1200);
        } else if (!e.target.closest('#ai-link-summarizer-popup')) {
            hidePopup();
        }
    });

    document.addEventListener('mouseout', (e) => {
        const link = e.target.closest('a');
        if (link) {
            // Only hide if the relatedTarget (where mouse is going) is NOT inside the current link
            // and NOT inside the popup
            if (!e.relatedTarget || (!link.contains(e.relatedTarget) && !e.relatedTarget.closest('#ai-link-summarizer-popup'))) {
                hidePopup();
            }
        }
    });

    window.addEventListener('scroll', hidePopup);
})();
