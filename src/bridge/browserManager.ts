import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn, ChildProcess } from 'child_process';
import puppeteer, { Browser, Page } from 'puppeteer-core';
import * as vscode from 'vscode';

export class BrowserManager {
  private static instance: BrowserManager;
  private browser: Browser | null = null;
  private activePage: Page | null = null;
  private chromeProcess: ChildProcess | null = null;
  private cdpPort: number = 9222;

  private constructor() {}

  public static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  public isConnected(): boolean {
    return this.browser !== null && this.browser.connected;
  }

  /**
   * Discovers Chrome executable on Windows, macOS, or Linux.
   */
  public findChromeExecutable(): string | null {
    const customPath = vscode.workspace.getConfiguration('autopom').get<string>('chromePath');
    if (customPath && fs.existsSync(customPath)) {
      return customPath;
    }

    const platform = process.platform;
    const paths: string[] = [];

    if (platform === 'win32') {
      const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
      const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
      const localAppData = process.env['LocalAppData'] || 'C:\\Users\\Default\\AppData\\Local';

      paths.push(
        path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        // Fallback to Edge which also supports CDP
        path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
      );
    } else if (platform === 'darwin') {
      paths.push(
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/Applications/Chromium.app/Contents/MacOS/Chromium'
      );
    } else {
      paths.push(
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser'
      );
    }

    for (const p of paths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return null;
  }

  /**
   * Launches Chrome with CDP enabled and connects puppeteer.
   */
  public async launchAndConnect(initialUrl: string = 'https://the-internet.herokuapp.com/login'): Promise<Page> {
    this.cdpPort = vscode.workspace.getConfiguration('autopom').get<number>('cdpPort') || 9222;

    // Check if browser is already running on that port
    try {
      this.browser = await puppeteer.connect({
        browserURL: `http://127.0.0.1:${this.cdpPort}`,
        defaultViewport: null,
      });
      const page = await this.getActivePage();
      if (initialUrl && initialUrl !== 'about:blank') {
        await page.goto(this.ensureProtocol(initialUrl), { waitUntil: 'domcontentloaded' }).catch(() => {});
      }
      this.setupBrowserEvents();
      return page;
    } catch {
      // Not yet running, proceed to launch
    }

    const chromePath = this.findChromeExecutable();
    if (!chromePath) {
      throw new Error(
        'Chrome or Edge executable not found. Please set "autopom.chromePath" in Settings to your chrome.exe path.'
      );
    }

    // Isolated temporary user data dir so it won't conflict with existing sessions
    const userDataDir = path.join(os.tmpdir(), 'autopom_chrome_profile');
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }

    const args = [
      `--remote-debugging-port=${this.cdpPort}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      this.ensureProtocol(initialUrl),
    ];

    this.chromeProcess = spawn(chromePath, args, {
      detached: true,
      stdio: 'ignore',
    });
    this.chromeProcess.unref();

    // Wait for Chrome to open debugging port and connect
    let retries = 15;
    while (retries > 0) {
      await new Promise((r) => setTimeout(r, 600));
      try {
        this.browser = await puppeteer.connect({
          browserURL: `http://127.0.0.1:${this.cdpPort}`,
          defaultViewport: null,
        });
        break;
      } catch {
        retries--;
      }
    }

    if (!this.browser) {
      throw new Error(`Failed to connect to Chrome on port ${this.cdpPort} after launching.`);
    }

    const page = await this.getActivePage();
    this.setupBrowserEvents();
    return page;
  }

  /**
   * Navigates the active page to a user-specified URL.
   */
  public async navigateTo(url: string): Promise<Page> {
    const page = await this.getActivePage();
    const fullUrl = this.ensureProtocol(url);
    await page.goto(fullUrl, { waitUntil: 'domcontentloaded' });
    return page;
  }

  public async getActivePage(): Promise<Page> {
    if (this.activePage && !this.activePage.isClosed()) {
      return this.activePage;
    }
    if (this.browser && this.browser.connected) {
      const pages = await this.browser.pages();
      // Return the most recent non-closed page
      for (let i = pages.length - 1; i >= 0; i--) {
        if (!pages[i].isClosed()) {
          this.activePage = pages[i];
          return this.activePage;
        }
      }
      this.activePage = await this.browser.newPage();
      return this.activePage;
    }
    throw new Error('No active browser connected. Please click "Launch & Connect Chrome" first.');
  }

  public async closeBrowser(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // ignore
      }
      this.browser = null;
      this.activePage = null;
    }
    if (this.chromeProcess) {
      try {
        this.chromeProcess.kill();
      } catch {
        // ignore
      }
      this.chromeProcess = null;
    }
  }

  private ensureProtocol(url: string): string {
    const trimmed = (url || '').trim();
    if (!trimmed) return 'https://the-internet.herokuapp.com/login';
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return 'https://' + trimmed;
    }
    return trimmed;
  }

  private setupBrowserEvents(): void {
    if (!this.browser) return;

    this.browser.on('disconnected', () => {
      this.browser = null;
      this.activePage = null;
      vscode.commands.executeCommand('setContext', 'autopom.browserConnected', false);
    });

    vscode.commands.executeCommand('setContext', 'autopom.browserConnected', true);
  }
}
