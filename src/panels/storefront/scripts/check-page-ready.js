// Script to check if the page is ready (complete state and body has children)
// @ts-nocheck
/* eslint-disable */
(function () {
    return (
        document.readyState === "complete" && !!document.body && document.body.children.length > 0
    );
})();
/* eslint-enable */
