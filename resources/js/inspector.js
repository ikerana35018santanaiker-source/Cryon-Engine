/**
 * inspector.js — Cryon Engine
 * Renders ImGui-style component inspector for selected objects.
 */

const CryonInspector = (() => {
  let _container  = null;
  let _onChanged  = null;

  const COMPONENT_INFO = {
    Transform: { icon: '⊹', label: 'Transform' },
    Renderer:  { icon: '◈', label: 'Renderer'  },
  };

  const AVAILABLE_COMPONENTS = [
    { type: 'Renderer', icon: '◈', label: 'Renderer', category: 'Rendering' },
  ];

  function init(onChanged) {
    _container = document.getElementById('inspector-content');
    _onChanged = onChanged || (() => {});
  }

  function refresh(obj) {
    if (!_container) return;
    if (!obj) {
      _container.innerHTML = `
        <div class="inspector-empty">
          <div class="empty-icon">◈</div>
          <p>No object selected</p>
        </div>`;
      return;
    }
    _renderObject(obj);
  }

  // ── Object Header ─────────────────────────────────

  function _renderObject(obj) {
    _container.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'inspector-object-header';
    header.innerHTML = `
      <div class="inspector-obj-name-row">
        <input type="checkbox" class="inspector-obj-active" ${obj.active ? 'checked' : ''}>
        <div class="inspector-obj-icon">◈</div>
        <input class="inspector-obj-name" type="text" value="${_esc(obj.name)}" />
      </div>
      <div class="inspector-obj-tags">
        <select class="inspector-tag-select">
          <option value="Untagged" ${obj.tag === 'Untagged' ? 'selected' : ''}>Untagged</option>
          <option value="Player"   ${obj.tag === 'Player'   ? 'selected' : ''}>Player</option>
          <option value="Enemy"    ${obj.tag === 'Enemy'    ? 'selected' : ''}>Enemy</option>
          <option value="Ground"   ${obj.tag === 'Ground'   ? 'selected' : ''}>Ground</option>
        </select>
      </div>
    `;

    header.querySelector('.inspector-obj-active').addEventListener('change', e => {
      obj.active = e.target.checked;
      _onChanged(obj);
    });

    header.querySelector('.inspector-obj-name').addEventListener('input', e => {
      obj.name = e.target.value;
      _onChanged(obj);
    });

    header.querySelector('.inspector-tag-select').addEventListener('change', e => {
      obj.tag = e.target.value;
      _onChanged(obj);
    });

    _container.appendChild(header);

    // Components
    obj.components.forEach(comp => {
      _renderComponent(obj, comp);
    });

    // Add Component button
    const addBtn = document.createElement('button');
    addBtn.className = 'add-component-btn';
    addBtn.innerHTML = '+ Add Component';
    addBtn.addEventListener('click', () => _showComponentPicker(obj, addBtn));
    _container.appendChild(addBtn);
  }

  // ── Component Block ───────────────────────────────

  function _renderComponent(obj, comp) {
    const info = COMPONENT_INFO[comp.type] || { icon: '⬡', label: comp.type };

    const block = document.createElement('div');
    block.className = 'component-block';
    block.dataset.compType = comp.type;

    const header = document.createElement('div');
    header.className = 'component-header';
    header.innerHTML = `
      <span class="component-collapse-arrow open">▶</span>
      <span class="component-icon">${info.icon}</span>
      <span class="component-name">${info.label}</span>
      <button class="component-menu-btn" title="Component options">⋮</button>
    `;

    const body = document.createElement('div');
    body.className = 'component-body';

    // Collapse toggle
    const arrow = header.querySelector('.component-collapse-arrow');
    header.addEventListener('click', (e) => {
      if (e.target.classList.contains('component-menu-btn')) return;
      body.classList.toggle('collapsed');
      arrow.classList.toggle('open');
    });

    // Component menu
    header.querySelector('.component-menu-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (comp.type !== 'Transform') {
        const ok = confirm(`Remove component "${comp.type}"?`);
        if (ok) {
          CryonScene.removeComponent(obj, comp.type);
          _onChanged(obj);
          refresh(obj);
        }
      }
    });

    // Fields per component type
    if (comp.type === 'Transform') {
      body.appendChild(_renderTransform(obj, comp));
    } else if (comp.type === 'Renderer') {
      body.appendChild(_renderRenderer(obj, comp));
    }

    block.appendChild(header);
    block.appendChild(body);
    _container.appendChild(block);
  }

  // ── Transform Fields ──────────────────────────────

  function _renderTransform(obj, comp) {
    const wrapper = document.createElement('div');

    wrapper.appendChild(_vec3Row('Position', comp.position, (axis, val) => {
      comp.position[axis] = val;
      CryonScene.syncObjectToMesh(obj);
      _onChanged(obj);
    }));

    wrapper.appendChild(_vec3Row('Rotation', comp.rotation, (axis, val) => {
      comp.rotation[axis] = val;
      CryonScene.syncObjectToMesh(obj);
      _onChanged(obj);
    }));

    wrapper.appendChild(_vec3Row('Scale', comp.scale, (axis, val) => {
      comp.scale[axis] = val;
      CryonScene.syncObjectToMesh(obj);
      _onChanged(obj);
    }));

    return wrapper;
  }

  // ── Renderer Fields ───────────────────────────────

  function _renderRenderer(obj, comp) {
    const wrapper = document.createElement('div');

    // Mesh Type
    wrapper.appendChild(_selectRow('Mesh', ['cube', 'sphere'], comp.meshType, (val) => {
      comp.meshType = val;
      CryonScene.syncObjectToMesh(obj);
      _onChanged(obj, true); // full sync (rebuild mesh)
    }));

    // Color
    wrapper.appendChild(_colorRow('Color', comp.color, (val) => {
      comp.color = val;
      CryonScene.syncObjectToMesh(obj);
      _onChanged(obj);
    }));

    // Wireframe toggle
    wrapper.appendChild(_toggleRow('Wireframe', comp.wireframe, (val) => {
      comp.wireframe = val;
      CryonScene.syncObjectToMesh(obj);
      _onChanged(obj);
    }));

    // Cast Shadow toggle
    wrapper.appendChild(_toggleRow('Cast Shadow', comp.castShadow, (val) => {
      comp.castShadow = val;
      if (obj._mesh) obj._mesh.castShadow = val;
      _onChanged(obj);
    }));

    return wrapper;
  }

  // ── Field Builders ────────────────────────────────

  function _vec3Row(label, vec, onChange) {
    const row = document.createElement('div');
    row.className = 'field-row';
    row.innerHTML = `<span class="field-label">${label}</span><div class="field-inputs"></div>`;
    const inputs = row.querySelector('.field-inputs');

    ['x', 'y', 'z'].forEach(axis => {
      const wrap = document.createElement('div');
      wrap.className = 'axis-input';
      wrap.innerHTML = `
        <span class="axis-label ${axis}">${axis.toUpperCase()}</span>
        <input type="number" value="${_round(vec[axis])}" step="0.1" />
      `;
      const input = wrap.querySelector('input');
      input.addEventListener('change', () => {
        const val = parseFloat(input.value) || 0;
        vec[axis] = val;
        onChange(axis, val);
      });
      inputs.appendChild(wrap);
    });

    return row;
  }

  function _colorRow(label, value, onChange) {
    const row = document.createElement('div');
    row.className = 'field-row';
    row.innerHTML = `<span class="field-label">${label}</span><div class="field-inputs"></div>`;
    const inputs = row.querySelector('.field-inputs');

    const colorField = document.createElement('div');
    colorField.className = 'color-field';

    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.style.background = value;
    swatch.innerHTML = `<input type="color" value="${value}" />`;

    const hex = document.createElement('input');
    hex.className  = 'color-hex-input';
    hex.type       = 'text';
    hex.value      = value;
    hex.maxLength  = 7;

    const colorInput = swatch.querySelector('input');
    colorInput.addEventListener('input', () => {
      swatch.style.background = colorInput.value;
      hex.value = colorInput.value;
      onChange(colorInput.value);
    });

    hex.addEventListener('change', () => {
      const v = hex.value.startsWith('#') ? hex.value : '#' + hex.value;
      colorInput.value = v;
      swatch.style.background = v;
      onChange(v);
    });

    colorField.appendChild(swatch);
    colorField.appendChild(hex);
    inputs.appendChild(colorField);
    return row;
  }

  function _selectRow(label, options, current, onChange) {
    const row = document.createElement('div');
    row.className = 'field-row';
    const opts = options.map(o => `<option value="${o}" ${o === current ? 'selected' : ''}>${o}</option>`).join('');
    row.innerHTML = `
      <span class="field-label">${label}</span>
      <div class="field-inputs">
        <select class="field-select">${opts}</select>
      </div>`;
    row.querySelector('select').addEventListener('change', e => onChange(e.target.value));
    return row;
  }

  function _toggleRow(label, value, onChange) {
    const row = document.createElement('div');
    row.className = 'field-row';
    row.innerHTML = `
      <span class="field-label">${label}</span>
      <div class="field-inputs">
        <div class="field-toggle ${value ? 'on' : ''}">
          <div class="field-toggle-knob"></div>
        </div>
      </div>`;
    const toggle = row.querySelector('.field-toggle');
    let state = value;
    toggle.addEventListener('click', () => {
      state = !state;
      toggle.classList.toggle('on', state);
      onChange(state);
    });
    return row;
  }

  // ── Component Picker ──────────────────────────────

  function _showComponentPicker(obj, anchorEl) {
    document.querySelectorAll('.component-picker').forEach(p => p.remove());

    const picker = document.createElement('div');
    picker.className = 'component-picker';

    const search = document.createElement('input');
    search.type  = 'text';
    search.className = 'component-picker-search';
    search.placeholder = 'Search components...';
    picker.appendChild(search);

    function renderItems(filter = '') {
      picker.querySelectorAll('.component-picker-cat, .component-picker-item').forEach(el => el.remove());

      const filtered = AVAILABLE_COMPONENTS.filter(c =>
        c.label.toLowerCase().includes(filter.toLowerCase()) &&
        !CryonScene.hasComponent(obj, c.type)
      );

      if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'padding:8px 10px; color:var(--text-muted); font-size:11px;';
        empty.textContent = 'No components available';
        picker.appendChild(empty);
        return;
      }

      // Group by category
      const cats = {};
      filtered.forEach(c => {
        if (!cats[c.category]) cats[c.category] = [];
        cats[c.category].push(c);
      });

      Object.entries(cats).forEach(([cat, items]) => {
        const catEl = document.createElement('div');
        catEl.className = 'component-picker-cat';
        catEl.textContent = cat;
        picker.appendChild(catEl);

        items.forEach(item => {
          const el = document.createElement('div');
          el.className = 'component-picker-item';
          el.innerHTML = `<span class="cpi-icon">${item.icon}</span> ${item.label}`;
          el.addEventListener('click', () => {
            CryonScene.addComponent(obj, item.type);
            _onChanged(obj, true);
            refresh(obj);
            picker.remove();
          });
          picker.appendChild(el);
        });
      });
    }

    renderItems();
    search.addEventListener('input', () => renderItems(search.value));

    // Position picker
    const rect  = anchorEl.getBoundingClientRect();
    picker.style.left   = rect.left + 'px';
    picker.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
    document.body.appendChild(picker);

    // Close on outside click
    const close = (e) => {
      if (!picker.contains(e.target) && e.target !== anchorEl) {
        picker.remove();
        document.removeEventListener('click', close, true);
      }
    };
    setTimeout(() => document.addEventListener('click', close, true), 10);
    search.focus();
  }

  // ── Utilities ─────────────────────────────────────

  function _round(n) { return Math.round(n * 1000) / 1000; }
  function _esc(s)   { return String(s).replace(/"/g, '&quot;'); }

  return { init, refresh };
})();
