// Example runtime env file for local dev (do NOT commit real keys or secrets)
// Copy to ciliai/env.js and fill values. Add ciliai/env.js to .gitignore.
window.CILIAI_ENV = {
    CILIAI_ASSISTANT_V2: 'false',
    CILIAI_LLM_PROVIDER: 'deepseek', // or 'ollama'
    CILIAI_ASSISTANT_CHAT_MODE: 'llm_first',
    CILIAI_MODEL: 'deepseek-chat',
    CILIAI_ASSISTANT_TEMPERATURE: '0.2',
    CILIAI_ASSISTANT_TIMEOUT_MS: '15000',
    CILIAI_ASSISTANT_RETRIES: '2',
    CILIAI_ASSISTANT_BASE_URL: 'https://api.deepseek.com',
    CILIAI_ASSISTANT_PROXY_URL: '', // e.g. https://your-worker.workers.dev/api/chat
    CILIAI_PROXY_SECRET: '', // Optional. If set in Worker env, set same value here. Never commit.
    CILIAI_ASSISTANT_DRY_RUN: 'false',
    CILIAI_ASSISTANT_FORCE_FAILURE: 'false',
    CILIAI_DEBUG: 'false'
};

