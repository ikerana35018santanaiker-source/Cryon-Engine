/**
 * console.js — Cryon Engine
 * In-editor console with log/warn/error/info/success levels.
 */

const CryonConsole = (() => {
  let _output = null;
  let _filter  = 'all';
  let _lines   = [];

  const ICONS = {
    log:     '·',
    warn:    '▲',
    error:   '✕',
    info:    'ℹ',
    success: '✓',
  };

  function _init() {
    _output = document.getElementById('console-output');

    document.getElementById('console-clear').addEventListener('click', clear);

    document.querySelectorAll('.console-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.console-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _filter = btn.dataset.filter;
        _render();
      });
    });
  }

  function _render() {
    if (!_output) return;
    _output.innerHTML = '';
    const filtered = _filter === 'all' ? _lines : _lines.filter(l => l.type === _filter);
    filtered.forEach(l => {
      const el = document.createElement('div');
      el.className = `console-line ${l.type}`;
      el.innerHTML = `
        <span class="console-icon">${ICONS[l.type] || '·'}</span>
        <span class="console-time">${l.time}</span>
        <span class="console-msg">${_escapeHtml(l.msg)}</span>
      `;
      _output.appendChild(el);
    });
    _output.scrollTop = _output.scrollHeight;
  }

  function _escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function _push(type, ...args) {
    const msg = args.map(a => {
      if (typeof a === 'object') {
        try { return JSON.stringify(a, null, 2); }
        catch { return String(a); }
      }
      return String(a);
    }).join(' ');

    const now  = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false });
    _lines.push({ type, msg, time });

    // Keep max 500 lines
    if (_lines.length > 500) _lines = _lines.slice(-500);
    _render();
  }

  function log    (...args) { _push('log',     ...args); }
  function warn   (...args) { _push('warn',    ...args); }
  function error  (...args) { _push('error',   ...args); }
  function info   (...args) { _push('info',    ...args); }
  function success(...args) { _push('success', ...args); }

  function clear() {
    _lines = [];
    _render();
  }

  return { init: _init, log, warn, error, info, success, clear };
})();
