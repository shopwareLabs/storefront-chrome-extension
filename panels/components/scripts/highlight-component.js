// Script to highlight a component element by its index
// This function accepts parameters: elementIndex (number) and scrollIntoView (boolean)
(function(elementIndex, scrollIntoView) {
    // Remove previous highlight
    const prevHighlight = document.querySelector('.shopware-devtools-highlight');
    if (prevHighlight) {
        prevHighlight.style.outline = prevHighlight.getAttribute('data-original-outline') || '';
        prevHighlight.removeAttribute('data-original-outline');
        prevHighlight.classList.remove('shopware-devtools-highlight');
    }
    
    // Include the findComponentByIndex function
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
            
            for (const child of element.children) {
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
        
        function findNestedComponents(element) {
            const components = [];
            
            if (element.hasAttribute('data-component-name')) {
                components.push(element);
                return components;
            }
            
            for (const child of element.children) {
                if (child.hasAttribute('data-component-name')) {
                    components.push(child);
                } else {
                    components.push(...findNestedComponents(child));
                }
            }
            
            return components;
        }
        
        for (const child of document.body.children) {
            if (child.hasAttribute('data-component-name')) {
                createComponentNode(child);
            } else {
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
    
    // Add highlight
    const originalOutline = targetElement.style.outline || '';
    targetElement.style.outline = '2px solid #4A90E2';
    targetElement.style.outlineOffset = '4px';
    targetElement.setAttribute('data-original-outline', originalOutline);
    targetElement.classList.add('shopware-devtools-highlight');
    
    // Scroll into view only if requested (on click, not on hover)
    if (scrollIntoView) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    return targetElement;
});
