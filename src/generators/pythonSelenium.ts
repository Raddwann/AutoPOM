import { CodeGenerator } from './baseGenerator';
import { POMGeneratorOptions, ScannedElement, LocatorCandidate } from '../types';
import { LocatorRanker } from '../scanner/locatorRanker';

export class PythonSeleniumGenerator implements CodeGenerator {
  public getFileExtension(): string {
    return '.py';
  }

  public generatePOM(options: POMGeneratorOptions): string {
    const { className, url, elements } = options;
    const selectedElements = elements.filter((el) => el.selected);

    const locatorConstants: string[] = [];
    const actionMethods: string[] = [];

    // Map locator signature -> metadata
    const locatorSignatureMap = new Map<
      string,
      { constName: string; count: number; element: ScannedElement }
    >();

    // Map constName -> count (for deduplicating variable names for different locators)
    const usedConstNames = new Map<string, number>();

    // Step 1: Deduplicate and assign unique, valid constant names
    selectedElements.forEach((el) => {
      const locatorTuple = this.toSeleniumBy(el.recommendedLocator);

      if (locatorSignatureMap.has(locatorTuple)) {
        // Same exact locator appears multiple times (e.g. repeated table row buttons)
        locatorSignatureMap.get(locatorTuple)!.count++;
      } else {
        let baseConstName = this.toUpperSnakeCase(el.suggestedVariableName);

        // Check if name was already used by a DIFFERENT locator
        if (usedConstNames.has(baseConstName)) {
          const nextIndex = usedConstNames.get(baseConstName)! + 1;
          usedConstNames.set(baseConstName, nextIndex);
          baseConstName = `${baseConstName}_${nextIndex}`;
        } else {
          usedConstNames.set(baseConstName, 1);
        }

        locatorSignatureMap.set(locatorTuple, {
          constName: baseConstName,
          count: 1,
          element: el,
        });
      }
    });

    // Step 2: Generate declarations & methods for unique locators
    locatorSignatureMap.forEach(({ constName, count, element }, locatorTuple) => {
      locatorConstants.push(`    ${constName} = ${locatorTuple}`);

      const method = this.generateActionMethod(element, constName, count > 1);
      if (method) {
        actionMethods.push(method);
      }
    });

    const lines: string[] = [
      '"""',
      `Page Object for ${className}`,
      url ? `Generated from URL: ${url}` : '',
      '"""',
      'from selenium.webdriver.common.by import By',
      'from selenium.webdriver.remote.webdriver import WebDriver',
      'from selenium.webdriver.support.ui import WebDriverWait',
      'from selenium.webdriver.support import expected_conditions as EC',
      '',
      '',
      `class ${className}:`,
      `    """Page Object Model for ${className}"""`,
      '',
      '    # --- Locators ---',
      ...(locatorConstants.length > 0 ? locatorConstants : ['    pass']),
      '',
      '    def __init__(self, driver: WebDriver, timeout: int = 10):',
      '        self.driver = driver',
      '        self.wait = WebDriverWait(driver, timeout)',
      '',
      '    # --- Page Actions ---',
      ...(actionMethods.length > 0 ? actionMethods : ['    pass']),
      '',
    ];

    return lines.filter((l) => l !== undefined).join('\n');
  }

  private toSeleniumBy(candidate: LocatorCandidate): string {
    const cleanVal = this.escape(candidate.value);
    switch (candidate.type) {
      case 'id':
        return `(By.ID, "${cleanVal}")`;
      case 'name':
        return `(By.NAME, "${cleanVal}")`;
      case 'data-testid':
      case 'aria':
      case 'css':
        return `(By.CSS_SELECTOR, "${cleanVal}")`;
      case 'xpath':
        return `(By.XPATH, "${cleanVal}")`;
      default:
        return `(By.CSS_SELECTOR, "${cleanVal}")`;
    }
  }

  private generateActionMethod(el: ScannedElement, constName: string, isRepeated: boolean): string {
    const varName = el.suggestedVariableName;

    if (el.category === 'button' || el.category === 'link') {
      const methodName = LocatorRanker.toMethodName(varName, 'click', 'python');

      if (isRepeated) {
        // Multi-element row click method with index
        return [
          `    def ${methodName}(self, index: int = 0):`,
          `        """Clicks the ${el.text || el.suggestedVariableName} element at given row/list index (default 0)."""`,
          `        elements = self.wait.until(EC.presence_of_all_elements_located(self.${constName}))`,
          `        if index >= len(elements):`,
          `            raise IndexError(f"Index {index} out of bounds for ${constName} (total {len(elements)})")`,
          `        elements[index].click()`,
          '        return self',
          '',
        ].join('\n');
      }

      return [
        `    def ${methodName}(self):`,
        `        """Clicks the ${el.text || el.suggestedVariableName} element."""`,
        `        element = self.wait.until(EC.element_to_be_clickable(self.${constName}))`,
        '        element.click()',
        '        return self',
        '',
      ].join('\n');
    }

    if (el.category === 'input') {
      const methodName = LocatorRanker.toMethodName(varName, 'enter', 'python');

      if (isRepeated) {
        return [
          `    def ${methodName}(self, value: str, index: int = 0):`,
          `        """Enters text into ${el.placeholder || el.suggestedVariableName} at given index."""`,
          `        elements = self.wait.until(EC.presence_of_all_elements_located(self.${constName}))`,
          `        elements[index].clear()`,
          `        elements[index].send_keys(value)`,
          '        return self',
          '',
        ].join('\n');
      }

      return [
        `    def ${methodName}(self, value: str):`,
        `        """Enters text into ${el.placeholder || el.suggestedVariableName}."""`,
        `        element = self.wait.until(EC.visibility_of_element_located(self.${constName}))`,
        '        element.clear()',
        '        element.send_keys(value)',
        '        return self',
        '',
      ].join('\n');
    }

    if (el.category === 'checkbox' || el.category === 'radio') {
      const methodName = LocatorRanker.toMethodName(varName, 'toggle', 'python');
      return [
        `    def ${methodName}(self):`,
        `        """Toggles the ${el.suggestedVariableName} option."""`,
        `        element = self.wait.until(EC.element_to_be_clickable(self.${constName}))`,
        '        element.click()',
        '        return self',
        '',
      ].join('\n');
    }

    const getterName = LocatorRanker.toMethodName(varName, 'get', 'python');
    return [
      `    def ${getterName}(self):`,
      `        return self.wait.until(EC.visibility_of_element_located(self.${constName}))`,
      '',
    ].join('\n');
  }

  private toUpperSnakeCase(str: string): string {
    let res = str
      .replace(/([A-Z])/g, '_$1')
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_/, '')
      .toUpperCase();

    // In Python, identifiers cannot start with a digit
    if (/^[0-9]/.test(res)) {
      res = `BTN_${res}`;
    }

    return res || 'ELEMENT';
  }

  private escape(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\r?\n|\r/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
