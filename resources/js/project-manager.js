/**
 * CRYON ENGINE — project-manager.js
 * Handles project creation, persistence (localStorage), listing, and loading.
 * Each project is stored as JSON under key: cryon_project_{id}
 * Index of all projects: cryon_projects_index
 */

'use strict';

window.ProjectManager = {
  _currentProjectId: null,
  _selectedTemplate: '3d',

  init() {
    // Template card selection
    document.querySelectorAll('.template-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this._selectedTemplate = card.dataset.template;
      });
    });

    // Load project list
    this._renderProjectList();

    // Enter key to create project
    document.getElementById('new-project-name').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.createProject();
    });
  },

  /* ── Project index helpers ── */
  _getIndex() {
    try {
      return JSON.parse(localStorage.getItem('cryon_projects_index') || '[]');
    } catch { return []; }
  },

  _saveIndex(index) {
    localStorage.setItem('cryon_projects_index', JSON.stringify(index));
  },

  _getProject(id) {
    try {
      return JSON.parse(localStorage.getItem(`cryon_project_${id}`) || 'null');
    } catch { return null; }
  },

  _saveProject(id, data) {
    localStorage.setItem(`cryon_project_${id}`, JSON.stringify(data));
  },

  _deleteProject(id) {
    localStorage.removeItem(`cryon_project_${id}`);
    const index = this._getIndex().filter(p => p.id !== id);
    this._saveIndex(index);
  },

  /* ── CREATE ── */
  createProject() {
    const nameInput = document.getElementById('new-project-name');
    let name = nameInput.value.trim();
    if (!name) {
      nameInput.style.borderColor = 'var(--red)';
      nameInput.focus();
      setTimeout(() => nameInput.style.borderColor = '', 1000);
      return;
    }

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const now = new Date().toISOString();

    const projectMeta = {
      id,
      name,
      template: this._selectedTemplate,
      created: now,
      modified: now
    };

    const projectData = {
      meta: projectMeta,
      scene: { objects: [], camera: { x: 0, y: 3, z: -10, rotX: 15, rotY: 0, fov: 60 } }
    };

    this._saveProject(id, projectData);
    const index = this._getIndex();
    index.unshift(projectMeta);
    this._saveIndex(index);

    nameInput.value = '';
    this._renderProjectList();
    this.openProject(id);
  },

  /* ── OPEN ── */
  openProject(id) {
    const data = this._getProject(id);
    if (!data) {
      alert('Project not found!');
      return;
    }

    this._currentProjectId = id;
    CryonEngine.currentProject = data.meta;

    // Load scene
    CryonEngine.sceneFromJSON(data.scene);

    // Update title bar
    document.getElementById('project-title-bar').textContent = data.meta.name;

    // Switch from launcher to editor
    document.getElementById('launcher').style.display = 'none';
    document.getElementById('editor').classList.remove('hidden');

    // Force resize
    setTimeout(() => {
      Renderer._resize();
      HierarchyUI.rebuild();
    }, 50);

    ConsoleUI.log(`Opened project: "${data.meta.name}"`, 'log');
    ConsoleUI.log(`Cryon Engine v0.1.0-alpha — Open Source`, 'log');
  },

  /* ── SAVE ── */
  saveCurrentProject() {
    if (!this._currentProjectId) return;
    const data = this._getProject(this._currentProjectId);
    if (!data) return;

    data.scene = CryonEngine.sceneToJSON();
    data.meta.modified = new Date().toISOString();
    this._saveProject(this._currentProjectId, data);

    // Update index entry
    const index = this._getIndex().map(p =>
      p.id === this._currentProjectId ? { ...p, modified: data.meta.modified } : p
    );
    this._saveIndex(index);

    ConsoleUI.log('Project saved ✓', 'log');

    // Flash indicator
    const bar = document.getElementById('project-title-bar');
    const orig = bar.textContent;
    bar.textContent = orig + ' [Saved]';
    bar.style.color = 'var(--accent)';
    setTimeout(() => { bar.textContent = orig; bar.style.color = ''; }, 1500);
  },

  /* ── BACK TO LAUNCHER ── */
  backToLauncher() {
    this.saveCurrentProject();
    document.getElementById('editor').classList.add('hidden');
    document.getElementById('launcher').style.display = 'flex';
    CryonEngine.objects.clear();
    CryonEngine.selectedId = null;
    this._currentProjectId = null;
    this._renderProjectList();
    window.dispatchEvent(new CustomEvent('cryon:scene-changed'));
  },

  /* ── RENDER LIST ── */
  _renderProjectList() {
    const list = document.getElementById('project-list');
    const index = this._getIndex();

    if (index.length === 0) {
      list.innerHTML = '<div class="project-list-empty">No projects yet. Create one →</div>';
      return;
    }

    list.innerHTML = '';
    for (const meta of index) {
      const card = document.createElement('div');
      card.className = 'project-card';
      const d = new Date(meta.modified);
      const dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
      const icon = meta.template === 'empty' ? '◻' : '⬡';

      card.innerHTML = `
        <div class="project-card-icon">${icon}</div>
        <div class="project-card-info">
          <div class="project-card-name">${this._esc(meta.name)}</div>
          <div class="project-card-date">Modified: ${dateStr}</div>
        </div>
        <button class="project-card-delete" title="Delete project"
          onclick="ProjectManager._confirmDelete('${meta.id}', event)">✕</button>`;

      card.addEventListener('click', () => this.openProject(meta.id));
      list.appendChild(card);
    }
  },

  _confirmDelete(id, e) {
    e.stopPropagation();
    const meta = this._getIndex().find(p => p.id === id);
    if (!meta) return;
    if (!confirm(`Delete project "${meta.name}"? This cannot be undone.`)) return;
    this._deleteProject(id);
    this._renderProjectList();
  },

  _esc(s) { return s.replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
};
