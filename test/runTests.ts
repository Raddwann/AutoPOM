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

test('LocatorRanker: normalizes newlines in button text for XPath', () => {
  const locators = LocatorRanker.rankLocators({
    tagName: 'button',
    innerText: '01\nCatalog',
  });

  const xpathLocator = locators.find((l) => l.type === 'xpath');
  assert.ok(xpathLocator);
  // Must NOT contain literal raw newline
  assert.ok(!xpathLocator.value.includes('\n'));
  assert.strictEqual(xpathLocator.value, "//button[normalize-space()='01 Catalog']");
});

test('PythonSeleniumGenerator: handles starting digits and deduplicates repeated buttons', () => {
  const generator = new PythonSeleniumGenerator();
  const sampleElements: ScannedElement[] = [
    {
      id: 'el_1',
      tagName: 'button',
      suggestedVariableName: '01CatalogButton',
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
    // Two identical buttons on page (e.g. repeated table rows)
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

  const code = generator.generatePOM({
    className: 'CatalogPage',
    language: 'python',
    url: 'http://localhost:8000/',
    elements: sampleElements,
  });

  // Valid identifier: cannot start with digit '01'
  assert.ok(!code.includes('01CATALOG_BUTTON ='), 'Must not start with number');
  assert.ok(code.includes('BTN_01_CATALOG_BUTTON ='), 'Must be prefixed with valid identifier');

  // Deduplication: DELETE_SOURCE_BUTTON should only be defined ONCE
  const occurrences = (code.match(/DELETE_SOURCE_BUTTON =/g) || []).length;
  assert.strictEqual(occurrences, 1, 'Repeated button must only be defined once in locators');

  // Must have index-aware action method
  assert.ok(code.includes('def click_delete_source_button(self, index: int = 0):'));
});

test('RecorderManager: generates properly indented Python test script (8 spaces inside try)', () => {
  const recorder = RecorderManager.getInstance();
  // Generate dummy test script
  const script = recorder.generateTestScript('python', 'SampleScenarioTest');

  assert.ok(script.includes('    try:'));
  // Lines inside try must be indented by 8 spaces, not 4
  const lines = script.split('\n');
  const tryIndex = lines.findIndex((l) => l.trim() === 'try:');
  assert.ok(tryIndex !== -1);
  const nextLine = lines[tryIndex + 1];
  assert.ok(nextLine.startsWith('        '), 'Lines inside try block must have 8 spaces indentation');
});

test('DomPruner: sanitizes emails and credit cards from DOM', () => {
  const textWithPii = 'Contact user john.doe@corp.example.com with card 4111-2222-3333-4444';
  const sanitized = DomPruner.sanitizePii(textWithPii);

  assert.ok(!sanitized.includes('john.doe@corp.example.com'));
  assert.ok(sanitized.includes('[EMAIL]'));
  assert.ok(!sanitized.includes('4111-2222-3333-4444'));
  assert.ok(sanitized.includes('[CARD]'));
});
