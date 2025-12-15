// Script to get the current page state (URL, ready state, body existence)
// @ts-nocheck
/* eslint-disable */
(function () {
    try {
        return {
            url: window.location.href,
            ready: document.readyState === "complete" || document.readyState === "interactive",
            bodyExists: !!document.body,
        };
    } catch (e) {
        return null;
    }
})();
/* eslint-enable */
