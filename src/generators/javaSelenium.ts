import { CodeGenerator } from './baseGenerator';
import { POMGeneratorOptions, ScannedElement, LocatorCandidate } from '../types';

export class JavaSeleniumGenerator implements CodeGenerator {
  public getFileExtension(): string {
    return '.java';
  }

  public generatePOM(options: POMGeneratorOptions): string {
    const { className, url, elements } = options;
    const selectedElements = elements.filter((el) => el.selected);

    const locatorFields: string[] = [];
    const actionMethods: string[] = [];

    selectedElements.forEach((el) => {
      const fieldName = this.toCamelCase(el.suggestedVariableName);
      const locatorBy = this.toJavaBy(el.recommendedLocator);

      locatorFields.push(`    private final By ${fieldName} = ${locatorBy};`);

      const method = this.generateActionMethod(el, fieldName, className);
      if (method) {
        actionMethods.push(method);
      }
    });

    const lines: string[] = [
      'package pages;',
      '',
      'import org.openqa.selenium.By;',
      'import org.openqa.selenium.WebDriver;',
      'import org.openqa.selenium.WebElement;',
      'import org.openqa.selenium.support.ui.ExpectedConditions;',
      'import org.openqa.selenium.support.ui.WebDriverWait;',
      'import java.time.Duration;',
      '',
      '/**',
      ` * Page Object Model for ${className}`,
      url ? ` * Source URL: ${url}` : ' *',
      ' */',
      `public class ${className} {`,
      '    private final WebDriver driver;',
      '    private final WebDriverWait wait;',
      '',
      '    // --- Locators ---',
      ...(locatorFields.length > 0 ? locatorFields : ['    // No locators selected']),
      '',
      `    public ${className}(WebDriver driver) {`,
      '        this(driver, Duration.ofSeconds(10));',
      '    }',
      '',
      `    public ${className}(WebDriver driver, Duration timeout) {`,
      '        this.driver = driver;',
      '        this.wait = new WebDriverWait(driver, timeout);',
      '    }',
      '',
      '    // --- Actions ---',
      ...(actionMethods.length > 0 ? actionMethods : ['    // No actions generated']),
      '}',
      '',
    ];

    return lines.join('\n');
  }

  private toJavaBy(candidate: LocatorCandidate): string {
    switch (candidate.type) {
      case 'id':
        return `By.id("${this.escape(candidate.value)}")`;
      case 'name':
        return `By.name("${this.escape(candidate.value)}")`;
      case 'data-testid':
      case 'aria':
      case 'css':
        return `By.cssSelector("${this.escape(candidate.value)}")`;
      case 'xpath':
        return `By.xpath("${this.escape(candidate.value)}")`;
      default:
        return `By.cssSelector("${this.escape(candidate.value)}")`;
    }
  }

  private generateActionMethod(el: ScannedElement, fieldName: string, className: string): string {
    const capitalized = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);

    if (el.category === 'button' || el.category === 'link') {
      const methodName = capitalized.startsWith('Click') ? fieldName : `click${capitalized}`;
      return [
        `    public ${className} ${methodName}() {`,
        `        WebElement element = wait.until(ExpectedConditions.elementToBeClickable(${fieldName}));`,
        '        element.click();',
        '        return this;',
        '    }',
        '',
      ].join('\n');
    }

    if (el.category === 'input') {
      const methodName = capitalized.startsWith('Enter') || capitalized.startsWith('Set') ? fieldName : `enter${capitalized}`;
      return [
        `    public ${className} ${methodName}(String value) {`,
        `        WebElement element = wait.until(ExpectedConditions.visibilityOfElementLocated(${fieldName}));`,
        '        element.clear();',
        '        element.sendKeys(value);',
        '        return this;',
        '    }',
        '',
      ].join('\n');
    }

    if (el.category === 'checkbox' || el.category === 'radio') {
      const methodName = `toggle${capitalized}`;
      return [
        `    public ${className} ${methodName}() {`,
        `        WebElement element = wait.until(ExpectedConditions.elementToBeClickable(${fieldName}));`,
        '        element.click();',
        '        return this;',
        '    }',
        '',
      ].join('\n');
    }

    return [
      `    public WebElement get${capitalized}() {`,
      `        return wait.until(ExpectedConditions.visibilityOfElementLocated(${fieldName}));`,
      '    }',
      '',
    ].join('\n');
  }

  private toCamelCase(str: string): string {
    return str
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
      .join('')
      .replace(/^[0-9]/, '_$&') || 'element';
  }

  private escape(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }
}
