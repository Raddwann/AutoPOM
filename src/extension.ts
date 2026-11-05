import * as vscode from 'vscode';
import { SidebarProvider } from './views/sidebarProvider';
import { BrowserManager } from './bridge/browserManager';
import { DomExtractor } from './scanner/domExtractor';
import { RecorderManager } from './recorder/recorderManager';

export function activate(context: vscode.ExtensionContext) {
  console.log('[AutoPOM] Extension is now activating...');

  const sidebarProvider = new SidebarProvider(context.extensionUri);

  // Register Webview View
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarProvider.viewType,
      sidebarProvider
    )
  );

  // Register Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('autopom.launchBrowser', async () => {
      try {
        await BrowserManager.getInstance().launchAndConnect();
        vscode.window.showInformationMessage('AutoPOM: Chrome launched and CDP connected!');
      } catch (err: any) {
        vscode.window.showErrorMessage(`AutoPOM Launch Error: ${err.message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('autopom.scanPage', async () => {
      try {
        const page = await BrowserManager.getInstance().getActivePage();
        const scan = await DomExtractor.scanPage(page);
        vscode.window.showInformationMessage(
          `AutoPOM: Scanned page "${scan.title}" - found ${scan.elements.length} elements.`
        );
      } catch (err: any) {
        vscode.window.showErrorMessage(`AutoPOM Scan Error: ${err.message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('autopom.startRecording', async () => {
      try {
        const page = await BrowserManager.getInstance().getActivePage();
        await RecorderManager.getInstance().startRecording(page);
        vscode.window.showInformationMessage('AutoPOM: Recording started.');
      } catch (err: any) {
        vscode.window.showErrorMessage(`AutoPOM Record Error: ${err.message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('autopom.stopRecording', async () => {
      try {
        const actions = await RecorderManager.getInstance().stopRecording();
        vscode.window.showInformationMessage(
          `AutoPOM: Recording stopped. ${actions.length} actions captured.`
        );
      } catch (err: any) {
        vscode.window.showErrorMessage(`AutoPOM Stop Error: ${err.message}`);
      }
    })
  );

  console.log('[AutoPOM] Extension activated successfully.');
}

export async function deactivate() {
  console.log('[AutoPOM] Extension deactivating. Closing browser if open...');
  await BrowserManager.getInstance().closeBrowser();
}

