// Script to disable inspection mode on the page
// @ts-nocheck
/* eslint-disable */
(function() {
    if (window.__shopwareDevtoolsCleanup) {
        window.__shopwareDevtoolsCleanup();
    }
    delete window.__shopwareDevtoolsGetClickedIndex;
})();
/* eslint-enable */

