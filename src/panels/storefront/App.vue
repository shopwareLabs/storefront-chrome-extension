<template>
    <div class="panel-container" @mouseleave="handlePanelMouseLeave" @click="handlePanelClick">
        <div class="toolbar">
            <MtButton
                :variant="inspectionMode ? 'critical' : 'primary'"
                size="default"
                class="inspection-mode-button"
                @click="toggleInspectionMode"
            >
                <MtIcon name="search-s" slot="iconFront" />
                {{ inspectionMode ? "Stop Inspection" : "Inspect" }}
            </MtButton>
            <MtButton
                variant="secondary"
                size="default"
                class="refresh-button"
                @click="refreshTree"
            >
                <MtIcon name="repeat" size="14px" slot="iconFront" /> Refresh
            </MtButton>
            <MtTextField
                v-model="searchQuery"
                size="small"
                placeholder="Search components..."
                class="search-input"
            />
        </div>
        <div class="component-tree-container" @mouseleave="handleTreeMouseLeave">
            <div v-if="error" class="error-message">Error: {{ error }}</div>
            <div
                v-else-if="
                    !componentTree || !componentTree.children || componentTree.children.length === 0
                "
                class="empty-message"
            >
                No components found. Make sure the page has elements with data-component-name
                attributes.
            </div>
            <ul v-else class="component-tree">
                <ComponentTreeNode
                    v-for="child in componentTree.children"
                    :key="child.elementIndex"
                    :node="child"
                    :depth="0"
                    :selected-element="selectedElement"
                    :search-query="searchQuery"
                    :expanded-nodes="expandedNodes"
                    @select="handleNodeSelect"
                    @highlight="handleNodeHighlight"
                    @remove-highlight="handleRemoveHighlight"
                    @inspect="handleNodeInspect"
                    @copy-path="handleCopyPath"
                    @expand-path="handleExpandPath"
                />
            </ul>
        </div>
        <MtSnackbar />
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import {
    MtTextField,
    MtButton,
    MtIcon,
    MtSnackbar,
    useSnackbar,
} from "@shopware-ag/meteor-component-library";
import ComponentTreeNode from "./components/ComponentTreeNode.vue";
import "@shopware-ag/meteor-component-library/styles.css";
import "@shopware-ag/meteor-component-library/font.css";

const componentTree = ref(null);
const componentElements = ref(null);
const selectedElement = ref(null);
const inspectionMode = ref(false);
const searchQuery = ref("");
const error = ref(null);

const { addSnackbar } = useSnackbar();

import { scriptLoader } from "./script-loader.js";

onMounted(async () => {
    await loadComponentTree();
    setupNavigationListener();
    setupPanelVisibilityListener();
});

onUnmounted(() => {
    if (inspectionMode.value) {
        disableInspectionMode();
    }
    // Remove highlight when component unmounts (panel closed)
    scriptLoader.injectScript("remove-highlight.js").catch(() => {
        // Ignore errors during unmount
    });
});

async function loadComponentTree() {
    try {
        error.value = null;
        const result = await scriptLoader.injectScript("build-component-tree.js");
        componentTree.value = result.tree;
        componentElements.value = result.elements;
    } catch (err) {
        error.value = err.message || String(err);
        console.error("Error building component tree:", error.value);
    }
}

async function refreshTree() {
    console.log("Refresh button clicked");
    try {
        // Clear current state
        selectedElement.value = null;
        expandedNodes.value = new Set();

        // Remove any active highlights
        try {
            await scriptLoader.injectScript("remove-highlight.js");
        } catch (err) {
            // Ignore highlight removal errors
        }

        // Reload the component tree
        console.log("Loading component tree...");
        await loadComponentTree();
        console.log("Component tree loaded successfully");
    } catch (err) {
        console.error("Error refreshing tree:", err);
        error.value = err.message || String(err);
    }
}

// Search is handled reactively through the searchQuery prop passed to ComponentTreeNode

async function handleNodeSelect(node) {
    // If clicking the same node that's already selected, deselect it
    if (selectedElement.value && selectedElement.value.elementIndex === node.elementIndex) {
        selectedElement.value = null;
        scriptLoader
            .injectScript("remove-highlight.js")
            .catch((err) => console.error("Error removing highlight:", err));
        return;
    }

    // Set selectedElement first to trigger watchers
    selectedElement.value = node;
    // Wait for Vue to process the change and run watchers
    await nextTick();
    // Give watchers time to expand parent nodes
    await new Promise((resolve) => setTimeout(resolve, 50));
    highlightComponent(node, true);
    expandPathToNode(node);
}

function handleExpandPath() {
    // This is handled by the component itself, but we need the handler
}

// Computed property to track which nodes should be expanded
const expandedNodes = ref(new Set());

