/* global chrome */

let storefrontPanel = null;
let navigationCallback = null;

chrome.devtools.panels.create(
    "Storefront",
    "icon.png",
    "panels/storefront/panel.html",
    function (panel) {
        storefrontPanel = panel;

        // Track if panel is currently shown
        let isPanelShown = false;

        // Listen for when panel is shown
        panel.onShown.addListener(function (window) {
            isPanelShown = true;
            console.log("Panel is now shown (onShown event fired)");

            // Panel is shown - refresh tree in case page changed while panel was hidden
            if (window && window.location) {
                // Access the panel's window to trigger refresh
                try {
                    window.postMessage({ type: "refresh-tree" }, "*");
                } catch (e) {
                    // Fallback: use storage
                    if (chrome.storage && chrome.storage.local) {
                        chrome.storage.local.set({ "shopware-devtools-refresh": Date.now() });
                    }
                }
            }
        });

        panel.onHidden.addListener(function () {
            isPanelShown = false;
            console.log("Panel is now hidden (onHidden event fired)");
        });

        // Listen for storage changes to show panel when icon is clicked
        chrome.storage.onChanged.addListener(function (changes, areaName) {
            console.log("Storage changed:", changes, areaName);
        });
    },
);

// Listen for page navigation - this API is available in devtools page context
if (chrome.devtools && chrome.devtools.network) {
    chrome.devtools.network.onNavigated.addListener(function (url) {
        console.log("Page navigated to:", url);
        // Store navigation timestamp for panel to check
        if (chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({
                "shopware-devtools-navigation": Date.now(),
                "shopware-devtools-navigation-url": url,
            });
        }
    });
}
