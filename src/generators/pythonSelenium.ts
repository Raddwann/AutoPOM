import { CodeGenerator } from './baseGenerator';
import { POMGeneratorOptions, ScannedElement, LocatorCandidate } from '../types';

export class PythonSeleniumGenerator implements CodeGenerator {
  public getFileExtension(): string {
    return '.py';
  }

  public generatePOM(options: POMGeneratorOptions): string {
    const { className, url, elements } = options;
    const selectedElements = elements.filter((el) => el.selected);

    const locatorConstants: string[] = [];
    const actionMethods: string[] = [];

    selectedElements.forEach((el) => {
      const constName = this.toUpperSnakeCase(el.suggestedVariableName);
      const locatorTuple = this.toSeleniumBy(el.recommendedLocator);

      locatorConstants.push(`    ${constName} = ${locatorTuple}`);

      // Generate action methods based on category
      const method = this.generateActionMethod(el, constName);
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
    switch (candidate.type) {
      case 'id':
        return `(By.ID, "${this.escape(candidate.value)}")`;
      case 'name':
        return `(By.NAME, "${this.escape(candidate.value)}")`;
      case 'data-testid':
      case 'aria':
      case 'css':
        return `(By.CSS_SELECTOR, "${this.escape(candidate.value)}")`;
      case 'xpath':
        return `(By.XPATH, "${this.escape(candidate.value)}")`;
      default:
        return `(By.CSS_SELECTOR, "${this.escape(candidate.value)}")`;
    }
  }

  private generateActionMethod(el: ScannedElement, constName: string): string {
    const varName = el.suggestedVariableName;
    const snakeName = this.toSnakeCase(varName);

    if (el.category === 'button' || el.category === 'link') {
      const methodName = snakeName.startsWith('click_') ? snakeName : `click_${snakeName}`;
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
      const methodName = snakeName.startsWith('enter_') || snakeName.startsWith('set_') ? snakeName : `enter_${snakeName}`;
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
      const methodName = `toggle_${snakeName}`;
      return [
        `    def ${methodName}(self):`,
        `        """Toggles the ${el.suggestedVariableName} option."""`,
        `        element = self.wait.until(EC.element_to_be_clickable(self.${constName}))`,
        '        element.click()',
        '        return self',
        '',
      ].join('\n');
    }

    // Default getter
    return [
      `    def get_${snakeName}(self):`,
      `        return self.wait.until(EC.visibility_of_element_located(self.${constName}))`,
      '',
    ].join('\n');
  }

  private toUpperSnakeCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_/, '')
      .toUpperCase();
  }

  private toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_/, '')
      .toLowerCase();
  }

  private escape(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }
}

