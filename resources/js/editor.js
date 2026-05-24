/**
 * editor.js — Cryon Engine
 * Main editor controller — wires together viewport, hierarchy,
 * inspector, scene, and project save/load.
 */

const CryonEditor = (() => {
  let _currentProject = null;
  let _saveTimer      = null;

  // ─────────────────────────────────────────────────
  // OPEN PROJECT
  // ─────────────────────────────────────────────────

  function openProject(project) {
    _currentProject = project;

    // Update title
    document.getElementById('current-project-name').textContent = project.name;
    document.title = `${project.name} — Cryon Engine`;

    // Clear scene
    CryonScene.clear();

    // Load saved scene data
    if (project.scene) {
      CryonScene.deserialize(project.scene);
    }

    // Refresh panels
    CryonHierarchy.refresh();
    CryonInspector.refresh(null);

    // Log
    CryonConsole.success(`Opened project: "${project.name}"`);
    CryonConsole.info('Scene loaded. Ready.');
  }

  // ─────────────────────────────────────────────────
  // SAVE (debounced)
  // ─────────────────────────────────────────────────

  function _scheduleAutoSave() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(_save, 1500);
  }

  function _save() {
    if (!_currentProject) return;
    _currentProject.scene = CryonScene.serialize();
    CryonStorage.saveProject(_currentProject);
  }

  // ─────────────────────────────────────────────────
  // OBJECT OPERATIONS
  // ─────────────────────────────────────────────────

  function addObject(type) {
    const obj = CryonScene.addObject(type);
    CryonScene.select(obj.id);
    CryonHierarchy.refresh();
    CryonInspector.refresh(obj);
    CryonViewport.refreshHighlight();
    CryonConsole.log(`Created ${type}: "${obj.name}"`);
    _scheduleAutoSave();
    return obj;
  }

  function deleteObject(id) {
    const obj = CryonScene.getObject(id);
    const name = obj ? obj.name : id;
    CryonScene.removeObject(id);
    CryonHierarchy.refresh();
    CryonInspector.refresh(null);
    CryonViewport.refreshHighlight();
    CryonConsole.log(`Deleted object: "${name}"`);
    _scheduleAutoSave();
  }

  function selectObject(obj) {
    CryonInspector.refresh(obj);
    CryonViewport.refreshHighlight();
    _updateSelectionInfo(obj);
  }

  function _updateSelectionInfo(obj) {
    const el   = document.getElementById('selection-info');
    const text = document.getElementById('selection-info-text');
    if (obj) {
      const t = CryonScene.getComponent(obj, 'Transform');
      text.textContent = t
        ? `${obj.name}  ·  x:${_r(t.position.x)} y:${_r(t.position.y)} z:${_r(t.position.z)}`
        : obj.name;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }

  function _r(n) { return Math.round(n * 100) / 100; }

  // ─────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────

  function init() {
    // Viewport
    CryonViewport.init((obj) => {
      selectObject(obj);
      // If dragging, auto-save
      _scheduleAutoSave();
    });

    // Hierarchy
    CryonHierarchy.init(
      (obj) => selectObject(obj),
      (id)  => deleteObject(id)
    );

    // Inspector
    CryonInspector.init((obj, rebuild) => {
      if (rebuild) {
        // Rebuild mesh (e.g. mesh type changed)
        CryonScene.syncObjectToMesh(obj);
        CryonViewport.refreshHighlight();
      }
      CryonHierarchy.refresh();
      _updateSelectionInfo(obj);
      _scheduleAutoSave();
    });

    // Tool buttons
    document.getElementById('tool-translate').addEventListener('click', () => CryonViewport.setTool('translate'));
    document.getElementById('tool-rotate').addEventListener('click',    () => CryonViewport.setTool('rotate'));
    document.getElementById('tool-scale').addEventListener('click',     () => CryonViewport.setTool('scale'));

    // Viewport toolbar
    document.getElementById('vp-perspective').addEventListener('click', () => {
      CryonViewport.setView('perspective');
      _setVpBtnActive('vp-perspective');
    });
    document.getElementById('vp-top').addEventListener('click', () => {
      CryonViewport.setView('top');
      _setVpBtnActive('vp-top');
    });
    document.getElementById('vp-front').addEventListener('click', () => {
      CryonViewport.setView('front');
      _setVpBtnActive('vp-front');
    });
    document.getElementById('vp-wireframe').addEventListener('click', () => {
      const on = CryonViewport.toggleWireframe();
      document.getElementById('vp-wireframe').textContent = on ? 'Solid' : 'Wireframe';
    });
    document.getElementById('vp-grid-toggle').addEventListener('click', () => {
      const on = CryonViewport.toggleGrid();
      document.getElementById('vp-grid-toggle').textContent = on ? 'Grid ✓' : 'Grid ✗';
    });

    // Hierarchy add button → show dropdown
    document.getElementById('hierarchy-add').addEventListener('click', (e) => {
      e.stopPropagation();
      const dd = document.getElementById('dropdown-gameobject');
      dd.classList.toggle('hidden');
      if (!dd.classList.contains('hidden')) {
        const rect = e.target.getBoundingClientRect();
        dd.style.left = rect.left + 'px';
        dd.style.top  = (rect.bottom + 4) + 'px';
      }
    });

    // Menu bar dropdowns
    document.querySelectorAll('.menu-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = btn.dataset.menu;
        if (menu === 'gameobject') {
          const dd = document.getElementById('dropdown-gameobject');
          dd.classList.toggle('hidden');
          if (!dd.classList.contains('hidden')) {
            const rect = btn.getBoundingClientRect();
            dd.style.left = rect.left + 'px';
            dd.style.top  = (rect.bottom + 2) + 'px';
          }
        }
      });
    });

    // Close dropdowns on outside click
    document.addEventListener('click', () => {
      document.getElementById('dropdown-gameobject').classList.add('hidden');
    });

    // GameObject creation
    document.getElementById('create-cube').addEventListener('click', () => {
      addObject('cube');
      document.getElementById('dropdown-gameobject').classList.add('hidden');
    });
    document.getElementById('create-sphere').addEventListener('click', () => {
      addObject('sphere');
      document.getElementById('dropdown-gameobject').classList.add('hidden');
    });
    document.getElementById('create-empty').addEventListener('click', () => {
      addObject('empty');
      document.getElementById('dropdown-gameobject').classList.add('hidden');
    });

    // Bottom panel tabs
    document.querySelectorAll('.bottom-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.panel;
        document.querySelectorAll('.bottom-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.bottom-panel-content').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`panel-${target}`).classList.add('active');
      });
    });

    // Play buttons (stub)
    document.getElementById('play-btn').addEventListener('click', () => {
      CryonConsole.warn('Play mode not yet implemented.');
    });

    // Back to launcher
    document.getElementById('back-to-launcher').addEventListener('click', () => {
      _save();
      CryonMain.showLauncher();
    });
  }

  function _setVpBtnActive(id) {
    document.querySelectorAll('.vp-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  return { init, openProject };
})();
