import { Page, CDPSession } from 'puppeteer-core';
import { RecordedAction, LocatorCandidate } from '../types';
import { LocatorRanker, RawElementInfo } from '../scanner/locatorRanker';

export class RecorderManager {
  private static instance: RecorderManager;
  private isRecording: boolean = false;
  private actions: RecordedAction[] = [];
  private cdpSession: CDPSession | null = null;
  private pendingRequests: Map<string, { url: string; startTime: number }> = new Map();
  private lastNetworkActivityTime: number = 0;

  private constructor() {}

  public static getInstance(): RecorderManager {
    if (!RecorderManager.instance) {
      RecorderManager.instance = new RecorderManager();
    }
    return RecorderManager.instance;
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  public getRecordedActions(): RecordedAction[] {
    return [...this.actions];
  }

  public async startRecording(page: Page): Promise<void> {
    this.isRecording = true;
    this.actions = [];
    this.pendingRequests.clear();
    this.lastNetworkActivityTime = Date.now();

    // 1. Create CDP session for network monitoring
    this.cdpSession = await page.createCDPSession();
    await this.cdpSession.send('Network.enable');

    this.cdpSession.on('Network.requestWillBeSent', (params) => {
      // Ignore static assets (images, fonts, stylesheets)
      const resourceType = params.type;
      if (resourceType && ['XHR', 'Fetch', 'Document'].includes(resourceType)) {
        this.pendingRequests.set(params.requestId, {
          url: params.request.url,
          startTime: Date.now(),
        });
      }
    });

    this.cdpSession.on('Network.loadingFinished', (params) => {
      this.pendingRequests.delete(params.requestId);
      this.lastNetworkActivityTime = Date.now();
    });

    this.cdpSession.on('Network.loadingFailed', (params) => {
      this.pendingRequests.delete(params.requestId);
      this.lastNetworkActivityTime = Date.now();
    });

    // 2. Expose binding for DOM event callback
    await page.exposeFunction('__AUTOPOM_ON_USER_ACTION', (rawAction: any) => {
      this.handleUserAction(rawAction);
    }).catch(() => {
      // Binding might already be registered
    });

    // 3. Inject event listener script
    await page.evaluate(() => {
      function getElementAttributes(el: HTMLElement) {
        return {
          tagName: el.tagName.toLowerCase(),
          id: el.id ? el.id.trim() : '',
          name: el.getAttribute('name') || '',
          type: el.getAttribute('type') || '',
          className: typeof el.className === 'string' ? el.className.trim() : '',
          innerText: (el.innerText || el.textContent || '').trim().slice(0, 100),
          placeholder: el.getAttribute('placeholder') || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          role: el.getAttribute('role') || '',
          dataTestId:
            el.getAttribute('data-testid') ||
            el.getAttribute('data-test') ||
            el.getAttribute('data-qa') ||
            el.getAttribute('data-cy') ||
            '',
        };
      }

      window.addEventListener(
        'click',
        (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          if (!target || target.closest('#autopom-overlay-root')) return;

          const closestInteractive = target.closest('button, a, input, select, [role="button"]') || target;
          const info = getElementAttributes(closestInteractive as HTMLElement);

          (window as any).__AUTOPOM_ON_USER_ACTION({
            type: 'click',
            elementInfo: info,
            timestamp: Date.now(),
          });
        },
        true
      );

      window.addEventListener(
        'change',
        (e: Event) => {
          const target = e.target as HTMLInputElement;
          if (!target || target.closest('#autopom-overlay-root')) return;

          const info = getElementAttributes(target);
          (window as any).__AUTOPOM_ON_USER_ACTION({
            type: 'input',
            value: target.value,
            elementInfo: info,
            timestamp: Date.now(),
          });
        },
        true
      );
    });

    // Record initial navigation
    this.actions.push({
      id: `act_${Date.now()}`,
      type: 'navigation',
      timestamp: Date.now(),
      url: page.url(),
      targetElementDescription: `Navigate to ${page.url()}`,
    });
  }

  public async stopRecording(): Promise<RecordedAction[]> {
    this.isRecording = false;
    if (this.cdpSession) {
      try {
        await this.cdpSession.detach();
      } catch {
        // ignore
      }
      this.cdpSession = null;
    }
    return [...this.actions];
  }

  private handleUserAction(raw: {
    type: 'click' | 'input';
    value?: string;
    elementInfo: RawElementInfo;
    timestamp: number;
  }): void {
    if (!this.isRecording) return;

    const locators = LocatorRanker.rankLocators(raw.elementInfo);
    const recommendedLocator: LocatorCandidate = locators[0];
    const category = LocatorRanker.categorize(raw.elementInfo.tagName, raw.elementInfo.type, raw.elementInfo.role);
    const varName = LocatorRanker.suggestVariableName(raw.elementInfo, category);

    // Detect if this action should have a smart wait attached
    // If pending XHR/Fetch requests are active, or if network activity occurred within the last 500ms
    const hasPendingNetwork = this.pendingRequests.size > 0 || (Date.now() - this.lastNetworkActivityTime < 500);

    const action: RecordedAction = {
      id: `act_${raw.timestamp}`,
      type: raw.type,
      timestamp: raw.timestamp,
      locator: recommendedLocator,
      value: raw.value,
      targetElementDescription: `${raw.type.toUpperCase()}: ${varName}`,
      waitCondition: hasPendingNetwork
        ? {
            type: 'network_idle',
            description: 'Wait for pending network requests to finish',
          }
        : undefined,
    };

    this.actions.push(action);
  }

  /**
   * Generates a complete runnable test script from recorded actions.
   */
  public generateTestScript(language: 'python' | 'java', pageClassName?: string): string {
    if (language === 'python') {
      return this.generatePythonTestScript(pageClassName);
    }
    return this.generateJavaTestScript(pageClassName);
  }

  private generatePythonTestScript(pageClassName: string = 'TestPage'): string {
    const steps: string[] = [];

    this.actions.forEach((act) => {
      if (act.type === 'navigation' && act.url) {
        steps.push(`    # Navigate to target page`);
        steps.push(`    driver.get("${act.url}")`);
        steps.push('');
      } else if (act.type === 'click' && act.locator) {
        steps.push(`    # ${act.targetElementDescription || 'Click element'}`);
        steps.push(
          `    element = wait.until(EC.element_to_be_clickable((${this.getPythonBy(act.locator)})))`
        );
        steps.push(`    element.click()`);
        if (act.waitCondition?.type === 'network_idle') {
          steps.push(`    # Smart Wait: wait until DOM stabilizes after click`);
          steps.push(`    wait.until(lambda d: d.execute_script("return document.readyState") == "complete")`);
        }
        steps.push('');
      } else if (act.type === 'input' && act.locator) {
        steps.push(`    # ${act.targetElementDescription || 'Input text'}`);
        steps.push(
          `    element = wait.until(EC.visibility_of_element_located((${this.getPythonBy(act.locator)})))`
        );
        steps.push(`    element.clear()`);
        steps.push(`    element.send_keys("${(act.value || '').replace(/"/g, '\\"')}")`);
        steps.push('');
      }
    });

    return [
      'import pytest',
      'from selenium import webdriver',
      'from selenium.webdriver.common.by import By',
      'from selenium.webdriver.support.ui import WebDriverWait',
      'from selenium.webdriver.support import expected_conditions as EC',
      '',
      '',
      `def test_${this.toSnakeCase(pageClassName)}_scenario():`,
      '    driver = webdriver.Chrome()',
      '    wait = WebDriverWait(driver, 10)',
      '    try:',
      ...(steps.length > 0 ? steps : ['        pass']),
      '    finally:',
      '        driver.quit()',
      '',
    ].join('\n');
  }

  private toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_/, '')
      .toLowerCase() || 'recorded';
  }

  private generateJavaTestScript(className: string = 'RecordedScenarioTest'): string {
    const steps: string[] = [];

    this.actions.forEach((act) => {
      if (act.type === 'navigation' && act.url) {
        steps.push(`        // Navigate`);
        steps.push(`        driver.get("${act.url}");`);
        steps.push('');
      } else if (act.type === 'click' && act.locator) {
        steps.push(`        // ${act.targetElementDescription || 'Click element'}`);
        steps.push(
          `        wait.until(ExpectedConditions.elementToBeClickable(${this.getJavaBy(act.locator)})).click();`
        );
        steps.push('');
      } else if (act.type === 'input' && act.locator) {
        steps.push(`        // ${act.targetElementDescription || 'Input text'}`);
        steps.push(`        WebElement inputEl = wait.until(ExpectedConditions.visibilityOfElementLocated(${this.getJavaBy(act.locator)}));`);
        steps.push(`        inputEl.clear();`);
        steps.push(`        inputEl.sendKeys("${(act.value || '').replace(/"/g, '\\"')}");`);
        steps.push('');
      }
    });

    return [
      'package tests;',
      '',
      'import org.junit.jupiter.api.AfterEach;',
      'import org.junit.jupiter.api.BeforeEach;',
      'import org.junit.jupiter.api.Test;',
      'import org.openqa.selenium.By;',
      'import org.openqa.selenium.WebDriver;',
      'import org.openqa.selenium.WebElement;',
      'import org.openqa.selenium.chrome.ChromeDriver;',
      'import org.openqa.selenium.support.ui.ExpectedConditions;',
      'import org.openqa.selenium.support.ui.WebDriverWait;',
      'import java.time.Duration;',
      '',
      `public class ${className} {`,
      '    private WebDriver driver;',
      '    private WebDriverWait wait;',
      '',
      '    @BeforeEach',
      '    public void setUp() {',
      '        driver = new ChromeDriver();',
      '        wait = new WebDriverWait(driver, Duration.ofSeconds(10));',
      '    }',
      '',
      '    @Test',
      '    public void testScenario() {',
      ...(steps.length > 0 ? steps : ['        // No actions recorded']),
      '    }',
      '',
      '    @AfterEach',
      '    public void tearDown() {',
      '        if (driver != null) {',
      '            driver.quit();',
      '        }',
      '    }',
      '}',
      '',
    ].join('\n');
  }

  private getPythonBy(locator: LocatorCandidate): string {
    switch (locator.type) {
      case 'id':
        return `By.ID, "${locator.value}"`;
      case 'name':
        return `By.NAME, "${locator.value}"`;
      case 'data-testid':
      case 'aria':
      case 'css':
        return `By.CSS_SELECTOR, "${locator.value.replace(/"/g, '\\"')}"`;
      case 'xpath':
        return `By.XPATH, "${locator.value.replace(/"/g, '\\"')}"`;
      default:
        return `By.CSS_SELECTOR, "${locator.value}"`;
    }
  }

  private getJavaBy(locator: LocatorCandidate): string {
    switch (locator.type) {
      case 'id':
        return `By.id("${locator.value}")`;
      case 'name':
        return `By.name("${locator.value}")`;
      case 'data-testid':
      case 'aria':
      case 'css':
        return `By.cssSelector("${locator.value.replace(/"/g, '\\"')}")`;
      case 'xpath':
        return `By.xpath("${locator.value.replace(/"/g, '\\"')}")`;
      default:
        return `By.cssSelector("${locator.value}")`;
    }
  }
}
