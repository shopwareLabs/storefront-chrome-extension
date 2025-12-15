// Code to execute in the page context to build component tree
(function () {
    // Store all component elements with their paths for later retrieval
    const componentElements = [];
    let elementCounter = 0;

    function createComponentNode(element, path) {
        const componentName = element.getAttribute("data-component-name");

        if (!componentName) {
            return null;
        }

        // Create unique identifier for this element
        const elementIndex = elementCounter++;
        const elementPath = path ? path + "," + elementIndex : String(elementIndex);

        // Store the element reference with its path
        componentElements.push({
            index: elementIndex,
            path: elementPath,
            element: element,
        });

        const node = {
            name: componentName,
            elementId: element.id || null,
            className: element.className || null,
            elementIndex: elementIndex,
            elementPath: elementPath,
            templatePath: element.getAttribute("data-component-template") || null,
            children: [],
        };

        // Recursively process direct children
        // Only include direct children that are components
        for (const child of element.children) {
            const childNode = createComponentNode(child, elementPath);
            if (childNode) {
                node.children.push(childNode);
            } else {
                // If child is not a component, check its descendants for components
                // This handles cases where components are nested with non-component elements in between
                const descendantComponents = findNestedComponents(child, elementPath);
                node.children.push(...descendantComponents);
            }
        }

        return node;
    }

    function findNestedComponents(element, parentPath) {
        const components = [];

        // Check if this element itself is a component
        if (element.hasAttribute("data-component-name")) {
            const node = createComponentNode(element, parentPath);
            if (node) {
                components.push(node);
            }
            return components; // Don't process children, already handled by createComponentNode
        }

        // Otherwise, check children
        for (const child of element.children) {
            if (child.hasAttribute("data-component-name")) {
                const node = createComponentNode(child, parentPath);
                if (node) {
                    components.push(node);
                }
            } else {
                // Recursively search in non-component children
                components.push(...findNestedComponents(child, parentPath));
            }
        }

        return components;
    }

    function createComponentTree() {
        const root = {
            name: "root",
            children: [],
        };

        // Start from body and build tree naturally
        // This ensures we capture the actual DOM hierarchy
        for (const child of document.body.children) {
            if (child.hasAttribute("data-component-name")) {
                const node = createComponentNode(child, null);
                if (node) {
                    root.children.push(node);
                }
            } else {
                // Check for nested components
                const nestedComponents = findNestedComponents(child, null);
                root.children.push(...nestedComponents);
            }
        }

        // Return both the tree and the element map
        return {
            tree: root,
            elements: componentElements.map((item) => ({
                index: item.index,
                path: item.path,
                // Store a way to find this element later
                // We'll use the path to reconstruct the element location
                tagName: item.element.tagName,
                id: item.element.id || "",
                className: item.element.className || "",
                componentName: item.element.getAttribute("data-component-name"),
            })),
        };
    }

    return createComponentTree();
})();
