/**
 * This script is evaluated inside the browser context via CDP.
 * It extracts all interactive elements and their attributes.
 */
export const INJECTED_SCANNER_FN_STRING = `
(function scanPageElements() {
  const INTERACTIVE_SELECTORS = [
    'button',
    'input',
    'select',
    'textarea',
    'a[href]',
    '[role="button"]',
    '[role="link"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="tab"]',
    '[role="menuitem"]',
    '[onclick]'
  ].join(',');

  const elements = Array.from(document.querySelectorAll(INTERACTIVE_SELECTORS));
  const results = [];
  const idCounts = new Map();

  // Pre-count IDs to check for uniqueness
  document.querySelectorAll('[id]').forEach(el => {
    const id = el.id.trim();
    if (id) {
      idCounts.set(id, (idCounts.get(id) || 0) + 1);
    }
  });

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return false;
    }
    return true;
  }

  function getDataTestId(el) {
    return (
      el.getAttribute('data-testid') ||
      el.getAttribute('data-test') ||
      el.getAttribute('data-qa') ||
      el.getAttribute('data-cy') ||
      el.getAttribute('data-component') ||
      ''
    );
  }

  elements.forEach((el, index) => {
    if (!isVisible(el)) return;

    // Filter out generic links with no meaningful href or text (e.g. anchor wrappers)
    if (el.tagName.toLowerCase() === 'a') {
      const href = el.getAttribute('href') || '';
      const text = (el.innerText || '').trim();
      if ((href === '#' || href === 'javascript:void(0)' || href === '') && !text) {
        return;
      }
    }

    const rect = el.getBoundingClientRect();
    const id = el.id ? el.id.trim() : '';
    const isIdUnique = id ? idCounts.get(id) === 1 : false;

    results.push({
      index,
      tagName: el.tagName.toLowerCase(),
      id: id,
      isIdUnique: isIdUnique,
      name: el.getAttribute('name') || '',
      type: el.getAttribute('type') || '',
      className: typeof el.className === 'string' ? el.className.trim() : '',
      innerText: (el.innerText || el.textContent || '').trim().slice(0, 100),
      placeholder: el.getAttribute('placeholder') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      role: el.getAttribute('role') || '',
      dataTestId: getDataTestId(el),
      href: el.getAttribute('href') || '',
      rect: {
        x: Math.round(rect.x + window.scrollX),
        y: Math.round(rect.y + window.scrollY),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    });
  });

  return {
    url: window.location.href,
    title: document.title,
    elements: results
  };
})()
`;

