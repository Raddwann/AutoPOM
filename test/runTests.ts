import test from 'node:test';
import assert from 'node:assert';
import { LocatorRanker } from '../src/scanner/locatorRanker';
import { PythonSeleniumGenerator } from '../src/generators/pythonSelenium';
import { JavaSeleniumGenerator } from '../src/generators/javaSelenium';
import { DomPruner } from '../src/ai/domPruner';
import { RecorderManager } from '../src/recorder/recorderManager';
import { ScannedElement } from '../src/types';

test('LocatorRanker: prioritizes data-testid with score 100', () => {
  const locators = LocatorRanker.rankLocators({
    tagName: 'button',
    id: 'submit-btn-49',
    dataTestId: 'login-submit',
    innerText: 'Log In',
  });

  assert.strictEqual(locators[0].type, 'data-testid');
  assert.strictEqual(locators[0].value, '[data-testid="login-submit"]');
  assert.strictEqual(locators[0].score, 100);
});

test('LocatorRanker: identifies dynamic IDs and penalizes them', () => {
  const locators = LocatorRanker.rankLocators({
    tagName: 'input',
    id: 'input_84719247',
    name: 'email',
  });

  assert.strictEqual(locators[0].type, 'name');
  assert.strictEqual(locators[0].value, 'email');
  assert.strictEqual(locators[0].score, 80);

  const idLocator = locators.find((l) => l.type === 'id');
  assert.ok(idLocator);
  assert.ok(idLocator.score <= 50, 'Dynamic ID score should be penalized');
});

test('LocatorRanker: suggests clean camelCase variable names', () => {
  const varName1 = LocatorRanker.suggestVariableName(
    { tagName: 'button', innerText: 'Sign In to Account' },
    'button'
  );
  assert.strictEqual(varName1, 'signInToAccountButton');

  const varName2 = LocatorRanker.suggestVariableName(
    { tagName: 'input', name: 'user_password' },
    'input'
  );
  assert.strictEqual(varName2, 'userPasswordInput');
});

test('LocatorRanker: generates multi-segment contains XPath for multi-line elements', () => {
  const locators = LocatorRanker.rankLocators({
    tagName: 'button',
    innerText: '01\nCatalog',
  });

  const topXpath = locators.find((l) => l.type === 'xpath');
  assert.ok(topXpath);
  assert.ok(!topXpath.value.includes('\n'));
  assert.strictEqual(topXpath.value, "//button[contains(., '01') and contains(., 'Catalog')]");

  const normalizeXpath = locators.filter((l) => l.type === 'xpath')[1];
  assert.ok(normalizeXpath);
  assert.strictEqual(normalizeXpath.value, "//button[normalize-space()='01 Catalog']");
});

test('LocatorRanker: toMethodName produces unified, matching method names for POM and Recorder', () => {
  // Python method names
  assert.strictEqual(LocatorRanker.toMethodName('btn_01CatalogButton', 'click', 'python'), 'click_btn01catalog_button');
  assert.strictEqual(LocatorRanker.toMethodName('filterSourcesInput', 'enter', 'python'), 'enter_filter_sources_input');

  // Java method names
  assert.strictEqual(LocatorRanker.toMethodName('btn_01CatalogButton', 'click', 'java'), 'clickBtn01catalogButton');
  assert.strictEqual(LocatorRanker.toMethodName('filterSourcesInput', 'enter', 'java'), 'enterFilterSourcesInput');
});

