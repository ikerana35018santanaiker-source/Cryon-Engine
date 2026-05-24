/**
 * hierarchy.js — Cryon Engine
 * Scene hierarchy panel — lists all objects, handles selection.
 */

const CryonHierarchy = (() => {
  let _tree       = null;
  let _onSelect   = null;
  let _onDelete   = null;

  const TYPE_ICONS = {
    cube:   '□',
    sphere: '○',
    empty:  '⬡',
  };

  function init(onSelect, onDelete) {
    _tree     = document.getElementById('hierarchy-tree');
    _onSelect = onSelect || (() => {});
    _onDelete = onDelete || (() => {});

    // Search
    const search = document.getElementById('hierarchy-search');
    search.addEventListener('input', () => refresh(_filter(search.value)));

    // Add button
    document.getElementById('hierarchy-add').addEventListener('click', () => {
      document.getElementById('dropdown-gameobject').classList.toggle('hidden');
    });
  }

  function _filter(q) {
    if (!q.trim()) return CryonScene.getAllObjects();
    return CryonScene.getAllObjects().filter(o =>
      o.name.toLowerCase().includes(q.toLowerCase())
    );
  }

  function refresh(objects) {
    if (!_tree) return;
    if (!objects) objects = CryonScene.getAllObjects();
    _tree.innerHTML = '';

    const selectedId = CryonScene.getSelectedId();

    if (objects.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:12px; font-size:11px; color:var(--text-muted); text-align:center;';
      empty.textContent = 'Scene is empty';
      _tree.appendChild(empty);
      return;
    }

    objects.forEach(obj => {
      const item = document.createElement('div');
      item.className = 'hierarchy-item' + (obj.id === selectedId ? ' selected' : '');
      item.dataset.id = obj.id;
      item.innerHTML = `
        <span class="hierarchy-item-icon">${TYPE_ICONS[obj.type] || '⬡'}</span>
        <span class="hierarchy-item-name">${_esc(obj.name)}</span>
      `;

      item.addEventListener('click', () => {
        CryonScene.select(obj.id);
        refresh();
        _onSelect(obj);
      });

      // Right-click context menu
      item.addEventListener('contextmenu', e => {
        e.preventDefault();
        _showContextMenu(obj, e.clientX, e.clientY);
      });

      _tree.appendChild(item);
    });
  }

  function _showContextMenu(obj, x, y) {
    document.querySelectorAll('.hierarchy-ctx').forEach(m => m.remove());

    const menu = document.createElement('div');
    menu.className = 'menu-dropdown hierarchy-ctx';
    menu.style.left = x + 'px';
    menu.style.top  = y + 'px';
    menu.style.position = 'fixed';
    menu.innerHTML = `
      <button class="dropdown-item" data-action="select">Select</button>
      <button class="dropdown-item" data-action="rename">Rename</button>
      <div class="dropdown-sep"></div>
      <button class="dropdown-item" style="color:var(--red)" data-action="delete">Delete</button>
    `;

    menu.querySelector('[data-action="select"]').addEventListener('click', () => {
      CryonScene.select(obj.id);
      refresh();
      _onSelect(obj);
      menu.remove();
    });

    menu.querySelector('[data-action="rename"]').addEventListener('click', () => {
      const newName = prompt('Rename object:', obj.name);
      if (newName && newName.trim()) {
        obj.name = newName.trim();
        refresh();
        _onSelect(obj);
      }
      menu.remove();
    });

    menu.querySelector('[data-action="delete"]').addEventListener('click', () => {
      _onDelete(obj.id);
      menu.remove();
    });

    document.body.appendChild(menu);

    const close = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', close, true);
      }
    };
    setTimeout(() => document.addEventListener('click', close, true), 10);
  }

  function _esc(s) { return String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  return { init, refresh };
})();
