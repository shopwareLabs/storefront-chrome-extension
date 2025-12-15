/* global chrome */

/**
 * Utility class for loading and injecting scripts into the inspected page
 */
class ScriptLoader {
    constructor() {
        this.scriptCache = new Map();
    }

    /**
     * Load a script file and return its content
     * @param {string} scriptPath - Path to the script file relative to panels/storefront/scripts/
     * @returns {Promise<string>} The script content
     */
    async loadScript(scriptPath) {
        // Check cache first
        if (this.scriptCache.has(scriptPath)) {
            return this.scriptCache.get(scriptPath);
        }

        try {
            // Check if extension context is still valid before accessing chrome.runtime
            if (!chrome || !chrome.runtime) {
                throw new Error("Extension context invalidated");
            }

            // Construct the full path
            let fullPath;
            try {
                fullPath = chrome.runtime.getURL(`panels/storefront/scripts/${scriptPath}`);
            } catch (e) {
                if (e.message && e.message.includes("Extension context invalidated")) {
                    throw new Error("Extension context invalidated");
                }
                throw e;
            }

            // Use XMLHttpRequest instead of fetch for better DevTools compatibility
            const content = await new Promise((resolve, reject) => {
                try {
                    const xhr = new XMLHttpRequest();
                    xhr.open("GET", fullPath, true);
                    xhr.onreadystatechange = function () {
                        if (xhr.readyState === 4) {
                            if (xhr.status === 200) {
                                resolve(xhr.responseText);
                            } else {
                                reject(
                                    new Error(
                                        `Failed to load script: ${xhr.statusText} (${xhr.status})`,
                                    ),
                                );
                            }
                        }
                    };
                    xhr.onerror = function () {
                        reject(new Error(`Network error loading script: ${scriptPath}`));
                    };
                    xhr.send();
                } catch (e) {
                    if (e.message && e.message.includes("Extension context invalidated")) {
                        reject(new Error("Extension context invalidated"));
                    } else {
                        reject(e);
                    }
                }
            });

            // Cache it
            this.scriptCache.set(scriptPath, content);

            return content;
        } catch (error) {
            // Clear cache on error to force reload next time
            this.scriptCache.delete(scriptPath);
            const errorMsg = error && error.message ? error.message : String(error);
            if (errorMsg.includes("Extension context invalidated")) {
                // Don't log context invalidation errors - they're expected on reload
                throw new Error("Extension context invalidated");
            }
            console.error(`Error loading script ${scriptPath}:`, error);
            throw error;
        }
    }

    /**
     * Load and inject a script into the inspected page
     * @param {string} scriptPath - Path to the script file
     * @param {...any} args - Arguments to pass to the script function
     * @returns {Promise<any>} The result from the evaluated script
     */
    async injectScript(scriptPath, ...args) {
        try {
            // Check if extension context is still valid
            if (!chrome || !chrome.devtools || !chrome.devtools.inspectedWindow) {
                throw new Error("Extension context invalidated");
            }

            let scriptContent = await this.loadScript(scriptPath);

            let wrappedScript;

            if (args.length === 0) {
                // No arguments - execute script as-is (handles IIFEs like build-component-tree.js)
                wrappedScript = scriptContent;
            } else {
                // Has arguments - expect a function expression and call it with the arguments
                // Serialize arguments safely using JSON.stringify
                const serializedArgs = args
                    .map((arg) => {
                        // For functions/undefined, we need special handling
                        if (typeof arg === "function") {
                            throw new Error("Cannot serialize functions as script arguments");
                        }
                        if (arg === undefined) {
                            return "undefined";
                        }
                        // Use JSON.stringify for safe serialization
                        return JSON.stringify(arg);
                    })
                    .join(", ");

                // Trim the script content
                scriptContent = scriptContent.trim();

                // Remove trailing semicolon if the script ends with }); or });
                // This handles function expressions that end with }); or });
                if (scriptContent.endsWith("});")) {
                    scriptContent = scriptContent.slice(0, -1); // Remove the semicolon
                } else if (scriptContent.endsWith(";")) {
                    scriptContent = scriptContent.slice(0, -1); // Remove any other trailing semicolon
                }

                // Wrap the script in an IIFE call with arguments
                // The script should now be a function expression ending with })
                wrappedScript = `(${scriptContent})(${serializedArgs});`;
            }

            return new Promise((resolve, reject) => {
                try {
                    // Check context again before eval
                    if (!chrome || !chrome.devtools || !chrome.devtools.inspectedWindow) {
                        reject(new Error("Extension context invalidated"));
                        return;
                    }

                    chrome.devtools.inspectedWindow.eval(wrappedScript, (result, isException) => {
                        if (isException) {
                            const errorMessage =
                                isException.value ||
                                isException.description ||
                                JSON.stringify(isException);
                            // Don't log context invalidation errors
                            if (
                                errorMessage &&
                                errorMessage.includes("Extension context invalidated")
                            ) {
                                reject(new Error("Extension context invalidated"));
                            } else {
                                reject(new Error(errorMessage));
                            }
                        } else {
                            resolve(result);
                        }
                    });
                } catch (e) {
                    if (e.message && e.message.includes("Extension context invalidated")) {
                        reject(new Error("Extension context invalidated"));
                    } else {
                        reject(e);
                    }
                }
            });
        } catch (error) {
            const errorMsg = error && error.message ? error.message : String(error);
            if (errorMsg.includes("Extension context invalidated")) {
                // Don't log context invalidation errors - they're expected on reload
                throw new Error("Extension context invalidated");
            }
            throw error;
        }
    }

    /**
     * Clear the script cache
     */
    clearCache() {
        this.scriptCache.clear();
    }
}

// Export class and singleton instance
export { ScriptLoader };
export const scriptLoader = new ScriptLoader();
