/* global chrome, scriptLoader */

let componentTree = null;
let componentElements = null;
let selectedElement = null;
let treeNodeMap = null; // Map of elementIndex -> tree node for quick lookup
let inspectionMode = false;

async function loadComponentTree() {
    try {
        const result = await scriptLoader.injectScript('build-component-tree.js');
        
        componentTree = result.tree;
        componentElements = result.elements;
        renderComponentTree();
    } catch (error) {
        const errorMessage = error.message || String(error);
        console.error('Error building component tree:', errorMessage);
        document.getElementById('component-tree').innerHTML = 
            '<div style="color: red; padding: 10px;">Error: ' + errorMessage + '</div>';
    }
}

function renderComponentTree() {
    const container = document.getElementById('component-tree');
    container.innerHTML = '';
    
    // Reset the node map
    treeNodeMap = new Map();
    
    if (!componentTree || !componentTree.children || componentTree.children.length === 0) {
        container.innerHTML = '<div style="padding: 10px; color: #666;">No components found. Make sure the page has elements with data-component-name attributes.</div>';
        return;
    }
    
    const treeElement = document.createElement('ul');
    treeElement.className = 'tree';
    treeElement.style.listStyle = 'none';
    treeElement.style.padding = '0';
    treeElement.style.margin = '0';
    
    componentTree.children.forEach(child => {
        treeElement.appendChild(createTreeNode(child, 0, null));
    });

    container.appendChild(treeElement);
}

