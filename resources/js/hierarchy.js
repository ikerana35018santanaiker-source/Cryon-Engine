/**
 * CRYON ENGINE — hierarchy.js
 * Builds and manages the Hierarchy panel.
 */

'use strict';

window.HierarchyUI = {
  _filter: '',

  init() {
    window.addEventListener('cryon:scene-changed', () => this.rebuild());
    window.addEventListener('cryon:select', () => this.rebuild());
  },

  rebuild() {
    const tree = document.getElementById('hierarchy-tree');
    if (!tree) return;
    tree.innerHTML = '';

    const objects = CryonEngine.getAllObjects();
    const f = this._filter.toLowerCase();

    for (const obj of objects) {
      if (f && !obj.name.toLowerCase().includes(f)) continue;
      tree.appendChild(this._buildItem(obj));
    }

    if (objects.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:16px;color:var(--text-dim);font-size:11px;font-family:var(--font-mono);text-align:center';
      empty.textContent = 'Scene is empty';
      tree.appendChild(empty);
    }
  },

  _buildItem(obj) {
    const item = document.createElement('div');
    item.className = `tree-item${CryonEngine.selectedId === obj.id ? ' selected' : ''}${!obj.visible ? ' hidden-obj' : ''}`;
    item.dataset.id = obj.id;

    const icon = { cube: '⬡', sphere: '◉', empty: '◻' }[obj.type] ?? '◻';

    item.innerHTML = `
      <span class="tree-item-icon">${icon}</span>
      <span class="tree-item-name">${this._esc(obj.name)}</span>
      <span class="tree-item-eye" title="Toggle visibility"
        onclick="HierarchyUI._toggleVisible(${obj.id}, event)">
        ${obj.visible ? '👁' : '🚫'}
      </span>`;

    item.onclick = () => {
      CryonEngine.selectObject(obj.id);
    };

    // Right-click context menu
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      CryonEngine.selectObject(obj.id);
      UI.showContextMenu(e.clientX, e.clientY, [
        { label: '⎘ Duplicate', action: () => SceneManager.duplicateSelected() },
        { label: '⤢ Focus', action: () => SceneManager.focusSelected() },
        { label: '✎ Rename', action: () => this._startRename(obj.id) },
        { sep: true },
        { label: '✕ Delete', action: () => SceneManager.deleteSelected(), danger: true }
      ]);
    });

    return item;
  },

  _toggleVisible(id, e) {
    e.stopPropagation();
    const obj = CryonEngine.objects.get(id);
    if (!obj) return;
    obj.visible = !obj.visible;
    this.rebuild();
  },

  _startRename(id) {
    const item = document.querySelector(`.tree-item[data-id="${id}"]`);
    if (!item) return;
    const nameSpan = item.querySelector('.tree-item-name');
    const obj = CryonEngine.objects.get(id);
    if (!obj) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = obj.name;
    input.style.cssText = 'background:var(--bg-deep);border:1px solid var(--accent);border-radius:2px;color:var(--text-primary);font-size:12px;font-family:var(--font-mono);padding:1px 4px;width:140px;outline:none;';

    const commit = () => {
      obj.name = input.value.trim() || obj.name;
      InspectorUI.rebuild(id);
      this.rebuild();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { commit(); }
      if (e.key === 'Escape') { this.rebuild(); }
    });
    input.addEventListener('blur', commit);

    nameSpan.replaceWith(input);
    input.select();
    input.focus();
  },

  filter(val) {
    this._filter = val;
    this.rebuild();
  },

  _esc(s) { return s.replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
};
