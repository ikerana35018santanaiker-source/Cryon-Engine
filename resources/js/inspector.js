/**
 * CRYON ENGINE — inspector.js
 * Builds and manages the Inspector panel UI.
 * Shows component blocks for the selected object.
 */

'use strict';

window.InspectorUI = {

  _expandedComponents: new Set(['Transform', 'Renderer']),

  init() {
    window.addEventListener('cryon:select', (e) => this.rebuild(e.detail.id));
  },

  rebuild(id) {
    const content = document.getElementById('inspector-content');
    if (!id) {
      content.innerHTML = '<div class="inspector-empty">No object selected</div>';
      return;
    }
    const obj = CryonEngine.objects.get(id);
    if (!obj) { content.innerHTML = '<div class="inspector-empty">Object not found</div>'; return; }

    content.innerHTML = '';

    // ── Name bar ──
    const namebar = document.createElement('div');
    namebar.className = 'inspector-namebar';
    namebar.innerHTML = `
      <div class="inspector-nameicon">${this._typeIcon(obj.type)}</div>
      <input class="inspector-nameinput" type="text" value="${this._esc(obj.name)}"
        onchange="InspectorUI._rename(${obj.id}, this.value)" />
      <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:11px;color:var(--text-dim)">
        <input type="checkbox" ${obj.active ? 'checked' : ''}
          onchange="InspectorUI._setActive(${obj.id}, this.checked)"
          style="accent-color:var(--accent)"/>
        Active
      </label>`;
    content.appendChild(namebar);

    // ── Tag / Layer ──
    const meta = document.createElement('div');
    meta.className = 'inspector-meta';
    meta.innerHTML = `
      <select class="select-field" style="flex:1">
        <option>Untagged</option><option>Player</option><option>Enemy</option>
        <option>Ground</option><option>UI</option>
      </select>
      <select class="select-field" style="flex:1">
        <option>Default</option><option>UI</option><option>Water</option><option>Ignore Raycast</option>
      </select>`;
    content.appendChild(meta);

    // ── Component blocks ──
    for (const [compName, compData] of Object.entries(obj.components)) {
      content.appendChild(this._buildComponent(obj.id, compName, compData));
    }

    // ── Add Component button ──
    const addBtn = document.createElement('button');
    addBtn.className = 'add-component-btn';
    addBtn.innerHTML = `<span>+</span> Add Component`;
    addBtn.onclick = (e) => this._showComponentPicker(e, obj.id);
    content.appendChild(addBtn);
  },

  refresh() {
    const id = CryonEngine.selectedId;
    if (!id) return;
    const obj = CryonEngine.objects.get(id);
    if (!obj) return;

    // Update just the transform fields without full rebuild
    const t = obj.transform;
    const updateVec = (prefix, vec) => {
      ['x', 'y', 'z'].forEach(ax => {
        const el = document.getElementById(`${prefix}_${ax}`);
        if (el && document.activeElement !== el) {
          el.value = vec[ax].toFixed(3);
        }
      });
    };
    updateVec('pos', t.position);
    updateVec('rot', t.rotation);
    updateVec('sca', t.scale);
  },

  _buildComponent(objId, compName, compData) {
    const def    = CryonEngine.COMPONENT_DEFS[compName];
    const icon   = def?.icon ?? '⚙';
    const isOpen = this._expandedComponents.has(compName);

    const block = document.createElement('div');
    block.className = 'component-block';
    block.id = `comp-block-${compName}-${objId}`;

    // Header
    const header = document.createElement('div');
    header.className = `component-header${isOpen ? ' open' : ''}`;
    header.innerHTML = `
      <span class="component-toggle${isOpen ? ' open' : ''}">▶</span>
      <span class="component-icon">${icon}</span>
      <span class="component-name">${compName}</span>
      ${def?.removable ? `<button class="component-menu-btn" title="Remove Component"
        onclick="InspectorUI._removeComponent(${objId},'${compName}')">✕</button>` : ''}
    `;
    header.onclick = (e) => {
      if (e.target.classList.contains('component-menu-btn')) return;
      const open = !header.classList.contains('open');
      header.classList.toggle('open', open);
      header.querySelector('.component-toggle').classList.toggle('open', open);
      body.classList.toggle('open', open);
      if (open) this._expandedComponents.add(compName);
      else this._expandedComponents.delete(compName);
    };
    block.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = `component-body${isOpen ? ' open' : ''}`;

    if (compName === 'Transform') {
      body.appendChild(this._buildTransformFields(objId, compData));
    } else if (compName === 'Renderer') {
      body.appendChild(this._buildRendererFields(objId, compData));
    } else {
      body.innerHTML = `<div style="font-size:11px;color:var(--text-dim);font-family:var(--font-mono)">
        No editable properties.</div>`;
    }
    block.appendChild(body);
    return block;
  },

  _buildTransformFields(objId, data) {
    const wrap = document.createElement('div');
    const rows = [
      { label: 'Position', key: 'position', prefix: 'pos' },
      { label: 'Rotation', key: 'rotation', prefix: 'rot' },
      { label: 'Scale',    key: 'scale',    prefix: 'sca' }
    ];
    for (const { label, key, prefix } of rows) {
      const row = document.createElement('div');
      row.className = 'field-row';
      row.innerHTML = `<span class="field-label">${label}</span>`;
      const trio = document.createElement('div');
      trio.className = 'field-trio';
      for (const ax of ['x','y','z']) {
        const vf = document.createElement('div');
        vf.className = `vec-field vec-${ax}`;
        vf.innerHTML = `
          <span class="vec-label">${ax.toUpperCase()}</span>
          <input class="vec-input" id="${prefix}_${ax}" type="number" step="0.01"
            value="${data[key][ax].toFixed(3)}"
            onchange="InspectorUI._setVec3(${objId},'Transform','${key}','${ax}',this.value)"
            oninput="InspectorUI._setVec3(${objId},'Transform','${key}','${ax}',this.value)"
          />`;
        trio.appendChild(vf);
      }
      row.appendChild(trio);
      wrap.appendChild(row);
    }

    // Reset button
    const resetBtn = document.createElement('button');
    resetBtn.style.cssText = 'width:100%;margin-top:6px;padding:4px;background:var(--bg-deep);border:1px solid var(--border);border-radius:var(--radius);color:var(--text-dim);font-size:11px;cursor:pointer;';
    resetBtn.textContent = 'Reset Transform';
    resetBtn.onclick = () => {
      const obj = CryonEngine.objects.get(objId);
      if (!obj) return;
      obj.transform.position = {x:0,y:0,z:0};
      obj.transform.rotation = {x:0,y:0,z:0};
      obj.transform.scale    = {x:1,y:1,z:1};
      this.rebuild(objId);
    };
    wrap.appendChild(resetBtn);
    return wrap;
  },

  _buildRendererFields(objId, data) {
    const wrap = document.createElement('div');

    // Mesh type
    wrap.appendChild(this._fieldRow('Mesh', `
      <select class="select-field"
        onchange="InspectorUI._setField(${objId},'Renderer','meshType',this.value)">
        ${['Cube','Sphere'].map(o =>
          `<option ${data.meshType===o?'selected':''}>${o}</option>`
        ).join('')}
      </select>`
    ));

    // Color
    wrap.appendChild(this._fieldRow('Color', `
      <input type="color" class="color-swatch" value="${data.color}"
        oninput="InspectorUI._setField(${objId},'Renderer','color',this.value)"/>
      <span style="font-size:11px;color:var(--text-dim);font-family:var(--font-mono);padding-left:4px">${data.color}</span>`
    ));

    // Wireframe
    wrap.appendChild(this._fieldRow('Wireframe', `
      <input type="checkbox" class="checkbox-field" ${data.wireframe?'checked':''}
        onchange="InspectorUI._setField(${objId},'Renderer','wireframe',this.checked)"/>`
    ));

    // Cast Shadow
    wrap.appendChild(this._fieldRow('Cast Shadow', `
      <input type="checkbox" class="checkbox-field" ${data.castShadow?'checked':''}
        onchange="InspectorUI._setField(${objId},'Renderer','castShadow',this.checked)"/>`
    ));

    // Visible
    wrap.appendChild(this._fieldRow('Visible', `
      <input type="checkbox" class="checkbox-field" ${data.visible?'checked':''}
        onchange="InspectorUI._setField(${objId},'Renderer','visible',this.checked)"/>`
    ));

    return wrap;
  },

  _fieldRow(label, html) {
    const row = document.createElement('div');
    row.className = 'field-row';
    row.innerHTML = `<span class="field-label">${label}</span><div class="field-value" style="align-items:center">${html}</div>`;
    return row;
  },

  /* ─── COMPONENT PICKER ─── */
  _showComponentPicker(e, objId) {
    UI.closeAllDropdowns();
    const obj = CryonEngine.objects.get(objId);
    if (!obj) return;

    const available = Object.keys(CryonEngine.COMPONENT_DEFS)
      .filter(name => !obj.components[name]);

    const picker = document.createElement('div');
    picker.className = 'component-picker';
    picker.style.left = e.clientX + 'px';
    picker.style.top  = e.clientY + 'px';

    const search = document.createElement('input');
    search.placeholder = 'Search component...';
    picker.appendChild(search);

    const list = document.createElement('div');
    list.className = 'component-picker-list';

    const renderList = (filter) => {
      list.innerHTML = '';
      const filtered = available.filter(n => n.toLowerCase().includes(filter.toLowerCase()));
      if (filtered.length === 0) {
        list.innerHTML = `<div class="component-picker-item" style="color:var(--text-dim)">No components found</div>`;
        return;
      }
      for (const name of filtered) {
        const def = CryonEngine.COMPONENT_DEFS[name];
        const item = document.createElement('div');
        item.className = 'component-picker-item';
        item.innerHTML = `<span class="item-icon">${def?.icon ?? '⚙'}</span>${name}`;
        item.onclick = () => {
          obj.addComponent(name);
          this.rebuild(objId);
          picker.remove();
          ConsoleUI.log(`Added component: ${name} to "${obj.name}"`, 'log');
        };
        list.appendChild(item);
      }
    };

    renderList('');
    search.oninput = () => renderList(search.value);
    picker.appendChild(list);
    document.body.appendChild(picker);

    // Close when clicking outside
    setTimeout(() => {
      const close = (ev) => { if (!picker.contains(ev.target)) { picker.remove(); document.removeEventListener('mousedown', close); } };
      document.addEventListener('mousedown', close);
    }, 0);

    search.focus();
  },

  /* ─── MUTATION HANDLERS ─── */
  _rename(objId, val) {
    const obj = CryonEngine.objects.get(objId);
    if (obj) {
      obj.name = val.trim() || 'GameObject';
      window.dispatchEvent(new CustomEvent('cryon:scene-changed'));
    }
  },

  _setActive(objId, val) {
    const obj = CryonEngine.objects.get(objId);
    if (obj) obj.active = val;
  },

  _setVec3(objId, compName, key, axis, val) {
    const obj = CryonEngine.objects.get(objId);
    if (!obj) return;
    const n = parseFloat(val);
    if (!isNaN(n)) {
      obj.components[compName][key][axis] = n;
    }
  },

  _setField(objId, compName, key, val) {
    const obj = CryonEngine.objects.get(objId);
    if (!obj) return;
    const comp = obj.components[compName];
    if (!comp) return;
    if (val === 'true') val = true;
    else if (val === 'false') val = false;
    comp[key] = val;
    // Refresh color label
    if (key === 'color') this.rebuild(objId);
  },

  _removeComponent(objId, compName) {
    const obj = CryonEngine.objects.get(objId);
    if (!obj) return;
    if (obj.removeComponent(compName)) {
      this.rebuild(objId);
      ConsoleUI.log(`Removed component: ${compName} from "${obj.name}"`, 'warn');
    }
  },

  /* ─── UTILS ─── */
  _typeIcon(type) {
    return { cube: '⬡', sphere: '◉', empty: '◻' }[type] ?? '◻';
  },
  _esc(s) { return s.replace(/"/g, '&quot;'); }
};