function createTreeNode(node, depth, parentLi = null) {
    const li = document.createElement('li');
    li.style.padding = '4px 0';
    li.style.margin = '0';
    li.setAttribute('data-component-name', node.name.toLowerCase());
    
    const hasChildren = node.children && node.children.length > 0;
    const nodeDiv = document.createElement('div');
    nodeDiv.className = 'tree-node';
    nodeDiv.style.display = 'flex';
    nodeDiv.style.height = '20px';
    nodeDiv.style.lineHeight = '20px';
    nodeDiv.style.alignItems = 'center';
    nodeDiv.style.padding = '2px 4px';
    nodeDiv.style.borderRadius = '3px';
    nodeDiv.style.userSelect = 'none';
    // Consistent indentation: each level adds exactly 20px
    nodeDiv.style.paddingLeft = (depth * 20 + 4) + 'px';
    
    // Create expand/collapse icon for nodes with children
    let expandIconSpan = null;
    let childrenUl = null;
    if (hasChildren) {
        expandIconSpan = document.createElement('span');
        expandIconSpan.className = 'expand-icon';
        expandIconSpan.style.display = 'inline-block';
        expandIconSpan.style.width = '12px';
        expandIconSpan.style.marginRight = '4px';
        expandIconSpan.style.cursor = 'pointer';
        expandIconSpan.style.textAlign = 'center';
        expandIconSpan.style.transition = 'transform 0.2s ease';
        expandIconSpan.textContent = '▶';
        
        // Click handler for expand/collapse icon only
        expandIconSpan.addEventListener('click', function(e) {
            e.stopPropagation();
            if (childrenUl) {
                if (childrenUl.style.display === 'none') {
                    childrenUl.style.display = 'block';
                    expandIconSpan.style.transform = 'rotate(90deg)';
                } else {
                    childrenUl.style.display = 'none';
                    expandIconSpan.style.transform = 'rotate(0deg)';
                }
            }
        });
        
        nodeDiv.appendChild(expandIconSpan);
    } else {
        // Empty spacer for nodes without children
        const spacer = document.createElement('span');
        spacer.style.display = 'inline-block';
        spacer.style.width = '12px';
        spacer.style.marginRight = '4px';
        nodeDiv.appendChild(spacer);
    }
    
    // Store node in map for inspection mode with parent references
    treeNodeMap.set(node.elementIndex, { 
        node: node, 
        nodeDiv: nodeDiv, 
        li: li,
        parentLi: parentLi,
        childrenUl: childrenUl,
        expandIconSpan: expandIconSpan
    });
    
    // Create component name container
    const nameContainer = document.createElement('span');
    nameContainer.className = 'component-name-container';
    nameContainer.style.cursor = 'pointer';
    nameContainer.style.flex = '1';
    nameContainer.style.display = 'flex';
    nameContainer.style.alignItems = 'center';
    nameContainer.style.gap = '4px';
    
    // Create component name label
    const nameSpan = document.createElement('span');
    nameSpan.className = 'component-name';
    nameSpan.textContent = node.name;
    
    nameContainer.appendChild(nameSpan);
    
    // Add file icon if template path exists (right beside the label)
    if (node.templatePath) {
        const fileIcon = document.createElement('span');
        fileIcon.className = 'file-icon';
        fileIcon.innerHTML = '📝';
        fileIcon.style.cursor = 'pointer';
        fileIcon.style.opacity = '0.6';
        fileIcon.style.fontSize = '12px';
        fileIcon.style.display = 'inline-block';
        fileIcon.style.flexShrink = '0';
        fileIcon.title = 'Copy template path to clipboard.';
        fileIcon.setAttribute('aria-label', 'Copy template path to clipboard: ' + node.templatePath);
        
        // Hover effect for file icon
        fileIcon.addEventListener('mouseenter', function() {
            this.style.opacity = '1';
        });
        fileIcon.addEventListener('mouseleave', function() {
            this.style.opacity = '0.6';
        });
        
        // Click handler to copy template path to clipboard
        fileIcon.addEventListener('click', function(e) {
            e.stopPropagation();
            copyToClipboard(node.templatePath);
        });
        
        nameContainer.appendChild(fileIcon);
    }
    
    // Add inspect icon to select element in Elements panel (always shown)
    const inspectIcon = document.createElement('span');
    inspectIcon.className = 'inspect-icon';
    inspectIcon.innerHTML = '🔍';
    inspectIcon.style.cursor = 'pointer';
    inspectIcon.style.opacity = '0.6';
    inspectIcon.style.fontSize = '12px';
    inspectIcon.style.display = 'inline-block';
    inspectIcon.style.flexShrink = '0';
    inspectIcon.style.marginLeft = node.templatePath ? '4px' : '0';
    inspectIcon.title = 'Inspect element in Elements panel';
    inspectIcon.setAttribute('aria-label', 'Inspect element in Elements panel');
    
    // Hover effect for inspect icon
    inspectIcon.addEventListener('mouseenter', function() {
        this.style.opacity = '1';
    });
    inspectIcon.addEventListener('mouseleave', function() {
        this.style.opacity = '0.6';
    });
    
    // Click handler to inspect element in Elements panel
    inspectIcon.addEventListener('click', function(e) {
        e.stopPropagation();
        
        // Stop inspection mode if it's active
        if (inspectionMode) {
            disableInspectionMode();
        }
        
        // Remove any highlight outlines
        removeHighlight();
        
        inspectElementInDevTools(node);
    });
    
    nameContainer.appendChild(inspectIcon);
    
    // Click handler for component name container - selects and highlights
    nameContainer.addEventListener('click', function(e) {
        // Don't trigger if clicking the file icon
        if (e.target.classList.contains('file-icon')) {
            return;
        }
        e.stopPropagation();
        
        // Highlight element in page
        highlightComponent(node, true); // true = scroll into view
        
        // Update selected state
        selectTreeNode(node);
    });
    
    nodeDiv.appendChild(nameContainer);
    
    // Hover effect - highlight on page when hovering over the node
    let hoverTimeout = null;
    nodeDiv.addEventListener('mouseenter', function() {
        // Visual hover effect
        if (this.style.backgroundColor !== 'rgb(74, 144, 226)') {
            this.style.backgroundColor = '#f0f0f0';
        }
        
        // Highlight component on page (without scrolling)
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
        }
        hoverTimeout = setTimeout(() => {
            highlightComponent(node, false); // false = don't scroll
        }, 100); // Small delay to avoid too many highlights when moving mouse quickly
    });
    
    nodeDiv.addEventListener('mouseleave', function() {
        // Remove visual hover effect
        if (this.style.backgroundColor !== 'rgb(74, 144, 226)') {
            this.style.backgroundColor = '';
        }
        
        // Clear hover timeout
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            hoverTimeout = null;
        }
        
        // Only remove highlight if this node is not selected
        if (selectedElement !== node) {
            removeHighlight();
        }
    });
    
    li.appendChild(nodeDiv);
    
    // Add children if they exist
    if (hasChildren) {
        childrenUl = document.createElement('ul');
        childrenUl.style.listStyle = 'none';
        childrenUl.style.padding = '0';
        childrenUl.style.margin = '0';
        childrenUl.style.display = 'none'; // Collapsed by default
        
        node.children.forEach(child => {
            childrenUl.appendChild(createTreeNode(child, depth + 1, li));
        });
        
        li.appendChild(childrenUl);
        
        // Update the stored reference with the actual childrenUl
        const storedData = treeNodeMap.get(node.elementIndex);
        if (storedData) {
            storedData.childrenUl = childrenUl;
        }
    }
    
    return li;
}

