import { CodeGenerator } from './baseGenerator';
import { POMGeneratorOptions, ScannedElement, LocatorCandidate } from '../types';
import { LocatorRanker } from '../scanner/locatorRanker';

export class JavaSeleniumGenerator implements CodeGenerator {
  public getFileExtension(): string {
    return '.java';
  }

  public generatePOM(options: POMGeneratorOptions): string {
    const { className: rawClassName, url, elements } = options;
    let className = rawClassName.replace(/[^a-zA-Z0-9_]/g, '');
    if (/^[0-9]/.test(className)) {
      className = `Page${className}`;
    }
    const selectedElements = elements.filter((el) => el.selected);

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

    // Step 2: Generate field declarations, actions, and verification methods with optional component grouping
    const hasComponents = selectedElements.some((el) => !!el.componentGroup);

    const groups = new Map<
      string,
      { fieldName: string; count: number; element: ScannedElement; locatorBy: string }[]
    >();

    locatorSignatureMap.forEach(({ fieldName, count, element }, locatorBy) => {
      const grp = element.componentGroup || (hasComponents ? 'General' : '');
      if (!groups.has(grp)) {
        groups.set(grp, []);
      }
      groups.get(grp)!.push({ fieldName, count, element, locatorBy });
    });

    const locatorFields: string[] = [];
    const actionMethods: string[] = [];
    const verificationMethods: string[] = [];

    groups.forEach((items, grp) => {
      if (grp) {
        locatorFields.push(`    // --- Component: ${grp} ---`);
        actionMethods.push(`    // --- Component Actions: ${grp} ---`);
        verificationMethods.push(`    // --- Component Verifications: ${grp} ---`);
      }
      items.forEach(({ fieldName, count, element, locatorBy }) => {
        locatorFields.push(`    private final By ${fieldName} = ${locatorBy};`);

        const method = this.generateActionMethod(element, fieldName, className, count > 1);
        if (method) {
          actionMethods.push(method);
        }

        const ver = this.generateVerificationMethods(element, fieldName, count > 1);
        verificationMethods.push(...ver);
      });
    });

    const lines: string[] = [
      'package pages;',
      '',
      'import org.openqa.selenium.By;',
      'import org.openqa.selenium.JavascriptExecutor;',
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
      '',
      '    // --- Verifications ---',
      ...(verificationMethods.length > 0 ? verificationMethods : ['    // No verifications generated']),
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
    const varName = el.suggestedVariableName;

    if (el.category === 'button' || el.category === 'link') {
      const methodName = LocatorRanker.toMethodName(varName, 'click', 'java');

      if (isRepeated) {
        return [
          `    public ${className} ${methodName}(int index) {`,
          `        List<WebElement> elements = wait.until(ExpectedConditions.presenceOfAllElementsLocatedBy(${fieldName}));`,
          `        ((JavascriptExecutor) driver).executeScript("arguments[0].scrollIntoView({block: 'center'});", elements.get(index));`,
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
        `        ((JavascriptExecutor) driver).executeScript("arguments[0].scrollIntoView({block: 'center'});", element);`,
        '        element.click();',
        '        return this;',
        '    }',
        '',
      ].join('\n');
    }

    if (el.category === 'input') {
      const methodName = LocatorRanker.toMethodName(varName, 'enter', 'java');

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
      const methodName = LocatorRanker.toMethodName(varName, 'toggle', 'java');
      return [
        `    public ${className} ${methodName}() {`,
        `        WebElement element = wait.until(ExpectedConditions.elementToBeClickable(${fieldName}));`,
        '        element.click();',
        '        return this;',
        '    }',
        '',
      ].join('\n');
    }

    const getterName = LocatorRanker.toMethodName(varName, 'get', 'java');
    return [
      `    public WebElement ${getterName}() {`,
      `        return wait.until(ExpectedConditions.visibilityOfElementLocated(${fieldName}));`,
      '    }',
      '',
    ].join('\n');
  }

  private generateVerificationMethods(
    el: ScannedElement,
    fieldName: string,
    isRepeated: boolean
  ): string[] {
    const camel = this.toCamelCase(el.suggestedVariableName);
    const cap = camel.charAt(0).toUpperCase() + camel.slice(1);

    if (isRepeated) {
      return [
        `    public boolean is${cap}Visible(int index) {`,
        `        try {`,
        `            List<WebElement> elements = wait.until(ExpectedConditions.presenceOfAllElementsLocatedBy(${fieldName}));`,
        `            return index < elements.size() && elements.get(index).isDisplayed();`,
        `        } catch (Exception e) {`,
        `            return false;`,
        `        }`,
        `    }`,
        '',
        `    public boolean is${cap}Visible() {`,
        `        return is${cap}Visible(0);`,
        `    }`,
        '',
        `    public String get${cap}Text(int index) {`,
        `        List<WebElement> elements = wait.until(ExpectedConditions.presenceOfAllElementsLocatedBy(${fieldName}));`,
        `        return index < elements.size() ? elements.get(index).getText() : "";`,
        `    }`,
        '',
        `    public String get${cap}Text() {`,
        `        return get${cap}Text(0);`,
        `    }`,
        '',
        `    public boolean is${cap}Hidden() {`,
        `        try {`,
        `            return wait.until(ExpectedConditions.invisibilityOfElementLocated(${fieldName}));`,
        `        } catch (Exception e) {`,
        `            return false;`,
        `        }`,
        `    }`,
        '',
      ];
    }

    return [
      `    public boolean is${cap}Visible() {`,
      `        try {`,
      `            return wait.until(ExpectedConditions.visibilityOfElementLocated(${fieldName})).isDisplayed();`,
      `        } catch (Exception e) {`,
      `            return false;`,
      `        }`,
      `    }`,
      '',
      `    public String get${cap}Text() {`,
      `        return wait.until(ExpectedConditions.visibilityOfElementLocated(${fieldName})).getText();`,
      `    }`,
      '',
      `    public boolean is${cap}Hidden() {`,
      `        try {`,
      `            return wait.until(ExpectedConditions.invisibilityOfElementLocated(${fieldName}));`,
      `        } catch (Exception e) {`,
      `            return false;`,
      `        }`,
      `    }`,
      '',
    ];
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
