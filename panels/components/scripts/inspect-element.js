// Script to inspect an element in the Elements panel by its index
// This function accepts parameter: elementIndex (number)
(function(elementIndex) {
    // Rebuild the tree in the exact same way and find element by index
    function findComponentByIndex(targetIndex) {
        let counter = 0;
        let targetElement = null;
        
        function createComponentNode(element) {
            const componentName = element.getAttribute('data-component-name');
            if (!componentName) return null;
            
            const currentIndex = counter++;
            if (currentIndex === targetIndex) {
                targetElement = element;
            }
            
            // Recursively process direct children (same logic as tree building)
            for (const child of element.children) {
                const childNode = createComponentNode(child);
                if (!childNode) {
                    // If child is not a component, check its descendants for components
                    const descendantComponents = findNestedComponents(child);
                    for (const desc of descendantComponents) {
                        createComponentNode(desc);
                    }
                }
            }
            
            return { name: componentName };
        }
        
        function findNestedComponents(element) {
            const components = [];
            
            // Check if this element itself is a component
            if (element.hasAttribute('data-component-name')) {
                components.push(element);
                return components;
            }
            
            // Otherwise, check children
            for (const child of element.children) {
                if (child.hasAttribute('data-component-name')) {
                    components.push(child);
                } else {
                    // Recursively search in non-component children
                    components.push(...findNestedComponents(child));
                }
            }
            
            return components;
        }
        
        // Start from body and build tree naturally (same as tree building)
        for (const child of document.body.children) {
            if (child.hasAttribute('data-component-name')) {
                createComponentNode(child);
            } else {
                // Check for nested components
                const nestedComponents = findNestedComponents(child);
                for (const comp of nestedComponents) {
                    createComponentNode(comp);
                }
            }
        }

        return targetElement;
    }

    const targetElement = findComponentByIndex(elementIndex);

    if (!targetElement) {
        console.warn('Could not find element with index:', elementIndex);
        return null;
    }

    // Use inspect() to open Elements panel and select the element
    // This will automatically switch to the Elements panel
    if (typeof inspect === 'function') {
        inspect(targetElement);
    } else {
        // Fallback: try to use $0 (though this won't switch panels)
        $0 = targetElement;
        console.log('Element selected. Switch to Elements panel manually.');
    }
    
    return targetElement;
});