async function highlightComponent(node, scrollIntoView = false) {
    // Validate node and elementIndex
    if (!node || node.elementIndex === undefined || node.elementIndex === null) {
        console.warn('Cannot highlight component: invalid node or elementIndex', node);
        return;
    }
    
    // Use the element index to find the exact element
    const elementIndex = node.elementIndex;
    
    try {
        await scriptLoader.injectScript('highlight-component.js', elementIndex, scrollIntoView);
    } catch (error) {
        const errorMessage = error.message || String(error);
        console.error('Error highlighting component:', errorMessage);
    }
}

async function removeHighlight() {
    try {
        await scriptLoader.injectScript('remove-highlight.js');
    } catch (error) {
        console.error('Error removing highlight:', error);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function inspectElementInDevTools(node) {
    // Validate node and elementIndex
    if (!node || node.elementIndex === undefined || node.elementIndex === null) {
        console.warn('Cannot inspect element: invalid node or elementIndex', node);
        return;
    }

    // Use the element index to find the exact element and inspect it
    const elementIndex = node.elementIndex;
    
    try {
        await scriptLoader.injectScript('inspect-element.js', elementIndex);
    } catch (error) {
        const errorMessage = error.message || String(error);
        console.error('Error inspecting element:', errorMessage);
    }
}


function copyToClipboard(text) {
    // Create a temporary textarea element
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    textarea.setAttribute('readonly', '');
    // Don't use aria-hidden as it conflicts with focus for copying
    
    document.body.appendChild(textarea);

    // Select and copy
    textarea.select();
    textarea.setSelectionRange(0, text.length);

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            // Show a brief visual feedback
            showCopyFeedback('Template path copied to clipboard!');
        } else {
            console.log('File path (copy manually):', text);
            showCopyFeedback('Could not copy automatically. Path logged to console.');
        }
    } catch (err) {
        console.log('File path (copy manually):', text);
        showCopyFeedback('Could not copy automatically. Path logged to console.');
    }
    
    // Clean up
    setTimeout(() => {
        if (document.body.contains(textarea)) {
            document.body.removeChild(textarea);
        }
    }, 100);
}

function showCopyFeedback(message) {
    // Create a temporary notification
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.top = '60px';
    notification.style.right = '20px';
    notification.style.backgroundColor = '#4A90E2';
    notification.style.color = 'white';
    notification.style.padding = '8px 12px';
    notification.style.borderRadius = '4px';
    notification.style.fontSize = '12px';
    notification.style.zIndex = '10000';
    notification.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    
    document.body.appendChild(notification);
    
    // Remove after 2 seconds
    setTimeout(() => {
        if (document.body.contains(notification)) {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }
    }, 2000);
}

function selectTreeNode(node) {
    const treeNodeData = treeNodeMap.get(node.elementIndex);
    if (!treeNodeData || !treeNodeData.nodeDiv) {
        console.warn('Could not find tree node for element index:', node.elementIndex);
        return;
    }
    
    // Expand all parent nodes to make this node visible
    expandParentNodes(treeNodeData);
    
    // Update selected state
    document.querySelectorAll('.tree-node').forEach(n => {
        n.style.backgroundColor = '';
        n.style.color = '';
    });
    
    treeNodeData.nodeDiv.style.backgroundColor = '#4A90E2';
    treeNodeData.nodeDiv.style.color = 'white';
    
    // Scroll tree node into view
    treeNodeData.nodeDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    selectedElement = node;
}

