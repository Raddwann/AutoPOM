(function () {
  const vscode = acquireVsCodeApi();

  // State
  let isConnected = false;
  let isRecording = false;
  let scannedElements = [];
  let recordedActions = [];

  // DOM Elements
  const connectionBadge = document.getElementById('connectionBadge');
  const inputUrl = document.getElementById('inputUrl');
  const btnNavigate = document.getElementById('btnNavigate');
  const btnLaunch = document.getElementById('btnLaunch');
  const btnScan = document.getElementById('btnScan');
  const btnRecord = document.getElementById('btnRecord');
  const recordingBanner = document.getElementById('recordingBanner');
  const recordingText = document.getElementById('recordingText');
  const selectLanguage = document.getElementById('selectLanguage');
  const inputClassName = document.getElementById('inputClassName');

  // Recorded Section
  const recordedSection = document.getElementById('recordedSection');
  const actionCountBadge = document.getElementById('actionCountBadge');
  const recordedList = document.getElementById('recordedList');
  const btnGenerateTest = document.getElementById('btnGenerateTest');

  // Scanned Section
  const elementCountBadge = document.getElementById('elementCountBadge');
  const elementsEmptyState = document.getElementById('elementsEmptyState');
  const elementsContainer = document.getElementById('elementsContainer');
  const scannerActions = document.getElementById('scannerActions');
  const btnAiRefactor = document.getElementById('btnAiRefactor');
  const btnGeneratePOM = document.getElementById('btnGeneratePOM');

  // Event Listeners
  btnLaunch.addEventListener('click', () => {
    btnLaunch.disabled = true;
    btnLaunch.textContent = 'Connecting...';
    vscode.postMessage({
      type: 'launchBrowser',
      url: inputUrl.value.trim(),
    });
  });

  btnNavigate.addEventListener('click', () => {
    navigateCurrentUrl();
  });

  inputUrl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (isConnected) {
        navigateCurrentUrl();
      } else {
        btnLaunch.click();
      }
    }
  });

  function navigateCurrentUrl() {
    const url = inputUrl.value.trim();
    if (!url) return;
    btnNavigate.disabled = true;
    btnNavigate.textContent = '...';
    vscode.postMessage({
      type: 'navigateTo',
      url,
    });
  }

  btnScan.addEventListener('click', () => {
    btnScan.disabled = true;
    btnScan.textContent = 'Scanning...';
    vscode.postMessage({ type: 'scanPage' });
  });

  btnRecord.addEventListener('click', () => {
    if (!isRecording) {
      recordedActions = [];
      renderRecordedList();
      vscode.postMessage({ type: 'startRecording' });
    } else {
      btnRecord.disabled = true;
      btnRecord.textContent = 'Stopping...';
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

      case 'urlUpdated':
        if (message.url) {
          inputUrl.value = message.url;
        }
        btnNavigate.disabled = false;
        btnNavigate.textContent = 'Go';
        break;

      case 'scanCompleted':
        btnScan.disabled = false;
        btnScan.innerHTML = '<span class="icon">🔍</span> Scan Page';
        scannedElements = message.elements || [];
        if (message.suggestedClassName) {
          inputClassName.value = message.suggestedClassName;
        }
        if (message.url) {
          inputUrl.value = message.url;
        }
        renderElementsList();
        break;

      case 'actionCaptured':
        if (message.action) {
          recordedActions.push(message.action);
        }
        updateRecordingCounter(message.totalCount || recordedActions.length);
        renderRecordedList();
        break;

      case 'recordingStatus':
        isRecording = message.isRecording;
        btnRecord.disabled = false;
        if (message.actions) {
          recordedActions = message.actions;
        }
        updateRecordingUI(message.actionCount || recordedActions.length);
        renderRecordedList();
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
        btnRecord.disabled = false;
        btnNavigate.disabled = false;
        btnNavigate.textContent = 'Go';
        btnAiRefactor.disabled = false;
        btnAiRefactor.innerHTML = '<span class="icon">✨</span> Refine with AI (Names & Groups)';
        break;
    }
  });

  function updateConnectionUI() {
    if (isConnected) {
      connectionBadge.textContent = 'Connected';
      connectionBadge.className = 'badge connected';
      btnLaunch.innerHTML = '<span class="icon">🔄</span> Reconnect Chrome';
      btnLaunch.disabled = false;
      btnNavigate.disabled = false;
      btnScan.disabled = false;
      btnRecord.disabled = false;
    } else {
      connectionBadge.textContent = 'Disconnected';
      connectionBadge.className = 'badge disconnected';
      btnLaunch.innerHTML = '<span class="icon">🚀</span> Launch & Connect Chrome';
      btnLaunch.disabled = false;
      btnNavigate.disabled = true;
      btnScan.disabled = true;
      btnRecord.disabled = true;
    }
  }

  function updateRecordingCounter(count) {
    recordingText.textContent = `Recording... (${count} actions captured)`;
    actionCountBadge.textContent = `${count} captured`;
  }

  function updateRecordingUI(count) {
    if (isRecording) {
      btnRecord.className = 'btn recording';
      btnRecord.innerHTML = '<span class="icon">⏹</span> Stop Recording';
      recordingBanner.classList.remove('hidden');
      updateRecordingCounter(count);
    } else {
      btnRecord.className = 'btn secondary';
      btnRecord.innerHTML = '<span class="icon">⏺</span> Record Steps';
      recordingBanner.classList.add('hidden');
    }
  }

  function renderRecordedList() {
    actionCountBadge.textContent = `${recordedActions.length} captured`;

    if (recordedActions.length === 0) {
      recordedSection.classList.add('hidden');
      return;
    }

    recordedSection.classList.remove('hidden');
    recordedList.innerHTML = '';

    recordedActions.forEach((act, idx) => {
      const item = document.createElement('div');
      item.className = 'action-item';

      const badge = document.createElement('span');
      badge.className = `action-badge ${act.type}`;
      badge.textContent = act.type.toUpperCase().slice(0, 4);

      const details = document.createElement('div');
      details.className = 'action-details';

      const title = document.createElement('div');
      title.className = 'action-title';

      if (act.type === 'navigation') {
        title.textContent = `${idx + 1}. Navigate: ${act.url || ''}`;
      } else if (act.type === 'click') {
        title.textContent = `${idx + 1}. Click: ${act.targetElementDescription || 'element'}`;
      } else if (act.type === 'input') {
        title.textContent = `${idx + 1}. Input: "${act.value || ''}" into ${act.targetElementDescription || 'element'}`;
      }

      details.appendChild(title);

      if (act.locator) {
        const sub = document.createElement('div');
        sub.className = 'action-subtitle';
        sub.textContent = `${act.locator.type}: ${act.locator.value}`;
        details.appendChild(sub);
      }

      if (act.waitCondition) {
        const wait = document.createElement('div');
        wait.className = 'wait-tag';
        wait.textContent = `⏱ Smart Wait: ${act.waitCondition.description}`;
        details.appendChild(wait);
      }

      item.appendChild(badge);
      item.appendChild(details);
      recordedList.appendChild(item);
    });
  }

  function renderElementsList() {
    elementCountBadge.textContent = `${scannedElements.length} found`;

    if (scannedElements.length === 0) {
      elementsEmptyState.classList.remove('hidden');
      elementsContainer.classList.add('hidden');
      scannerActions.classList.add('hidden');
      return;
    }

    elementsEmptyState.classList.add('hidden');
    elementsContainer.classList.remove('hidden');
    scannerActions.classList.remove('hidden');

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
