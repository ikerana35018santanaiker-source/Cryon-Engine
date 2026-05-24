/**
 * CRYON ENGINE — scene-manager.js
 * Handles object creation, deletion, selection, tools, and playmode
 */

'use strict';

window.SceneManager = {

  init() {
    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'w' || e.key === 'W') this.setTool('move');
      if (e.key === 'e' || e.key === 'E') this.setTool('rotate');
      if (e.key === 'r' || e.key === 'R') this.setTool('scale');
      if (e.key === 'Delete' || e.key === 'Backspace') this.deleteSelected();
      if (e.key === 'f' || e.key === 'F') this.focusSelected();
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        ProjectManager.saveCurrentProject();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        this.duplicateSelected();
      }
    });

    // Default scene objects
    this._addDefaultObjects();
    ConsoleUI.log('Cryon Engine initialized. Scene ready.', 'log');
  },

  _addDefaultObjects() {
    // Grid plane reference (not a real game object, just a visual hint — handled in renderer)
    // Create a default directional light marker
    const ground = new CryonEngine.GameObject('Main Camera', 'empty');
    ground.components.Transform.position = { x: 0, y: 3, z: -10 };
    CryonEngine.addObject(ground);
    ConsoleUI.log('Default scene created.', 'log');
  },

  createObject(type) {
    const names = {
      cube: 'Cube',
      sphere: 'Sphere',
      empty: 'GameObject'
    };
    // Count existing of same type for auto-numbering
    let count = 0;
    for (const obj of CryonEngine.objects.values()) {
      if (obj.type === type) count++;
    }
    const suffix = count > 0 ? ` (${count})` : '';
    const name = (names[type] || 'GameObject') + suffix;

    const go = new CryonEngine.GameObject(name, type);

    // Spawn slightly in front of camera
    const cam = CryonEngine.camera;
    const spawnDist = 6;
    const rad = cam.rotY * CryonEngine.Math.DEG2RAD;
    go.components.Transform.position = {
      x: cam.x + Math.sin(rad) * spawnDist + (Math.random() - 0.5) * 2,
      y: 0,
      z: cam.z + Math.cos(rad) * spawnDist + (Math.random() - 0.5) * 2
    };

    CryonEngine.addObject(go);
    CryonEngine.selectObject(go.id);
    ConsoleUI.log(`Created ${name}`, 'log');
    return go;
  },

  deleteSelected() {
    const id = CryonEngine.selectedId;
    if (!id) return;
    const obj = CryonEngine.getSelected();
    if (!obj) return;
    CryonEngine.removeObject(id);
    ConsoleUI.log(`Deleted "${obj.name}"`, 'warn');
  },

  duplicateSelected() {
    const obj = CryonEngine.getSelected();
    if (!obj) return;
    const dupe = new CryonEngine.GameObject(obj.name + ' (Copy)', obj.type);
    dupe.components = JSON.parse(JSON.stringify(obj.components));
    dupe.components.Transform.position.x += 1;
    CryonEngine.addObject(dupe);
    CryonEngine.selectObject(dupe.id);
    ConsoleUI.log(`Duplicated "${obj.name}"`, 'log');
  },

  focusSelected() {
    const obj = CryonEngine.getSelected();
    if (!obj) return;
    const pos = obj.components.Transform.position;
    const cam = CryonEngine.camera;
    const rad = cam.rotY * CryonEngine.Math.DEG2RAD;
    cam.x = pos.x - Math.sin(rad) * 8;
    cam.y = pos.y + 3;
    cam.z = pos.z - Math.cos(rad) * 8;
    window.dispatchEvent(new CustomEvent('cryon:camera-moved'));
  },

  setTool(tool) {
    CryonEngine.activeTool = tool;
    // Update toolbar UI
    document.querySelectorAll('.tool-btn[id^="tool-"]').forEach(btn => btn.classList.remove('active'));
    const btn = document.getElementById('tool-' + tool);
    if (btn) btn.classList.add('active');
    ConsoleUI.log(`Tool: ${tool}`, 'log');
    window.dispatchEvent(new CustomEvent('cryon:tool-changed', { detail: { tool } }));
  },

  togglePlay() {
    if (!CryonEngine.isPlaying) {
      CryonEngine.isPlaying = true;
      CryonEngine.isPaused = false;
      document.getElementById('btn-play').classList.add('playing');
      document.getElementById('btn-play').innerHTML = `
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <rect x="2" y="1" width="4" height="12"/><rect x="8" y="1" width="4" height="12"/>
        </svg> Stop`;
      document.getElementById('btn-pause').disabled = false;
      ConsoleUI.log('▶ Entering Play Mode', 'log');
    } else {
      CryonEngine.isPlaying = false;
      CryonEngine.isPaused = false;
      document.getElementById('btn-play').classList.remove('playing');
      document.getElementById('btn-play').innerHTML = `
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <polygon points="2,1 13,7 2,13"/>
        </svg> Play`;
      document.getElementById('btn-pause').disabled = true;
      ConsoleUI.log('■ Exiting Play Mode', 'log');
    }
  },

  togglePause() {
    if (!CryonEngine.isPlaying) return;
    CryonEngine.isPaused = !CryonEngine.isPaused;
    ConsoleUI.log(CryonEngine.isPaused ? '⏸ Paused' : '▶ Resumed', 'log');
  }
};