function expandParentNodes(treeNodeData) {
    // Walk up the parent chain and expand all collapsed parents
    let currentLi = treeNodeData.parentLi;
    while (currentLi) {
        // Find the parent node data by searching for the li
        let parentData = null;
        for (const [index, data] of treeNodeMap.entries()) {
            if (data.li === currentLi) {
                parentData = data;
                break;
            }
        }
        
        if (parentData) {
            // Expand this parent if it has children and is collapsed
            if (parentData.childrenUl && parentData.expandIconSpan) {
                if (parentData.childrenUl.style.display === 'none') {
                    parentData.childrenUl.style.display = 'block';
                    parentData.expandIconSpan.style.transform = 'rotate(90deg)';
                }
            }
            // Move to the next parent
            currentLi = parentData.parentLi;
        } else {
            // No parent found, stop
            break;
        }
    }
}

async function enableInspectionMode() {
    if (inspectionMode) return;
    inspectionMode = true;
    
    const inspectBtn = document.getElementById('inspect-btn');
    if (inspectBtn) {
        inspectBtn.classList.add('active');
        inspectBtn.textContent = '🔍 Stop Inspection';
    }

    // Start polling for inspection events
    startInspectionPolling();
    
    // Inject inspection mode script into the page
    try {
        await scriptLoader.injectScript('inspection-mode.js');
    } catch (error) {
        const errorMessage = error.message || String(error);
        console.error('Error enabling inspection mode:', errorMessage);
    }
}

function startInspectionPolling() {
    if (window.__shopwareInspectionPollInterval) {
        clearInterval(window.__shopwareInspectionPollInterval);
    }
    
    window.__shopwareInspectionPollInterval = setInterval(function() {
        if (!inspectionMode) {
            clearInterval(window.__shopwareInspectionPollInterval);
            delete window.__shopwareInspectionPollInterval;
            return;
        }
        
        // Poll for clicked index
        scriptLoader.injectScript('get-clicked-index.js').then(clickedIndex => {
            if (clickedIndex !== null && clickedIndex !== undefined) {
                const treeNodeData = treeNodeMap.get(clickedIndex);
                if (treeNodeData && treeNodeData.node) {
                    highlightComponent(treeNodeData.node, true);
                    selectTreeNode(treeNodeData.node);
                }
            }
        }).catch(error => {
            // Silently ignore errors (e.g., context invalidated during polling)
        });
    }, 100); // Poll every 100ms
}

async function disableInspectionMode() {
    if (!inspectionMode) return;
    inspectionMode = false;
    
    const inspectBtn = document.getElementById('inspect-btn');
    if (inspectBtn) {
        inspectBtn.classList.remove('active');
        inspectBtn.textContent = '🔍 Inspect';
    }
    
    // Stop polling
    if (window.__shopwareInspectionPollInterval) {
        clearInterval(window.__shopwareInspectionPollInterval);
        delete window.__shopwareInspectionPollInterval;
    }

    // Remove inspection mode from page
    try {
        await scriptLoader.injectScript('disable-inspection-mode.js');
    } catch (error) {
        // Silently ignore errors (e.g., context invalidated)
    }
}

// Load tree when panel opens
loadComponentTree();

// Listen for page navigation - check when page becomes ready
let lastUrl = null;
let isPageLoading = false;

// Initialize lastUrl
scriptLoader.injectScript('get-current-url.js').then(currentUrl => {
    if (currentUrl) {
        lastUrl = currentUrl;
    }
}).catch(error => {
    // Silently ignore errors during initialization
});

// Method 1: Storage change listener (event-driven from devtools.js)
if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(function(changes, areaName) {
        if (areaName === 'local' && changes['shopware-devtools-navigation']) {
            const navTime = changes['shopware-devtools-navigation'].newValue;
            console.log('Navigation detected via storage');
            // Wait for page to be ready
            waitForPageReadyAndRefresh();
        }
    });
}

// Method 2: Check URL and page readiness periodically
setInterval(function() {
    checkPageState();
}, 500);

