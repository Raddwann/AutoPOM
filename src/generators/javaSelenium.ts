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

    // Map locator signature -> metadata
    const locatorSignatureMap = new Map<
      string,
      { fieldName: string; count: number; element: ScannedElement }
    >();

    // Map fieldName -> count
    const usedFieldNames = new Map<string, number>();

    // Step 1: Deduplicate identical locators and prevent duplicate variable names
    selectedElements.forEach((el) => {
      const locatorBy = this.toJavaBy(el.recommendedLocator);

      if (locatorSignatureMap.has(locatorBy)) {
        locatorSignatureMap.get(locatorBy)!.count++;
      } else {
        let baseFieldName = this.toCamelCase(el.suggestedVariableName);

        if (usedFieldNames.has(baseFieldName)) {
          const nextIndex = usedFieldNames.get(baseFieldName)! + 1;
          usedFieldNames.set(baseFieldName, nextIndex);
          baseFieldName = `${baseFieldName}${nextIndex}`;
        } else {
          usedFieldNames.set(baseFieldName, 1);
        }

        locatorSignatureMap.set(locatorBy, {
          fieldName: baseFieldName,
          count: 1,
          element: el,
        });
      }
    });

    // Step 2: Generate field declarations and action methods
    locatorSignatureMap.forEach(({ fieldName, count, element }, locatorBy) => {
      locatorFields.push(`    private final By ${fieldName} = ${locatorBy};`);

      const method = this.generateActionMethod(element, fieldName, className, count > 1);
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
      'import java.util.List;',
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
    const cleanVal = this.escape(candidate.value);
    switch (candidate.type) {
      case 'id':
        return `By.id("${cleanVal}")`;
      case 'name':
        return `By.name("${cleanVal}")`;
      case 'data-testid':
      case 'aria':
      case 'css':
        return `By.cssSelector("${cleanVal}")`;
      case 'xpath':
        return `By.xpath("${cleanVal}")`;
      default:
        return `By.cssSelector("${cleanVal}")`;
    }
  }

  private generateActionMethod(
    el: ScannedElement,
    fieldName: string,
    className: string,
    isRepeated: boolean
  ): string {
    const capitalized = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);

    if (el.category === 'button' || el.category === 'link') {
      const methodName = capitalized.startsWith('Click') ? fieldName : `click${capitalized}`;

      if (isRepeated) {
        return [
          `    public ${className} ${methodName}(int index) {`,
          `        List<WebElement> elements = wait.until(ExpectedConditions.presenceOfAllElementsLocatedBy(${fieldName}));`,
          '        elements.get(index).click();',
          '        return this;',
          '    }',
          '',
          `    public ${className} ${methodName}() {`,
          `        return ${methodName}(0);`,
          '    }',
          '',
        ].join('\n');
      }

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
      const methodName =
        capitalized.startsWith('Enter') || capitalized.startsWith('Set')
          ? fieldName
          : `enter${capitalized}`;

      if (isRepeated) {
        return [
          `    public ${className} ${methodName}(String value, int index) {`,
          `        List<WebElement> elements = wait.until(ExpectedConditions.presenceOfAllElementsLocatedBy(${fieldName}));`,
          '        WebElement element = elements.get(index);',
          '        element.clear();',
          '        element.sendKeys(value);',
          '        return this;',
          '    }',
          '',
        ].join('\n');
      }

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

  private escape(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\r?\n|\r/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
