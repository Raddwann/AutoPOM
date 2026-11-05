import { Page } from 'puppeteer-core';
import { PageScanResult, ScannedElement } from '../types';
import { LocatorRanker, RawElementInfo } from './locatorRanker';

export class DomExtractor {
  /**
   * Scans the active browser page, identifies all interactive elements,
   * generates ranked locators, and injects visual badges.
   */
  public static async scanPage(page: Page): Promise<PageScanResult> {
    // 1. Evaluate scanner directly in the browser page context
    const rawResult = await page.evaluate(() => {
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
        '[onclick]',
      ].join(',');

      const elements = Array.from(document.querySelectorAll(INTERACTIVE_SELECTORS));
      const results: any[] = [];
      const idCounts = new Map<string, number>();

      // Count IDs to determine uniqueness
      document.querySelectorAll('[id]').forEach((el) => {
        const id = el.id ? el.id.trim() : '';
        if (id) {
          idCounts.set(id, (idCounts.get(id) || 0) + 1);
        }
      });

      function isVisible(el: Element): boolean {
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

      function getDataTestId(el: Element): string {
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

        // Skip blank hash/javascript links with no text
        if (el.tagName.toLowerCase() === 'a') {
          const href = el.getAttribute('href') || '';
          const text = (el.textContent || '').trim();
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
          id,
          isIdUnique,
          name: el.getAttribute('name') || '',
          type: el.getAttribute('type') || '',
          className: typeof el.className === 'string' ? el.className.trim() : '',
          innerText: (el.textContent || '').trim().slice(0, 100),
          placeholder: el.getAttribute('placeholder') || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          role: el.getAttribute('role') || '',
          dataTestId: getDataTestId(el),
          href: el.getAttribute('href') || '',
          rect: {
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
        });
      });

      return {
        url: window.location.href,
        title: document.title || window.location.href,
        elements: results,
      };
    });

    if (!rawResult || !Array.isArray(rawResult.elements)) {
      throw new Error('Failed to extract elements from active page.');
    }

    const { url, title, elements: rawElements } = rawResult;

    // 2. Process and rank each element using LocatorRanker
    const scannedElements: ScannedElement[] = rawElements.map((raw, idx) => {
      const rawInfo: RawElementInfo = {
        tagName: raw.tagName,
        id: raw.id,
        name: raw.name,
        type: raw.type,
        className: raw.className,
        innerText: raw.innerText,
        placeholder: raw.placeholder,
        ariaLabel: raw.ariaLabel,
        role: raw.role,
        dataTestId: raw.dataTestId,
        href: raw.href,
      };

      const category = LocatorRanker.categorize(raw.tagName, raw.type, raw.role);
      const locators = LocatorRanker.rankLocators(rawInfo, raw.isIdUnique);
      const recommendedLocator = locators[0];
      const suggestedVariableName = LocatorRanker.suggestVariableName(rawInfo, category);
      const confidence = LocatorRanker.getConfidenceLevel(recommendedLocator.score);

      return {
        id: `el_${idx + 1}`,
        tagName: raw.tagName,
        inputType: raw.type,
        name: raw.name,
        text: raw.innerText,
        placeholder: raw.placeholder,
        ariaLabel: raw.ariaLabel,
        locators,
        recommendedLocator,
        suggestedVariableName,
        category,
        confidence,
        boundingRect: raw.rect,
        selected: true,
      };
    });

    // 3. Inject visual overlay directly into page
    try {
      await page.evaluate((elementsData: any[]) => {
        const CONTAINER_ID = 'autopom-overlay-root';
        let root = document.getElementById(CONTAINER_ID);
        if (root) {
          root.remove();
        }

        root = document.createElement('div');
        root.id = CONTAINER_ID;
        root.style.position = 'fixed';
        root.style.top = '0px';
        root.style.left = '0px';
        root.style.width = '100vw';
        root.style.height = '100vh';
        root.style.pointerEvents = 'none';
        root.style.zIndex = '2147483647';
        root.style.overflow = 'hidden';
        document.documentElement.appendChild(root);

        const badgeElements: { badge: HTMLElement; outline: HTMLElement; targetEl?: Element }[] = [];

        // Collect matching DOM elements
        const INTERACTIVE_SELECTORS = [
          'button', 'input', 'select', 'textarea', 'a[href]',
          '[role="button"]', '[role="link"]', '[role="checkbox"]',
          '[role="radio"]', '[role="tab"]', '[role="menuitem"]', '[onclick]'
        ].join(',');
        const liveDomElements = Array.from(document.querySelectorAll(INTERACTIVE_SELECTORS));

        elementsData.forEach((item, idx) => {
          const rect = item.boundingRect;
          if (!rect || rect.width === 0 || rect.height === 0) return;

          const isHigh = item.confidence === 'high';
          const isMed = item.confidence === 'medium';
          const bg = isHigh ? '#10b981' : (isMed ? '#f59e0b' : '#ef4444');

          const badge = document.createElement('div');
          badge.className = 'autopom-badge';
          badge.textContent = '#' + (idx + 1);
          badge.style.position = 'fixed';
          badge.style.left = Math.max(0, rect.x) + 'px';
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
          badge.style.zIndex = '2147483647';
          badge.title =
            (item.suggestedVariableName || '') +
            ' (' +
            item.recommendedLocator.type +
            ': ' +
            item.recommendedLocator.value +
            ')';

          const outline = document.createElement('div');
          outline.style.position = 'fixed';
          outline.style.left = rect.x + 'px';
          outline.style.top = rect.y + 'px';
          outline.style.width = rect.width + 'px';
          outline.style.height = rect.height + 'px';
          outline.style.border = '2px solid ' + bg;
          outline.style.borderRadius = '2px';
          outline.style.backgroundColor = isHigh
            ? 'rgba(16, 185, 129, 0.08)'
            : isMed
            ? 'rgba(245, 158, 11, 0.08)'
            : 'rgba(239, 68, 68, 0.08)';
          outline.style.pointerEvents = 'none';

          root.appendChild(badge);
          root.appendChild(outline);

          badgeElements.push({
            badge,
            outline,
            targetEl: liveDomElements[idx],
          });
        });

        // Dynamic update on scroll
        const updatePositions = () => {
          badgeElements.forEach(({ badge, outline, targetEl }) => {
            if (!targetEl || !targetEl.getBoundingClientRect) return;
            const r = targetEl.getBoundingClientRect();
            if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > window.innerHeight) {
              badge.style.display = 'none';
              outline.style.display = 'none';
            } else {
              badge.style.display = 'block';
              outline.style.display = 'block';
              badge.style.left = Math.max(0, r.left) + 'px';
              badge.style.top = Math.max(0, r.top - 18) + 'px';
              outline.style.left = r.left + 'px';
              outline.style.top = r.top + 'px';
              outline.style.width = r.width + 'px';
              outline.style.height = r.height + 'px';
            }
          });
        };

        window.addEventListener('scroll', updatePositions, { capture: true, passive: true });
        window.addEventListener('resize', updatePositions, { passive: true });
      }, scannedElements);
    } catch (err) {
      console.warn('[AutoPOM] Could not render visual overlay on page:', err);
    }

    return {
      url,
      title,
      timestamp: Date.now(),
      elements: scannedElements,
    };
  }

  /**
   * Clears visual overlay from the page.
   */
  public static async clearOverlay(page: Page): Promise<void> {
    try {
      await page.evaluate(() => {
        const root = document.getElementById('autopom-overlay-root');
        if (root) {
          root.remove();
        }
      });
    } catch (err) {
      console.warn('[AutoPOM] Could not clear overlay:', err);
    }
  }
}