function checkPageState() {
    // Check if page is available and ready
    scriptLoader.injectScript('get-page-state.js').then(result => {
        if (result && result.url) {
            const urlChanged = lastUrl !== null && lastUrl !== result.url;
            const pageBecameAvailable = lastUrl === null && result.url;
            
            if (urlChanged || (pageBecameAvailable && result.ready && result.bodyExists)) {
                if (urlChanged) {
                    console.log('URL changed:', lastUrl, '->', result.url);
                } else {
                    console.log('Page became available:', result.url);
                }
                
                lastUrl = result.url;
                isPageLoading = false;
                
                // Wait for page to be fully ready
                waitForPageReadyAndRefresh();
            } else if (result.url) {
                lastUrl = result.url;
                isPageLoading = false;
            }
        }
    }).catch(error => {
        // Page is not available (loading or navigated away)
        if (!isPageLoading && lastUrl !== null) {
            isPageLoading = true;
            lastUrl = null;
        }
    });
}

function waitForPageReadyAndRefresh() {
    // Check if page is ready, retry if not
    let attempts = 0;
    const maxAttempts = 20; // 10 seconds max
    
    function checkReady() {
        scriptLoader.injectScript('check-page-ready.js').then(isReady => {
            if (isReady) {
                // Page is ready - refresh tree
                handlePageNavigation();
            } else {
                // Page not ready yet, try again
                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(checkReady, 500);
                }
            }
        }).catch(error => {
            // Page not available yet, try again
            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(checkReady, 500);
            }
        });
    }
    
    // Start checking after a short delay
    setTimeout(checkReady, 300);
}

function handlePageNavigation() {
    // Stop inspection mode if active
    if (inspectionMode) {
        disableInspectionMode();
    }

    // Reload the entire panel to ensure fresh state
    // This is more reliable than trying to refresh just the tree
    setTimeout(function() {
        window.location.reload();
    }, 100);
}

document.addEventListener('DOMContentLoaded', function() {
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            loadComponentTree();
        });
    }
    
    const inspectBtn = document.getElementById('inspect-btn');
    if (inspectBtn) {
        inspectBtn.addEventListener('click', function() {
            if (inspectionMode) {
                disableInspectionMode();
            } else {
                enableInspectionMode();
            }
        });
    }
    
    // Add search/filter functionality
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        let searchTimeout = null;
        searchInput.addEventListener('input', function(e) {
            const query = e.target.value.trim().toLowerCase();
            
            // Debounce search
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }
            
            searchTimeout = setTimeout(function() {
                filterComponentTree(query);
            }, 150);
        });
        
        // Clear search on Escape key
        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                e.target.value = '';
                filterComponentTree('');
            }
        });
    }
});

function filterComponentTree(query) {
    if (!query) {
        // Show all nodes
        document.querySelectorAll('#component-tree li').forEach(li => {
            li.style.display = '';
        });
        return;
    }

    // Filter nodes - need to check both the node and its children
    const allNodes = Array.from(document.querySelectorAll('#component-tree li'));

    // First pass: mark which nodes match
    const nodeMatches = new Map();
    allNodes.forEach(li => {
        const nodeDiv = li.querySelector('.tree-node');
        const nameSpan = nodeDiv ? nodeDiv.querySelector('.component-name') : null;
        const nodeName = nameSpan ? nameSpan.textContent.toLowerCase() : '';
        const matches = nodeName.includes(query);
        nodeMatches.set(li, matches);
    });

    // Second pass: show/hide nodes and expand parents of matching children
    allNodes.forEach(li => {
        const matches = nodeMatches.get(li) || false;
        const childrenUl = li.querySelector('ul');
        let hasMatchingChild = false;

        if (childrenUl) {
            const childNodes = childrenUl.querySelectorAll('li');
            childNodes.forEach(childLi => {
                if (nodeMatches.get(childLi)) {
                    hasMatchingChild = true;
                }
            });
        }

        // Show node if it matches or has matching children
        if (matches || hasMatchingChild) {
            li.style.display = '';
            // Expand parent if child matches
            if (hasMatchingChild && !matches && childrenUl) {
                childrenUl.style.display = 'block';
                const nodeDiv = li.querySelector('.tree-node');
                const expandIcon = nodeDiv ? nodeDiv.querySelector('.expand-icon') : null;
                if (expandIcon) {
                    expandIcon.style.transform = 'rotate(90deg)';
                }
            }
        } else {
            li.style.display = 'none';
        }
    });
}