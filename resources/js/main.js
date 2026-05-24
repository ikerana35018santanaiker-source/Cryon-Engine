/**
 * main.js — Cryon Engine
 * Entry point — initialises all systems and handles screen transitions.
 */

const CryonMain = (() => {
  let _editorInitialized = false;

  function init() {
    // Boot console first
    CryonConsole.init();
    CryonConsole.info('Cryon Engine v0.1.0 booting...');

    // Init launcher
    CryonLauncher.init();

    // Check if there's a recent project to restore
    const lastId = CryonStorage.getCurrentProjectId();
    if (lastId) {
      const project = CryonStorage.getProject(lastId);
      if (project) {
        CryonConsole.info(`Restoring last project: "${project.name}"`);
        // Small delay for launcher animation
        setTimeout(() => openEditor(project), 100);
        return;
      }
    }

    CryonConsole.success('Ready. Create or open a project to begin.');
    showLauncher();
  }

  function showLauncher() {
    document.getElementById('launcher').classList.add('active');
    document.getElementById('editor').classList.remove('active');
    CryonLauncher.refresh();
  }

  function openEditor(project) {
    document.getElementById('launcher').classList.remove('active');
    document.getElementById('editor').classList.add('active');

    if (!_editorInitialized) {
      CryonEditor.init();
      _editorInitialized = true;
      CryonConsole.info('Editor initialized.');
    }

    CryonEditor.openProject(project);
  }

  return { init, showLauncher, openEditor };
})();

// ── Boot ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  CryonMain.init();
});
