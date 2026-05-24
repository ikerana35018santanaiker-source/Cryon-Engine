/**
 * viewport.js — Cryon Engine
 * Three.js viewport: rendering, camera controls, object picking,
 * transform gizmos (translate / rotate / scale).
 */

const CryonViewport = (() => {

  // ── Three.js Core ─────────────────────────────────
  let renderer, scene3, camera, ambientLight, dirLight;
  let canvas, wrapper;
  let animId = null;

  // ── Camera Controls ──────────────────────────────
  let orbit = {
    target: new THREE.Vector3(0, 0, 0),
    theta:  45,   // horizontal angle
    phi:    35,   // vertical angle
    radius: 10,
    panning: false,
    orbiting: false,
  };

  // ── Gizmo ─────────────────────────────────────────
  let gizmoCanvas, gizmoCtx, gizmoCamera, gizmoScene, gizmoRenderer;

  // ── Grid ──────────────────────────────────────────
  let gridHelper;

  // ── Selection / Raycasting ────────────────────────
  const raycaster = new THREE.Raycaster();
  const mouse     = new THREE.Vector2();
  let _onSelect   = null;

  // ── Active Transform Tool ─────────────────────────
  let activeTool = 'translate'; // 'translate' | 'rotate' | 'scale'

  // ── Transform Drag ────────────────────────────────
  let isDragging = false;
  let dragStart  = { x: 0, y: 0 };
  let dragObj    = null;
  let dragPlane  = new THREE.Plane();
  let dragOffset = new THREE.Vector3();
  let dragAxis   = null; // 'x'|'y'|'z'|null

  // ── Wireframe global ─────────────────────────────
  let wireframeGlobal = false;

  // ── Selection highlight ───────────────────────────
  let outlineMesh = null;

  // ─────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────

  function init(onSelect) {
    _onSelect = onSelect || (() => {});
    canvas  = document.getElementById('viewport-canvas');
    wrapper = document.getElementById('viewport-area');

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    renderer.outputEncoding    = THREE.sRGBEncoding;
    renderer.setClearColor(0x0a0b0e);

    // Scene
    scene3 = new THREE.Scene();
    scene3.fog = new THREE.FogExp2(0x0a0b0e, 0.04);

    // Camera
    camera = new THREE.PerspectiveCamera(60, 1, 0.01, 1000);
    _updateCameraFromOrbit();

    // Lights
    ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene3.add(ambientLight);

    dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(5, 10, 7);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far  = 100;
    dirLight.shadow.camera.left = dirLight.shadow.camera.bottom = -20;
    dirLight.shadow.camera.right = dirLight.shadow.camera.top   =  20;
    scene3.add(dirLight);

    // Grid
    gridHelper = new THREE.GridHelper(20, 20, 0x2a2d38, 0x1e2028);
    scene3.add(gridHelper);

    // Axis lines (thin coloured)
    const axMat = (c) => new THREE.LineBasicMaterial({ color: c });
    const line  = (pts, mat) => {
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      return new THREE.Line(geo, mat);
    };
    scene3.add(line([new THREE.Vector3(-10,0,0), new THREE.Vector3(10,0,0)], axMat(0x3a1a1a)));
    scene3.add(line([new THREE.Vector3(0,-10,0), new THREE.Vector3(0,10,0)], axMat(0x1a3a1a)));
    scene3.add(line([new THREE.Vector3(0,0,-10), new THREE.Vector3(0,0,10)], axMat(0x1a1a3a)));

    // Gizmo
    _initGizmo();

    // Events
    _bindEvents();

    // Resize
    const ro = new ResizeObserver(_resize);
    ro.observe(wrapper);
    _resize();

    // Start render loop
    _loop();

    // Init CryonScene with the Three scene
    CryonScene.init(scene3);
  }

  // ─────────────────────────────────────────────────
  // GIZMO (corner orientation indicator)
  // ─────────────────────────────────────────────────

  function _initGizmo() {
    gizmoCanvas   = document.getElementById('gizmo-canvas');
    gizmoCtx      = gizmoCanvas.getContext('2d');
  }

  function _drawGizmo() {
    const size = gizmoCanvas.width;
    const cx = size / 2, cy = size / 2;
    gizmoCtx.clearRect(0, 0, size, size);

    // Project unit vectors using camera
    const axes = [
      { dir: new THREE.Vector3(1, 0, 0), color: '#f04a6a', label: 'X' },
      { dir: new THREE.Vector3(0, 1, 0), color: '#4af07a', label: 'Y' },
      { dir: new THREE.Vector3(0, 0, 1), color: '#4ab0f0', label: 'Z' },
    ];

    axes.forEach(ax => {
      const v = ax.dir.clone().project(camera);
      const ex = cx + v.x * (cx - 10);
      const ey = cy - v.y * (cy - 10);

      // Line
      gizmoCtx.beginPath();
      gizmoCtx.strokeStyle = ax.color;
      gizmoCtx.lineWidth   = 2;
      gizmoCtx.moveTo(cx, cy);
      gizmoCtx.lineTo(ex, ey);
      gizmoCtx.stroke();

      // Dot
      gizmoCtx.beginPath();
      gizmoCtx.fillStyle = ax.color;
      gizmoCtx.arc(ex, ey, 4, 0, Math.PI * 2);
      gizmoCtx.fill();

      // Label
      gizmoCtx.fillStyle = ax.color;
      gizmoCtx.font = 'bold 9px JetBrains Mono, monospace';
      gizmoCtx.fillText(ax.label, ex + 5, ey + 4);
    });

    // Center dot
    gizmoCtx.beginPath();
    gizmoCtx.fillStyle = '#888';
    gizmoCtx.arc(cx, cy, 3, 0, Math.PI * 2);
    gizmoCtx.fill();
  }

  // ─────────────────────────────────────────────────
  // CAMERA / ORBIT
  // ─────────────────────────────────────────────────

  function _updateCameraFromOrbit() {
    const thetaR = THREE.MathUtils.degToRad(orbit.theta);
    const phiR   = THREE.MathUtils.degToRad(orbit.phi);
    camera.position.set(
      orbit.target.x + orbit.radius * Math.cos(phiR) * Math.sin(thetaR),
      orbit.target.y + orbit.radius * Math.sin(phiR),
      orbit.target.z + orbit.radius * Math.cos(phiR) * Math.cos(thetaR)
    );
    camera.lookAt(orbit.target);
  }

  function setView(preset) {
    if (preset === 'perspective') { orbit.theta = 45; orbit.phi = 35; orbit.radius = 10; }
    if (preset === 'top')        { orbit.theta = 0;  orbit.phi = 89; orbit.radius = 12; }
    if (preset === 'front')      { orbit.theta = 0;  orbit.phi = 0;  orbit.radius = 10; }
    _updateCameraFromOrbit();
  }

  // ─────────────────────────────────────────────────
  // EVENT BINDING
  // ─────────────────────────────────────────────────

  function _bindEvents() {
    canvas.addEventListener('mousedown', _onMouseDown);
    window.addEventListener('mousemove', _onMouseMove);
    window.addEventListener('mouseup',   _onMouseUp);
    canvas.addEventListener('wheel',     _onWheel, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // Keyboard shortcuts
    window.addEventListener('keydown', e => {
      if (document.activeElement.tagName === 'INPUT' ||
          document.activeElement.tagName === 'TEXTAREA') return;
      if (e.key === 'w' || e.key === 'W') setTool('translate');
      if (e.key === 'e' || e.key === 'E') setTool('rotate');
      if (e.key === 'r' || e.key === 'R') setTool('scale');
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const sel = CryonScene.getSelected();
        if (sel) {
          CryonScene.removeObject(sel.id);
          _onSelect(null);
          CryonHierarchy.refresh();
        }
      }
      if (e.key === 'f' || e.key === 'F') {
        const sel = CryonScene.getSelected();
        if (sel) {
          const t = CryonScene.getComponent(sel, 'Transform');
          if (t) orbit.target.set(t.position.x, t.position.y, t.position.z);
          _updateCameraFromOrbit();
        }
      }
    });
  }

  let _lastMouseBtn = -1;
  let _pointerStart = { x: 0, y: 0 };
  let _mouseMoved = false;

  function _onMouseDown(e) {
    _lastMouseBtn   = e.button;
    _pointerStart   = { x: e.clientX, y: e.clientY };
    _mouseMoved     = false;

    if (e.button === 2) { // right click → orbit
      orbit.orbiting = true;
      canvas.style.cursor = 'grabbing';
    }

    if (e.button === 1) { // middle click → pan
      e.preventDefault();
      orbit.panning = true;
      canvas.style.cursor = 'move';
    }

    if (e.button === 0) { // left click
      // Check if clicking on selected object for drag
      const sel = CryonScene.getSelected();
      if (sel && sel._mesh) {
        const hit = _raycast([sel._mesh]);
        if (hit) {
          _startDrag(e, sel);
          return;
        }
      }
    }
  }

  function _onMouseMove(e) {
    const dx = e.clientX - _pointerStart.x;
    const dy = e.clientY - _pointerStart.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) _mouseMoved = true;

    if (orbit.orbiting) {
      orbit.theta -= dx * 0.4;
      orbit.phi   += dy * 0.4;
      orbit.phi    = Math.max(-89, Math.min(89, orbit.phi));
      _pointerStart = { x: e.clientX, y: e.clientY };
      _updateCameraFromOrbit();
    }

    if (orbit.panning) {
      const right = new THREE.Vector3();
      const up    = new THREE.Vector3();
      camera.getWorldDirection(new THREE.Vector3());
      right.crossVectors(camera.getWorldDirection(new THREE.Vector3()), camera.up).normalize();
      up.copy(camera.up);
      const speed = orbit.radius * 0.001;
      orbit.target.addScaledVector(right, -dx * speed);
      orbit.target.addScaledVector(up,     dy * speed);
      _pointerStart = { x: e.clientX, y: e.clientY };
      _updateCameraFromOrbit();
    }

    if (isDragging && dragObj) {
      _updateDrag(e);
    }
  }

  function _onMouseUp(e) {
    orbit.orbiting = false;
    orbit.panning  = false;
    canvas.style.cursor = 'default';

    if (isDragging) {
      _endDrag();
      return;
    }

    // Click (no movement) → selection
    if (e.button === 0 && !_mouseMoved) {
      _pickObject(e);
    }
  }

  function _onWheel(e) {
    e.preventDefault();
    orbit.radius *= 1 + e.deltaY * 0.001;
    orbit.radius  = Math.max(0.5, Math.min(200, orbit.radius));
    _updateCameraFromOrbit();
  }

  // ─────────────────────────────────────────────────
  // RAYCASTING / PICKING
  // ─────────────────────────────────────────────────

  function _getMouseNDC(e) {
    const rect = canvas.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width)  * 2 - 1,
      -((e.clientY - rect.top)  / rect.height) * 2 + 1
    );
  }

  function _raycast(objects) {
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(objects, false);
    return hits.length > 0 ? hits[0] : null;
  }

  function _pickObject(e) {
    mouse.copy(_getMouseNDC(e));
    raycaster.setFromCamera(mouse, camera);

    const meshes = CryonScene.getAllObjects()
      .filter(o => o._mesh)
      .map(o => o._mesh);

    const hits = raycaster.intersectObjects(meshes, false);

    if (hits.length > 0) {
      const mesh  = hits[0].object;
      const cryonId = mesh.userData.cryonId;
      const obj   = CryonScene.getObject(cryonId);
      CryonScene.select(obj ? obj.id : null);
      _onSelect(obj);
    } else {
      CryonScene.select(null);
      _onSelect(null);
    }

    CryonHierarchy.refresh();
    _updateSelectionHighlight();
  }

  // ─────────────────────────────────────────────────
  // TRANSFORM DRAG
  // ─────────────────────────────────────────────────

  function _startDrag(e, obj) {
    isDragging = true;
    dragObj    = obj;
    dragStart  = { x: e.clientX, y: e.clientY };
    canvas.style.cursor = 'crosshair';
  }

  function _updateDrag(e) {
    if (!dragObj || !dragObj._mesh) return;

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    dragStart = { x: e.clientX, y: e.clientY };

    const t = CryonScene.getComponent(dragObj, 'Transform');
    if (!t) return;

    const speed = orbit.radius * 0.003;

    if (activeTool === 'translate') {
      if (e.shiftKey) {
        // Move on Y axis when shift held
        t.position.y += -dy * speed;
      } else {
        // Move on XZ plane
        const right = new THREE.Vector3();
        right.crossVectors(camera.getWorldDirection(new THREE.Vector3()), camera.up).normalize();
        const forward = new THREE.Vector3(right.z, 0, -right.x).normalize();

        t.position.x += right.x   * dx * speed + forward.x * (-dy * speed);
        t.position.z += right.z   * dx * speed + forward.z * (-dy * speed);
      }
    } else if (activeTool === 'rotate') {
      t.rotation.y += dx * 0.5;
      t.rotation.x += dy * 0.5;
    } else if (activeTool === 'scale') {
      const delta = 1 + (dx - dy) * 0.005;
      t.scale.x *= delta;
      t.scale.y *= delta;
      t.scale.z *= delta;
      t.scale.x = Math.max(0.001, t.scale.x);
      t.scale.y = Math.max(0.001, t.scale.y);
      t.scale.z = Math.max(0.001, t.scale.z);
    }

    CryonScene.syncObjectToMesh(dragObj);
    _onSelect(dragObj); // refresh inspector
  }

  function _endDrag() {
    isDragging = false;
    dragObj    = null;
    canvas.style.cursor = 'default';
  }

  // ─────────────────────────────────────────────────
  // SELECTION HIGHLIGHT
  // ─────────────────────────────────────────────────

  function _updateSelectionHighlight() {
    // Remove old outline
    if (outlineMesh) {
      scene3.remove(outlineMesh);
      outlineMesh.geometry.dispose();
      outlineMesh.material.dispose();
      outlineMesh = null;
    }

    const sel = CryonScene.getSelected();
    if (!sel || !sel._mesh) return;

    const outlineGeo = sel._mesh.geometry.clone();
    const outlineMat = new THREE.MeshBasicMaterial({
      color: 0x4af0d0,
      side: THREE.BackSide,
    });
    outlineMesh = new THREE.Mesh(outlineGeo, outlineMat);
    outlineMesh.position.copy(sel._mesh.position);
    outlineMesh.rotation.copy(sel._mesh.rotation);
    outlineMesh.scale.copy(sel._mesh.scale).multiplyScalar(1.05);
    outlineMesh.userData.isOutline = true;
    scene3.add(outlineMesh);
  }

  function refreshHighlight() {
    _updateSelectionHighlight();
  }

  // ─────────────────────────────────────────────────
  // TOOLS
  // ─────────────────────────────────────────────────

  function setTool(tool) {
    activeTool = tool;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`tool-${tool}`);
    if (btn) btn.classList.add('active');
  }

  // ─────────────────────────────────────────────────
  // RESIZE
  // ─────────────────────────────────────────────────

  function _resize() {
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight - 28; // minus toolbar
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // ─────────────────────────────────────────────────
  // WIREFRAME TOGGLE
  // ─────────────────────────────────────────────────

  function toggleWireframe() {
    wireframeGlobal = !wireframeGlobal;
    CryonScene.getAllObjects().forEach(obj => {
      if (obj._mesh) {
        obj._mesh.material.wireframe = wireframeGlobal;
      }
    });
    return wireframeGlobal;
  }

  function toggleGrid() {
    gridHelper.visible = !gridHelper.visible;
    return gridHelper.visible;
  }

  // ─────────────────────────────────────────────────
  // RENDER LOOP
  // ─────────────────────────────────────────────────

  function _loop() {
    animId = requestAnimationFrame(_loop);

    // Sync outline if selected
    const sel = CryonScene.getSelected();
    if (outlineMesh && sel && sel._mesh) {
      outlineMesh.position.copy(sel._mesh.position);
      outlineMesh.rotation.copy(sel._mesh.rotation);
      const s = sel._mesh.scale;
      outlineMesh.scale.set(s.x * 1.05, s.y * 1.05, s.z * 1.05);
    }

    renderer.render(scene3, camera);
    _drawGizmo();
  }

  function getScene() { return scene3; }

  return {
    init,
    setTool,
    setView,
    toggleWireframe,
    toggleGrid,
    refreshHighlight,
    getScene,
  };
})();
