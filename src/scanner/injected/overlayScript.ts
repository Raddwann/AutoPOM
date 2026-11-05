/**
 * Visual Overlay script injected into the page to render badges,
 * hover outlines, and locator tooltips.
 */
export const INJECTED_OVERLAY_FN_STRING = `
(function setupAutoPomOverlay() {
  const CONTAINER_ID = 'autopom-overlay-root';
  let root = document.getElementById(CONTAINER_ID);
  if (root) {
    root.remove();
  }

  root = document.createElement('div');
  root.id = CONTAINER_ID;
  root.style.position = 'absolute';
  root.style.top = '0';
  root.style.left = '0';
  root.style.width = '100%';
  root.style.height = '100%';
  root.style.pointerEvents = 'none';
  root.style.zIndex = '2147483640';
  document.body.appendChild(root);

  window.__AUTOPOM_RENDER_OVERLAY = function(elements) {
    if (!root) return;
    root.innerHTML = '';

    elements.forEach((item, idx) => {
      const rect = item.boundingRect;
      if (!rect || rect.width === 0 || rect.height === 0) return;

      const badge = document.createElement('div');
      badge.className = 'autopom-badge';
      badge.textContent = '#' + (idx + 1);
      
      const isHigh = item.confidence === 'high';
      const isMed = item.confidence === 'medium';
      const bg = isHigh ? '#10b981' : (isMed ? '#f59e0b' : '#ef4444');

      badge.style.position = 'absolute';
      badge.style.left = rect.x + 'px';
      badge.style.top = Math.max(0, rect.y - 18) + 'px';
      badge.style.backgroundColor = bg;
      badge.style.color = '#ffffff';
      badge.style.fontSize = '11px';
      badge.style.fontWeight = 'bold';
      badge.style.padding = '1px 5px';
      badge.style.borderRadius = '3px';
      badge.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)';
      badge.style.pointerEvents = 'auto';
      badge.style.cursor = 'pointer';
      badge.style.zIndex = '2147483645';
      badge.title = (item.suggestedVariableName || '') + ' (' + item.recommendedLocator.type + ': ' + item.recommendedLocator.value + ')';

      const outline = document.createElement('div');
      outline.style.position = 'absolute';
      outline.style.left = rect.x + 'px';
      outline.style.top = rect.y + 'px';
      outline.style.width = rect.width + 'px';
      outline.style.height = rect.height + 'px';
      outline.style.border = '2px solid ' + bg;
      outline.style.borderRadius = '2px';
      outline.style.backgroundColor = isHigh ? 'rgba(16, 185, 129, 0.08)' : (isMed ? 'rgba(245, 158, 11, 0.08)' : 'rgba(239, 68, 68, 0.08)');
      outline.style.pointerEvents = 'none';

      badge.addEventListener('mouseenter', () => {
        outline.style.borderWidth = '3px';
        outline.style.backgroundColor = isHigh ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)';
      });

      badge.addEventListener('mouseleave', () => {
        outline.style.borderWidth = '2px';
        outline.style.backgroundColor = isHigh ? 'rgba(16, 185, 129, 0.08)' : (isMed ? 'rgba(245, 158, 11, 0.08)' : 'rgba(239, 68, 68, 0.08)');
      });

      root.appendChild(badge);
      root.appendChild(outline);
    });
  };

  window.__AUTOPOM_REMOVE_OVERLAY = function() {
    if (root) {
      root.remove();
      root = null;
    }
  };
})()
`;
