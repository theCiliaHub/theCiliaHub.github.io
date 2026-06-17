/* ciliahub-ui.js — shared, self-contained UI utilities for CiliaHub.
 * Non-layout-shifting toast notifications. The script injects its own CSS and
 * a fixed toast container, so pages only need: <script src="js/ciliahub-ui.js"></script>
 *
 * API (window.CiliaHubUI):
 *   showErrorToast(title, description)             → persistent error toast (manual dismiss)
 *   showSuccessToast(title, description)           → auto-dismiss success toast
 *   showToast({title, description, type, timeout, allowHtml}) → generic
 *     type: 'error' | 'success' | 'info'  (default 'info')
 *     timeout: ms before auto-dismiss; 0 = persist until dismissed
 */
(function (win, doc) {
    'use strict';
    if (win.CiliaHubUI) return;

    var CSS = [
        '#ciliahub-toast-container{position:fixed;bottom:1.25rem;right:1.25rem;z-index:9999;display:flex;flex-direction:column;gap:.75rem;width:100%;max-width:24rem;pointer-events:none;padding:0 1rem;box-sizing:border-box}',
        '.ch-toast{pointer-events:auto;display:flex;gap:.75rem;align-items:flex-start;background:#fff;border:1px solid #e5e7eb;border-left:4px solid #2563eb;border-radius:.6rem;padding:.9rem 1rem;box-shadow:0 10px 25px -5px rgba(0,0,0,.12),0 4px 8px -4px rgba(0,0,0,.08);transform:translateY(.5rem);opacity:0;transition:transform .3s ease,opacity .3s ease;font-family:inherit}',
        '.ch-toast.show{transform:translateY(0);opacity:1}',
        '.ch-toast--error{border-left-color:#ef4444}',
        '.ch-toast--success{border-left-color:#16a34a}',
        '.ch-toast--info{border-left-color:#2563eb}',
        '.ch-toast-icon{flex-shrink:0;width:1.25rem;height:1.25rem;margin-top:1px}',
        '.ch-toast--error .ch-toast-icon{color:#ef4444}',
        '.ch-toast--success .ch-toast-icon{color:#16a34a}',
        '.ch-toast--info .ch-toast-icon{color:#2563eb}',
        '.ch-toast-content{flex:1 1 0%;min-width:0}',
        '.ch-toast-title{font-size:.875rem;font-weight:600;color:#1f2937;margin:0}',
        '.ch-toast-desc{font-size:.75rem;color:#4b5563;margin:.25rem 0 0;line-height:1.45;overflow-wrap:break-word}',
        '.ch-toast-desc code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#f3f4f6;padding:.05rem .3rem;border-radius:.2rem;font-size:.92em;color:#b91c1c}',
        '.ch-toast-close{background:none;border:0;color:#9ca3af;cursor:pointer;flex-shrink:0;padding:0;line-height:0}',
        '.ch-toast-close:hover{color:#4b5563}'
    ].join('');

    var ICONS = {
        error: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"/>',
        success: '<path stroke-linecap="round" stroke-linejoin="round" d="m9 12.75 2.25 2.25L15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>',
        info: '<path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"/>'
    };

    function injectCSS() {
        if (doc.getElementById('ciliahub-ui-css')) return;
        var s = doc.createElement('style');
        s.id = 'ciliahub-ui-css';
        s.textContent = CSS;
        (doc.head || doc.documentElement).appendChild(s);
    }

    function container() {
        var c = doc.getElementById('ciliahub-toast-container');
        if (!c) {
            c = doc.createElement('div');
            c.id = 'ciliahub-toast-container';
            doc.body.appendChild(c);
        }
        return c;
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
        });
    }

    function showToast(opts) {
        opts = opts || {};
        var type = opts.type || 'info';
        var timeout = opts.timeout == null ? 7000 : opts.timeout;
        injectCSS();
        var c = container();
        var t = doc.createElement('div');
        t.className = 'ch-toast ch-toast--' + type;
        t.setAttribute('role', type === 'error' ? 'alert' : 'status');
        t.innerHTML =
            '<svg class="ch-toast-icon" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">' + (ICONS[type] || ICONS.info) + '</svg>' +
            '<div class="ch-toast-content"><p class="ch-toast-title">' + escapeHtml(opts.title || '') + '</p>' +
            (opts.description ? '<p class="ch-toast-desc">' + (opts.allowHtml ? opts.description : escapeHtml(opts.description)) + '</p>' : '') +
            '</div>' +
            '<button class="ch-toast-close" type="button" aria-label="Dismiss notification"><svg style="width:16px;height:16px" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg></button>';
        c.appendChild(t);
        void t.offsetWidth; // reflow to trigger the slide-in transition
        t.classList.add('show');

        function dismiss() {
            t.classList.remove('show');
            setTimeout(function () { if (t.parentNode) t.remove(); }, 300);
        }
        t.querySelector('.ch-toast-close').addEventListener('click', dismiss);
        if (timeout > 0) setTimeout(function () { if (t.parentNode) dismiss(); }, timeout);
        return { dismiss: dismiss };
    }

    win.CiliaHubUI = {
        showToast: showToast,
        showErrorToast: function (title, description) {
            return showToast({ type: 'error', title: title, description: description, timeout: 0 });
        },
        showSuccessToast: function (title, description) {
            return showToast({ type: 'success', title: title, description: description });
        }
    };
})(window, document);
