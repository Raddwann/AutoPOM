import { Page, CDPSession } from 'puppeteer-core';
import { RecordedAction, LocatorCandidate } from '../types';
import { LocatorRanker, RawElementInfo } from '../scanner/locatorRanker';

export type OnActionCallback = (action: RecordedAction, totalCount: number) => void;

export class RecorderManager {
  private static instance: RecorderManager;
  private isRecording: boolean = false;
  private actions: RecordedAction[] = [];
  private cdpSession: CDPSession | null = null;
  private pendingRequests: Map<string, { url: string; startTime: number }> = new Map();
  private lastNetworkActivityTime: number = 0;
  private onActionCallback: OnActionCallback | null = null;

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

  public setOnActionCallback(cb: OnActionCallback | null): void {
    this.onActionCallback = cb;
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
      // Binding may already exist on page
    });

    // 3. Script to attach to page and persist across navigations
    const listenerScript = () => {
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

          if ((window as any).__AUTOPOM_ON_USER_ACTION) {
            (window as any).__AUTOPOM_ON_USER_ACTION({
              type: 'click',
              elementInfo: info,
              timestamp: Date.now(),
            });
          }
        },
        true
      );

      window.addEventListener(
        'change',
        (e: Event) => {
          const target = e.target as HTMLInputElement;
          if (!target || target.closest('#autopom-overlay-root')) return;

          const info = getElementAttributes(target);
          if ((window as any).__AUTOPOM_ON_USER_ACTION) {
            (window as any).__AUTOPOM_ON_USER_ACTION({
              type: 'input',
              value: target.value,
              elementInfo: info,
              timestamp: Date.now(),
            });
          }
        },
        true
      );
    };

    // Inject for future navigations and current document
    await page.evaluateOnNewDocument(listenerScript).catch(() => {});
    await page.evaluate(listenerScript).catch(() => {});

    // Record initial navigation
    const navAction: RecordedAction = {
      id: `act_${Date.now()}`,
      type: 'navigation',
      timestamp: Date.now(),
      url: page.url(),
      targetElementDescription: `Navigate to ${page.url()}`,
    };
    this.actions.push(navAction);
    this.onActionCallback?.(navAction, this.actions.length);
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

    const hasPendingNetwork =
      this.pendingRequests.size > 0 || Date.now() - this.lastNetworkActivityTime < 500;

    const action: RecordedAction = {
      id: `act_${raw.timestamp}`,
      type: raw.type,
      timestamp: raw.timestamp,
      locator: recommendedLocator,
      value: raw.value,
      targetElementDescription: `${raw.type === 'click' ? 'Click' : 'Input'}: ${varName}`,
      waitCondition: hasPendingNetwork
        ? {
            type: 'network_idle',
            description: 'Wait for network requests to finish',
          }
        : undefined,
    };

    this.actions.push(action);
    this.onActionCallback?.(action, this.actions.length);
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
        steps.push(`        # 1. Navigate to target URL`);
        steps.push(`        driver.get("${act.url}")`);
        steps.push('');
      } else if (act.type === 'click' && act.locator) {
        steps.push(`        # ${act.targetElementDescription || 'Click element'}`);
        steps.push(
          `        element = wait.until(EC.element_to_be_clickable((${this.getPythonBy(act.locator)})))`
        );
        steps.push(`        element.click()`);
        if (act.waitCondition?.type === 'network_idle') {
          steps.push(`        # Smart Wait: wait for network/DOM to stabilize`);
          steps.push(`        wait.until(lambda d: d.execute_script("return document.readyState") == "complete")`);
        }
        steps.push('');
      } else if (act.type === 'input' && act.locator) {
        steps.push(`        # ${act.targetElementDescription || 'Input text'}`);
        steps.push(
          `        element = wait.until(EC.visibility_of_element_located((${this.getPythonBy(act.locator)})))`
        );
        steps.push(`        element.clear()`);
        steps.push(`        element.send_keys("${(act.value || '').replace(/"/g, '\\"').replace(/\r?\n|\r/g, ' ')}")`);
        steps.push('');
      }
    });

    return [
      '"""',
      'Generated Selenium Python Test Script by AutoPOM',
      '"""',
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

  private generateJavaTestScript(className: string = 'RecordedScenarioTest'): string {
    const steps: string[] = [];

    this.actions.forEach((act) => {
      if (act.type === 'navigation' && act.url) {
        steps.push(`        // 1. Navigate to target URL`);
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
        steps.push(
          `        WebElement inputEl = wait.until(ExpectedConditions.visibilityOfElementLocated(${this.getJavaBy(act.locator)}));`
        );
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
      '/**',
      ` * Auto-generated Selenium Test Scenario by AutoPOM`,
      ' */',
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

  private toSnakeCase(str: string): string {
    return (
      str
        .replace(/([A-Z])/g, '_$1')
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_/, '')
        .toLowerCase() || 'recorded'
    );
  }

  private getPythonBy(locator: LocatorCandidate): string {
    const cleanVal = locator.value.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
    switch (locator.type) {
      case 'id':
        return `By.ID, "${cleanVal}"`;
      case 'name':
        return `By.NAME, "${cleanVal}"`;
      case 'data-testid':
      case 'aria':
      case 'css':
        return `By.CSS_SELECTOR, "${cleanVal.replace(/"/g, '\\"')}"`;
      case 'xpath':
        return `By.XPATH, "${cleanVal.replace(/"/g, '\\"')}"`;
      default:
        return `By.CSS_SELECTOR, "${cleanVal}"`;
    }
  }

  private getJavaBy(locator: LocatorCandidate): string {
    const cleanVal = locator.value.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
    switch (locator.type) {
      case 'id':
        return `By.id("${cleanVal}")`;
      case 'name':
        return `By.name("${cleanVal}")`;
      case 'data-testid':
      case 'aria':
      case 'css':
        return `By.cssSelector("${cleanVal.replace(/"/g, '\\"')}")`;
      case 'xpath':
        return `By.xpath("${cleanVal.replace(/"/g, '\\"')}")`;
      default:
        return `By.cssSelector("${cleanVal}")`;
    }
  }
}
