(function () {
  const vscode = acquireVsCodeApi();

  // State
  let isConnected = false;
  let isRecording = false;
  let scannedElements = [];

  // DOM Elements
  const connectionBadge = document.getElementById('connectionBadge');
  const btnLaunch = document.getElementById('btnLaunch');
  const btnScan = document.getElementById('btnScan');
  const btnRecord = document.getElementById('btnRecord');
  const recordingBanner = document.getElementById('recordingBanner');
  const recordingText = document.getElementById('recordingText');
  const selectLanguage = document.getElementById('selectLanguage');
  const inputClassName = document.getElementById('inputClassName');
  const elementCountBadge = document.getElementById('elementCountBadge');
  const elementsEmptyState = document.getElementById('elementsEmptyState');
  const elementsContainer = document.getElementById('elementsContainer');
  const actionsFooter = document.getElementById('actionsFooter');
  const btnAiRefactor = document.getElementById('btnAiRefactor');
  const btnGeneratePOM = document.getElementById('btnGeneratePOM');
  const btnGenerateTest = document.getElementById('btnGenerateTest');

  // Event Listeners
  btnLaunch.addEventListener('click', () => {
    btnLaunch.disabled = true;
    btnLaunch.textContent = 'Connecting...';
    vscode.postMessage({ type: 'launchBrowser' });
  });

  btnScan.addEventListener('click', () => {
    btnScan.disabled = true;
    btnScan.textContent = 'Scanning...';
    vscode.postMessage({ type: 'scanPage' });
  });

  btnRecord.addEventListener('click', () => {
    if (!isRecording) {
      vscode.postMessage({ type: 'startRecording' });
    } else {
      vscode.postMessage({ type: 'stopRecording' });
    }
  });

  btnAiRefactor.addEventListener('click', () => {
    btnAiRefactor.disabled = true;
    btnAiRefactor.textContent = 'Refining with AI...';
    vscode.postMessage({
      type: 'aiRefactor',
      className: inputClassName.value,
      elements: scannedElements,
    });
  });

  btnGeneratePOM.addEventListener('click', () => {
    vscode.postMessage({
      type: 'generatePOM',
      className: inputClassName.value || 'LoginPage',
      language: selectLanguage.value,
      elements: scannedElements,
    });
  });

  btnGenerateTest.addEventListener('click', () => {
    vscode.postMessage({
      type: 'generateTestScript',
      className: inputClassName.value || 'RecordedScenarioTest',
      language: selectLanguage.value,
    });
  });

  // Handle messages from Extension Host
  window.addEventListener('message', (event) => {
    const message = event.data;

    switch (message.type) {
      case 'browserStatus':
        isConnected = message.connected;
        updateConnectionUI();
        break;

      case 'scanCompleted':
        btnScan.disabled = false;
        btnScan.innerHTML = '<span class="icon">🔍</span> Scan Page';
        scannedElements = message.elements || [];
        if (message.suggestedClassName) {
          inputClassName.value = message.suggestedClassName;
        }
        renderElementsList();
        break;

      case 'recordingStatus':
        isRecording = message.isRecording;
        updateRecordingUI(message.actionCount || 0);
        break;

      case 'aiRefactorCompleted':
        btnAiRefactor.disabled = false;
        btnAiRefactor.innerHTML = '<span class="icon">✨</span> Refine with AI (Names & Groups)';
        if (message.pageClassName) {
          inputClassName.value = message.pageClassName;
        }
        if (message.elements) {
          scannedElements = message.elements;
        }
        renderElementsList();
        break;

      case 'error':
        btnLaunch.disabled = false;
        btnLaunch.innerHTML = '<span class="icon">🚀</span> Launch & Connect Chrome';
        btnScan.disabled = false;
        btnScan.innerHTML = '<span class="icon">🔍</span> Scan Page';
        btnAiRefactor.disabled = false;
        btnAiRefactor.innerHTML = '<span class="icon">✨</span> Refine with AI (Names & Groups)';
        break;
    }
  });

  function updateConnectionUI() {
    if (isConnected) {
      connectionBadge.textContent = 'Connected (CDP)';
      connectionBadge.className = 'badge connected';
      btnLaunch.innerHTML = '<span class="icon">🔄</span> Reconnect Chrome';
      btnLaunch.disabled = false;
      btnScan.disabled = false;
      btnRecord.disabled = false;
    } else {
      connectionBadge.textContent = 'Disconnected';
      connectionBadge.className = 'badge disconnected';
      btnLaunch.innerHTML = '<span class="icon">🚀</span> Launch & Connect Chrome';
      btnLaunch.disabled = false;
      btnScan.disabled = true;
      btnRecord.disabled = true;
    }
  }

  function updateRecordingUI(count) {
    if (isRecording) {
      btnRecord.className = 'btn recording';
      btnRecord.innerHTML = '<span class="icon">⏹</span> Stop Recording';
      recordingBanner.classList.remove('hidden');
      recordingText.textContent = `Recording actions... (${count} captured)`;
      btnGenerateTest.classList.remove('hidden');
    } else {
      btnRecord.className = 'btn secondary';
      btnRecord.innerHTML = '<span class="icon">⏺</span> Record';
      recordingBanner.classList.add('hidden');
      if (count > 0) {
        btnGenerateTest.classList.remove('hidden');
      }
    }
  }

  function renderElementsList() {
    elementCountBadge.textContent = `${scannedElements.length} found`;

    if (scannedElements.length === 0) {
      elementsEmptyState.classList.remove('hidden');
      elementsContainer.classList.add('hidden');
      actionsFooter.classList.add('hidden');
      return;
    }

    elementsEmptyState.classList.add('hidden');
    elementsContainer.classList.remove('hidden');
    actionsFooter.classList.remove('hidden');

    elementsContainer.innerHTML = '';

    scannedElements.forEach((el, index) => {
      const item = document.createElement('div');
      item.className = 'element-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = el.selected !== false;
      checkbox.addEventListener('change', () => {
        el.selected = checkbox.checked;
      });

      const badge = document.createElement('span');
      badge.className = `element-badge badge-${el.confidence || 'high'}`;
      badge.textContent = `#${index + 1}`;

      const details = document.createElement('div');
      details.className = 'element-details';

      const name = document.createElement('div');
      name.className = 'element-name';
      name.textContent = el.suggestedVariableName;
      if (el.componentGroup) {
        name.textContent += ` [${el.componentGroup}]`;
      }

      const locator = document.createElement('div');
      locator.className = 'element-locator';
      const loc = el.recommendedLocator;
      locator.textContent = `${loc.type}: ${loc.value}`;

      details.appendChild(name);
      details.appendChild(locator);

      item.appendChild(checkbox);
      item.appendChild(badge);
      item.appendChild(details);

      elementsContainer.appendChild(item);
    });
  }

  // Initial check
  vscode.postMessage({ type: 'checkStatus' });
})();

