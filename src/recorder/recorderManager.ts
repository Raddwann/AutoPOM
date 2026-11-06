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

  public setRecordedActions(actions: RecordedAction[]): void {
    this.actions = [...actions];
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
          // Extract textContent so XPath normalize-space() matches the true DOM string nodes without CSS line-break insertions
          innerText: (el.textContent || el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 100),
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

      function showAssertionPopup(el: HTMLElement, info: any) {
        const old = document.getElementById('autopom-assert-card');
        if (old) old.remove();

        const rect = el.getBoundingClientRect();
        const card = document.createElement('div');
        card.id = 'autopom-assert-card';
        card.style.position = 'fixed';
        card.style.zIndex = '2147483647';
        card.style.left = `${Math.max(10, Math.min(window.innerWidth - 320, rect.left))}px`;
        card.style.top = `${Math.max(10, Math.min(window.innerHeight - 250, rect.bottom + 8))}px`;
        card.style.width = '300px';
        card.style.background = '#1e1e2e';
        card.style.color = '#cdd6f4';
        card.style.borderRadius = '8px';
        card.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px #89b4fa';
        card.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        card.style.fontSize = '12px';
        card.style.padding = '12px';
        card.style.boxSizing = 'border-box';

        const textSample = (info.innerText || '').slice(0, 40);

        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="font-weight:bold; color:#89b4fa; display:flex; align-items:center; gap:6px;">
              <span>🎯 Add Test Assertion</span>
            </div>
            <button id="autopom-close-assert" style="background:none; border:none; color:#a6adc8; cursor:pointer; font-size:14px;">✕</button>
          </div>
          <div style="margin-bottom:8px; color:#a6adc8; font-size:11px;">
            Target: &lt;${info.tagName}&gt; ${textSample ? '"' + textSample.replace(/"/g, '&quot;') + '"' : ''}
          </div>
          <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:10px;">
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
              <input type="radio" name="autopom-assert-type" value="visible" checked />
              <span>👁️ <b>Assert Visible</b> (is displayed)</span>
            </label>
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
              <input type="radio" name="autopom-assert-type" value="text_contains" />
              <span>📝 <b>Assert Text Contains</b></span>
            </label>
            <input id="autopom-assert-text-val" type="text" value="${textSample.replace(/"/g, '&quot;')}" style="margin-left:20px; background:#313244; color:#cdd6f4; border:1px solid #45475a; border-radius:4px; padding:3px 6px; font-size:11px;" />
            <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
              <input type="radio" name="autopom-assert-type" value="hidden" />
              <span>💨 <b>Assert Disappeared / Hidden</b></span>
            </label>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:8px;">
            <button id="autopom-cancel-assert" style="background:#313244; color:#cdd6f4; border:none; border-radius:4px; padding:5px 10px; cursor:pointer;">Cancel</button>
            <button id="autopom-confirm-assert" style="background:#89b4fa; color:#11111b; font-weight:bold; border:none; border-radius:4px; padding:5px 12px; cursor:pointer;">Add Assertion</button>
          </div>
        `;

        document.documentElement.appendChild(card);

        const prevOutline = el.style.outline;
        el.style.outline = '2px solid #cba6f7';

        const cleanup = () => {
          card.remove();
          el.style.outline = prevOutline;
        };

        card.querySelector('#autopom-close-assert')?.addEventListener('click', cleanup);
        card.querySelector('#autopom-cancel-assert')?.addEventListener('click', cleanup);

        card.querySelector('#autopom-confirm-assert')?.addEventListener('click', () => {
          const selectedRadio = card.querySelector('input[name="autopom-assert-type"]:checked') as HTMLInputElement;
          const assertType = selectedRadio ? selectedRadio.value : 'visible';
          const textVal = (card.querySelector('#autopom-assert-text-val') as HTMLInputElement)?.value || '';

          if ((window as any).__AUTOPOM_ON_USER_ACTION) {
            (window as any).__AUTOPOM_ON_USER_ACTION({
              type: 'assert',
              assertionType: assertType,
              expectedValue: textVal,
              elementInfo: info,
              timestamp: Date.now(),
            });
          }
          cleanup();
        });
      }

      window.addEventListener(
        'click',
        (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          if (!target || target.closest('#autopom-overlay-root') || target.closest('#autopom-assert-card')) return;

          // Check if user triggered assertion via Alt+Click or toolbar Assertion Mode
          const isAssertMode = e.altKey || !!(window as any).__AUTOPOM_ASSERT_MODE;
          if (isAssertMode) {
            e.preventDefault();
            e.stopPropagation();
            (window as any).__AUTOPOM_ASSERT_MODE = false;

            const targetEl = target.closest(
              'button, a, input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="menuitem"], [onclick], h1, h2, h3, h4, p, span, div'
            ) || target;

            const info = getElementAttributes(targetEl as HTMLElement);
            showAssertionPopup(targetEl as HTMLElement, info);
            return;
          }

          // Only record clicks on actual interactive targets - ignore background whitespace/layout containers
          const closestInteractive = target.closest(
            'button, a, input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="menuitem"], [onclick]'
          );
          if (!closestInteractive) {
            return;
          }

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

  public async toggleAssertionMode(page: Page): Promise<boolean> {
    try {
      const mode = await page.evaluate(() => {
        (window as any).__AUTOPOM_ASSERT_MODE = !((window as any).__AUTOPOM_ASSERT_MODE);
        return !!((window as any).__AUTOPOM_ASSERT_MODE);
      });
      return mode;
    } catch {
      return false;
    }
  }

  private handleUserAction(raw: {
    type: 'click' | 'input' | 'assert';
    value?: string;
    assertionType?: 'visible' | 'text_contains' | 'state' | 'hidden';
    expectedValue?: string;
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

    let targetDesc = '';
    if (raw.type === 'click') {
      targetDesc = `Click: ${varName}`;
    } else if (raw.type === 'input') {
      targetDesc = `Input: ${varName}`;
    } else {
      const assertLabel = raw.assertionType || 'visible';
      const valStr = raw.expectedValue ? ` "${raw.expectedValue}"` : '';
      targetDesc = `Assert [${assertLabel}]: ${varName}${valStr}`;
    }

    const action: RecordedAction = {
      id: `act_${raw.timestamp}`,
      type: raw.type,
      timestamp: raw.timestamp,
      locator: recommendedLocator,
      value: raw.value,
      targetElementDescription: targetDesc,
      suggestedVariableName: varName,
      category,
      assertionType: raw.assertionType,
      expectedValue: raw.expectedValue,
      waitCondition: hasPendingNetwork && raw.type !== 'assert'
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
   * Supports POM-driven integration by default, with fallback to standalone.
   */
  public generateTestScript(
    language: 'python' | 'java',
    pageClassName: string = 'LoginPage',
    usePom: boolean = true
  ): string {
    if (language === 'python') {
      return usePom
        ? this.generatePythonPomTestScript(pageClassName)
        : this.generatePythonStandaloneScript(pageClassName);
    }
    return usePom
      ? this.generateJavaPomTestScript(pageClassName)
      : this.generateJavaStandaloneScript(pageClassName);
  }

  /**
   * Generates Python test using Page Object Model methods
   */
  public generatePythonPomTestScript(rawPageClassName: string = 'LoginPage'): string {
    let pageClassName = rawPageClassName.replace(/[^a-zA-Z0-9_]/g, '');
    if (/^[0-9]/.test(pageClassName)) {
      pageClassName = `Page${pageClassName}`;
    }
    const snakeClass = this.toSnakeCase(pageClassName);
    const testFunc = `test_${this.toSnakeCase(pageClassName.replace(/Page$/, ''))}_scenario`;

    const navAction = this.actions.find((a) => a.type === 'navigation');
    const startUrl = navAction?.url || 'http://localhost:8000/';

    const pomSteps: string[] = [];

    this.actions.forEach((act) => {
      if (act.type === 'click' && act.suggestedVariableName) {
        const methodName = LocatorRanker.toMethodName(act.suggestedVariableName, 'click', 'python');
        pomSteps.push(`        page.${methodName}()`);
      } else if (act.type === 'input' && act.suggestedVariableName) {
        const methodName = LocatorRanker.toMethodName(act.suggestedVariableName, 'enter', 'python');
        const cleanVal = (act.value || '').replace(/"/g, '\\"').replace(/\r?\n|\r/g, ' ');
        pomSteps.push(`        page.${methodName}("${cleanVal}")`);
      } else if (act.type === 'assert' && act.suggestedVariableName) {
        const varName = LocatorRanker.toSnakeCase(act.suggestedVariableName);
        if (act.assertionType === 'visible') {
          pomSteps.push(`        assert page.is_${varName}_visible()`);
        } else if (act.assertionType === 'text_contains') {
          const cleanVal = (act.expectedValue || '').replace(/"/g, '\\"').replace(/\r?\n|\r/g, ' ');
          pomSteps.push(`        assert "${cleanVal}" in page.get_${varName}_text()`);
        } else if (act.assertionType === 'hidden') {
          pomSteps.push(`        assert page.is_${varName}_hidden()`);
        } else {
          pomSteps.push(`        assert page.is_${varName}_visible()`);
        }
      }
    });

    return [
      '"""',
      `Auto-generated Selenium POM Test Scenario for ${pageClassName}`,
      '"""',
      'import pytest',
      'from selenium import webdriver',
      `from pages.${snakeClass} import ${pageClassName}`,
      '',
      '',
      `def ${testFunc}():`,
      '    driver = webdriver.Chrome()',
      '    try:',
      `        # 1. Navigate to target URL`,
      `        driver.get("${startUrl}")`,
      `        page = ${pageClassName}(driver)`,
      '',
      '        # 2. Executing recorded test actions via Page Object',
      ...(pomSteps.length > 0 ? pomSteps : ['        pass']),
      '    finally:',
      '        driver.quit()',
      '',
    ].join('\n');
  }

  /**
   * Generates Java test using Page Object Model methods with JUnit 5
   */
  public generateJavaPomTestScript(rawPageClassName: string = 'LoginPage'): string {
    let pageClassName = rawPageClassName.replace(/[^a-zA-Z0-9_]/g, '');
    if (/^[0-9]/.test(pageClassName)) {
      pageClassName = `Page${pageClassName}`;
    }
    const testClassName = pageClassName.endsWith('Page')
      ? pageClassName.slice(0, -4) + 'Test'
      : `${pageClassName}Test`;

    const navAction = this.actions.find((a) => a.type === 'navigation');
    const startUrl = navAction?.url || 'http://localhost:8000/';

    const pomSteps: string[] = [];

    this.actions.forEach((act) => {
      if (act.type === 'click' && act.suggestedVariableName) {
        const methodName = LocatorRanker.toMethodName(act.suggestedVariableName, 'click', 'java');
        pomSteps.push(`        page.${methodName}();`);
      } else if (act.type === 'input' && act.suggestedVariableName) {
        const methodName = LocatorRanker.toMethodName(act.suggestedVariableName, 'enter', 'java');
        const cleanVal = (act.value || '').replace(/"/g, '\\"').replace(/\r?\n|\r/g, ' ');
        pomSteps.push(`        page.${methodName}("${cleanVal}");`);
      } else if (act.type === 'assert' && act.suggestedVariableName) {
        const camel = LocatorRanker.toCamelCase(act.suggestedVariableName);
        const cap = camel.charAt(0).toUpperCase() + camel.slice(1);
        if (act.assertionType === 'visible') {
          pomSteps.push(`        assertTrue(page.is${cap}Visible());`);
        } else if (act.assertionType === 'text_contains') {
          const cleanVal = (act.expectedValue || '').replace(/"/g, '\\"').replace(/\r?\n|\r/g, ' ');
          pomSteps.push(`        assertTrue(page.get${cap}Text().contains("${cleanVal}"));`);
        } else if (act.assertionType === 'hidden') {
          pomSteps.push(`        assertTrue(page.is${cap}Hidden());`);
        } else {
          pomSteps.push(`        assertTrue(page.is${cap}Visible());`);
        }
      }
    });

    return [
      'package tests;',
      '',
      'import static org.junit.jupiter.api.Assertions.assertTrue;',
      'import org.junit.jupiter.api.AfterEach;',
      'import org.junit.jupiter.api.BeforeEach;',
      'import org.junit.jupiter.api.Test;',
      'import org.openqa.selenium.WebDriver;',
      'import org.openqa.selenium.chrome.ChromeDriver;',
      `import pages.${pageClassName};`,
      '',
      '/**',
      ` * Auto-generated Selenium Test Scenario using ${pageClassName}`,
      ' */',
      `public class ${testClassName} {`,
      '    private WebDriver driver;',
      `    private ${pageClassName} page;`,
      '',
      '    @BeforeEach',
      '    public void setUp() {',
      '        driver = new ChromeDriver();',
      `        driver.get("${startUrl}");`,
      `        page = new ${pageClassName}(driver);`,
      '    }',
      '',
      '    @Test',
      '    public void testScenario() {',
      ...(pomSteps.length > 0 ? pomSteps : ['        // No actions recorded']),
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

  /**
   * Standalone Python script with inline WebDriverWait calls
   */
  public generatePythonStandaloneScript(pageClassName: string = 'TestPage'): string {
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
        steps.push(`        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)`);
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
        steps.push(
          `        element.send_keys("${(act.value || '').replace(/"/g, '\\"').replace(/\r?\n|\r/g, ' ')}")`
        );
        steps.push('');
      } else if (act.type === 'assert' && act.locator) {
        if (act.assertionType === 'visible') {
          steps.push(`        # Assert visible: ${act.targetElementDescription || 'Element'}`);
          steps.push(
            `        assert_el = wait.until(EC.visibility_of_element_located((${this.getPythonBy(act.locator)})))`
          );
          steps.push(`        assert assert_el.is_displayed(), "Expected element to be visible"`);
        } else if (act.assertionType === 'text_contains') {
          const cleanExpected = (act.expectedValue || '').replace(/"/g, '\\"').replace(/\r?\n|\r/g, ' ');
          steps.push(`        # Assert text contains "${cleanExpected}": ${act.targetElementDescription || 'Element'}`);
          steps.push(
            `        assert_el = wait.until(EC.visibility_of_element_located((${this.getPythonBy(act.locator)})))`
          );
          steps.push(`        assert "${cleanExpected}" in assert_el.text, f"Expected '${cleanExpected}' in element text"`);
        } else if (act.assertionType === 'hidden') {
          steps.push(`        # Assert hidden: ${act.targetElementDescription || 'Element'}`);
          steps.push(
            `        assert wait.until(EC.invisibility_of_element_located((${this.getPythonBy(act.locator)}))), "Expected element to be hidden"`
          );
        } else if (act.assertionType === 'state') {
          steps.push(`        # Assert enabled: ${act.targetElementDescription || 'Element'}`);
          steps.push(
            `        assert_el = wait.until(EC.element_to_be_clickable((${this.getPythonBy(act.locator)})))`
          );
          steps.push(`        assert assert_el.is_enabled(), "Expected element to be enabled"`);
        }
        steps.push('');
      }
    });

    return [
      '"""',
      'Generated Standalone Selenium Python Test Script by AutoPOM',
      '"""',
      'import pytest',
      'from selenium import webdriver',
      'from selenium.webdriver.common.by import By',
      'from selenium.webdriver.support.ui import WebDriverWait',
      'from selenium.webdriver.support import expected_conditions as EC',
      '',
      '',
      `def test_${this.toSnakeCase(pageClassName.replace(/Page$/, ''))}_scenario():`,
      '    driver = webdriver.Chrome()',
      '    wait = WebDriverWait(driver, 10)',
      '    try:',
      ...(steps.length > 0 ? steps : ['        pass']),
      '    finally:',
      '        driver.quit()',
      '',
    ].join('\n');
  }

  /**
   * Standalone Java script with inline WebDriverWait calls
   */
  public generateJavaStandaloneScript(rawClassName: string = 'RecordedScenarioTest'): string {
    let className = rawClassName.replace(/[^a-zA-Z0-9_]/g, '');
    if (/^[0-9]/.test(className)) {
      className = `Test${className}`;
    }
    const testClassName = className.endsWith('Page')
      ? className.slice(0, -4) + 'Test'
      : (className.endsWith('Test') ? className : `${className}Test`);

    const steps: string[] = [];

    this.actions.forEach((act) => {
      if (act.type === 'navigation' && act.url) {
        steps.push(`        // 1. Navigate to target URL`);
        steps.push(`        driver.get("${act.url}");`);
        steps.push('');
      } else if (act.type === 'click' && act.locator) {
        steps.push(`        // ${act.targetElementDescription || 'Click element'}`);
        steps.push(
          `        WebElement clickEl = wait.until(ExpectedConditions.elementToBeClickable(${this.getJavaBy(act.locator)}));`
        );
        steps.push(
          `        ((JavascriptExecutor) driver).executeScript("arguments[0].scrollIntoView({block: 'center'});", clickEl);`
        );
        steps.push(`        clickEl.click();`);
        steps.push('');
      } else if (act.type === 'input' && act.locator) {
        steps.push(`        // ${act.targetElementDescription || 'Input text'}`);
        steps.push(
          `        WebElement inputEl = wait.until(ExpectedConditions.visibilityOfElementLocated(${this.getJavaBy(act.locator)}));`
        );
        steps.push(`        inputEl.clear();`);
        steps.push(`        inputEl.sendKeys("${(act.value || '').replace(/"/g, '\\"')}");`);
        steps.push('');
      } else if (act.type === 'assert' && act.locator) {
        if (act.assertionType === 'visible') {
          steps.push(`        // Assert visible: ${act.targetElementDescription || 'Element'}`);
          steps.push(
            `        WebElement assertEl = wait.until(ExpectedConditions.visibilityOfElementLocated(${this.getJavaBy(act.locator)}));`
          );
          steps.push(`        assertTrue(assertEl.isDisplayed(), "Expected element to be visible");`);
        } else if (act.assertionType === 'text_contains') {
          const cleanExpected = (act.expectedValue || '').replace(/"/g, '\\"').replace(/\r?\n|\r/g, ' ');
          steps.push(`        // Assert text contains "${cleanExpected}": ${act.targetElementDescription || 'Element'}`);
          steps.push(
            `        WebElement assertEl = wait.until(ExpectedConditions.visibilityOfElementLocated(${this.getJavaBy(act.locator)}));`
          );
          steps.push(`        assertTrue(assertEl.getText().contains("${cleanExpected}"), "Expected element text to contain substring");`);
        } else if (act.assertionType === 'hidden') {
          steps.push(`        // Assert hidden: ${act.targetElementDescription || 'Element'}`);
          steps.push(
            `        assertTrue(wait.until(ExpectedConditions.invisibilityOfElementLocated(${this.getJavaBy(act.locator)})), "Expected element to be hidden");`
          );
        } else if (act.assertionType === 'state') {
          steps.push(`        // Assert enabled: ${act.targetElementDescription || 'Element'}`);
          steps.push(
            `        WebElement assertEl = wait.until(ExpectedConditions.elementToBeClickable(${this.getJavaBy(act.locator)}));`
          );
          steps.push(`        assertTrue(assertEl.isEnabled(), "Expected element to be enabled");`);
        }
        steps.push('');
      }
    });

    return [
      'package tests;',
      '',
      'import static org.junit.jupiter.api.Assertions.assertTrue;',
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
      ` * Auto-generated Standalone Selenium Test Scenario by AutoPOM`,
      ' */',
      `public class ${testClassName} {`,
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
    let res = str
      .replace(/([A-Z])/g, '_$1')
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_/, '')
      .toLowerCase();

    if (/^[0-9]/.test(res)) {
      res = `btn_${res}`;
    }

    return res || 'scenario';
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
