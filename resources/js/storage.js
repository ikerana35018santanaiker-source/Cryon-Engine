/**
 * storage.js — Cryon Engine
 * Handles all project persistence via localStorage.
 */

const CryonStorage = (() => {
  const PROJECTS_KEY = 'cryon_projects';
  const CURRENT_KEY  = 'cryon_current_project';

  // ── Helpers ──────────────────────────────────────

  function _getAll() {
    try {
      const raw = localStorage.getItem(PROJECTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function _saveAll(projects) {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  }

  function _timestamp() {
    return new Date().toISOString();
  }

  function _generateId() {
    return 'proj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }

  // ── Project CRUD ─────────────────────────────────

  function createProject(name, description = '', template = 'empty') {
    const projects = _getAll();
    const id = _generateId();
    const project = {
      id,
      name:        name.trim(),
      description: description.trim(),
      template,
      createdAt:   _timestamp(),
      updatedAt:   _timestamp(),
      scene: {
        objects:  [],
        nextId:   1,
        settings: {
          ambientIntensity: 0.4,
          skyColor: '#0a0b0e',
          gridVisible: true,
        }
      }
    };
    projects.unshift(project);
    _saveAll(projects);
    return project;
  }

  function getAllProjects() {
    return _getAll();
  }

  function getProject(id) {
    return _getAll().find(p => p.id === id) || null;
  }

  function saveProject(project) {
    const projects = _getAll();
    const idx = projects.findIndex(p => p.id === project.id);
    if (idx === -1) return false;
    project.updatedAt = _timestamp();
    projects[idx] = project;
    _saveAll(projects);
    return true;
  }

  function deleteProject(id) {
    const projects = _getAll().filter(p => p.id !== id);
    _saveAll(projects);
    if (getCurrentProjectId() === id) {
      localStorage.removeItem(CURRENT_KEY);
    }
  }

  // ── Current Project ───────────────────────────────

  function setCurrentProject(id) {
    localStorage.setItem(CURRENT_KEY, id);
  }

  function getCurrentProjectId() {
    return localStorage.getItem(CURRENT_KEY);
  }

  function loadCurrentProject() {
    const id = getCurrentProjectId();
    return id ? getProject(id) : null;
  }

  // ── Scene helpers ─────────────────────────────────

  function saveScene(projectId, sceneData) {
    const projects = _getAll();
    const idx = projects.findIndex(p => p.id === projectId);
    if (idx === -1) return false;
    projects[idx].scene = sceneData;
    projects[idx].updatedAt = _timestamp();
    _saveAll(projects);
    return true;
  }

  return {
    createProject,
    getAllProjects,
    getProject,
    saveProject,
    deleteProject,
    setCurrentProject,
    getCurrentProjectId,
    loadCurrentProject,
    saveScene,
  };
})();
