(function railVisualEditorOverlayBootstrap() {
  const OVERLAY_ID = 'rail-visual-editor-overlay';
  const TOGGLE_ID = 'rail-visual-editor-toggle';
  const OUTPUT_ID = 'rail-visual-editor-output';
  const originalConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };
  let outputInitialized = false;
  let outputLogBody = null;
  let outputErrorBody = null;
  let outputCaptureDepth = 0;

  function createStyle() {
    if (document.getElementById('rail-visual-editor-style')) {
      return;
    }
    const style = document.createElement('style');
    style.id = 'rail-visual-editor-style';
    style.textContent = `
      #${TOGGLE_ID} {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 2147483647;
        border: 1px solid rgba(120, 145, 178, 0.42);
        background: rgba(12, 16, 22, 0.98);
        color: #eef5ff;
        border-radius: 0;
        padding: 8px 10px;
        font: 11px/1.1 SFMono-Regular, Menlo, Consolas, monospace;
        cursor: pointer;
      }
      #${OVERLAY_ID} {
        position: fixed;
        top: 16px;
        right: 16px;
        width: min(42vw, 640px);
        height: calc(100vh - 32px);
        z-index: 2147483647;
        display: none;
        grid-template-rows: auto auto minmax(0, 1fr);
        border: 1px solid rgba(96, 118, 148, 0.38);
        border-radius: 0;
        background: rgba(8, 12, 18, 0.985);
        color: #edf4ff;
        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.5);
        overflow: hidden;
      }
      #${OUTPUT_ID} {
        position: fixed;
        top: 16px;
        left: 16px;
        right: min(42vw + 32px, 672px);
        height: calc(100vh - 32px);
        z-index: 2147483646;
        display: none;
        grid-template-rows: auto minmax(0, 1fr) auto;
        border: 1px solid rgba(96, 118, 148, 0.38);
        border-radius: 0;
        background: rgba(8, 12, 18, 0.985);
        color: #edf4ff;
        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.4);
        overflow: hidden;
      }
      #${OUTPUT_ID}.is-open {
        display: grid;
      }
      #${OUTPUT_ID} * {
        box-sizing: border-box;
      }
      #${OVERLAY_ID}.is-open {
        display: grid;
      }
      #${OVERLAY_ID} * {
        box-sizing: border-box;
      }
      #${OVERLAY_ID} .rv-head,
      #${OUTPUT_ID} .rv-output-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 8px 12px;
        border-bottom: 1px solid rgba(96, 118, 148, 0.28);
        background: rgba(14, 19, 27, 0.96);
      }
      #${OVERLAY_ID} .rv-eyebrow,
      #${OVERLAY_ID} h2,
      #${OVERLAY_ID} p,
      #${OVERLAY_ID} pre {
        margin: 0;
      }
      #${OVERLAY_ID} .rv-head-actions {
        display: flex;
        gap: 6px;
        align-items: center;
      }
      #${OVERLAY_ID} .rv-eyebrow {
        font: 10px/1.1 SFMono-Regular, Menlo, Consolas, monospace;
        letter-spacing: 0.12em;
        color: rgba(198, 216, 242, 0.72);
      }
      #${OVERLAY_ID} h2 {
        font: 700 13px/1.2 SFMono-Regular, Menlo, Consolas, monospace;
      }
      #${OVERLAY_ID} .rv-tabs {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        padding: 8px 12px 0;
      }
      #${OVERLAY_ID} .rv-editor-wrap {
        position: relative;
        min-height: 0;
        padding: 8px 12px 0;
      }
      #${OVERLAY_ID} .rv-file-label {
        display: block;
        margin: 0 0 6px;
        font: 11px/1.2 SFMono-Regular, Menlo, Consolas, monospace;
        color: rgba(230, 240, 255, 0.86);
      }
      #${OVERLAY_ID} .rv-editor-shell {
        position: absolute;
        top: 25px;
        left: 12px;
        right: 12px;
        bottom: 0;
        display: grid;
        grid-template-columns: 44px minmax(0, 1fr);
        border: 1px solid rgba(83, 104, 131, 0.34);
        background: #0b0f14;
        overflow: hidden;
      }
      #${OVERLAY_ID} .rv-line-numbers {
        margin: 0;
        padding: 44px 6px 10px 0;
        border-right: 1px solid rgba(83, 104, 131, 0.34);
        background: #10161d;
        color: rgba(185, 201, 221, 0.52);
        text-align: right;
        font: 11px/1.55 SFMono-Regular, Menlo, Consolas, monospace;
        overflow: hidden;
        user-select: none;
      }
      #${OVERLAY_ID} .rv-line-number {
        display: block;
      }
      #${OVERLAY_ID} textarea {
        width: 100%;
        height: 100%;
        min-height: 0;
        margin: 0;
        border: 0;
        padding: 44px 10px 10px;
        background: transparent;
        color: #d9e4f2;
        font: 11px/1.55 SFMono-Regular, Menlo, Consolas, monospace;
        resize: none;
        white-space: pre;
        tab-size: 2;
        outline: none;
        overflow: auto;
      }
      #${OVERLAY_ID} .rv-actions {
        position: absolute;
        top: 31px;
        right: 22px;
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        padding: 5px;
        border: 1px solid rgba(96, 118, 148, 0.28);
        background: rgba(12, 17, 24, 0.92);
        z-index: 2;
      }
      #${OUTPUT_ID} .rv-output-split {
        min-height: 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 8px;
        padding: 8px 10px;
        background: #0b0f14;
      }
      #${OUTPUT_ID} .rv-output-pane {
        min-height: 0;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        border: 1px solid rgba(83, 104, 131, 0.28);
        background: rgba(12, 17, 24, 0.76);
      }
      #${OUTPUT_ID} .rv-output-pane.is-error-pane {
        border-color: rgba(212, 90, 108, 0.36);
        background: rgba(32, 12, 16, 0.72);
      }
      #${OUTPUT_ID} .rv-output-pane-head {
        padding: 6px 8px;
        border-bottom: 1px solid rgba(83, 104, 131, 0.24);
        font: 11px/1.2 SFMono-Regular, Menlo, Consolas, monospace;
        color: rgba(223, 234, 248, 0.82);
        background: rgba(16, 22, 31, 0.88);
      }
      #${OUTPUT_ID} .rv-output-pane.is-error-pane .rv-output-pane-head {
        border-bottom-color: rgba(212, 90, 108, 0.24);
        color: #ffd7dd;
        background: rgba(45, 16, 22, 0.82);
      }
      #${OUTPUT_ID} .rv-output-body {
        min-height: 0;
        overflow: auto;
        padding: 8px;
      }
      #${OUTPUT_ID} .rv-output-entry {
        margin: 0 0 6px;
        padding: 6px 8px;
        border-left: 2px solid rgba(120, 145, 178, 0.5);
        background: rgba(19, 25, 34, 0.76);
        font: 11px/1.45 SFMono-Regular, Menlo, Consolas, monospace;
        white-space: pre-wrap;
        word-break: break-word;
      }
      #${OUTPUT_ID} .rv-output-entry.is-error {
        border-left-color: #d45a6c;
        color: #ffd7dd;
        background: rgba(58, 17, 24, 0.72);
      }
      #${OUTPUT_ID} .rv-output-entry.is-warn {
        border-left-color: #d1a24a;
        color: #ffe6b0;
        background: rgba(54, 37, 9, 0.72);
      }
      #${OUTPUT_ID} .rv-output-entry.is-info {
        border-left-color: #5d95dd;
      }
      #${OUTPUT_ID} .rv-output-foot {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        padding: 8px 10px 10px;
        border-top: 1px solid rgba(96, 118, 148, 0.28);
        background: rgba(12, 17, 24, 0.94);
      }
      #${OVERLAY_ID} button {
        border: 0;
        border-radius: 0;
        padding: 6px 8px;
        cursor: pointer;
        font: 11px/1.1 SFMono-Regular, Menlo, Consolas, monospace;
      }
      #${OUTPUT_ID} button {
        border: 0;
        border-radius: 0;
        padding: 6px 8px;
        cursor: pointer;
        font: 11px/1.1 SFMono-Regular, Menlo, Consolas, monospace;
      }
      #${OVERLAY_ID} .rv-tab {
        border: 1px solid rgba(96, 118, 148, 0.32);
        background: rgba(21, 28, 38, 0.96);
        color: #dbe8f8;
      }
      #${OVERLAY_ID} .rv-tab.is-active {
        background: #163a70;
        color: #fff;
      }
      #${OVERLAY_ID} .rv-primary {
        background: #1c4f96;
        color: #fff;
      }
      #${OVERLAY_ID} .rv-secondary {
        background: #1a2230;
        color: #eef5ff;
      }
      #${OVERLAY_ID} .rv-danger {
        background: #4b1f28;
        color: #ffdbe2;
      }
      #${OUTPUT_ID} .rv-secondary {
        background: #1a2230;
        color: #eef5ff;
      }
      @media (max-width: 900px) {
        #${OVERLAY_ID} {
          left: 12px;
          right: 12px;
          top: 12px;
          width: auto;
          height: calc(100vh - 24px);
        }
        #${OUTPUT_ID} {
          left: 12px;
          right: 12px;
          top: auto;
          bottom: 12px;
          height: min(34vh, 280px);
        }
        #${OUTPUT_ID} .rv-output-split {
          grid-template-columns: 1fr;
          grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
        }
      }
    `;
    document.head.appendChild(style);
  }

  function formatConsoleValue(value) {
    if (typeof value === 'string') {
      return value;
    }
    if (value instanceof Error) {
      return value.stack || value.message;
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch (_error) {
      return String(value);
    }
  }

  function appendOutput(kind, args) {
    const targetBody = kind === 'error' ? outputErrorBody : outputLogBody;
    if (!targetBody) {
      return;
    }
    const entry = document.createElement('pre');
    entry.className = `rv-output-entry is-${kind}`;
    entry.textContent = (Array.isArray(args) ? args : [args]).map(formatConsoleValue).join(' ');
    targetBody.appendChild(entry);
    targetBody.scrollTop = targetBody.scrollHeight;
  }

  function beginOutputCapture() {
    outputCaptureDepth += 1;
  }

  function endOutputCapture() {
    outputCaptureDepth = Math.max(0, outputCaptureDepth - 1);
  }

  function shouldCaptureConsole(kind, args) {
    if (outputCaptureDepth > 0) {
      return true;
    }
    if (kind !== 'error') {
      return false;
    }
    return (Array.isArray(args) ? args : [args]).some((value) => value instanceof Error && value.railEditor);
  }

  function runWithOutputCapture(fn) {
    beginOutputCapture();
    try {
      return fn();
    } finally {
      endOutputCapture();
    }
  }

  function exposeOutputHooks() {
    window.__dioramaRailVisualEditorOutputHooks = {
      beginCapture: beginOutputCapture,
      endCapture: endOutputCapture,
      appendOutput,
    };
  }

  function ensureOutputPanel() {
    if (document.getElementById(OUTPUT_ID)) {
      outputLogBody = document.querySelector(`#${OUTPUT_ID} [data-role="output-log-body"]`);
      outputErrorBody = document.querySelector(`#${OUTPUT_ID} [data-role="output-error-body"]`);
      return document.getElementById(OUTPUT_ID);
    }
    const output = document.createElement('aside');
    output.id = OUTPUT_ID;
    output.innerHTML = `
      <div class="rv-output-head">
        <div></div>
      </div>
      <div class="rv-output-split">
        <section class="rv-output-pane">
          <div class="rv-output-pane-head">log</div>
          <div class="rv-output-body" data-role="output-log-body"></div>
        </section>
        <section class="rv-output-pane is-error-pane">
          <div class="rv-output-pane-head">error</div>
          <div class="rv-output-body" data-role="output-error-body"></div>
        </section>
      </div>
      <div class="rv-output-foot">
        <button type="button" class="rv-secondary" data-action="clear-output">clear</button>
        <button type="button" class="rv-secondary" data-action="toggle-output">hide</button>
      </div>
    `;
    document.body.appendChild(output);
    outputLogBody = output.querySelector('[data-role="output-log-body"]');
    outputErrorBody = output.querySelector('[data-role="output-error-body"]');
    output.querySelector('[data-action="clear-output"]').addEventListener('click', () => {
      outputLogBody.innerHTML = '';
      outputErrorBody.innerHTML = '';
    });
    output.querySelector('[data-action="toggle-output"]').addEventListener('click', () => {
      output.classList.toggle('is-open');
    });
    return output;
  }

  function installOutputHooks() {
    if (outputInitialized) {
      return;
    }
    outputInitialized = true;
    ensureOutputPanel();

    console.log = (...args) => {
      if (shouldCaptureConsole('info', args)) {
        appendOutput('info', args);
      }
      originalConsole.log(...args);
    };
    console.info = (...args) => {
      if (shouldCaptureConsole('info', args)) {
        appendOutput('info', args);
      }
      originalConsole.info(...args);
    };
    console.warn = (...args) => {
      if (shouldCaptureConsole('warn', args)) {
        appendOutput('warn', args);
      }
      originalConsole.warn(...args);
    };
    console.error = (...args) => {
      if (shouldCaptureConsole('error', args)) {
        appendOutput('error', args);
      }
      originalConsole.error(...args);
    };

    window.addEventListener('error', (event) => {
      if (outputCaptureDepth > 0) {
        appendOutput('error', [event.error || event.message || 'Unknown error']);
      }
    });
    window.addEventListener('unhandledrejection', (event) => {
      if (outputCaptureDepth > 0) {
        appendOutput('error', [event.reason || 'Unhandled promise rejection']);
      }
    });
  }

  function insertTab(textarea) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    textarea.value = `${value.slice(0, start)}  ${value.slice(end)}`;
    textarea.selectionStart = start + 2;
    textarea.selectionEnd = start + 2;
  }

  function waitForApi(attempt = 0) {
    const api = window.__dioramaRailVisualEditor;
    if (api) {
      return Promise.resolve(api);
    }
    if (attempt >= 120) {
      return Promise.reject(new Error('rail visual editor api not found'));
    }
    return new Promise((resolve, reject) => {
      window.setTimeout(() => {
        waitForApi(attempt + 1).then(resolve).catch(reject);
      }, 250);
    });
  }

  function buildOverlay(api) {
    createStyle();
    installOutputHooks();
    exposeOutputHooks();
    if (document.getElementById(OVERLAY_ID)) {
      return;
    }

    const toggle = document.createElement('button');
    toggle.id = TOGGLE_ID;
    toggle.type = 'button';
    toggle.textContent = 'Rail FX';

    const panel = document.createElement('aside');
    panel.id = OVERLAY_ID;
    panel.innerHTML = `
      <div class="rv-head">
        <div>
          <p class="rv-eyebrow">RAIL VISUAL EDITOR</p>
          <h2>関数差し替え</h2>
        </div>
        <div class="rv-head-actions">
          <button type="button" class="rv-secondary" data-toggle-output>STATUS</button>
          <button type="button" class="rv-secondary" data-close>閉じる</button>
        </div>
      </div>
      <div class="rv-tabs" data-role="file-tabs">
        <button type="button" class="rv-tab is-active" data-file="buildRailVisualSegment">buildRailVisualSegment</button>
        <button type="button" class="rv-tab" data-file="buildRailStripMesh">buildRailStripMesh</button>
      </div>
      <div class="rv-editor-wrap">
        <span class="rv-file-label" data-role="file-label">buildRailVisualSegment</span>
        <div class="rv-actions">
          <button type="button" class="rv-primary" data-action="apply">適用</button>
          <button type="button" class="rv-secondary" data-action="reload">現在値を再読込</button>
          <button type="button" class="rv-danger" data-action="reset">初期値に戻す</button>
        </div>
        <div class="rv-editor-shell">
          <pre class="rv-line-numbers" data-role="line-numbers">1</pre>
          <textarea spellcheck="false" data-role="code-editor"></textarea>
        </div>
      </div>
    `;

    const fileTabs = Array.from(panel.querySelectorAll('[data-file]'));
    const fileLabel = panel.querySelector('[data-role="file-label"]');
    const lineNumbers = panel.querySelector('[data-role="line-numbers"]');
    const codeEditor = panel.querySelector('[data-role="code-editor"]');
    const draftSources = {
      buildRailVisualSegment: '',
      buildRailStripMesh: '',
    };
    let activeFile = 'buildRailVisualSegment';

    function setStatus(message) {
      appendOutput('info', [message]);
    }

    function updateLineNumbers() {
      const lineCount = Math.max(1, codeEditor.value.split('\n').length);
      lineNumbers.innerHTML = Array.from({ length: lineCount }, (_unused, index) => (
        `<span class="rv-line-number">${index + 1}</span>`
      )).join('');
      lineNumbers.scrollTop = codeEditor.scrollTop;
    }

    function loadSources(sourceSet) {
      draftSources.buildRailVisualSegment = sourceSet.buildRailVisualSegment || '';
      draftSources.buildRailStripMesh = sourceSet.buildRailStripMesh || '';
      codeEditor.value = draftSources[activeFile] || '';
      updateLineNumbers();
    }

    function syncDraftFromEditor() {
      draftSources[activeFile] = codeEditor.value;
    }

    function switchFile(nextFile) {
      if (!draftSources[nextFile]) {
        return;
      }
      syncDraftFromEditor();
      activeFile = nextFile;
      fileLabel.textContent = nextFile;
      codeEditor.value = draftSources[nextFile] || '';
      updateLineNumbers();
      fileTabs.forEach((tab) => {
        tab.classList.toggle('is-active', tab.dataset.file === nextFile);
      });
    }

    function applyChanges() {
      try {
        syncDraftFromEditor();
        const updated = runWithOutputCapture(() => api.applySources({
          buildRailVisualSegment: draftSources.buildRailVisualSegment,
          buildRailStripMesh: draftSources.buildRailStripMesh,
        }));
        loadSources(updated);
        setStatus('適用しました。');
      } catch (error) {
        appendOutput('error', [error]);
      }
    }

    function reloadSources() {
      try {
        loadSources(runWithOutputCapture(() => api.getSources()));
        setStatus('現在値を再読込しました。');
      } catch (error) {
        appendOutput('error', [error]);
      }
    }

    function resetSources() {
      try {
        loadSources(runWithOutputCapture(() => api.resetSources()));
        setStatus('初期値へ戻しました。');
      } catch (error) {
        appendOutput('error', [error]);
      }
    }

    function setPanelsOpen(open) {
      panel.classList.toggle('is-open', open);
      const output = ensureOutputPanel();
      output.classList.toggle('is-open', open);
    }

    codeEditor.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') {
        return;
      }
      event.preventDefault();
      insertTab(codeEditor);
      syncDraftFromEditor();
      updateLineNumbers();
    });
    codeEditor.addEventListener('input', syncDraftFromEditor);
    codeEditor.addEventListener('input', updateLineNumbers);
    codeEditor.addEventListener('scroll', () => {
      lineNumbers.scrollTop = codeEditor.scrollTop;
    });
    fileTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        switchFile(String(tab.dataset.file || ''));
      });
    });

    panel.querySelector('[data-action="apply"]').addEventListener('click', applyChanges);
    panel.querySelector('[data-action="reload"]').addEventListener('click', reloadSources);
    panel.querySelector('[data-action="reset"]').addEventListener('click', resetSources);
    panel.querySelector('[data-toggle-output]').addEventListener('click', () => {
      const output = ensureOutputPanel();
      output.classList.toggle('is-open');
    });
    panel.querySelector('[data-close]').addEventListener('click', () => {
      setPanelsOpen(false);
    });
    toggle.addEventListener('click', () => {
      setPanelsOpen(!panel.classList.contains('is-open'));
    });

    document.body.appendChild(toggle);
    document.body.appendChild(panel);

    loadSources(api.getSources());
    switchFile(activeFile);
    setStatus('現在の main.js 実装を読み込みました。');
  }

  window.addEventListener('load', () => {
    waitForApi().then(buildOverlay).catch((error) => {
      console.warn('[rail-editor-overlay] failed to initialize', error);
    });
  });
})();
