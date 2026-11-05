import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { BrowserManager } from '../bridge/browserManager';
import { DomExtractor } from '../scanner/domExtractor';
import { RecorderManager } from '../recorder/recorderManager';
import { AIService } from '../ai/aiService';
import { PythonSeleniumGenerator } from '../generators/pythonSelenium';
import { JavaSeleniumGenerator } from '../generators/javaSelenium';
import { ScannedElement, PageScanResult } from '../types';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'autopom.sidebarView';
  private view?: vscode.WebviewView;
  private lastScanResult?: PageScanResult;

  constructor(private readonly extensionUri: vscode.Uri) {
    // Setup real-time action listener for recorder
    RecorderManager.getInstance().setOnActionCallback((action, totalCount) => {
      this.view?.webview.postMessage({
        type: 'actionCaptured',
        action,
        totalCount,
      });
    });
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      try {
        switch (data.type) {
          case 'checkStatus':
            this.sendBrowserStatus();
            break;

          case 'launchBrowser':
            await this.handleLaunchBrowser(data.url);
            break;

          case 'navigateTo':
            await this.handleNavigate(data.url);
            break;

          case 'scanPage':
            await this.handleScanPage();
            break;

          case 'startRecording':
            await this.handleStartRecording();
            break;

          case 'stopRecording':
            await this.handleStopRecording();
            break;

          case 'aiRefactor':
            await this.handleAiRefactor(data.className, data.elements);
            break;

          case 'generatePOM':
            await this.handleGeneratePOM(data.className, data.language, data.elements);
            break;

          case 'generateTestScript':
            await this.handleGenerateTestScript(data.className, data.language, data.usePom !== false);
            break;
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(`[AutoPOM] ${err.message || err}`);
        this.view?.webview.postMessage({ type: 'error', message: err.message });
      }
    });
  }

  private sendBrowserStatus(): void {
    const connected = BrowserManager.getInstance().isConnected();
    this.view?.webview.postMessage({
      type: 'browserStatus',
      connected,
    });
  }

  private async handleLaunchBrowser(customUrl?: string): Promise<void> {
    try {
      const url = customUrl || 'https://the-internet.herokuapp.com/login';
      vscode.window.showInformationMessage(`AutoPOM: Launching Chrome with CDP enabled (${url})...`);
      const page = await BrowserManager.getInstance().launchAndConnect(url);
      const currentUrl = page.url();

      this.view?.webview.postMessage({
        type: 'urlUpdated',
        url: currentUrl,
      });

      vscode.window.showInformationMessage('AutoPOM: Connected to Chrome successfully!');
      this.sendBrowserStatus();
    } catch (err: any) {
      vscode.window.showErrorMessage(`AutoPOM: Failed to connect to Chrome: ${err.message}`);
      this.view?.webview.postMessage({ type: 'error', message: err.message });
    }
  }

  private async handleNavigate(targetUrl: string): Promise<void> {
    try {
      if (!targetUrl || targetUrl.trim().length === 0) {
        vscode.window.showWarningMessage('Please enter a valid URL.');
        return;
      }
      vscode.window.showInformationMessage(`AutoPOM: Navigating to ${targetUrl}...`);
      const page = await BrowserManager.getInstance().navigateTo(targetUrl);
      this.view?.webview.postMessage({
        type: 'urlUpdated',
        url: page.url(),
      });
      vscode.window.showInformationMessage(`AutoPOM: Loaded ${page.url()}`);
    } catch (err: any) {
      vscode.window.showErrorMessage(`AutoPOM Navigation Error: ${err.message}`);
      this.view?.webview.postMessage({ type: 'error', message: err.message });
    }
  }

  private async handleScanPage(): Promise<void> {
    try {
      const page = await BrowserManager.getInstance().getActivePage();
      const result = await DomExtractor.scanPage(page);
      this.lastScanResult = result;

      // Suggest clean, concise class name from page title or URL
      const suggestedClassName = this.suggestCleanPageClassName(result.title);

      this.view?.webview.postMessage({
        type: 'scanCompleted',
        suggestedClassName,
        elements: result.elements,
        url: result.url,
      });

      vscode.window.showInformationMessage(
        `AutoPOM: Found ${result.elements.length} interactive elements on "${result.title}".`
      );
    } catch (err: any) {
      vscode.window.showErrorMessage(`AutoPOM Scan error: ${err.message}`);
      this.view?.webview.postMessage({ type: 'error', message: err.message });
    }
  }

  private async handleStartRecording(): Promise<void> {
    try {
      const page = await BrowserManager.getInstance().getActivePage();
      await RecorderManager.getInstance().startRecording(page);

      this.view?.webview.postMessage({
        type: 'recordingStatus',
        isRecording: true,
        actionCount: 1,
        actions: RecorderManager.getInstance().getRecordedActions(),
      });

      vscode.window.showInformationMessage('AutoPOM: Recording started! Perform your test clicks & inputs in Chrome.');
    } catch (err: any) {
      vscode.window.showErrorMessage(`AutoPOM Recording error: ${err.message}`);
    }
  }

  private async handleStopRecording(): Promise<void> {
    try {
      const actions = await RecorderManager.getInstance().stopRecording();

      this.view?.webview.postMessage({
        type: 'recordingStatus',
        isRecording: false,
        actionCount: actions.length,
        actions: actions,
      });

      const choice = await vscode.window.showInformationMessage(
        `AutoPOM: Recording stopped. Captured ${actions.length} actions!`,
        'Open Test Script'
      );

      if (choice === 'Open Test Script') {
        await this.handleGenerateTestScript('RecordedScenarioTest', 'python');
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(`AutoPOM Stop Recording error: ${err.message}`);
    }
  }

  private async handleAiRefactor(className: string, elements: ScannedElement[]): Promise<void> {
    const pageTitle = this.lastScanResult?.title || className;
    const pageUrl = this.lastScanResult?.url || '';

    const { pageClassName, updatedElements } = await AIService.getInstance().refactorWithAI(
      elements,
      pageTitle,
      pageUrl
    );

    this.view?.webview.postMessage({
      type: 'aiRefactorCompleted',
      pageClassName,
      elements: updatedElements,
    });
  }

  private async handleGeneratePOM(
    className: string,
    language: 'python' | 'java',
    elements: ScannedElement[]
  ): Promise<void> {
    const generator = language === 'python' ? new PythonSeleniumGenerator() : new JavaSeleniumGenerator();

    const code = generator.generatePOM({
      className: className || 'SamplePage',
      language,
      url: this.lastScanResult?.url,
      elements,
    });

    const ext = generator.getFileExtension();
    const fileName = `${className}${ext}`;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      const rootPath = workspaceFolders[0].uri.fsPath;
      const pagesDir = path.join(rootPath, language === 'python' ? 'pages' : 'src/test/java/pages');

      if (!fs.existsSync(pagesDir)) {
        fs.mkdirSync(pagesDir, { recursive: true });
      }

      const filePath = path.join(pagesDir, fileName);
      fs.writeFileSync(filePath, code, 'utf-8');

      const doc = await vscode.workspace.openTextDocument(filePath);
      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage(`AutoPOM: Generated ${fileName} in ${pagesDir}`);
    } else {
      const doc = await vscode.workspace.openTextDocument({
        content: code,
        language: language === 'python' ? 'python' : 'java',
      });
      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage(`AutoPOM: Generated ${fileName}`);
    }
  }

  private async handleGenerateTestScript(
    className: string,
    language: 'python' | 'java',
    usePom: boolean = true
  ): Promise<void> {
    const code = RecorderManager.getInstance().generateTestScript(language, className, usePom);
    const doc = await vscode.workspace.openTextDocument({
      content: code,
      language: language === 'python' ? 'python' : 'java',
    });
    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage('AutoPOM: Generated recorded test script!');
  }

  private suggestCleanPageClassName(rawTitle: string): string {
    if (!rawTitle) return 'LoginPage';

    // Remove file extensions, URLs, or trailing branding (e.g. "Proposal Platform | Acme Corp")
    const clean = rawTitle
      .replace(/https?:\/\/[^\s]+/g, '')
      .replace(/[|–—\-_].*$/, '')
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .trim();

    const stopWords = new Set([
      'and', 'or', 'the', 'a', 'an', 'of', 'to', 'in', 'for', 'with', 'on', 'at', 'by', 'from'
    ]);
    const words = clean
      .split(/\s+/)
      .filter((w) => w && !stopWords.has(w.toLowerCase()));

    if (words.length === 0) return 'CustomPage';

    // If title has many words, pick the last 2-3 significant words for clean conciseness
    const selectedWords = words.length > 3 ? words.slice(-3) : words;

    const pascal = selectedWords
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('');

    return pascal.endsWith('Page') ? pascal : `${pascal}Page`;
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const distWebviewDir = path.join(this.extensionUri.fsPath, 'dist', 'webview');
    const baseDir = fs.existsSync(distWebviewDir)
      ? distWebviewDir
      : path.join(this.extensionUri.fsPath, 'src', 'views', 'webview');

    const htmlPath = path.join(baseDir, 'index.html');
    const stylePath = path.join(baseDir, 'style.css');
    const scriptPath = path.join(baseDir, 'main.js');

    const styleUri = webview.asWebviewUri(vscode.Uri.file(stylePath));
    const scriptUri = webview.asWebviewUri(vscode.Uri.file(scriptPath));

    let html = fs.readFileSync(htmlPath, 'utf8');
    html = html.replace('{{styleUri}}', styleUri.toString());
    html = html.replace('{{scriptUri}}', scriptUri.toString());

    return html;
  }
}
