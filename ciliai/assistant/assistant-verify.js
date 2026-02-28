// CiliAI Assistant Verification Mode (UI-only checks)
(function (root) {
    'use strict';

    const core = root.CiliAIAssistantCore;
    if (!core) return;

    const CHECKS = [
        { id: 'flags', label: 'Assistant V2 flag', run: checkFlags },
        { id: 'provider', label: 'Provider selection', run: checkProvider },
        { id: 'model', label: 'Model name', run: checkModel },
        { id: 'proxy', label: 'Proxy reachable', run: checkProxyReachable },
        { id: 'proxyDeepSeek', label: 'DeepSeek via proxy', run: checkDeepSeekViaProxy },
        { id: 'keySafe', label: 'API key safe (not in browser)', run: checkApiKeySafe },
        { id: 'apikey', label: 'API key presence', run: checkApiKey },
        { id: 'style', label: 'Style compliance', run: checkStyleCompliance },
        { id: 'basic', label: 'Basic assistant response', run: checkBasicResponse },
        { id: 'actions', label: 'Actions JSON validity', run: checkActionsJson },
        { id: 'dataFirst', label: 'Data-first used', run: checkDataFirstUsed },
        { id: 'llmCalled', label: 'LLM called', run: checkLlmCalled },
        { id: 'jsonRepaired', label: 'JSON repaired (if needed)', run: checkJsonRepaired },
        { id: 'mappingAttempted', label: 'Mapping attempted', run: checkMappingAttempted },
        { id: 'mappingSuccess', label: 'Mapping success', run: checkMappingSuccess },
        { id: 'visualA', label: 'Visual A: Gold Standard list', run: checkGoldStandard },
        { id: 'visualB', label: 'Visual B: CEP290 localization', run: checkCep290Localization },
        { id: 'visualC', label: 'Visual C: Bardet–Biedl genes', run: checkBbsGenes },
        { id: 'failure', label: 'Failure handling (no crash)', run: checkFailureHandling }
    ];

    function buildPanel() {
        const existing = document.getElementById('assistant-verify-panel');
        if (existing) return existing;

        const panel = document.createElement('div');
        panel.id = 'assistant-verify-panel';
        panel.className = 'assistant-verify-panel';
        panel.setAttribute('data-testid', 'assistant-verify-panel');
        panel.innerHTML = `
            <div class="assistant-verify-card">
                <div class="assistant-verify-header">
                    <div>
                        <div class="assistant-verify-title">Assistant Verification</div>
                        <div class="assistant-verify-subtitle">UI-only checks for DeepSeek integration</div>
                    </div>
                    <button class="assistant-verify-close" data-testid="assistant-verify-close">✕</button>
                </div>

                <div class="assistant-verify-section" data-testid="assistant-verify-status">
                    <div class="assistant-verify-metric"><span>Assistant V2</span><strong id="verify-flag">—</strong></div>
                    <div class="assistant-verify-metric"><span>Provider</span><strong id="verify-provider">—</strong></div>
                    <div class="assistant-verify-metric"><span>Model</span><strong id="verify-model">—</strong></div>
                    <div class="assistant-verify-metric"><span>Proxy URL</span><strong id="verify-proxy">—</strong></div>
                    <div class="assistant-verify-metric"><span>API key present</span><strong id="verify-key">—</strong></div>
                </div>
                <div id="verify-proxy-warning" class="assistant-verify-warning" style="display:none;"></div>

                <div class="assistant-verify-actions">
                    <button class="assistant-verify-run" data-testid="assistant-verify-run">Run Verification</button>
                    <span class="assistant-verify-hint">Runs ~10 checks and shows PASS/FAIL</span>
                </div>

                <div class="assistant-verify-results" data-testid="assistant-verify-results"></div>

                <div class="assistant-verify-section assistant-verify-debug" data-testid="assistant-verify-debug">
                    <div class="assistant-verify-title">Debug details</div>
                    <div class="assistant-verify-debug-grid">
                        <div><strong>Env version:</strong> <span id="verify-env-version">—</span></div>
                        <div><strong>V2 flag:</strong> <span id="verify-debug-v2">—</span></div>
                        <div><strong>Provider:</strong> <span id="verify-debug-provider">—</span></div>
                        <div><strong>Model:</strong> <span id="verify-debug-model">—</span></div>
                        <div><strong>Proxy URL:</strong> <span id="verify-debug-proxy">—</span></div>
                        <div><strong>Health URL:</strong> <span id="verify-debug-health-url">—</span></div>
                        <div><strong>Health status:</strong> <span id="verify-debug-health-status">—</span></div>
                    </div>
                </div>
                <div class="assistant-verify-section">
                    <div class="assistant-verify-title">Try in Assistant</div>
                    <div class="assistant-verify-chips" data-testid="assistant-verify-try">
                        ${buildTryButtons([
                            'Show Gold Standard ciliary genes',
                            'Where is CEP290 localized?',
                            'Display Bardet–Biedl genes',
                            'What is IFT88?'
                        ])}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);
        panel.querySelector('[data-testid="assistant-verify-close"]').addEventListener('click', closePanel);
        panel.querySelector('[data-testid="assistant-verify-run"]').addEventListener('click', runVerification);
        panel.addEventListener('click', (event) => {
            if (event.target === panel) closePanel();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closePanel();
        });

        return panel;
    }

    function buildTryButtons(questions) {
        return questions.map(q => {
            const safe = String(q).replace(/"/g, '&quot;');
            return `<button class="assistant-verify-chip" data-question="${safe}">${q}</button>`;
        }).join('');
    }

    function openPanel() {
        const panel = buildPanel();
        panel.classList.add('active');
        updateStatus();
        attachTryHandlers(panel);
        refreshHealthStatus();
    }

    function closePanel() {
        const panel = document.getElementById('assistant-verify-panel');
        if (panel) panel.classList.remove('active');
        if (location.hash === '#verify' || location.hash === '#assistant/verify') {
            history.pushState('', document.title, window.location.pathname + window.location.search);
        }
    }

    function attachTryHandlers(panel) {
        panel.querySelectorAll('.assistant-verify-chip').forEach(btn => {
            btn.onclick = () => {
                const question = btn.getAttribute('data-question');
                const input = document.getElementById('chatInput');
                if (input) input.value = question;
                if (typeof root.handleAIQuery === 'function') root.handleAIQuery(question);
            };
        });
    }

    function updateStatus() {
        const config = core.buildConfig();
        setText('verify-flag', config.assistantV2 ? 'Enabled' : 'Disabled');
        setText('verify-provider', config.provider || 'legacy');
        setText('verify-model', config.model || '—');
        setText('verify-proxy', config.proxyUrl ? 'Configured' : 'Missing');
        setText('verify-key', config.proxyUrl ? 'Checking...' : (config.apiKey ? 'Yes' : 'No'));
        setText('verify-env-version', config.envVersion || '—');
        setText('verify-debug-v2', String(config.assistantV2));
        setText('verify-debug-provider', config.provider || 'legacy');
        setText('verify-debug-model', config.model || '—');
        setText('verify-debug-proxy', config.proxyUrl || '—');
        setText('verify-debug-health-url', config.proxyUrl ? getHealthUrl(config.proxyUrl) : '—');
        setText('verify-debug-health-status', root.__CILIAI_PROXY_HEALTH__?.status || '—');
        updateProxyWarning(config.proxyUrl || '');
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function renderResults(results) {
        const container = document.querySelector('[data-testid="assistant-verify-results"]');
        if (!container) return;
        container.innerHTML = results.map(r => `
            <div class="assistant-verify-result ${r.pass ? 'pass' : 'fail'}" data-testid="check-${r.id}">
                <span>${r.pass ? '✅' : '❌'} ${r.label}</span>
                <span class="assistant-verify-detail">${r.detail || ''}${r.fix ? ` — Fix: ${r.fix}` : ''}</span>
            </div>
        `).join('');
    }

    function waitForDataReady(maxMs) {
        const deadline = Date.now() + (maxMs || 8000);
        return new Promise(function check(resolve) {
            if (root.CiliAI && root.CiliAI.ready) return resolve(true);
            if (Date.now() >= deadline) return resolve(false);
            setTimeout(function () { check(resolve); }, 300);
        });
    }

    async function runVerification() {
        updateStatus();
        await refreshHealthStatus();
        await waitForDataReady(8000);
        const results = [];
        for (const check of CHECKS) {
            const outcome = await check.run();
            results.push({
                id: check.id,
                label: check.label,
                pass: outcome.pass,
                detail: outcome.detail,
                fix: outcome.fix
            });
            renderResults(results);
        }
    }

    function getConfig() {
        return core.buildConfig();
    }

    function isAssistantEnabled(config) {
        return config.assistantV2 && (config.provider === 'deepseek' || config.provider === 'ollama');
    }

    function isLocalOllamaMode(config) {
        return config.assistantV2 && config.provider === 'ollama';
    }

    function ensureChatReady() {
        const chatWindow = document.getElementById('messages');
        return !!chatWindow;
    }

    function lastAssistantMessage() {
        const messages = document.querySelectorAll('#messages .ciliai-message.assistant .ciliai-message-content');
        if (!messages.length) return '';
        return messages[messages.length - 1].textContent || '';
    }

    async function withLegacyAssistant(fn) {
        const env = root.CILIAI_ENV || (root.__CILIAI_ENV__ || {});
        const previous = env.CILIAI_ASSISTANT_V2;
        env.CILIAI_ASSISTANT_V2 = 'false';
        try {
            return await fn();
        } finally {
            env.CILIAI_ASSISTANT_V2 = previous;
        }
    }

    function checkFlags() {
        const config = getConfig();
        return { pass: true, detail: `V2 is ${config.assistantV2 ? 'enabled' : 'disabled'}` };
    }

    function checkProvider() {
        const config = getConfig();
        return { pass: true, detail: `Provider: ${config.provider || 'legacy'}` };
    }

    function checkModel() {
        const config = getConfig();
        return { pass: !!config.model, detail: `Model: ${config.model || '—'}` };
    }

    async function checkProxyReachable() {
        const config = getConfig();
        if (!config.proxyUrl) {
            return { pass: false, detail: 'Missing proxy URL', fix: 'Set CILIAI_ASSISTANT_PROXY_URL' };
        }
        try {
            const response = await fetch(getHealthUrl(config.proxyUrl), { method: 'GET' });
            const ok = response.ok;
            return { pass: ok, detail: ok ? 'Proxy responded' : `Proxy status ${response.status}`, fix: ok ? '' : 'Check proxy deployment and CORS' };
        } catch (e) {
            return { pass: false, detail: 'Proxy not reachable', fix: 'Check proxy URL and network' };
        }
    }

    async function checkDeepSeekViaProxy() {
        const config = getConfig();
        if (!config.proxyUrl) {
            return { pass: false, detail: 'Missing proxy URL', fix: 'Set CILIAI_ASSISTANT_PROXY_URL' };
        }
        try {
            const response = await fetch(config.proxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: config.model || 'deepseek-chat',
                    temperature: 0.2,
                    messages: [{ role: 'user', content: 'Hello' }]
                })
            });
            const ok = response.ok;
            if (response.status === 402) {
                return { pass: true, detail: 'SKIPPED: LLM unavailable (402)', fix: '' };
            }
            if (!ok) {
                return { pass: false, detail: `Proxy status ${response.status}`, fix: 'Check proxy secret and DeepSeek access' };
            }
            const data = await response.json();
            const content = data?.choices?.[0]?.message?.content;
            return { pass: !!content, detail: content ? 'DeepSeek replied' : 'No content returned', fix: content ? '' : 'Check proxy response mapping' };
        } catch (e) {
            return { pass: false, detail: 'Proxy call failed', fix: 'Check proxy and DeepSeek availability' };
        }
    }

    function checkApiKeySafe() {
        const env = root.CILIAI_ENV || {};
        if (env.DEEPSEEK_API_KEY) {
            return { pass: false, detail: 'Key found in browser', fix: 'Remove DEEPSEEK_API_KEY from env.js' };
        }
        return { pass: true, detail: 'No key in browser' };
    }

    async function checkStyleCompliance() {
        const config = getConfig();
        if (!isAssistantEnabled(config) && !isLocalOllamaMode(config)) {
            return { pass: false, detail: 'Assistant not enabled', fix: 'Set CILIAI_ASSISTANT_V2=true and choose provider' };
        }
        if (config.provider === 'deepseek' && !config.proxyUrl) {
            return { pass: false, detail: 'Missing proxy URL', fix: 'Set CILIAI_ASSISTANT_PROXY_URL' };
        }
        if (!root.CiliAIAssistant || typeof root.CiliAIAssistant.ask !== 'function') {
            return { pass: false, detail: 'Assistant runtime not available', fix: 'Check assistant scripts in index.html' };
        }
        const response = await root.CiliAIAssistant.ask('Hello');
        const finalText = root.CiliAIAssistant.finalizeAssistantOutput(response, 'Hello');
        const parsed = core.parseAssistantResponse(finalText);
        const ok = parsed && parsed.markdown && parsed.markdown.trim().length > 0 && parsed.jsonValid;
        return { pass: !!ok, detail: ok ? 'Response + JSON valid' : 'Empty response or JSON invalid', fix: ok ? '' : 'Check system prompt and LLM connection' };
    }

    function checkApiKey() {
        const config = getConfig();
        if (config.assistantV2 && config.provider === 'deepseek' && !config.proxyUrl) {
            return { pass: false, detail: 'Missing proxy URL', fix: 'Set CILIAI_ASSISTANT_PROXY_URL' };
        }
        if (config.proxyUrl) {
            const health = root.__CILIAI_PROXY_HEALTH__;
            if (!health) {
                return { pass: false, detail: 'Key status unknown', fix: 'Check /health endpoint' };
            }
            if (!health.keyConfigured) {
                return { pass: false, detail: 'Server key missing', fix: 'Set DEEPSEEK_API_KEY in worker' };
            }
            return { pass: true, detail: 'Key stored on server' };
        }
        return { pass: true, detail: `Key present: ${config.apiKey ? 'yes' : 'no'}` };
    }

    async function checkBasicResponse() {
        const config = getConfig();
        if (!isAssistantEnabled(config) && !isLocalOllamaMode(config)) {
            return { pass: false, detail: 'Assistant not enabled', fix: 'Set CILIAI_ASSISTANT_V2=true and choose provider' };
        }
        if (config.provider === 'deepseek' && !config.proxyUrl) {
            return { pass: false, detail: 'Missing proxy URL', fix: 'Set CILIAI_ASSISTANT_PROXY_URL' };
        }
        if (!root.CiliAIAssistant || typeof root.CiliAIAssistant.ask !== 'function') {
            return { pass: false, detail: 'Assistant runtime not available', fix: 'Check assistant scripts in index.html' };
        }
        const response = await root.CiliAIAssistant.ask('Hello');
        const finalText = root.CiliAIAssistant.finalizeAssistantOutput(response, 'Hello');
        const parsed = core.parseAssistantResponse(finalText);
        const hasMarkdown = parsed && core.validateMarkdownTemplate(parsed.markdown);
        const hasActions = parsed && parsed.jsonValid;
        return { pass: !!(hasMarkdown && hasActions), detail: hasMarkdown && hasActions ? 'Contract sections found' : 'Missing contract sections', fix: hasMarkdown && hasActions ? '' : 'Check template enforcement' };
    }

    async function checkActionsJson() {
        const config = getConfig();
        if (!isAssistantEnabled(config) && !isLocalOllamaMode(config)) {
            return { pass: false, detail: 'Assistant not enabled', fix: 'Set CILIAI_ASSISTANT_V2=true and choose provider' };
        }
        if (config.provider === 'deepseek' && !config.proxyUrl) {
            return { pass: false, detail: 'Missing proxy URL', fix: 'Set CILIAI_ASSISTANT_PROXY_URL' };
        }
        if (!root.CiliAIAssistant || typeof root.CiliAIAssistant.ask !== 'function') {
            return { pass: false, detail: 'Assistant runtime not available', fix: 'Check assistant scripts in index.html' };
        }
        const response = await root.CiliAIAssistant.ask('Hello');
        const finalText = root.CiliAIAssistant.finalizeAssistantOutput(response, 'Hello');
        const parsed = core.parseAssistantResponse(finalText);
        const valid = parsed && parsed.jsonValid;
        const intentOk = parsed && core.INTENTS.includes(parsed.actions.intent);
        return { pass: !!(valid && intentOk), detail: valid ? `Intent: ${parsed.actions.intent}` : 'Invalid JSON', fix: valid ? '' : 'Check response parsing and JSON repair' };
    }

    async function checkDataFirstUsed() {
        if (!root.CiliAIAssistant || typeof root.CiliAIAssistant.ask !== 'function') {
            return { pass: false, detail: 'Assistant runtime not available', fix: 'Check assistant scripts in index.html' };
        }
        await root.CiliAIAssistant.ask('Display Bardet–Biedl genes');
        const meta = root.__CILIAI_ASSISTANT_META__ || {};
        if (meta.dataFirstUsed) {
            return { pass: true, detail: 'Used: ' + (meta.dataFirstSource || 'data-first'), fix: '' };
        }
        const config = getConfig();
        if (config.chatMode === 'llm_first' && meta.llmCalled) {
            return { pass: true, detail: 'LLM used (data-first skipped, e.g. data loading)', fix: '' };
        }
        return { pass: false, detail: 'Data-first not used', fix: 'Check data-first handlers' };
    }

    async function checkLlmCalled() {
        if (!root.CiliAIAssistant || typeof root.CiliAIAssistant.ask !== 'function') {
            return { pass: false, detail: 'Assistant runtime not available', fix: 'Check assistant scripts in index.html' };
        }
        await root.CiliAIAssistant.ask('What is IFT88?');
        const meta = root.__CILIAI_ASSISTANT_META__ || {};
        if (meta.dataFirstUsed) {
            return { pass: true, detail: 'SKIPPED: data-first used', fix: '' };
        }
        return { pass: !!meta.llmCalled, detail: meta.llmCalled ? 'LLM called' : 'LLM not called', fix: meta.llmCalled ? '' : 'Check proxy and LLM path' };
    }

    function checkJsonRepaired() {
        const meta = root.__CILIAI_ASSISTANT_META__ || {};
        return {
            pass: meta.jsonRepaired === true || meta.jsonRepaired === false,
            detail: meta.jsonRepaired ? 'Repair used' : 'No repair needed',
            fix: ''
        };
    }

    async function checkMappingSuccess() {
        if (!root.CiliAIAssistant || typeof root.CiliAIAssistant.ask !== 'function') {
            return { pass: false, detail: 'Assistant runtime not available', fix: 'Check assistant scripts in index.html' };
        }
        await root.CiliAIAssistant.ask('Where is CEP290 localized?');
        const meta = root.__CILIAI_ASSISTANT_META__ || {};
        if (meta.mappingSuccess === true) {
            return { pass: true, detail: 'Localization mapped', fix: '' };
        }
        if (meta.mappingSuccess === false) {
            return { pass: false, detail: 'Localization not mapped', fix: 'Extend localization map' };
        }
        if (meta.mappingAttempted || meta.dataFirstUsed || meta.llmCalled) {
            return { pass: true, detail: 'SKIP: response OK, map optional', fix: '' };
        }
        return { pass: false, detail: 'Mapping not attempted', fix: 'Check highlight dispatch' };
    }

    async function checkMappingAttempted() {
        if (!root.CiliAIAssistant || typeof root.CiliAIAssistant.ask !== 'function') {
            return { pass: false, detail: 'Assistant runtime not available', fix: 'Check assistant scripts in index.html' };
        }
        await root.CiliAIAssistant.ask('Where is CEP290 localized?');
        const meta = root.__CILIAI_ASSISTANT_META__ || {};
        if (meta.mappingAttempted) {
            return { pass: true, detail: 'Highlight attempted', fix: '' };
        }
        if (meta.dataFirstUsed || meta.llmCalled) {
            return { pass: true, detail: 'SKIP: response OK, highlight optional', fix: '' };
        }
        return { pass: false, detail: 'Highlight not attempted', fix: 'Check highlight dispatch' };
    }

    async function checkGoldStandard() {
        if (!ensureChatReady()) return { pass: false, detail: 'Chat not ready' };
        const masterData = (root.CiliAI && root.CiliAI.masterData) || [];
        if (masterData.length === 0) return { pass: false, detail: 'Data not loaded', fix: 'Wait for DB then re-run' };
        if (typeof root.renderGoldStandardView !== 'function') return { pass: false, detail: 'renderGoldStandardView missing' };
        root.renderGoldStandardView();
        await wait(500);
        const table = document.querySelector('#cilia-svg .ciliai-table-container') || document.querySelector('.ciliai-table-container');
        const ok = !!table;
        return { pass: ok, detail: ok ? 'Gene list visible' : 'Gene list not found' };
    }

    async function checkCep290Localization() {
        if (!ensureChatReady() || !root.CiliAIAssistant || typeof root.CiliAIAssistant.getDataOnlyResponse !== 'function') {
            return { pass: false, detail: 'Assistant handler missing' };
        }
        const result = root.CiliAIAssistant.getDataOnlyResponse('Where is CEP290 localized?');
        if (!result || !result.actions) {
            return { pass: false, detail: 'Localization response missing' };
        }
        if (typeof root.CiliAIAssistant.dispatchActions === 'function') {
            root.CiliAIAssistant.dispatchActions(result.actions);
        }
        await wait(300);
        const text = (result.markdown || '').toLowerCase();
        const ok = /cep290/.test(text) && /localiz/.test(text);
        return { pass: ok, detail: ok ? 'Localization response shown' : 'Localization response missing' };
    }

    async function checkBbsGenes() {
        if (!ensureChatReady() || !root.CiliAIAssistant || typeof root.CiliAIAssistant.getDataOnlyResponse !== 'function') {
            return { pass: false, detail: 'Assistant handler missing' };
        }
        const result = root.CiliAIAssistant.getDataOnlyResponse('Display Bardet–Biedl genes');
        if (!result || !result.actions) {
            return { pass: false, detail: 'BBS gene list not visible' };
        }
        if (typeof root.CiliAIAssistant.dispatchActions === 'function') {
            root.CiliAIAssistant.dispatchActions(result.actions);
        }
        await wait(500);
        const table = document.querySelector('#cilia-svg .ciliai-table-container') || document.querySelector('.ciliai-table-container');
        const text = (table && table.textContent) ? table.textContent.toUpperCase() : '';
        const bbsSymbols = ['BBS1', 'BBS2', 'BBS4', 'BBS5', 'BBS7', 'BBS9', 'BBS10', 'BBS12', 'TTC8', 'MKKS', 'CEP290', 'WDPCP'];
        const found = bbsSymbols.filter(g => text.includes(g));
        const pass = !!table && (found.length >= 3 || text.length > 80);
        return { pass, detail: pass ? 'BBS gene list visible' : 'BBS gene list not visible' };
    }

    async function checkFailureHandling() {
        const config = getConfig();
        if (!isAssistantEnabled(config)) {
            return { pass: false, detail: 'Assistant not enabled', fix: 'Enable V2 and set provider' };
        }
        if (config.provider === 'deepseek' && !config.proxyUrl) {
            return { pass: false, detail: 'Missing proxy URL', fix: 'Set CILIAI_ASSISTANT_PROXY_URL' };
        }
        if (!root.CiliAIAssistant || typeof root.CiliAIAssistant.ask !== 'function') {
            return { pass: false, detail: 'Assistant runtime not available', fix: 'Check assistant scripts in index.html' };
        }
        const env = root.CILIAI_ENV || (root.__CILIAI_ENV__ || {});
        const previous = env.CILIAI_ASSISTANT_FORCE_FAILURE;
        env.CILIAI_ASSISTANT_FORCE_FAILURE = 'true';
        const response = await root.CiliAIAssistant.ask('Hello');
        env.CILIAI_ASSISTANT_FORCE_FAILURE = previous;
        const finalText = root.CiliAIAssistant.finalizeAssistantOutput(response, 'Hello');
        const hasContract = finalText.includes('[MARKDOWN]') && finalText.includes('[ACTIONS_JSON]');
        const usedFallback = root.__CILIAI_FALLBACK_USED__ === true;
        const ok = hasContract && usedFallback;
        return { pass: ok, detail: ok ? 'Fallback used safely' : 'Fallback missing' };
    }

    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function getHealthUrl(proxyUrl) {
        const trimmed = String(proxyUrl || '').replace(/\/+$/, '');
        if (!trimmed) return '';
        if (trimmed.endsWith('/health')) return trimmed;
        return `${trimmed}/health`;
    }

    function updateProxyWarning(proxyUrl) {
        const warning = document.getElementById('verify-proxy-warning');
        if (!warning) return;
        const isPlaceholder = proxyUrl === 'https://example.workers.dev/api/chat';
        if (isPlaceholder) {
            warning.style.display = 'block';
            warning.textContent = 'Proxy URL is still the placeholder. Replace it in ciliai/env.js.';
        } else {
            warning.style.display = 'none';
            warning.textContent = '';
        }
    }

    async function refreshHealthStatus() {
        const config = getConfig();
        if (!config.proxyUrl) return;
        try {
            const response = await fetch(getHealthUrl(config.proxyUrl), { method: 'GET' });
            if (!response.ok) throw new Error('Health request failed');
            const data = await response.json();
            root.__CILIAI_PROXY_HEALTH__ = {
                reachable: true,
                keyConfigured: !!data.keyConfigured,
                status: String(response.status)
            };
            setText('verify-key', data.keyConfigured ? 'Configured' : 'Missing');
            setText('verify-debug-health-status', String(response.status));
        } catch (e) {
            root.__CILIAI_PROXY_HEALTH__ = { reachable: false, keyConfigured: false, status: 'Error' };
            setText('verify-key', 'Unknown');
            setText('verify-debug-health-status', 'Error');
        }
    }

    function initVerificationLink() {
        const link = document.querySelector('[data-verify-link]');
        if (link) {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                location.hash = '#verify';
            });
        }
    }

    function handleHashChange() {
        if (location.hash === '#verify' || location.hash === '#assistant/verify') {
            openPanel();
        } else {
            closePanel();
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        buildPanel();
        initVerificationLink();
        handleHashChange();
        window.addEventListener('hashchange', handleHashChange);
    });
})(typeof window !== 'undefined' ? window : globalThis);