test('PythonSeleniumGenerator: handles starting digits and deduplicates repeated buttons', () => {
  const generator = new PythonSeleniumGenerator();
  const sampleElements: ScannedElement[] = [
    {
      id: 'el_1',
      tagName: 'button',
      suggestedVariableName: 'btn_01CatalogButton',
      category: 'button',
      confidence: 'high',
      selected: true,
      locators: [],
      recommendedLocator: {
        type: 'xpath',
        value: "//button[normalize-space()='01 Catalog']",
        score: 70,
        isUnique: true,
      },
      boundingRect: { x: 0, y: 0, width: 100, height: 30 },
    },
    {
      id: 'el_2',
      tagName: 'button',
      suggestedVariableName: 'deleteSourceButton',
      category: 'button',
      confidence: 'high',
      selected: true,
      locators: [],
      recommendedLocator: {
        type: 'xpath',
        value: "//button[normalize-space()='Delete Source']",
        score: 70,
        isUnique: false,
      },
      boundingRect: { x: 0, y: 50, width: 80, height: 30 },
    },
    {
      id: 'el_3',
      tagName: 'button',
      suggestedVariableName: 'deleteSourceButton',
      category: 'button',
      confidence: 'high',
      selected: true,
      locators: [],
      recommendedLocator: {
        type: 'xpath',
        value: "//button[normalize-space()='Delete Source']",
        score: 70,
        isUnique: false,
      },
      boundingRect: { x: 0, y: 90, width: 80, height: 30 },
    },
  ];

  // Test when className starts with a number like "01catalogPage"
  const codeWithDigitClass = generator.generatePOM({
    className: '01catalogPage',
    language: 'python',
    url: 'http://localhost:8000/',
    elements: sampleElements,
  });

  assert.ok(!codeWithDigitClass.includes('class 01catalogPage:'), 'Class name must not start with a digit in Python');
  assert.ok(codeWithDigitClass.includes('class Page01catalogPage:'), 'Class name starting with digit must be prefixed');

  const code = generator.generatePOM({
    className: 'CatalogPage',
    language: 'python',
    url: 'http://localhost:8000/',
    elements: sampleElements,
  });

  assert.ok(!code.includes('01CATALOG_BUTTON ='), 'Must not start with number');
  assert.ok(code.includes('BTN_01_CATALOG_BUTTON ='), 'Must be prefixed with valid identifier');

  const occurrences = (code.match(/DELETE_SOURCE_BUTTON =/g) || []).length;
  assert.strictEqual(occurrences, 1, 'Repeated button must only be defined once in locators');
  assert.ok(code.includes('def click_delete_source_button(self, index: int = 0):'));
});

test('RecorderManager: generates POM-driven test script in Python and Java with clean Test class names', () => {
  const recorder = RecorderManager.getInstance();

  // Test Java Test class naming convention
  const javaScript = recorder.generateTestScript('java', 'ProposalPlatformPage', true);
  assert.ok(javaScript.includes('public class ProposalPlatformTest {'), 'Java test class must end in Test, not Page');
  assert.ok(javaScript.includes('import pages.ProposalPlatformPage;'));
  assert.ok(javaScript.includes('page = new ProposalPlatformPage(driver);'));

  // Test Python POM-driven test
  const pythonScript = recorder.generateTestScript('python', 'ProposalPlatformPage', true);
  assert.ok(pythonScript.includes('from pages.proposal_platform_page import ProposalPlatformPage'));
  assert.ok(pythonScript.includes('page = ProposalPlatformPage(driver)'));
  assert.ok(pythonScript.includes('def test_proposal_platform_scenario():'));
});

test('DomPruner: sanitizes emails and credit cards from DOM', () => {
  const textWithPii = 'Contact user john.doe@corp.example.com with card 4111-2222-3333-4444';
  const sanitized = DomPruner.sanitizePii(textWithPii);

  assert.ok(!sanitized.includes('john.doe@corp.example.com'));
  assert.ok(sanitized.includes('[EMAIL]'));
  assert.ok(!sanitized.includes('4111-2222-3333-4444'));
  assert.ok(sanitized.includes('[CARD]'));
});

test('PythonSeleniumGenerator: generates verification methods and supports component grouping', () => {
  const generator = new PythonSeleniumGenerator();
  const sampleElements: ScannedElement[] = [
    {
      id: 'el_1',
      tagName: 'button',
      suggestedVariableName: 'catalogButton',
      category: 'button',
      confidence: 'high',
      selected: true,
      componentGroup: 'Navigation',
      locators: [],
      recommendedLocator: {
        type: 'xpath',
        value: "//button[normalize-space()='01 Catalog']",
        score: 70,
        isUnique: true,
      },
      boundingRect: { x: 0, y: 0, width: 100, height: 30 },
    },
    {
      id: 'el_2',
      tagName: 'input',
      suggestedVariableName: 'usernameInput',
      category: 'input',
      confidence: 'high',
      selected: true,
      componentGroup: 'LoginForm',
      locators: [],
      recommendedLocator: {
        type: 'css',
        value: 'input[name="username"]',
        score: 80,
        isUnique: true,
      },
      boundingRect: { x: 0, y: 50, width: 100, height: 30 },
    },
  ];

  const code = generator.generatePOM({
    className: 'LoginPage',
    language: 'python',
    url: 'http://localhost:8000/',
    elements: sampleElements,
  });

  // Verify component grouping headers
  assert.ok(code.includes('# --- Component: Navigation ---'), 'Should group Navigation locators');
  assert.ok(code.includes('# --- Component: LoginForm ---'), 'Should group LoginForm locators');
  assert.ok(code.includes('# --- Component Actions: Navigation ---'));
  assert.ok(code.includes('# --- Component Verifications: Navigation ---'));

  // Verify verification helper methods
  assert.ok(code.includes('def is_catalog_button_visible(self) -> bool:'), 'Must generate visibility check');
  assert.ok(code.includes('def get_catalog_button_text(self) -> str:'), 'Must generate text getter');
  assert.ok(code.includes('def is_catalog_button_hidden(self) -> bool:'), 'Must generate hidden check');
  assert.ok(code.includes('def is_username_input_visible(self) -> bool:'));
});

