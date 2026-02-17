function localizeHtmlPage() {
    // Localize text content
    const translateElements = document.querySelectorAll('[data-i18n]');
    translateElements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        const message = chrome.i18n.getMessage(key);
        if (message) {
            el.textContent = message;
        }
    });

    // Localize placeholders
    const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
    placeholderElements.forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const message = chrome.i18n.getMessage(key);
        if (message) {
            el.placeholder = message;
        }
    });
}

document.addEventListener('DOMContentLoaded', localizeHtmlPage);
