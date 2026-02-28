import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const core = require('../assistant/assistant-core.js');

const fixturePath = new URL('./assistant_golden_cases.json', import.meta.url);

function assertValidTargets(actions) {
    if (!actions || !Array.isArray(actions.visual)) return;
    for (const visual of actions.visual) {
        assert.equal(typeof visual.target, 'string');
        assert.ok(core.isKnownTarget(visual.target), `Unknown target: ${visual.target}`);
    }
}

test('golden assistant responses follow output contract', async () => {
    const raw = await readFile(fixturePath, 'utf8');
    const cases = JSON.parse(raw);

    assert.ok(Array.isArray(cases));
    assert.ok(cases.length >= 20);

    for (const entry of cases) {
        assert.ok(entry.question, 'Question missing');
        assert.ok(entry.response, 'Response missing');

        const parsed = core.parseAssistantResponse(entry.response);
        assert.ok(parsed.markdown && parsed.markdown.includes('- Question:'), 'Markdown missing question line');

        assert.ok(core.INTENTS.includes(parsed.actions.intent), 'Invalid intent');
        assertValidTargets(parsed.actions);
    }
});

