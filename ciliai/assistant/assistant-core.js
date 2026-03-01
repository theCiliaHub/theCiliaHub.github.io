// CiliAI Assistant Core - provider-agnostic helpers (UMD)
(function (root) {
    'use strict';

    const INTENTS = [
        'none',
        'list_genes',
        'show_gene',
        'show_disease',
        'filter',
        'plot',
        'compare',
        'navigate',
        'help',
        'visualize_bbs_list',
        'lookup_gene_list'
    ];

    const KNOWN_TARGETS = [
        'cilia-svg',
        'plotly-container',
        'domain-viewer',
        'cilia-diagram',
        'messages',
        'viz-stage',
        'tab-diagram',
        'tab-plot',
        'tab-domain'
    ];

    function parseBoolean(value, fallback = false) {
        if (value === undefined || value === null) return fallback;
        if (typeof value === 'boolean') return value;
        const val = String(value).toLowerCase().trim();
        if (['1', 'true', 'yes', 'on'].includes(val)) return true;
        if (['0', 'false', 'no', 'off'].includes(val)) return false;
        return fallback;
    }

    function getEnvValue(key, fallback) {
        const winEnv = (root && root.CILIAI_ENV) || {};
        if (Object.prototype.hasOwnProperty.call(winEnv, key)) return winEnv[key];
        return fallback;
    }

    function buildConfig() {
        const provider = getEnvValue('CILIAI_LLM_PROVIDER', '').toLowerCase().trim();
        const chatModeRaw = getEnvValue('CILIAI_ASSISTANT_CHAT_MODE', 'llm_first');
        const chatMode = ['llm_first', 'data_first'].includes(String(chatModeRaw).toLowerCase())
            ? String(chatModeRaw).toLowerCase()
            : 'llm_first';
        const assistantV2 = parseBoolean(getEnvValue('CILIAI_ASSISTANT_V2', false), false);
        const dryRun = parseBoolean(getEnvValue('CILIAI_ASSISTANT_DRY_RUN', false), false);
        const debug = parseBoolean(getEnvValue('CILIAI_DEBUG', false), false) || (typeof location !== 'undefined' && location.hostname === 'localhost');
        const apiKey = getEnvValue('DEEPSEEK_API_KEY', '');
        const defaultModel = provider === 'ollama' ? 'llama3.1' : 'deepseek-chat';
        const model = getEnvValue('CILIAI_MODEL', defaultModel);
        const temperature = Number(getEnvValue('CILIAI_ASSISTANT_TEMPERATURE', 0.2));
        const timeoutMs = Number(getEnvValue('CILIAI_ASSISTANT_TIMEOUT_MS', 15000));
        const retries = Number(getEnvValue('CILIAI_ASSISTANT_RETRIES', 2));
        const baseUrl = getEnvValue('CILIAI_ASSISTANT_BASE_URL', 'https://api.deepseek.com');
        const proxyUrl = getEnvValue('CILIAI_ASSISTANT_PROXY_URL', '');
        const proxySecret = getEnvValue('CILIAI_PROXY_SECRET', '');
        const envVersion = getEnvValue('CILIAI_ENV_VERSION', '');
        const forceFailure = parseBoolean(getEnvValue('CILIAI_ASSISTANT_FORCE_FAILURE', false), false);

        return {
            provider,
            chatMode,
            assistantV2,
            dryRun,
            debug,
            apiKey,
            model,
            temperature: Number.isFinite(temperature) ? temperature : 0.2,
            timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 15000,
            retries: Number.isFinite(retries) ? retries : 2,
            baseUrl,
            proxyUrl,
            proxySecret: typeof proxySecret === 'string' ? proxySecret : '',
            envVersion,
            forceFailure
        };
    }

    function noOpActions() {
        return { intent: 'none', title: '', payload: {}, visual: [] };
    }

    function isKnownTarget(target) {
        if (!target || typeof target !== 'string') return false;
        if (KNOWN_TARGETS.includes(target)) return true;
        if (target === '#ciliai') return true;
        if (target.startsWith('#gene/')) return true;
        return false;
    }

    function normalizeVisualItem(item) {
        if (!item || typeof item !== 'object') return null;
        const type = typeof item.type === 'string' ? item.type : '';
        const target = typeof item.target === 'string' ? item.target : '';
        if (!type || !target || !isKnownTarget(target)) return null;
        const data = item.data && typeof item.data === 'object' && !Array.isArray(item.data) ? item.data : {};
        return { type, target, data };
    }

    function normalizeActions(actions) {
        if (!actions || typeof actions !== 'object') return noOpActions();
        const intent = INTENTS.includes(actions.intent) ? actions.intent : 'none';
        const title = typeof actions.title === 'string' ? actions.title : '';
        const payload = actions.payload && typeof actions.payload === 'object' && !Array.isArray(actions.payload) ? actions.payload : {};
        const visual = Array.isArray(actions.visual)
            ? actions.visual.map(normalizeVisualItem).filter(Boolean)
            : [];

        return { intent, title, payload, visual };
    }

    function parseAssistantResponse(text) {
        const raw = typeof text === 'string' ? text : '';
        const result = {
            markdown: '',
            actions: noOpActions(),
            raw,
            jsonValid: false
        };

        if (!raw) return result;

        const mdTag = '[MARKDOWN]';
        const actionTag = '[ACTIONS_JSON]';
        const mdIndex = raw.indexOf(mdTag);
        const actionIndex = raw.indexOf(actionTag);

        if (mdIndex === -1 || actionIndex === -1 || actionIndex < mdIndex) {
            result.markdown = raw.trim();
            return result;
        }

        const markdown = raw.slice(mdIndex + mdTag.length, actionIndex).trim();
        const jsonText = raw.slice(actionIndex + actionTag.length).trim();
        result.markdown = markdown;

        try {
            const parsed = JSON.parse(jsonText);
            result.actions = normalizeActions(parsed);
            result.jsonValid = true;
        } catch (e) {
            result.actions = noOpActions();
            result.jsonValid = false;
        }

        return result;
    }

    function validateMarkdownTemplate(markdown) {
        return typeof markdown === 'string' && markdown.trim().length > 0;
    }

    function buildStructuredMarkdown(question, shortAnswer, details, visuals, nextActions) {
        const parts = [];
        if (shortAnswer) parts.push(shortAnswer);
        if (details) parts.push('', details);
        if (visuals) parts.push('', visuals);
        if (nextActions) parts.push('', nextActions);
        return parts.join('\n');
    }

    const api = {
        INTENTS,
        KNOWN_TARGETS,
        parseBoolean,
        buildConfig,
        noOpActions,
        isKnownTarget,
        normalizeActions,
        parseAssistantResponse,
        validateMarkdownTemplate,
        buildStructuredMarkdown
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    root.CiliAIAssistantCore = api;
})(typeof window !== 'undefined' ? window : globalThis);

