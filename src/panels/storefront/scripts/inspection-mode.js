// Script to enable inspection mode on the page
(function () {
    // Remove existing inspection listeners if any
    if (window.__shopwareDevtoolsInspectionEnabled) {
        return;
    }
    window.__shopwareDevtoolsInspectionEnabled = true;

    let currentHighlightedElement = null;
    let hoverTimeout = null;
    let lastHoveredIndex = null;
    let clickedIndex = null;

    function findComponentElement(element) {
        // Walk up the DOM tree to find the nearest component
        let current = element;
        while (current && current !== document.body) {
            if (current.hasAttribute("data-component-name")) {
                return current;
            }
            current = current.parentElement;
        }
        return null;
    }

    function getElementIndex(element) {
        // Rebuild tree to find element index (same logic as tree building)
        let counter = 0;
        let targetIndex = null;

        function createComponentNode(el) {
            const componentName = el.getAttribute("data-component-name");
            if (!componentName) return null;

            const currentIndex = counter++;
            if (el === element) {
                targetIndex = currentIndex;
            }

            for (const child of el.children) {
                const childNode = createComponentNode(child);
                if (!childNode) {
                    const descendantComponents = findNestedComponents(child);
                    for (const desc of descendantComponents) {
                        createComponentNode(desc);
                    }
                }
            }

            return { name: componentName };
        }

        function findNestedComponents(el) {
            const components = [];
            if (el.hasAttribute("data-component-name")) {
                components.push(el);
                return components;
            }
            for (const child of el.children) {
                if (child.hasAttribute("data-component-name")) {
                    components.push(child);
                } else {
                    components.push(...findNestedComponents(child));
                }
            }
            return components;
        }

        for (const child of document.body.children) {
            if (child.hasAttribute("data-component-name")) {
                createComponentNode(child);
            } else {
                const nestedComponents = findNestedComponents(child);
                for (const comp of nestedComponents) {
                    createComponentNode(comp);
                }
            }
        }

        return targetIndex;
    }

    function highlightElement(element) {
        // Remove previous highlight
        const prevHighlight = document.querySelector(".shopware-devtools-inspect-highlight");
        if (prevHighlight) {
            prevHighlight.style.outline = prevHighlight.getAttribute("data-original-outline") || "";
            prevHighlight.removeAttribute("data-original-outline");
            prevHighlight.classList.remove("shopware-devtools-inspect-highlight");
        }

        if (!element) return;

        const originalOutline = element.style.outline || "";
        element.style.outline = "2px solid #4A90E2";
        element.style.outlineOffset = "4px";
        element.setAttribute("data-original-outline", originalOutline);
        element.classList.add("shopware-devtools-inspect-highlight");
        currentHighlightedElement = element;
    }

    function handleMouseOver(e) {
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
        }

        hoverTimeout = setTimeout(() => {
            const componentElement = findComponentElement(e.target);
            if (componentElement) {
                highlightElement(componentElement);
                const elementIndex = getElementIndex(componentElement);
                if (elementIndex !== null) {
                    lastHoveredIndex = elementIndex;
                }
            } else {
                highlightElement(null);
                lastHoveredIndex = null;
            }
        }, 50);
    }

    function handleClick(e) {
        e.preventDefault();
        e.stopPropagation();

        const componentElement = findComponentElement(e.target);
        if (componentElement) {
            const elementIndex = getElementIndex(componentElement);
            if (elementIndex !== null) {
                clickedIndex = elementIndex;
            }
        }
    }

    document.addEventListener("mouseover", handleMouseOver, true);
    document.addEventListener("click", handleClick, true);

    // Add style to force crosshair cursor on all elements
    const styleId = "shopware-devtools-inspect-cursor";
    let cursorStyle = document.getElementById(styleId);
    if (!cursorStyle) {
        cursorStyle = document.createElement("style");
        cursorStyle.id = styleId;
        cursorStyle.textContent = "* { cursor: crosshair !important; }";
        document.head.appendChild(cursorStyle);
    }

    // Store cleanup function
    window.__shopwareDevtoolsCleanup = function () {
        document.removeEventListener("mouseover", handleMouseOver, true);
        document.removeEventListener("click", handleClick, true);

        // Remove the cursor style
        const styleToRemove = document.getElementById(styleId);
        if (styleToRemove) {
            styleToRemove.remove();
        }

        highlightElement(null);
        window.__shopwareDevtoolsInspectionEnabled = false;
        delete window.__shopwareDevtoolsCleanup;
    };

    // Expose getters for polling
    window.__shopwareDevtoolsGetClickedIndex = function () {
        const index = clickedIndex;
        clickedIndex = null; // Reset after reading
        return index;
    };
})();