test('JavaSeleniumGenerator: generates verification methods and supports component grouping', () => {
  const generator = new JavaSeleniumGenerator();
  const sampleElements: ScannedElement[] = [
    {
      id: 'el_1',
      tagName: 'button',
      suggestedVariableName: 'catalogButton',
      category: 'button',
      confidence: 'high',
      selected: true,
      componentGroup: 'Navigation',
      locators: [],
      recommendedLocator: {
        type: 'xpath',
        value: "//button[normalize-space()='01 Catalog']",
        score: 70,
        isUnique: true,
      },
      boundingRect: { x: 0, y: 0, width: 100, height: 30 },
    },
  ];

  const code = generator.generatePOM({
    className: 'LoginPage',
    language: 'java',
    url: 'http://localhost:8000/',
    elements: sampleElements,
  });

  // Verify component grouping
  assert.ok(code.includes('// --- Component: Navigation ---'));
  assert.ok(code.includes('// --- Component Actions: Navigation ---'));
  assert.ok(code.includes('// --- Component Verifications: Navigation ---'));

  // Verify verification helper methods
  assert.ok(code.includes('public boolean isCatalogButtonVisible()'));
  assert.ok(code.includes('public String getCatalogButtonText()'));
  assert.ok(code.includes('public boolean isCatalogButtonHidden()'));
});

test('RecorderManager: generates assertion steps for both Standalone and POM test scripts', () => {
  const recorder = RecorderManager.getInstance();
  recorder.setRecordedActions([
    {
      id: 'act_1',
      type: 'navigation',
      url: 'http://localhost:8000/',
      timestamp: 1000,
    },
    {
      id: 'act_2',
      type: 'assert',
      assertionType: 'visible',
      suggestedVariableName: 'catalogButton',
      targetElementDescription: 'Catalog Button',
      locator: {
        type: 'xpath',
        value: "//button[normalize-space()='01 Catalog']",
        score: 70,
        isUnique: true,
      },
      timestamp: 2000,
    },
    {
      id: 'act_3',
      type: 'assert',
      assertionType: 'text_contains',
      expectedValue: 'Catalog',
      suggestedVariableName: 'catalogButton',
      targetElementDescription: 'Catalog Button',
      locator: {
        type: 'xpath',
        value: "//button[normalize-space()='01 Catalog']",
        score: 70,
        isUnique: true,
      },
      timestamp: 3000,
    },
  ]);

  // 1. Python POM
  const pyPom = recorder.generateTestScript('python', 'CatalogPage', true);
  assert.ok(pyPom.includes('assert page.is_catalog_button_visible()'), 'Python POM should call is_catalog_button_visible');
  assert.ok(pyPom.includes('assert "Catalog" in page.get_catalog_button_text()'), 'Python POM should call get_catalog_button_text');

  // 2. Python Standalone
  const pyStandalone = recorder.generateTestScript('python', 'CatalogPage', false);
  assert.ok(pyStandalone.includes('assert assert_el.is_displayed()'), 'Python standalone should assert is_displayed');
  assert.ok(pyStandalone.includes('"Catalog" in assert_el.text'), 'Python standalone should assert text contains');

  // 3. Java POM
  const javaPom = recorder.generateTestScript('java', 'CatalogPage', true);
  assert.ok(javaPom.includes('assertTrue(page.isCatalogButtonVisible());'), 'Java POM should call isCatalogButtonVisible');
  assert.ok(javaPom.includes('assertTrue(page.getCatalogButtonText().contains("Catalog"));'), 'Java POM should verify text contains');

  // 4. Java Standalone
  const javaStandalone = recorder.generateTestScript('java', 'CatalogPage', false);
  assert.ok(javaStandalone.includes('assertTrue(assertEl.isDisplayed()'), 'Java standalone should assert isDisplayed');
  assert.ok(javaStandalone.includes('assertTrue(assertEl.getText().contains("Catalog")'), 'Java standalone should assert getText');
});
