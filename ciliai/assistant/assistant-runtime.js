// CiliAI Assistant Runtime (DeepSeek integration + action dispatcher)
(function (root) {
    'use strict';

    const core = root.CiliAIAssistantCore;
    if (!core) return;

    function buildDatabaseContext(query) {
        if (!root.CiliAI || !root.CiliAI.ready) return '';
        const q = String(query || '').toLowerCase();
        const geneMap = root.CiliAI.lookups?.geneMap || {};
        const byCiliopathy = root.CiliAI.lookups?.byCiliopathy || {};
        const masterData = root.CiliAI.masterData || [];
        const maxGenes = 12;
        const maxDescLen = 120;
        const lines = [];
        const seen = new Set();

        function addGene(symbol) {
            const key = String(symbol || '').toUpperCase();
            if (!key || seen.has(key)) return;
            seen.add(key);
            const rec = geneMap[key] || masterData.find(g => (g.Gene || g.gene || '').toUpperCase() === key);
            if (!rec) return;
            const name = rec.Gene || rec.gene || key;
            const loc = rec.Localization || rec.localization || '';
            const desc = (rec['Gene.Description'] || rec.description || '').slice(0, maxDescLen);
            if (desc) lines.push(`${name}: ${desc}${desc.length >= maxDescLen ? '...' : ''}${loc ? ' | Localization: ' + loc : ''}`);
            else if (loc) lines.push(`${name} | Localization: ${loc}`);
        }

        const genes = root.CiliAI.utils?.extractGenes ? root.CiliAI.utils.extractGenes(query) : [];
        genes.slice(0, maxGenes).forEach(addGene);

        if (lines.length === 0 && (q.includes('gold standard') || q.includes('ciliary genes'))) {
            masterData.slice(0, 8).forEach(g => addGene(g.Gene || g.gene));
        }
        if (lines.length === 0 && (q.includes('bardet') || q.includes('biedl') || q.includes('bbs'))) {
            const bbsKey = Object.keys(byCiliopathy).find(k => k.toLowerCase().includes('bardet'));
            const list = bbsKey ? (byCiliopathy[bbsKey] || []) : [];
            list.slice(0, 10).forEach(g => addGene(typeof g === 'string' ? g : g.Gene || g.gene));
        }

        if (lines.length === 0) return '';
        return '\n\nDATABASE CONTEXT (use this data to answer; prefer it over general knowledge):\n' + lines.join('\n');
    }

    function buildDatabaseSummaryForDisplay(query) {
        if (!root.CiliAI || !root.CiliAI.ready) return '';
        const q = String(query || '').toLowerCase();
        const geneMap = root.CiliAI.lookups?.geneMap || {};
        const masterData = root.CiliAI.masterData || [];
        const maxItems = 8;
        const maxDescLen = 80;
        const lines = [];
        const seen = new Set();

        function addLine(symbol) {
            const key = String(symbol || '').toUpperCase();
            if (!key || seen.has(key)) return;
            seen.add(key);
            const rec = geneMap[key] || masterData.find(g => (g.Gene || g.gene || '').toUpperCase() === key);
            if (!rec) return;
            const name = rec.Gene || rec.gene || key;
            const loc = rec.Localization || rec.localization || '';
            const desc = (rec['Gene.Description'] || rec.description || '').slice(0, maxDescLen);
            if (desc) lines.push('• **' + name + '**: ' + desc + (loc ? ' — Lokalizasyon: ' + loc : ''));
            else if (loc) lines.push('• **' + name + '**: Lokalizasyon: ' + loc);
        }

        const genes = root.CiliAI.utils?.extractGenes ? root.CiliAI.utils.extractGenes(query) : [];
        genes.slice(0, maxItems).forEach(addLine);

        const byCiliopathy = root.CiliAI.lookups?.byCiliopathy || {};
        if (lines.length === 0 && (q.includes('bardet') || q.includes('biedl') || q.includes('bbs'))) {
            const bbsKey = Object.keys(byCiliopathy).find(k => k.toLowerCase().includes('bardet'));
            const list = bbsKey ? (byCiliopathy[bbsKey] || []) : [];
            list.slice(0, maxItems).forEach(g => addLine(typeof g === 'string' ? g : g.Gene || g.gene));
        }
        if (lines.length === 0 && (q.includes('gold standard') || q.includes('ciliary genes'))) {
            masterData.slice(0, maxItems).forEach(g => addLine(g.Gene || g.gene));
        }

        if (lines.length === 0) return '';
        return '\n\n---\n**From the database:**\n' + lines.join('\n');
    }

    function buildSystemPrompt(fewShotText, dbContext) {
        const targets = core.KNOWN_TARGETS.concat(['#ciliai', '#gene/{SYMBOL}']).join(', ');
        const base = [
            'You are CiliAI, a query router and interpreter for a ciliary biology database application.',
            '',
            'YOUR ROLE:',
            '- You are a ROUTER / INTERPRETER, NOT a free-answer chatbot.',
            '- Your job is to understand the user query and map it to the correct database action.',
            '- Do NOT generate biological facts, gene annotations, disease associations, or expression patterns from your own knowledge.',
            '- Do NOT hallucinate or invent scientific information.',
            '- ONLY use the DATABASE CONTEXT provided below to construct your response.',
            '- If the DATABASE CONTEXT does not contain an answer, say clearly: "This information is not available in the current CiliAI database."',
            '',
            'RESPONSE FORMAT — always respond in exactly TWO SECTIONS:',
            '',
            '[MARKDOWN]',
            'Write a BRIEF, factual response using ONLY data from DATABASE CONTEXT below.',
            'If no relevant data exists in the context, say the data is not available.',
            'Do NOT elaborate with general biological knowledge.',
            '',
            '[ACTIONS_JSON]',
            '{ "intent": "...", "title": "...", "payload": { ... }, "visual": [ { "type": "...", "target": "...", "data": { ... } } ] }',
            '',
            'Rules:',
            '- The [MARKDOWN] section is what the user sees. Keep it SHORT and grounded in the DATABASE CONTEXT.',
            '- The [ACTIONS_JSON] section triggers UI actions. JSON MUST parse.',
            '- If nothing to do: {"intent":"none","title":"","payload":{},"visual":[]}',
            '- Do NOT invent capabilities. Only use these targets: ' + targets,
            '- Intents: none, list_genes, show_gene, show_disease, filter, plot, compare, navigate, help, visualize_bbs_list, lookup_gene_list.',
            '- For gene card requests, use intent "show_gene" with payload { "gene": "SYMBOL" }.',
            '- When DATABASE CONTEXT provides gene data, use ONLY those exact values. Do NOT add or supplement.',
            '- When DATABASE CONTEXT is empty or does not contain relevant information, respond with: "This information is not available in the current CiliAI database." and use intent "none".',
            '- Do NOT add highlight visuals unless the user explicitly asks about localization or spatial position.',
        ];
        if (dbContext) base.push(dbContext);
        if (fewShotText) {
            base.push('', 'Examples:', fewShotText);
        }
        return base.join('\n');
    }

    function escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function inlineFormat(text) {
        return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    }

    function renderMarkdown(markdown) {
        const text = String(markdown || '');
        const lines = text.split('\n');
        const htmlLines = [];
        let inList = false;

        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();

            if (!trimmed) {
                if (inList) { htmlLines.push('</ul>'); inList = false; }
                htmlLines.push('<br>');
                continue;
            }

            const headerMatch = trimmed.match(/^(#{1,4})\s+(.*)/);
            const bulletMatch = trimmed.match(/^[-*]\s+(.*)/);

            if (headerMatch) {
                if (inList) { htmlLines.push('</ul>'); inList = false; }
                const level = Math.min(headerMatch[1].length, 4);
                htmlLines.push(`<h${level + 1}>${inlineFormat(headerMatch[2])}</h${level + 1}>`);
            } else if (bulletMatch) {
                if (!inList) { htmlLines.push('<ul>'); inList = true; }
                htmlLines.push(`<li>${inlineFormat(bulletMatch[1])}</li>`);
            } else {
                if (inList) { htmlLines.push('</ul>'); inList = false; }
                htmlLines.push(`<p>${inlineFormat(trimmed)}</p>`);
            }
        }
        if (inList) htmlLines.push('</ul>');

        return `<div class="assistant-markdown">${htmlLines.join('\n')}</div>`;
    }

    function getMeta() {
        if (!root.__CILIAI_ASSISTANT_META__) root.__CILIAI_ASSISTANT_META__ = {};
        return root.__CILIAI_ASSISTANT_META__;
    }

    function setMeta(updates) {
        const meta = getMeta();
        Object.assign(meta, updates);
        return meta;
    }
    async function loadFewShotExamples() {
        if (root.CiliAIFewShotCache) return root.CiliAIFewShotCache;
        try {
            const response = await fetch('./ciliai/tests/assistant_golden_cases.json');
            if (!response.ok) throw new Error('Few-shot examples not found');
            const data = await response.json();
            const examples = Array.isArray(data) ? data : [];
            const formatted = examples.map(item => {
                const converted = convertGoldenToTemplate(item.response || '');
                return `User: ${item.question}\nAssistant:\n${converted}`;
            }).join('\n\n');
            root.CiliAIFewShotCache = formatted;
            return formatted;
        } catch (e) {
            return '';
        }
    }

    function convertGoldenToTemplate(text) {
        const parsed = core.parseAssistantResponse(text);
        const md = parsed.markdown || '';
        if (!md) return '';
        const lines = md.split('\n');
        const out = [];
        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('- Question:')) out.push('Question:' + trimmed.replace('- Question:', '').trimStart());
            else if (trimmed.startsWith('- Short Answer:')) out.push('Short Answer:' + trimmed.replace('- Short Answer:', '').trimStart());
            else if (trimmed.startsWith('- Details:')) out.push('Detailed Explanation:' + trimmed.replace('- Details:', '').trimStart());
            else if (trimmed.startsWith('- What I can show visually:')) out.push('What I can show visually:' + trimmed.replace('- What I can show visually:', '').trimStart());
            else if (trimmed.startsWith('- Next best actions:')) out.push('Next best actions:' + trimmed.replace('- Next best actions:', '').trimStart());
            else if (trimmed.startsWith('- ')) out.push(trimmed);
            else if (trimmed.length) out.push(trimmed);
        });
        return ['[MARKDOWN]', out.join('\n'), '', '[ACTIONS_JSON]', JSON.stringify(parsed.actions)].join('\n');
    }

    function extractFirstSentence(text) {
        if (!text) return '';
        const match = text.match(/([^\.!\?]+[\.!\?])\s/);
        return match ? match[1].trim() : text.split('\n')[0].trim();
    }

    function repairResponse(query, rawText, parsed) {
        const markdownText = parsed && parsed.markdown ? parsed.markdown : rawText || '';
        const actions = parsed && parsed.jsonValid ? parsed.actions : core.noOpActions();
        return {
            markdown: markdownText.trim() || 'I\'m not sure how to answer that. Try asking about a specific gene or ciliopathy.',
            actions,
            raw: ''
        };
    }

    function logDebug(enabled, ...args) {
        if (!enabled) return;
        console.log('[CiliAI Assistant]', ...args);
    }

    function getProvider(config) {
        if (config.provider === 'deepseek') {
            if (!root.DeepSeekProvider) return null;
            return new root.DeepSeekProvider({
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                proxyUrl: config.proxyUrl,
                proxySecret: config.proxySecret,
                model: config.model,
                temperature: config.temperature,
                timeoutMs: config.timeoutMs,
                retries: config.retries,
                debug: config.debug
            });
        }
        if (config.provider === 'ollama') {
            if (!root.OllamaProvider) return null;
            if (!root.__CILIAI_OLLAMA_LOGGED__) {
                console.log('[CiliAI] Using local Ollama provider');
                root.__CILIAI_OLLAMA_LOGGED__ = true;
            }
            return new root.OllamaProvider({
                model: config.model || 'llama3.1',
                timeoutMs: config.timeoutMs,
                retries: config.retries,
                debug: config.debug
            });
        }
        return null;
    }

    function normalizeGenes(input) {
        if (!input) return [];
        if (Array.isArray(input)) return input.map(g => String(g).toUpperCase()).filter(Boolean);
        if (typeof input === 'string') {
            return input.split(/[,\s]+/).map(g => g.trim().toUpperCase()).filter(Boolean);
        }
        return [];
    }

    function validateGenes(genes) {
        const geneMap = root.CiliAI?.lookups?.geneMap;
        if (!geneMap) return genes; // lookups not loaded yet — pass through
        const valid = [];
        const invalid = [];
        genes.forEach(g => {
            if (geneMap[g]) {
                valid.push(g);
            } else {
                invalid.push(g);
            }
        });
        // #region agent log
        fetch('http://127.0.0.1:7491/ingest/b99c607b-adae-4c2a-a178-1292ac376939',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8e17aa'},body:JSON.stringify({sessionId:'8e17aa',location:'assistant-runtime.js:validateGenes',message:'validation result',data:{inputCount:genes.length,validCount:valid.length,invalidCount:invalid.length,firstInvalid:invalid.slice(0,5),firstValid:valid.slice(0,5),firstInput:genes.slice(0,5)},timestamp:Date.now(),hypothesisId:'C+D'})}).catch(()=>{});
        // #endregion
        if (invalid.length && root.console && console.warn) {
            console.warn('[CiliAI] Unrecognized gene symbols removed from payload:', invalid);
        }
        return valid;
    }

    function normalizeTermLocal(term) {
        return String(term || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    function findCiliopathyKey(term) {
        const lookups = root.CiliAI?.lookups;
        if (!lookups || !lookups.byCiliopathy) return null;
        const target = normalizeTermLocal(term);
        const keys = Object.keys(lookups.byCiliopathy);
        return keys.find(k => normalizeTermLocal(k) === target) || null;
    }

    function findBbsKey() {
        const lookups = root.CiliAI?.lookups;
        if (!lookups || !lookups.byCiliopathy) return null;
        const keys = Object.keys(lookups.byCiliopathy);
        return keys.find(k => {
            const n = normalizeTermLocal(k);
            return n.includes('bardet') && n.includes('biedl');
        }) || null;
    }

    function buildHelpResponse(query) {
        const suggestions = [
            'What is IFT88?',
            'Where is CEP290 localized?',
            'Show Gold Standard ciliary genes',
            'Display Bardet–Biedl genes',
            'Show disease associated with TMEM67'
        ];
        return {
            markdown: [
                'Hello! I\'m CiliAI, your assistant for ciliary biology.',
                '',
                'I can help you with:',
                '- Gene information and function (e.g. IFT88, CEP290)',
                '- Localization on the ciliary diagram',
                '- Gene lists (Gold Standard, Bardet\u2013Biedl)',
                '- Disease associations and expression data',
                '',
                'Try asking me something like:',
                suggestions.map(s => '- **' + s + '**').join('\n')
            ].join('\n'),
            actions: core.normalizeActions({
                intent: 'help',
                title: 'Welcome',
                payload: { suggestions },
                visual: []
            }),
            raw: ''
        };
    }

    function isGreeting(text) {
        const q = String(text || '').toLowerCase().trim();
        if (!q) return false;
        return /^(hi|hello|hey|hi there|good morning|good afternoon|good evening|selam|merhaba|how are you|how are u|how r u|what'?s up|who are you|what can you do|help|thanks|thank you|thx)\b/.test(q);
    }

    function buildFallbackResponse(query, reason) {
        root.__CILIAI_FALLBACK_USED__ = true;
        root.__CILIAI_LAST_FALLBACK_REASON__ = reason || 'unknown';
        setMeta({ fallbackUsed: true, fallbackReason: reason || 'unknown' });
        return {
            markdown: [
                'I couldn\'t reach the assistant service right now.',
                '',
                'But I can still help! Try these data-driven queries:',
                '- **Show Gold Standard ciliary genes**',
                '- **Where is CEP290 localized?**',
                '- **What is IFT88?**'
            ].join('\n'),
            actions: core.normalizeActions({ intent: 'help', title: 'Fallback', payload: {}, visual: [] }),
            raw: ''
        };
    }

    function buildLocalizationResponse(query, geneSymbol, localization) {
        const locText = localization || 'Unknown';
        return {
            markdown: [
                `**${geneSymbol}** localizes to the **${locText}**.`,
                '',
                'I\'ll highlight this on the ciliary diagram for you.'
            ].join('\n'),
            actions: core.normalizeActions({
                intent: 'show_gene',
                title: `${geneSymbol} localization`,
                payload: { gene: geneSymbol },
                visual: [
                    { type: 'highlight', target: 'cilia-diagram', data: { localization: locText, gene: geneSymbol } }
                ]
            }),
            raw: ''
        };
    }

    function buildGoldStandardResponse(query, genes) {
        const list = genes || [];
        return {
            markdown: [
                `Here's the **Gold Standard ciliary gene set** — ${list.length} curated genes.`,
                '',
                'I\'m opening the gene list table for you now.'
            ].join('\n'),
            actions: core.normalizeActions({
                intent: 'list_genes',
                title: 'Gold Standard Ciliary Genes',
                payload: { genes: list },
                visual: [
                    { type: 'table', target: 'cilia-svg', data: { title: 'Gold Standard Ciliary Genes', genes: list } }
                ]
            }),
            raw: ''
        };
    }

    function buildGeneInfoResponse(query, geneSymbol, geneData) {
        const desc = geneData?.['Gene.Description'] || 'No description available.';
        const loc = geneData?.['Localization'] || '';
        const parts = [`**${geneSymbol}** — ${desc}`];
        if (loc) parts.push(``, `Localization: **${loc}**`);
        parts.push('', 'I can show you the gene detail card, expression plots, and diagram highlights.');
        return {
            markdown: parts.join('\n'),
            actions: core.normalizeActions({
                intent: 'show_gene',
                title: `${geneSymbol} overview`,
                payload: { gene: geneSymbol },
                visual: []
            }),
            raw: ''
        };
    }

    function tryHighlightLocalization(locText, geneSymbol) {
        const term = String(locText || '').trim();
        if (!term) return false;
        setMeta({ mappingAttempted: true });
        root.__CILIAI_MAPPING_ATTEMPTED__ = true;
        if (root.SpatialManager && typeof root.SpatialManager.highlight === 'function') {
            const mapped = root.SpatialManager.highlight(term, geneSymbol || null);
            setMeta({ mappingSuccess: !!mapped });
            root.__CILIAI_MAPPING_SUCCESS__ = !!mapped;
            return !!mapped;
        }
        setMeta({ mappingSuccess: false });
        root.__CILIAI_MAPPING_SUCCESS__ = false;
        return false;
    }

    function buildBbsListResponse(query, genes) {
        const list = genes || [];
        return {
            markdown: [
                `I found **${list.length} Bardet\u2013Biedl (BBS) genes** in the curated database.`,
                '',
                'Opening the gene list for you now.'
            ].join('\n'),
            actions: core.normalizeActions({
                intent: 'visualize_bbs_list',
                title: 'Bardet\u2013Biedl Genes',
                payload: { genes: list },
                visual: [
                    { type: 'table', target: 'cilia-svg', data: { title: 'Bardet\u2013Biedl Genes', genes: list } }
                ]
            }),
            raw: ''
        };
    }

    function buildFinalizedOutput(markdown, actions) {
        const safeActions = core.normalizeActions(actions);
        const finalMarkdown = markdown || 'I\'m not sure how to answer that. Try asking about a specific gene.';
        return `[MARKDOWN]\n${finalMarkdown}\n\n[ACTIONS_JSON]\n${JSON.stringify(safeActions)}`;
    }

    function extractQuestion(text) {
        if (!text) return '';
        const match = text.match(/Question:\s*(.+)/i);
        if (match) return match[1].trim();
        return '';
    }

    function tryDataFirst(query) {
        if (!root.CiliAI || !root.CiliAI.ready) return null;
        const q = String(query || '').toLowerCase();

        if (isGreeting(q)) {
            setMeta({ dataFirstUsed: true, dataFirstSource: 'greeting', llmCalled: false });
            return buildHelpResponse(query);
        }

        if (q.includes('help')) {
            setMeta({ dataFirstUsed: true, dataFirstSource: 'help', llmCalled: false });
            return buildHelpResponse(query);
        }

        // BBS list only when user clearly asks to SHOW/LIST (not "what is BBS1?" etc.)
        const wantsBbsList = (q.includes('display') || q.includes('show') || q.includes('list')) &&
            (q.includes('bardet') || q.includes('biedl') || q.includes('bbs'));
        const isExplainQuestion = /what is|what are|explain|tell me about|define|how do/.test(q);
        if (wantsBbsList && !isExplainQuestion) {
            const key = findBbsKey();
            let genes = key ? (root.CiliAI.lookups.byCiliopathy[key] || []) : [];
            if (!genes.length && root.CiliAI.lookups?.geneMap) {
                genes = Object.keys(root.CiliAI.lookups.geneMap).filter(g => g.startsWith('BBS'));
            }
            setMeta({ dataFirstUsed: true, dataFirstSource: 'Bardet–Biedl', llmCalled: false });
            return buildBbsListResponse(query, genes);
        }

        if (q.includes('gold standard')) {
            const genes = (root.CiliAI.masterData || []).map(g => g.Gene).filter(Boolean);
            setMeta({ dataFirstUsed: true, dataFirstSource: 'Gold Standard', llmCalled: false });
            return buildGoldStandardResponse(query, genes);
        }

        // Generic ciliopathy list: any (show|list|display) + known disease name → full list from byCiliopathy
        const wantsDiseaseList = (q.includes('display') || q.includes('show') || q.includes('list'))
            && !isExplainQuestion;
        if (wantsDiseaseList) {
            const byCiliopathy = root.CiliAI.lookups?.byCiliopathy || {};
            const qNorm = q.replace(/[^a-z0-9]/g, '');
            const matchedKey = Object.keys(byCiliopathy).find(k => {
                const kNorm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                return kNorm.length >= 5 && qNorm.includes(kNorm);
            });
            if (matchedKey) {
                const rawList = byCiliopathy[matchedKey] || [];
                const genes = rawList.map(g =>
                    typeof g === 'string' ? g : g.Gene || g.gene
                ).filter(Boolean);
                if (genes.length) {
                    const displayName = matchedKey
                        .replace(/([a-z])([A-Z])/g, '$1 $2')
                        .replace(/^([a-z])/, c => c.toUpperCase());
                    setMeta({ dataFirstUsed: true, dataFirstSource: matchedKey, llmCalled: false });
                    return {
                        markdown: [
                            `Here are the **${genes.length} ${displayName} genes** in the curated database.`,
                            '',
                            'Opening the full gene list table now.'
                        ].join('\n'),
                        actions: core.normalizeActions({
                            intent: 'list_genes',
                            title: `${displayName} Genes`,
                            payload: { genes },
                            visual: [{ type: 'table', target: 'cilia-svg',
                                       data: { title: `${displayName} Genes`, genes } }]
                        }),
                        raw: ''
                    };
                }
            }
        }

        if (q.includes('where is') || q.includes('localized') || q.includes('localised') || q.includes('localization')) {
            const genes = root.CiliAI.utils?.extractGenes ? root.CiliAI.utils.extractGenes(query) : [];
            if (genes.length) {
                const symbol = genes[0].toUpperCase();
                const gene = root.CiliAI.lookups?.geneMap?.[symbol];
                const loc = gene?.Localization || 'Unknown';
                setMeta({ dataFirstUsed: true, dataFirstSource: 'Localization', llmCalled: false });
                const response = buildLocalizationResponse(query, symbol, loc);
                tryHighlightLocalization(loc, symbol);
                return response;
            }
        }

        if (q.includes('what is') || q.includes('tell me about')) {
            const genes = root.CiliAI.utils?.extractGenes ? root.CiliAI.utils.extractGenes(query) : [];
            if (genes.length) {
                const symbol = genes[0].toUpperCase();
                const gene = root.CiliAI.lookups?.geneMap?.[symbol];
                if (gene) {
                    setMeta({ dataFirstUsed: true, dataFirstSource: 'Gene Info', llmCalled: false });
                    return buildGeneInfoResponse(query, symbol, gene);
                }
            }
        }

        // Total ciliopathy gene count — mirrors logic in legacy ciliai.js priority-78 handler
        if (/total.{0,15}ciliopathy|ciliopathy.{0,15}total/i.test(q)) {
            const masterData = root.CiliAI.masterData || [];
            const allUniqueGenes = new Set();
            masterData.forEach(gene => {
                const rawData = gene.Ciliopathies || gene.Ciliopathy;
                if (!rawData) return;
                const list = Array.isArray(rawData)
                    ? rawData
                    : String(rawData).split(/[;,]/).map(s => s.trim());
                const isValid = list.some(d =>
                    d && d.length > 2 && !['NONE', 'N/A', 'UNKNOWN'].includes(d.toUpperCase())
                );
                if (isValid) allUniqueGenes.add(gene.Gene);
            });
            const totalCount = allUniqueGenes.size;
            const genes = [...allUniqueGenes].filter(Boolean);
            setMeta({ dataFirstUsed: true, dataFirstSource: 'Total Ciliopathy', llmCalled: false });
            return {
                markdown: `There are **${totalCount} unique ciliopathy-associated genes** in the curated database.`,
                actions: core.normalizeActions({
                    intent: 'list_genes',
                    title: 'Ciliopathy Genes',
                    payload: { genes },
                    visual: [{ type: 'table', target: 'cilia-svg',
                                data: { title: 'Ciliopathy Genes', genes } }]
                }),
                raw: ''
            };
        }

        // Localization gene list: (show|list|display) + known compartment → full list from byLocalization
        const wantsLocList = (q.includes('show') || q.includes('list') || q.includes('display'))
            && !isExplainQuestion;
        if (wantsLocList) {
            const byLocalization = root.CiliAI.lookups?.byLocalization || {};
            const geneMap = root.CiliAI.lookups?.geneMap || {};
            // Sort by length descending so "transition zone" matches before "zone"
            const sortedKeys = Object.keys(byLocalization).sort((a, b) => b.length - a.length);
            // Use word-boundary regex so "cilia" does NOT match "ciliary" or "pan-ciliary"
            const matchedLoc = sortedKeys.find(loc => {
                const escaped = loc.toLowerCase().replace(/[-\s]+/g, '[\\s\\-]+');
                return new RegExp('(?:^|[^a-z])' + escaped + '(?:[^a-z]|$)').test(q);
            });
            // #region agent log
            fetch('http://127.0.0.1:7491/ingest/b99c607b-adae-4c2a-a178-1292ac376939',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8e17aa'},body:JSON.stringify({sessionId:'8e17aa',location:'assistant-runtime.js:tryDataFirst:locList',message:'localization list check',data:{q,wantsLocList,matchedLoc:matchedLoc||null},timestamp:Date.now(),hypothesisId:'A+B'})}).catch(()=>{});
            // #endregion
            if (matchedLoc) {
                const rawList = byLocalization[matchedLoc] || [];
                const rawGenes = rawList.map(g =>
                    typeof g === 'string' ? g : g.Gene || g.gene
                ).filter(Boolean).map(g => String(g).toUpperCase());
                // Validate against geneMap so the markdown count matches what the table will show
                const genes = rawGenes.filter(g => !!geneMap[g]);
                const finalGenes = genes.length > 0 ? genes : rawGenes;
                if (finalGenes.length) {
                    const displayName = matchedLoc.charAt(0).toUpperCase() + matchedLoc.slice(1);
                    setMeta({ dataFirstUsed: true, dataFirstSource: matchedLoc, llmCalled: false });
                    return {
                        markdown: [
                            `Found **${finalGenes.length} genes** localized to the **${displayName}** in the curated database.`,
                            '',
                            'Opening the full gene list table now.'
                        ].join('\n'),
                        actions: core.normalizeActions({
                            intent: 'list_genes',
                            title: `${displayName} Genes`,
                            payload: { genes: finalGenes },
                            // No highlight visual — avoids showDiagram() stealing focus from the table
                            visual: [
                                { type: 'table', target: 'cilia-svg',
                                  data: { title: `${displayName} Genes`, genes: finalGenes } }
                            ]
                        }),
                        raw: ''
                    };
                }
            }
        }

        return null;
    }

    function shouldForceDataFirst(query) {
        const q = String(query || '').toLowerCase();
        const wantsList = q.includes('display') || q.includes('show') || q.includes('list');
        const isExplain = /what is|what are|explain|tell me about|define|how do/.test(q);
        // #region agent log
        fetch('http://127.0.0.1:7491/ingest/b99c607b-adae-4c2a-a178-1292ac376939',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8e17aa'},body:JSON.stringify({sessionId:'8e17aa',location:'assistant-runtime.js:shouldForceDataFirst',message:'entry',data:{query,q,wantsList,isExplain},timestamp:Date.now(),hypothesisId:'A+E'})}).catch(()=>{});
        // #endregion
        if (q.includes('gold standard')) return true;
        if (q.includes('where is cep290 localized')) return true;
        // "Total ciliopathy genes" — force data-first so legacy handler isn't blocked by LLM
        if (/total.{0,15}ciliopathy|ciliopathy.{0,15}total/i.test(q)) return true;
        if (!isExplain && wantsList) {
            // BBS shortcut
            if (q.includes('bardet') || q.includes('biedl') || q.includes('bbs')) return true;
            // Any known ciliopathy key
            const byCiliopathy = root.CiliAI?.lookups?.byCiliopathy || {};
            const qNorm = q.replace(/[^a-z0-9]/g, '');
            const hit = Object.keys(byCiliopathy).find(k => {
                const kNorm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                return kNorm.length >= 5 && qNorm.includes(kNorm);
            });
            // #region agent log
            fetch('http://127.0.0.1:7491/ingest/b99c607b-adae-4c2a-a178-1292ac376939',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8e17aa'},body:JSON.stringify({sessionId:'8e17aa',location:'assistant-runtime.js:shouldForceDataFirst:diseaseHit',message:'disease key scan',data:{qNorm,hit:hit||null},timestamp:Date.now(),hypothesisId:'C+D'})}).catch(()=>{});
            // #endregion
            if (hit) return true;
            // Any known localization compartment — word-boundary match to avoid "cilia" matching "ciliary"
            const byLocalization = root.CiliAI?.lookups?.byLocalization || {};
            const locHit = Object.keys(byLocalization).find(loc => {
                const escaped = loc.toLowerCase().replace(/[-\s]+/g, '[\\s\\-]+');
                return new RegExp('(?:^|[^a-z])' + escaped + '(?:[^a-z]|$)').test(q);
            });
            // #region agent log
            fetch('http://127.0.0.1:7491/ingest/b99c607b-adae-4c2a-a178-1292ac376939',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8e17aa'},body:JSON.stringify({sessionId:'8e17aa',location:'assistant-runtime.js:shouldForceDataFirst:locHit',message:'localization key scan (word-boundary)',data:{q,locHit:locHit||null},timestamp:Date.now(),hypothesisId:'A+E'})}).catch(()=>{});
            // #endregion
            if (locHit) return true;
        }
        return false;
    }

    function dispatchActions(actions) {
        if (!actions || typeof actions !== 'object') return;
        const intent = actions.intent || 'none';
        const payload = actions.payload || {};

        try {
            setMeta({ mappingSuccess: null, mappingAttempted: false });
            if (intent === 'list_genes' && root.showDataInLeftPanel) {
                const genes = validateGenes(normalizeGenes(payload.genes));
                const title = actions.title || payload.title || 'Gene List';
                if (genes.length) root.showDataInLeftPanel(title, genes);
            }

            // lookup_gene_list: LLM signals a disease/localization name; client does the data lookup
            if (intent === 'lookup_gene_list') {
                const diseaseRaw = payload.disease || payload.localization || '';
                const localizationRaw = payload.localization || '';
                let resolved = false;

                if (diseaseRaw && root.CiliAI?.lookups?.byCiliopathy) {
                    const byCiliopathy = root.CiliAI.lookups.byCiliopathy;
                    const qNorm = diseaseRaw.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const key = Object.keys(byCiliopathy).find(k => {
                        const kNorm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                        return kNorm.length >= 5 && (qNorm.includes(kNorm) || kNorm.includes(qNorm));
                    });
                    if (key) {
                        const rawList = byCiliopathy[key] || [];
                        const genes = rawList.map(g =>
                            typeof g === 'string' ? g : g.Gene || g.gene
                        ).filter(Boolean);
                        if (genes.length && root.showDataInLeftPanel) {
                            const title = actions.title || `${diseaseRaw} Genes`;
                            root.showDataInLeftPanel(title, genes);
                            resolved = true;
                        }
                    }
                }

                if (!resolved && localizationRaw && root.CiliAI?.lookups?.byLocalization) {
                    const byLocalization = root.CiliAI.lookups.byLocalization;
                    const locKey = Object.keys(byLocalization).find(k =>
                        k.toLowerCase() === localizationRaw.toLowerCase()
                    ) || Object.keys(byLocalization).find(k =>
                        localizationRaw.toLowerCase().includes(k.toLowerCase())
                    );
                    if (locKey) {
                        const rawList = byLocalization[locKey] || [];
                        const genes = rawList.map(g =>
                            typeof g === 'string' ? g : g.Gene || g.gene
                        ).filter(Boolean);
                        if (genes.length && root.showDataInLeftPanel) {
                            const title = actions.title || `${locKey} Genes`;
                            root.showDataInLeftPanel(title, genes);
                            resolved = true;
                        }
                    }
                }
            }

            if (intent === 'plot' && root.renderUMAPPlot && payload.gene) {
                const gene = String(payload.gene).toUpperCase();
                const genes = normalizeGenes(payload.genes);
                const zoom = payload.zoomToCellType || null;
                if (typeof root.switchView === 'function') root.switchView('plot');
                root.renderUMAPPlot(gene, genes.length ? genes : [gene], zoom);
            }

            if (intent === 'compare' && typeof root.handleComparativeDashboard === 'function' && payload.genes) {
                const genes = normalizeGenes(payload.genes);
                if (genes.length > 1) root.handleComparativeDashboard(genes.join(' vs '));
            }

            if (intent === 'visualize_bbs_list' && root.showDataInLeftPanel) {
                const genes = validateGenes(normalizeGenes(payload.genes));
                const title = actions.title || 'Bardet–Biedl Genes';
                if (genes.length) root.showDataInLeftPanel(title, genes);
            }

            if (intent === 'navigate' && payload.route) {
                const route = String(payload.route);
                if (typeof root.navigateTo === 'function') {
                    root.navigateTo(null, route.replace(/^#/, ''));
                } else if (typeof location !== 'undefined') {
                    location.hash = route;
                }
            }

            // show_gene: open the real gene card UI (not just chat text)
            if (intent === 'show_gene' && payload.gene) {
                const gene = String(payload.gene).toUpperCase();
                if (typeof root.displayFullGeneInfo === 'function') {
                    root.displayFullGeneInfo(gene).then(html => {
                        if (html && typeof root.addChatMessage === 'function') {
                            root.addChatMessage(html, false);
                        }
                    }).catch(() => {});
                }
            }

            if (Array.isArray(actions.visual)) {
                // Only switch to diagram view if there is no competing table/plot visual
                const hasTableOrPlot = actions.visual.some(v =>
                    v && (v.type === 'table' || v.type === 'list' || v.type === 'plot')
                );

                actions.visual.forEach(item => {
                    if (!item || !item.type) return;
                    const type = item.type;
                    const data = item.data || {};

                    if (type === 'highlight' && root.SpatialManager && data.localization) {
                        // #region agent log
                        fetch('http://127.0.0.1:7491/ingest/b99c607b-adae-4c2a-a178-1292ac376939',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8e17aa'},body:JSON.stringify({sessionId:'8e17aa',location:'assistant-runtime.js:dispatchActions:highlight',message:'highlight dispatch',data:{localization:data.localization,gene:data.gene||null,intent,hasTableOrPlot,allVisuals:actions.visual},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
                        // #endregion
                        // Only auto-zoom diagram for EXPLICIT localization requests.
                        // Do NOT zoom for gene cards, overviews, disease queries, etc.
                        const isLocalizationQuery = (actions.title || '').toLowerCase().includes('localization')
                            || (actions.title || '').toLowerCase().includes('highlight');
                        if (!hasTableOrPlot && isLocalizationQuery) {
                            root.showDiagram && root.showDiagram();
                        }
                        setMeta({ mappingAttempted: true });
                        const mapped = root.SpatialManager.highlight(data.localization, data.gene || null);
                        setMeta({ mappingSuccess: mapped });
                    } else if (type === 'highlight') {
                        setMeta({ mappingAttempted: true, mappingSuccess: false });
                    }

                    if (type === 'plot' && root.renderUMAPPlot && data.gene) {
                        const gene = String(data.gene).toUpperCase();
                        const genes = normalizeGenes(data.genes);
                        root.switchView && root.switchView('plot');
                        root.renderUMAPPlot(gene, genes.length ? genes : [gene], data.zoomToCellType || null);
                    }

                    if ((type === 'table' || type === 'list' || type === 'panel') && root.showDataInLeftPanel) {
                        const genes = validateGenes(normalizeGenes(data.genes));
                        const title = data.title || actions.title || 'Gene List';
                        if (genes.length) root.showDataInLeftPanel(title, genes);
                    }

                    if (type === 'panel' && item.target === 'domain-viewer' && root.showDomainViewer && data.gene) {
                        if (typeof root.switchView === 'function') root.switchView('domain');
                        root.showDomainViewer(String(data.gene).toUpperCase());
                    }

                    if (type === 'link' && data.route && typeof root.navigateTo === 'function') {
                        root.navigateTo(null, String(data.route).replace(/^#/, ''));
                    }
                });
            }
        } catch (e) {
            // Defensive: never crash UI for assistant actions
            if (root.console && console.warn) console.warn('[CiliAI Assistant] action dispatch failed', e);
        }
    }

    function getMockResponse(query) {
        const mocks = root.CiliAIAssistantMocks || {};
        if (!query) return '';
        return mocks[query] || '';
    }

    async function ask(query) {
        const config = core.buildConfig();
        const enabled = config.assistantV2 && (config.provider === 'deepseek' || config.provider === 'ollama');
        if (!enabled) return null;

        root.__CILIAI_FALLBACK_USED__ = false;
        root.__CILIAI_LAST_FALLBACK_REASON__ = '';
        setMeta({ dataFirstUsed: false, dataFirstSource: '', llmCalled: false, jsonRepaired: false, mappingSuccess: null, mappingAttempted: false, fallbackUsed: false, fallbackReason: '' });
        const preferLlm = config.chatMode !== 'data_first';
        if (!preferLlm || shouldForceDataFirst(query)) {
            const dataFirst = tryDataFirst(query);
            if (dataFirst) return dataFirst;
        }

        const fewShot = await loadFewShotExamples();
        const dbContext = buildDatabaseContext(query);
        const systemPrompt = buildSystemPrompt(fewShot, dbContext);
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: query }
        ];

        if (config.dryRun) {
            const mock = getMockResponse(query);
            if (mock) return core.parseAssistantResponse(mock);
            return {
                markdown: 'Dry-run mode is active \u2014 no live model call was made. Disable dry-run in env.js for real responses.',
                actions: core.noOpActions(),
                raw: ''
            };
        }

        if (config.forceFailure) {
            return buildFallbackResponse(query, 'forced_failure');
        }

        const provider = getProvider(config);
        if (!provider) {
            return {
                markdown: 'The assistant is not configured yet. Please set your LLM provider in env.js (deepseek or ollama).',
                actions: core.noOpActions(),
                raw: ''
            };
        }

        try {
            setMeta({ llmCalled: true });
            const content = await provider.chat(messages);
            let parsed = core.parseAssistantResponse(content);
            if (!parsed.jsonValid) {
                const repaired = tryRepairJson(content);
                if (repaired) {
                    parsed.actions = core.normalizeActions(repaired);
                    parsed.jsonValid = true;
                    setMeta({ jsonRepaired: true });
                }
            }
            if (!core.validateMarkdownTemplate(parsed.markdown)) {
                return repairResponse(query, content, parsed);
            }
            const dbSummary = buildDatabaseSummaryForDisplay(query);
            if (dbSummary) parsed.markdown = (parsed.markdown || '').trim() + dbSummary;
            return parsed;
        } catch (e) {
            const msg = e && e.message ? e.message : '';
            if (!(msg.includes('402') || msg.toLowerCase().includes('insufficient balance'))) {
                logDebug(config.debug, 'LLM request failed', e);
            }
            root.__CILIAI_LAST_API_ERROR__ = msg || (e && e.name) || 'Unknown';
            const is402 = msg.includes('402') || msg.toLowerCase().includes('payment required');
            if (preferLlm) {
                const dataFirstFallback = tryDataFirst(query);
                if (dataFirstFallback) {
                    const apiFailedNote = is402
                        ? '\n\n---\n*⚠️ **DeepSeek balance insufficient (402)**. Showing cached answer. Top up at platform.deepseek.com.*'
                        : '\n\n---\n*⚠️ **API unavailable** (error: ' + (msg.slice(0, 60) || 'connection error') + '). Showing cached answer.*';
                    dataFirstFallback.markdown = (dataFirstFallback.markdown || '').trim() + apiFailedNote;
                    return dataFirstFallback;
                }
            }
            if (config.provider === 'ollama') {
                return buildFallbackResponse(query, 'Local AI not running. Start Ollama.');
            }
            const reason = e && e.message ? e.message : 'Request failed';
            return buildFallbackResponse(query, reason);
        }
    }

    function tryRepairJson(content) {
        if (!content) return null;
        const marker = '[ACTIONS_JSON]';
        const idx = content.indexOf(marker);
        if (idx === -1) return null;
        const jsonText = content.slice(idx + marker.length).trim();
        const start = jsonText.indexOf('{');
        const end = jsonText.lastIndexOf('}');
        if (start === -1 || end === -1) return null;
        let block = jsonText.slice(start, end + 1);
        block = block.replace(/,\s*([}\]])/g, '$1');
        try {
            return JSON.parse(block);
        } catch (e) {
            return null;
        }
    }

    function isEnabled() {
        const config = core.buildConfig();
        return config.assistantV2 && (config.provider === 'deepseek' || config.provider === 'ollama');
    }

    function getDataOnlyResponse(query) {
        return tryDataFirst(query);
    }

    root.CiliAIAssistant = {
        isEnabled,
        isGreeting,
        getGreetingResponse: buildHelpResponse,
        getDataOnlyResponse,
        ask,
        dispatchActions,
        renderMarkdown,
        buildFallbackResponse,
        finalizeAssistantOutput: function(result, query) {
            const markdown = result?.markdown || '';
            const actions = result?.actions || core.noOpActions();
            return buildFinalizedOutput(markdown, actions);
        }
    };
})(typeof window !== 'undefined' ? window : globalThis);

