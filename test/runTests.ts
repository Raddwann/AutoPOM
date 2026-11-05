import test from 'node:test';
import assert from 'node:assert';
import { LocatorRanker } from '../src/scanner/locatorRanker';
import { PythonSeleniumGenerator } from '../src/generators/pythonSelenium';
import { JavaSeleniumGenerator } from '../src/generators/javaSelenium';
import { DomPruner } from '../src/ai/domPruner';
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

  // Name should rank higher than dynamic ID
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

test('PythonSeleniumGenerator: produces valid Page Object class', () => {
  const generator = new PythonSeleniumGenerator();
  const sampleElements: ScannedElement[] = [
    {
      id: 'el_1',
      tagName: 'input',
      suggestedVariableName: 'usernameInput',
      category: 'input',
      confidence: 'high',
      selected: true,
      locators: [],
      recommendedLocator: {
        type: 'id',
        value: 'username',
        score: 90,
        isUnique: true,
      },
      boundingRect: { x: 0, y: 0, width: 100, height: 30 },
    },
    {
      id: 'el_2',
      tagName: 'button',
      suggestedVariableName: 'submitButton',
      category: 'button',
      confidence: 'high',
      selected: true,
      locators: [],
      recommendedLocator: {
        type: 'css',
        value: 'button[type="submit"]',
        score: 70,
        isUnique: true,
      },
      boundingRect: { x: 0, y: 50, width: 80, height: 30 },
    },
  ];

  const code = generator.generatePOM({
    className: 'LoginPage',
    language: 'python',
    url: 'https://example.com/login',
    elements: sampleElements,
  });

  assert.ok(code.includes('class LoginPage:'));
  assert.ok(code.includes('USERNAME_INPUT = (By.ID, "username")'));
  assert.ok(code.includes('SUBMIT_BUTTON = (By.CSS_SELECTOR, "button[type=\\"submit\\"]")'));
  assert.ok(code.includes('def enter_username_input(self, value: str):'));
  assert.ok(code.includes('def click_submit_button(self):'));
  assert.ok(code.includes('WebDriverWait'));
});

test('JavaSeleniumGenerator: produces valid Java Page Object class', () => {
  const generator = new JavaSeleniumGenerator();
  const sampleElements: ScannedElement[] = [
    {
      id: 'el_1',
      tagName: 'button',
      suggestedVariableName: 'loginButton',
      category: 'button',
      confidence: 'high',
      selected: true,
      locators: [],
      recommendedLocator: {
        type: 'id',
        value: 'login-btn',
        score: 90,
        isUnique: true,
      },
      boundingRect: { x: 0, y: 0, width: 100, height: 30 },
    },
  ];

  const code = generator.generatePOM({
    className: 'LoginPage',
    language: 'java',
    url: 'https://example.com/login',
    elements: sampleElements,
  });

  assert.ok(code.includes('public class LoginPage {'));
  assert.ok(code.includes('private final By loginButton = By.id("login-btn");'));
  assert.ok(code.includes('public LoginPage clickLoginButton() {'));
  assert.ok(code.includes('ExpectedConditions.elementToBeClickable'));
});

test('DomPruner: sanitizes emails and credit cards from DOM', () => {
  const textWithPii = 'Contact user john.doe@corp.example.com with card 4111-2222-3333-4444';
  const sanitized = DomPruner.sanitizePii(textWithPii);

  assert.ok(!sanitized.includes('john.doe@corp.example.com'));
  assert.ok(sanitized.includes('[EMAIL]'));
  assert.ok(!sanitized.includes('4111-2222-3333-4444'));
  assert.ok(sanitized.includes('[CARD]'));
});

