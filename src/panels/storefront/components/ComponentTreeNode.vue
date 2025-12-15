<template>
  <li v-if="isVisible" :class="{ 'tree-node-item': true, 'selected': isSelected }">
    <div
      class="tree-node"
      :style="{ paddingLeft: depth * 20 + 4 + 'px' }"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
    >
      <span
        v-if="hasChildren"
        class="expand-icon"
        :class="{ expanded: isExpanded }"
        @click.stop="toggleExpand"
      >
        <MtIcon name="chevron-right-xxs" size="12px" class="expand-icon-icon" />
      </span>
      <span v-else class="spacer"></span>

      <span class="component-name-container" @click.stop="handleClick">
        <span class="component-name">{{ node.name }}</span>

        <button
          v-if="node.templatePath"
          class="icon-button"
          @click.stop="$emit('copy-path', node.templatePath)"
          title="Copy template path to clipboard"
        >
          <MtIcon name="solid-file-export" size="16px" class="icon-button-icon" />
        </button>

        <button
          class="icon-button"
          @click.stop="$emit('inspect', node)"
          title="Inspect element in Elements panel"
        >
          <MtIcon name="solid-crosshair-block" size="16px" class="icon-button-icon" />
        </button>
      </span>
    </div>

    <ul v-if="hasChildren && isExpanded" class="children-list">
      <ComponentTreeNode
        v-for="child in node.children"
        :key="child.elementIndex"
        :node="child"
        :depth="depth + 1"
        :selected-element="selectedElement"
        :search-query="searchQuery"
        :expanded-nodes="expandedNodes"
        @select="$emit('select', $event)"
        @highlight="$emit('highlight', $event)"
        @remove-highlight="$emit('remove-highlight')"
        @inspect="$emit('inspect', $event)"
        @copy-path="$emit('copy-path', $event)"
        @expand-path="$emit('expand-path')"
      />
    </ul>
  </li>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { MtIcon } from '@shopware-ag/meteor-component-library';
// Using native buttons for now - can be replaced with Meteor components if needed

const props = defineProps({
  node: {
    type: Object,
    required: true,
  },
  depth: {
    type: Number,
    default: 0,
  },
  selectedElement: {
    type: Object,
    default: null,
  },
  searchQuery: {
    type: String,
    default: '',
  },
  expandedNodes: {
    type: Set,
    default: () => new Set(),
  },
});

const emit = defineEmits(['select', 'highlight', 'remove-highlight', 'inspect', 'copy-path', 'expand-path']);

const isExpanded = ref(false);
const isHovered = ref(false);

const hasChildren = computed(() => {
  return props.node.children && props.node.children.length > 0;
});

const isSelected = computed(() => {
  return props.selectedElement && props.selectedElement.elementIndex === props.node.elementIndex;
});

// Recursively check if a node or any of its descendants match the query
function hasMatchingDescendantRecursive(node, query) {
  if (node.name.toLowerCase().includes(query)) {
    return true;
  }
  if (node.children && node.children.length > 0) {
    return node.children.some(child => hasMatchingDescendantRecursive(child, query));
  }
  return false;
}

// Check if this node or any of its descendants match the search query
const matchesSearch = computed(() => {
  if (!props.searchQuery || !props.searchQuery.trim()) return true;
  const query = props.searchQuery.toLowerCase().trim();
  const nameMatches = props.node.name.toLowerCase().includes(query);
  
  // Check if any descendant matches (recursively)
  if (props.node.children && props.node.children.length > 0) {
    const hasMatchingDescendant = props.node.children.some(child => 
      hasMatchingDescendantRecursive(child, query)
    );
    return nameMatches || hasMatchingDescendant;
  }
  
  return nameMatches;
});

// Check if this node should be visible (matches search or has matching descendants)
const isVisible = computed(() => {
  if (!props.searchQuery || !props.searchQuery.trim()) return true;
  return matchesSearch.value;
});

// Track if this node was manually expanded by the user
const wasManuallyExpanded = ref(false);
// Track if this node was programmatically expanded (via expandedNodes or selection)
const wasProgrammaticallyExpanded = ref(false);

// Track previous expandedNodes size to detect refresh (when it goes from non-empty to empty)
const previousExpandedNodesSize = ref(-1);

