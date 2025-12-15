// Script to remove highlight from any highlighted element
(function () {
    const prevHighlight = document.querySelector(".shopware-devtools-highlight");
    if (prevHighlight) {
        prevHighlight.style.outline = prevHighlight.getAttribute("data-original-outline") || "";
        prevHighlight.removeAttribute("data-original-outline");
        prevHighlight.classList.remove("shopware-devtools-highlight");
    }
})();
