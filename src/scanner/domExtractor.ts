import { Page } from 'puppeteer-core';
import { PageScanResult, ScannedElement } from '../types';
import { LocatorRanker, RawElementInfo } from './locatorRanker';
import { INJECTED_SCANNER_FN_STRING } from './injected/scannerScript';
import { INJECTED_OVERLAY_FN_STRING } from './injected/overlayScript';

export class DomExtractor {
  /**
   * Scans the active browser page, identifies all interactive elements,
   * generates ranked locators, and injects visual badges.
   */
  public static async scanPage(page: Page): Promise<PageScanResult> {
    // 1. Evaluate scanner in page context
    const rawResult = await page.evaluate((scriptStr: string) => {
      const runner = new Function(scriptStr);
      return runner();
    }, INJECTED_SCANNER_FN_STRING);

    const { url, title, elements: rawElements } = rawResult as {
      url: string;
      title: string;
      elements: any[];
    };

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

    // 3. Inject visual overlay into page
    try {
      await page.evaluate((overlayScript: string) => {
        const inject = new Function(overlayScript);
        inject();
      }, INJECTED_OVERLAY_FN_STRING);

      await page.evaluate((elementsData: any) => {
        if ((window as any).__AUTOPOM_RENDER_OVERLAY) {
          (window as any).__AUTOPOM_RENDER_OVERLAY(elementsData);
        }
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
        if ((window as any).__AUTOPOM_REMOVE_OVERLAY) {
          (window as any).__AUTOPOM_REMOVE_OVERLAY();
        }
      });
    } catch (err) {
      console.warn('[AutoPOM] Could not clear overlay:', err);
    }
  }
}
