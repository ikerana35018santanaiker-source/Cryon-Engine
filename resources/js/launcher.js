/**
 * launcher.js — Cryon Engine
 * Launcher screen: project list, project creation.
 */

const CryonLauncher = (() => {

  function init() {
    // Tab switching
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${target}`).classList.add('active');

        if (target === 'projects') _refreshList();
      });
    });

    // Template cards
    document.querySelectorAll('.template-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
    });

    // Create project
    document.getElementById('create-project-btn').addEventListener('click', _createProject);
    document.getElementById('new-project-name').addEventListener('keydown', e => {
      if (e.key === 'Enter') _createProject();
    });

    // Refresh
    document.getElementById('refresh-projects').addEventListener('click', _refreshList);

    _refreshList();
  }

  function _refreshList() {
    const list     = document.getElementById('projects-list');
    const empty    = document.getElementById('projects-empty');
    const projects = CryonStorage.getAllProjects();

    list.innerHTML = '';

    if (projects.length === 0) {
      empty.style.display = 'flex';
      return;
    }
    empty.style.display = 'none';

    projects.forEach(proj => {
      const card = document.createElement('div');
      card.className = 'project-card';

      const updated = _formatDate(proj.updatedAt);

      card.innerHTML = `
        <div class="project-card-icon">◈</div>
        <div class="project-card-info">
          <div class="project-card-name">${_esc(proj.name)}</div>
          <div class="project-card-meta">
            ${_esc(proj.template)} · Updated ${updated}
            ${proj.description ? ' · ' + _esc(proj.description) : ''}
          </div>
        </div>
        <div class="project-card-actions">
          <button class="project-action-btn open">Open</button>
          <button class="project-action-btn delete">Delete</button>
        </div>
      `;

      card.querySelector('.open').addEventListener('click', (e) => {
        e.stopPropagation();
        _openProject(proj.id);
      });

      card.querySelector('.delete').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete project "${proj.name}"? This cannot be undone.`)) {
          CryonStorage.deleteProject(proj.id);
          _refreshList();
        }
      });

      card.addEventListener('dblclick', () => _openProject(proj.id));

      list.appendChild(card);
    });
  }

  function _createProject() {
    const nameInput = document.getElementById('new-project-name');
    const descInput = document.getElementById('new-project-desc');
    const errEl     = document.getElementById('form-error');
    const template  = document.querySelector('.template-card.selected')?.dataset.template || 'empty';

    const name = nameInput.value.trim();
    if (!name) {
      errEl.textContent = 'Project name is required.';
      nameInput.focus();
      return;
    }

    errEl.textContent = '';

    const project = CryonStorage.createProject(name, descInput.value, template);
    CryonStorage.setCurrentProject(project.id);

    nameInput.value = '';
    descInput.value = '';

    CryonMain.openEditor(project);
  }

  function _openProject(id) {
    const project = CryonStorage.getProject(id);
    if (!project) return;
    CryonStorage.setCurrentProject(id);
    CryonMain.openEditor(project);
  }

  function _formatDate(iso) {
    if (!iso) return 'Unknown';
    const d = new Date(iso);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60000)  return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return d.toLocaleDateString();
  }

  function _esc(s) { return String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  return { init, refresh: _refreshList };
})();
