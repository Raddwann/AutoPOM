import { ScannedElement } from '../types';

export class DomPruner {
  /**
   * Compresses scanned elements into a concise, token-efficient JSON format
   * while masking any sensitive PII data.
   */
  public static pruneForAI(elements: ScannedElement[]): string {
    const pruned = elements.map((el) => {
      return {
        id: el.id,
        tag: el.tagName,
        type: el.inputType || undefined,
        name: el.name || undefined,
        text: el.text ? this.sanitizePii(el.text) : undefined,
        placeholder: el.placeholder ? this.sanitizePii(el.placeholder) : undefined,
        ariaLabel: el.ariaLabel || undefined,
        testId: el.locators.find((l) => l.type === 'data-testid')?.value,
        category: el.category,
        currentVar: el.suggestedVariableName,
      };
    });

    return JSON.stringify(pruned, null, 2);
  }

  /**
   * Sanitizes potential PII (emails, phone numbers, credit cards, passwords).
   */
  public static sanitizePii(text: string): string {
    let clean = text;
    // Email regex
    clean = clean.replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '[EMAIL]');
    // Phone numbers (rough)
    clean = clean.replace(/\+?[0-9]{1,3}?[-. ]?\(?[0-9]{3}\)?[-. ]?[0-9]{3}[-. ]?[0-9]{4}/g, '[PHONE]');
    // Credit cards (16 digits)
    clean = clean.replace(/\b(?:\d[ -]*?){13,16}\b/g, '[CARD]');
    return clean;
  }
}