function expandPathToNode(targetNode) {
    if (!targetNode || !componentTree.value) return;

    // Build path from root to target node
    function findPath(tree, targetIndex, path = []) {
        if (!tree || !tree.children) return null;

        for (const child of tree.children) {
            if (child.elementIndex === targetIndex) {
                return [...path, child];
            }
            const found = findPath(child, targetIndex, [...path, child]);
            if (found) return found;
        }
        return null;
    }

    const path = findPath(componentTree.value, targetNode.elementIndex);
    if (path && path.length > 1) {
        // Add all nodes in the path (except the last one) to the existing expandedNodes Set
        // This preserves manually expanded nodes and previously expanded paths
        const newExpanded = new Set(expandedNodes.value);
        for (let i = 0; i < path.length - 1; i++) {
            newExpanded.add(path[i].elementIndex);
        }
        expandedNodes.value = newExpanded;
    }
}

function handleNodeHighlight(node, scrollIntoView) {
    highlightComponent(node, scrollIntoView);
}

function handleRemoveHighlight() {
    // Always remove hover highlight, but if an element is selected, re-highlight it
    scriptLoader
        .injectScript("remove-highlight.js")
        .then(() => {
            // If an element is selected, re-highlight it (not the hovered one)
            if (selectedElement.value) {
                highlightComponent(selectedElement.value, false);
            }
        })
        .catch((err) => console.error("Error removing highlight:", err));
}

function handleTreeMouseLeave() {
    // Always remove hover highlight when mouse leaves the tree
    // If an element is selected, re-highlight it instead
    scriptLoader
        .injectScript("remove-highlight.js")
        .then(() => {
            // If an element is selected, re-highlight it (not the hovered one)
            if (selectedElement.value) {
                highlightComponent(selectedElement.value, false);
            }
        })
        .catch((err) => console.error("Error removing highlight:", err));
}

function handlePanelMouseLeave(event) {
    // Always remove hover highlight when mouse leaves the panel
    // If an element is selected, re-highlight it instead
    // Check if we're actually leaving the panel (not just moving to another element inside)
    // Use a small delay to check if mouse re-entered
    setTimeout(() => {
        // Check if mouse is still outside the panel
        const panelElement = event.currentTarget;
        if (panelElement && !panelElement.matches(":hover")) {
            scriptLoader
                .injectScript("remove-highlight.js")
                .then(() => {
                    // If an element is selected, re-highlight it (not the hovered one)
                    if (selectedElement.value) {
                        highlightComponent(selectedElement.value, false);
                    }
                })
                .catch((err) => console.error("Error removing highlight:", err));
        }
    }, 100);
}

function handleNodeInspect(node) {
    inspectElementInDevTools(node);
}

function handlePanelClick(event) {
    // Deselect if clicking on free space (not on buttons, inputs, tree nodes, or other interactive elements)
    const target = event.target;
    const isInteractive = target.closest(
        "button, input, .component-tree, .tree-node-item, .tree-node, .component-name-container, .toolbar",
    );

    // Only deselect if clicking on non-interactive areas (like empty space in the panel)
    if (!isInteractive && selectedElement.value) {
        selectedElement.value = null;
        scriptLoader
            .injectScript("remove-highlight.js")
            .catch((err) => console.error("Error removing highlight:", err));
    }
}

function handleCopyPath(path) {
    copyToClipboard(path);
}

async function highlightComponent(node, scrollIntoView = false) {
    if (!node || node.elementIndex === undefined || node.elementIndex === null) {
        return;
    }

    try {
        await scriptLoader.injectScript(
            "highlight-component.js",
            node.elementIndex,
            scrollIntoView,
        );
    } catch (err) {
        console.error("Error highlighting component:", err);
    }
}

async function inspectElementInDevTools(node) {
    if (!node || node.elementIndex === undefined || node.elementIndex === null) {
        return;
    }

    try {
        // Remove highlight before inspecting
        await scriptLoader.injectScript("remove-highlight.js");
        await scriptLoader.injectScript("inspect-element.js", node.elementIndex);
    } catch (err) {
        console.error("Error inspecting element:", err);
    }
}

function copyToClipboard(text) {
    // Use textarea + execCommand approach as Clipboard API is blocked in DevTools context
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();

    try {
        const success = document.execCommand("copy");
        if (success) {
            // Show success message
            addSnackbar({
                message: "Template path copied to clipboard",
                variant: "success",
            });
        } else {
            throw new Error("execCommand copy failed");
        }
    } catch (err) {
        console.error("Failed to copy:", err);
        // Show error message
        addSnackbar({
            message: "Failed to copy to clipboard",
            variant: "error",
        });
    } finally {
        document.body.removeChild(textarea);
    }
}

async function toggleInspectionMode() {
    if (inspectionMode.value) {
        await disableInspectionMode();
    } else {
        await enableInspectionMode();
    }
}

