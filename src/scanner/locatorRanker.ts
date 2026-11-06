import { LocatorCandidate, ElementCategory, ConfidenceLevel } from '../types';

export interface RawElementInfo {
  tagName: string;
  id?: string;
  name?: string;
  type?: string;
  className?: string;
  innerText?: string;
  placeholder?: string;
  ariaLabel?: string;
  role?: string;
  dataTestId?: string; // data-testid, data-test, data-qa, data-cy
  href?: string;
  parentContext?: {
    tagName: string;
    id?: string;
    className?: string;
  };
}

export class LocatorRanker {
  /**
   * Generates and ranks locator candidates for an element.
   */
  public static rankLocators(info: RawElementInfo, isIdUnique: boolean = true): LocatorCandidate[] {
    const candidates: LocatorCandidate[] = [];

    // 1. Check data-testid / data-test / data-qa attributes
    if (info.dataTestId && info.dataTestId.trim().length > 0) {
      candidates.push({
        type: 'data-testid',
        value: `[data-testid="${this.escapeSelector(info.dataTestId)}"]`,
        score: 100,
        isUnique: true,
      });
    }

    // 2. Check standard ID (check if dynamic/random)
    if (info.id && info.id.trim().length > 0) {
      const isDynamic = this.isLikelyDynamicId(info.id);
      const score = isDynamic ? 40 : (isIdUnique ? 90 : 50);
      candidates.push({
        type: 'id',
        value: info.id,
        score,
        isUnique: isIdUnique && !isDynamic,
      });
    }

    // 3. Check Name attribute
    if (info.name && info.name.trim().length > 0) {
      candidates.push({
        type: 'name',
        value: info.name,
        score: 80,
        isUnique: true,
      });
    }

    // 4. Check Aria-label
    if (info.ariaLabel && info.ariaLabel.trim().length > 0) {
      candidates.push({
        type: 'aria',
        value: `[aria-label="${this.escapeSelector(info.ariaLabel)}"]`,
        score: 75,
        isUnique: true,
      });
    }

    // 5. Semantic XPath for buttons and links based on text
    if (info.innerText && info.innerText.trim().length > 0 && info.innerText.length < 60) {
      const cleanText = info.innerText.replace(/\s+/g, ' ').trim();
      const tag = info.tagName.toLowerCase();
      if (tag === 'button' || tag === 'a' || info.role === 'button') {
        candidates.push({
          type: 'xpath',
          value: `//${tag}[normalize-space()='${this.escapeXPath(cleanText)}']`,
          score: 70,
          isUnique: true,
        });
      }
    }

    // 6. CSS Selector based on attributes or classes
    const cssCandidate = this.buildCssSelector(info);
    if (cssCandidate) {
      candidates.push(cssCandidate);
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    // Fallback if no candidate found
    if (candidates.length === 0) {
      candidates.push({
        type: 'xpath',
        value: `//${info.tagName.toLowerCase()}`,
        score: 20,
        isUnique: false,
      });
    }

    return candidates;
  }

  /**
   * Generates a clean, camelCase variable name for the element.
   * e.g. "Sign In" -> "signInButton", "username" -> "usernameInput"
   */
  public static suggestVariableName(info: RawElementInfo, category: ElementCategory): string {
    let base = '';

    if (info.dataTestId) {
      base = info.dataTestId;
    } else if (info.name) {
      base = info.name;
    } else if (info.id && !this.isLikelyDynamicId(info.id)) {
      base = info.id;
    } else if (info.ariaLabel) {
      base = info.ariaLabel;
    } else if (info.innerText && info.innerText.trim().length > 0 && info.innerText.length < 40) {
      base = info.innerText.replace(/\s+/g, ' ').trim();
    } else if (info.placeholder) {
      base = info.placeholder;
    } else {
      base = `${category}_element`;
    }

    // Normalize to camelCase
    let camel = this.toCamelCase(base);

    // Append category suffix if not already present
    const suffixMap: Record<ElementCategory, string> = {
      button: 'Button',
      input: 'Input',
      link: 'Link',
      select: 'Select',
      checkbox: 'Checkbox',
      radio: 'Radio',
      other: 'Element',
    };

    const suffix = suffixMap[category] || 'Element';
    if (!camel.toLowerCase().endsWith(suffix.toLowerCase())) {
      camel = `${camel}${suffix}`;
    }

    return camel;
  }

  /**
   * Determine element category
   */
  public static categorize(tagName: string, type?: string, role?: string): ElementCategory {
    const tag = tagName.toLowerCase();
    const inputType = (type || '').toLowerCase();

    if (tag === 'button' || role === 'button' || inputType === 'button' || inputType === 'submit') {
      return 'button';
    }
    if (tag === 'select') {
      return 'select';
    }
    if (tag === 'a') {
      return 'link';
    }
    if (tag === 'input') {
      if (inputType === 'checkbox') return 'checkbox';
      if (inputType === 'radio') return 'radio';
      return 'input';
    }
    if (tag === 'textarea') {
      return 'input';
    }
    return 'other';
  }

  /**
   * Confidence level based on highest candidate score
   */
  public static getConfidenceLevel(score: number): ConfidenceLevel {
    if (score >= 80) return 'high';
    if (score >= 60) return 'medium';
    return 'low';
  }

  private static isLikelyDynamicId(id: string): boolean {
    // Patterns like: ember123, :r0:, gen-4829, uid-19af3b, 169283749
    if (/^[0-9]+$/.test(id)) return true;
    if (/^[a-zA-Z]+[_-]?[0-9]{4,}$/.test(id)) return true;
    if (/:[a-zA-Z0-9_-]+:/.test(id)) return true;
    if (/[0-9a-f]{8}-[0-9a-f]{4}/.test(id)) return true; // UUID
    return false;
  }

  private static buildCssSelector(info: RawElementInfo): LocatorCandidate | null {
    const tag = info.tagName.toLowerCase();

    // Check placeholder for inputs
    if (info.placeholder) {
      return {
        type: 'css',
        value: `${tag}[placeholder="${this.escapeSelector(info.placeholder)}"]`,
        score: 65,
        isUnique: true,
      };
    }

    // Check meaningful CSS classes (filter out utility/framework hashes)
    if (info.className) {
      const classes = info.className
        .split(/\s+/)
        .filter((c) => c && !this.isNoiseClass(c))
        .slice(0, 2);

      if (classes.length > 0) {
        return {
          type: 'css',
          value: `${tag}.${classes.join('.')}`,
          score: 55,
          isUnique: false,
        };
      }
    }

    return null;
  }

  private static isNoiseClass(className: string): boolean {
    // Filter out Tailwind utility classes or css-in-js hashed classes
    if (/^css-[a-zA-Z0-9]+$/.test(className)) return true;
    if (/^sc-[a-zA-Z0-9]+$/.test(className)) return true; // styled-components
    if (/^[a-z]{1,2}-[0-9]+$/.test(className)) return true;
    if (['flex', 'grid', 'hidden', 'block', 'relative', 'absolute'].includes(className)) return true;
    return false;
  }

  public static toCamelCase(str: string): string {
    let res = str
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .trim()
      .split(/\s+/)
      .map((word, idx) => {
        if (word.length === 0) return '';
        const lower = word.toLowerCase();
        if (idx === 0) return lower;
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join('') || 'element';

    if (/^[0-9]/.test(res)) {
      res = `btn_${res}`;
    }
    return res;
  }

  public static toSnakeCase(str: string): string {
    let res = str
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_/, '')
      .toLowerCase();

    if (/^[0-9]/.test(res)) {
      res = `btn_${res}`;
    }
    return res || 'element';
  }

  public static toMethodName(
    varName: string,
    action: 'click' | 'enter' | 'toggle' | 'get',
    language: 'python' | 'java'
  ): string {
    const camel = this.toCamelCase(varName);

    if (language === 'python') {
      const snake = this.toSnakeCase(camel);
      if (action === 'click') {
        return snake.startsWith('click_') ? snake : `click_${snake}`;
      }
      if (action === 'enter') {
        return snake.startsWith('enter_') || snake.startsWith('set_') ? snake : `enter_${snake}`;
      }
      if (action === 'toggle') {
        return `toggle_${snake}`;
      }
      return `get_${snake}`;
    }

    // Java
    const cap = camel.charAt(0).toUpperCase() + camel.slice(1);
    if (action === 'click') {
      return cap.startsWith('Click') ? camel : `click${cap}`;
    }
    if (action === 'enter') {
      return cap.startsWith('Enter') || cap.startsWith('Set') ? camel : `enter${cap}`;
    }
    if (action === 'toggle') {
      return `toggle${cap}`;
    }
    return `get${cap}`;
  }

  private static escapeSelector(str: string): string {
    return str.replace(/["\\]/g, '\\$&').replace(/\r?\n|\r/g, ' ');
  }

  private static escapeXPath(str: string): string {
    return str
      .replace(/\s+/g, ' ')
      .replace(/\r?\n|\r/g, ' ')
      .replace(/'/g, "\\'")
      .trim();
  }
}