// Auto-expand when selected element is in this subtree OR when this node is in expandedNodes
// Only collapse programmatically expanded nodes, preserve manually expanded ones
watch([() => props.selectedElement?.elementIndex, () => props.expandedNodes], ([newIndex, expandedSet]) => {
  if (hasChildren.value) {
    let shouldExpand = false;
    
    // Check if this node should be expanded based on expandedNodes Set
    if (expandedSet && expandedSet.has(props.node.elementIndex)) {
      shouldExpand = true;
      wasProgrammaticallyExpanded.value = true;
    }
    
    // Also check if the selected element is a descendant
    if (newIndex !== undefined && newIndex !== null) {
      const isDescendant = isSelectedElementInSubtree(props.node, newIndex);
      if (isDescendant) {
        shouldExpand = true;
        wasProgrammaticallyExpanded.value = true;
      }
    }
    
    // Detect if this is a refresh (expandedNodes went from non-empty to empty, or is empty on first watch)
    const isRefresh = (previousExpandedNodesSize.value > 0 && expandedSet && expandedSet.size === 0) ||
                      (previousExpandedNodesSize.value === -1 && expandedSet && expandedSet.size === 0);
    
    // Update expansion state based on conditions
    if (shouldExpand) {
      isExpanded.value = true;
      emit('expand-path');
    } else {
      // Only collapse if this is a refresh (collapse everything) or if node was programmatically expanded
      // Never collapse manually expanded nodes when selecting other nodes
      if (isRefresh) {
        // On refresh, collapse all nodes regardless of how they were expanded
        isExpanded.value = false;
        wasManuallyExpanded.value = false;
        wasProgrammaticallyExpanded.value = false;
      } else if (wasProgrammaticallyExpanded.value && !wasManuallyExpanded.value) {
        // Only collapse if the node is no longer in expandedNodes and doesn't have a selected descendant
        // If it's still in expandedNodes, keep it expanded (it might be from a previous selection)
        const stillInExpandedNodes = expandedSet && expandedSet.has(props.node.elementIndex);
        if (!stillInExpandedNodes) {
          // Node was programmatically expanded but is no longer needed - collapse it
          isExpanded.value = false;
          wasProgrammaticallyExpanded.value = false;
        }
        // Otherwise, keep it expanded (it's still in expandedNodes from a previous path)
      }
      // If node was manually expanded, preserve its state (don't collapse)
    }
    
    // Update previous size for next comparison
    previousExpandedNodesSize.value = expandedSet ? expandedSet.size : 0;
  }
}, { immediate: true });

// Auto-expand when search query matches children
watch(() => props.searchQuery, (newQuery) => {
  if (newQuery && newQuery.trim() && hasChildren.value) {
    // Check if any child matches the search
    const query = newQuery.toLowerCase().trim();
    const hasMatchingChild = props.node.children.some(child => {
      return hasMatchingDescendantRecursive(child, query);
    });
    if (hasMatchingChild) {
      isExpanded.value = true;
    }
  } else if (!newQuery || !newQuery.trim()) {
    // When search is cleared, collapse nodes that were auto-expanded
    // But only if they weren't manually expanded - we'll keep them expanded for now
    // to avoid annoying the user
  }
});

function isSelectedElementInSubtree(node, targetIndex) {
  // Don't consider the node itself as a descendant
  if (node.elementIndex === targetIndex) return false;
  if (node.children) {
    return node.children.some(child => isSelectedElementInSubtree(child, targetIndex));
  }
  return false;
}

function hasMatchingDescendant(node, query) {
  if (node.name.toLowerCase().includes(query)) return true;
  if (node.children && node.children.length > 0) {
    return node.children.some(child => hasMatchingDescendant(child, query));
  }
  return false;
}

function toggleExpand(event) {
  event.stopPropagation();
  isExpanded.value = !isExpanded.value;
  // Track manual expansion so we don't collapse it when selecting other nodes
  if (isExpanded.value) {
    wasManuallyExpanded.value = true;
    // Clear programmatic expansion flag when manually toggled
    wasProgrammaticallyExpanded.value = false;
  } else {
    wasManuallyExpanded.value = false;
  }
}

function handleClick() {
  emit('select', props.node);
  emit('highlight', props.node, true);
}

function handleMouseEnter() {
  isHovered.value = true;
  if (!isSelected.value) {
    emit('highlight', props.node, false);
  }
}

function handleMouseLeave() {
  isHovered.value = false;
  if (!isSelected.value) {
    // Emit event to remove highlight when mouse leaves
    emit('remove-highlight');
  }
}
</script>

<style scoped>
.tree-node-item {
  list-style: none;
  padding: 4px 0;
  margin: 0;
}

.tree-node {
  display: flex;
  align-items: center;
  padding: 4px;
  border-radius: 3px;
  user-select: none;
  cursor: pointer;
}

.tree-node:hover {
  background-color: #f0f0f0;
}

.tree-node-item.selected > .tree-node {
  background-color: #e4e6e8;
}

.expand-icon,
.spacer {
  display: inline-block;
  padding: 0 4px;
  margin-right: 8px;
  text-align: center;
  transition: transform 0.2s ease;
}

.spacer {
  width: 20px;
}

.expand-icon {
  cursor: pointer;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

.expand-icon-icon {
  position: relative;
  top: -1px;
}

.component-name-container {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.component-name {
  font-weight: 500;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.children-list {
  list-style: none;
  padding: 4px 0 0 0;
  margin: 0;
}

.icon-button {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
  transition: opacity 0.2s;
}

.icon-button:hover {
  color: var(--color-interaction-primary-default);
}
</style>