async function enableInspectionMode() {
    if (inspectionMode.value) return;
    inspectionMode.value = true;

    try {
        await scriptLoader.injectScript("inspection-mode.js");
        startInspectionPolling();
    } catch (err) {
        console.error("Error enabling inspection mode:", err);
        inspectionMode.value = false;
    }
}

async function disableInspectionMode() {
    if (!inspectionMode.value) return;
    inspectionMode.value = false;

    // Clear selected element when disabling inspection mode
    // This ensures mouse leave handlers can properly remove highlights
    selectedElement.value = null;

    if (window.__shopwareInspectionPollInterval) {
        clearInterval(window.__shopwareInspectionPollInterval);
        delete window.__shopwareInspectionPollInterval;
    }

    try {
        // Remove highlight when disabling inspection mode
        await scriptLoader.injectScript("remove-highlight.js");
        await scriptLoader.injectScript("disable-inspection-mode.js");
    } catch (err) {
        console.error("Error disabling inspection mode:", err);
    }
}

function startInspectionPolling() {
    if (window.__shopwareInspectionPollInterval) {
        clearInterval(window.__shopwareInspectionPollInterval);
    }

    window.__shopwareInspectionPollInterval = setInterval(async () => {
        if (!inspectionMode.value) {
            clearInterval(window.__shopwareInspectionPollInterval);
            delete window.__shopwareInspectionPollInterval;
            return;
        }

        try {
            const clickedIndex = await scriptLoader.injectScript("get-clicked-index.js");
            if (clickedIndex !== null && clickedIndex !== undefined) {
                // Find node by index and select it
                const node = findNodeByIndex(componentTree.value, clickedIndex);
                if (node) {
                    handleNodeSelect(node);
                }
            }
        } catch (err) {
            // Silently ignore polling errors
        }
    }, 100);
}

function findNodeByIndex(tree, index) {
    if (!tree) return null;

    function search(node) {
        if (node.elementIndex === index) return node;
        if (node.children) {
            for (const child of node.children) {
                const found = search(child);
                if (found) return found;
            }
        }
        return null;
    }

    return search(tree);
}

function setupNavigationListener() {
    if (chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === "local" && changes["shopware-devtools-navigation"]) {
                waitForPageReadyAndRefresh();
            }
        });
    }
}

function setupPanelVisibilityListener() {
    // Listen for visibility change (panel hidden/closed)
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            // Panel was hidden/closed - remove hover highlight
            // If an element is selected, re-highlight it
            scriptLoader
                .injectScript("remove-highlight.js")
                .then(() => {
                    if (selectedElement.value) {
                        highlightComponent(selectedElement.value, false);
                    }
                })
                .catch(() => {
                    // Ignore errors
                });
        }
    });

    // Also listen for blur event (panel loses focus)
    window.addEventListener("blur", () => {
        // Remove hover highlight when panel loses focus
        // If an element is selected, re-highlight it
        scriptLoader
            .injectScript("remove-highlight.js")
            .then(() => {
                if (selectedElement.value) {
                    highlightComponent(selectedElement.value, false);
                }
            })
            .catch(() => {
                // Ignore errors
            });
    });
}

let isRefreshing = false;

function waitForPageReadyAndRefresh() {
    if (isRefreshing) return; // Prevent multiple refresh attempts

    isRefreshing = true;
    let attempts = 0;
    const maxAttempts = 20;

    function checkReady() {
        scriptLoader
            .injectScript("check-page-ready.js")
            .then((isReady) => {
                if (isReady) {
                    handlePageNavigation();
                } else {
                    attempts++;
                    if (attempts < maxAttempts) {
                        setTimeout(checkReady, 500);
                    } else {
                        isRefreshing = false;
                    }
                }
            })
            .catch(() => {
                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(checkReady, 500);
                } else {
                    isRefreshing = false;
                }
            });
    }

    setTimeout(checkReady, 300);
}

async function handlePageNavigation() {
    if (inspectionMode.value) {
        await disableInspectionMode();
    }

    // Remove highlight on page navigation
    try {
        await scriptLoader.injectScript("remove-highlight.js");
    } catch (err) {
        // Ignore errors during navigation
    }

    setTimeout(() => {
        window.location.reload();
    }, 100);
}
</script>

<style scoped>
.panel-container {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.toolbar {
    display: flex;
    align-items: stretch;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid #e0e0e0;
    background: #f5f5f5;
    flex-shrink: 0;
}

.inspection-mode-button,
.refresh-button {
    height: auto;
}

.search-input {
    flex: 1;
    margin-bottom: 0;
}

:deep(.mt-field .mt-block-field__block) {
    min-height: 100% !important;
}

.component-tree-container {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
}

.component-tree {
    list-style: none;
    padding: 0;
    margin: 0;
}

.error-message {
    color: red;
    padding: 10px;
}

.empty-message {
    padding: 10px;
    color: #666;
}
</style>
