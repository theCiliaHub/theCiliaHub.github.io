// Runtime env — DeepSeek (proxy). API key lives only in the Cloudflare Worker, never here.
window.CILIAI_ENV = {
    CILIAI_ENV_VERSION: 'v1-deepseek',
    CILIAI_ASSISTANT_V2: 'true',
    CILIAI_LLM_PROVIDER: 'deepseek',
    CILIAI_ASSISTANT_CHAT_MODE: 'llm_first',
    CILIAI_MODEL: 'deepseek-chat',
    CILIAI_ASSISTANT_TEMPERATURE: '0.2',
    CILIAI_ASSISTANT_TIMEOUT_MS: '60000',
    CILIAI_ASSISTANT_RETRIES: '2',
    CILIAI_ASSISTANT_PROXY_URL: 'https://sweet-poetry-5f25.ramiz-karadeniz81.workers.dev/api/chat',
    CILIAI_PROXY_SECRET: '',
    CILIAI_ASSISTANT_DRY_RUN: 'false',
    CILIAI_ASSISTANT_FORCE_FAILURE: 'false',
    CILIAI_DEBUG: 'false'
};

