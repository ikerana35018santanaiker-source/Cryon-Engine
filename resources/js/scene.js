/**
 * scene.js — Cryon Engine
 * Scene graph: manages CryonObjects with components.
 */

const CryonScene = (() => {
  let _objects = [];    // Array of CryonObject
  let _nextId  = 1;
  let _selectedId = null;
  let _threeScene = null;

  // ── CryonObject Factory ──────────────────────────

  function createObject(name, type = 'empty') {
    const id = _nextId++;
    const obj = {
      id,
      name:       name || `GameObject (${id})`,
      active:     true,
      tag:        'Untagged',
      type,       // 'empty' | 'cube' | 'sphere'
      components: [],
      _mesh:      null,   // THREE.Mesh reference
    };

    // Add default components
    obj.components.push(createTransformComponent());
    if (type !== 'empty') {
      obj.components.push(createRendererComponent(type));
    }

    return obj;
  }

  // ── Component Factories ───────────────────────────

  function createTransformComponent() {
    return {
      type:      'Transform',
      enabled:   true,
      position:  { x: 0, y: 0, z: 0 },
      rotation:  { x: 0, y: 0, z: 0 },
      scale:     { x: 1, y: 1, z: 1 },
    };
  }

  function createRendererComponent(meshType = 'cube') {
    return {
      type:        'Renderer',
      enabled:     true,
      meshType,    // 'cube' | 'sphere'
      color:       '#4af0d0',
      wireframe:   false,
      castShadow:  true,
      receiveShadow: true,
    };
  }

  // ── Component Helpers ─────────────────────────────

  function getComponent(obj, type) {
    return obj.components.find(c => c.type === type) || null;
  }

  function hasComponent(obj, type) {
    return obj.components.some(c => c.type === type);
  }

  function addComponent(obj, type) {
    if (hasComponent(obj, type)) return null;
    let comp = null;
    if (type === 'Transform') comp = createTransformComponent();
    if (type === 'Renderer')  comp = createRendererComponent();
    if (comp) {
      obj.components.push(comp);
      _syncMesh(obj);
    }
    return comp;
  }

  function removeComponent(obj, type) {
    if (type === 'Transform') return; // Can't remove Transform
    obj.components = obj.components.filter(c => c.type !== type);
    _syncMesh(obj);
  }

  // ── Scene Mesh Sync ───────────────────────────────

  function _buildMesh(obj) {
    const renderer = getComponent(obj, 'Renderer');
    if (!renderer || !_threeScene) return;

    const geo = renderer.meshType === 'sphere'
      ? new THREE.SphereGeometry(0.5, 32, 32)
      : new THREE.BoxGeometry(1, 1, 1);

    const mat = new THREE.MeshStandardMaterial({
      color:     new THREE.Color(renderer.color),
      wireframe: renderer.wireframe,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow    = renderer.castShadow;
    mesh.receiveShadow = renderer.receiveShadow;
    mesh.userData.cryonId = obj.id;

    _applyTransformToMesh(obj, mesh);

    obj._mesh = mesh;
    _threeScene.add(mesh);
  }

  function _destroyMesh(obj) {
    if (obj._mesh && _threeScene) {
      _threeScene.remove(obj._mesh);
      obj._mesh.geometry.dispose();
      obj._mesh.material.dispose();
      obj._mesh = null;
    }
  }

  function _syncMesh(obj) {
    _destroyMesh(obj);
    if (hasComponent(obj, 'Renderer')) {
      _buildMesh(obj);
    }
  }

  function _applyTransformToMesh(obj, mesh) {
    const t = getComponent(obj, 'Transform');
    if (!t || !mesh) return;
    mesh.position.set(t.position.x, t.position.y, t.position.z);
    mesh.rotation.set(
      THREE.MathUtils.degToRad(t.rotation.x),
      THREE.MathUtils.degToRad(t.rotation.y),
      THREE.MathUtils.degToRad(t.rotation.z)
    );
    mesh.scale.set(t.scale.x, t.scale.y, t.scale.z);
  }

  function syncObjectToMesh(obj) {
    _applyTransformToMesh(obj, obj._mesh);
    const renderer = getComponent(obj, 'Renderer');
    if (renderer && obj._mesh) {
      obj._mesh.material.color.set(renderer.color);
      obj._mesh.material.wireframe = renderer.wireframe;
    }
  }

  // ── Public API ────────────────────────────────────

  function init(threeScene) {
    _threeScene = threeScene;
  }

  function addObject(type = 'empty', name = null) {
    const label = name || (type === 'cube' ? 'Cube' : type === 'sphere' ? 'Sphere' : 'GameObject');
    const obj = createObject(`${label} (${_nextId})`, type);
    _objects.push(obj);
    if (type !== 'empty') {
      _buildMesh(obj);
    }
    return obj;
  }

  function removeObject(id) {
    const obj = _objects.find(o => o.id === id);
    if (!obj) return;
    _destroyMesh(obj);
    _objects = _objects.filter(o => o.id !== id);
    if (_selectedId === id) _selectedId = null;
  }

  function getObject(id) {
    return _objects.find(o => o.id === id) || null;
  }

  function getAllObjects() {
    return _objects;
  }

  function select(id) {
    _selectedId = id;
  }

  function getSelected() {
    return _selectedId !== null ? getObject(_selectedId) : null;
  }

  function getSelectedId() { return _selectedId; }

  // Serialize scene for storage (without Three.js refs)
  function serialize() {
    return {
      nextId:  _nextId,
      objects: _objects.map(o => ({
        id:         o.id,
        name:       o.name,
        active:     o.active,
        tag:        o.tag,
        type:       o.type,
        components: o.components,
      }))
    };
  }

  // Load from serialized data
  function deserialize(data) {
    if (!data) return;
    _nextId  = data.nextId  || 1;
    _objects = [];
    (data.objects || []).forEach(raw => {
      const obj = {
        id:         raw.id,
        name:       raw.name,
        active:     raw.active,
        tag:        raw.tag,
        type:       raw.type,
        components: raw.components || [],
        _mesh:      null,
      };
      _objects.push(obj);
      if (hasComponent(obj, 'Renderer')) {
        _buildMesh(obj);
      }
    });
  }

  function clear() {
    _objects.forEach(o => _destroyMesh(o));
    _objects    = [];
    _nextId     = 1;
    _selectedId = null;
  }

  // Expose component factories
  return {
    init,
    addObject,
    removeObject,
    getObject,
    getAllObjects,
    select,
    getSelected,
    getSelectedId,
    getComponent,
    hasComponent,
    addComponent,
    removeComponent,
    syncObjectToMesh,
    serialize,
    deserialize,
    clear,
    // Component factories for external use
    createTransformComponent,
    createRendererComponent,
  };
})();
