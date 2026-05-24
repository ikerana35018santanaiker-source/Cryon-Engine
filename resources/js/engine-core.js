/**
 * CRYON ENGINE — engine-core.js
 * Core data structures, math utilities, and Entity-Component system
 * Open-source | MIT License
 */

'use strict';

/* ================================================================
   MATH UTILITIES
================================================================ */
const CryonMath = {
  DEG2RAD: Math.PI / 180,
  RAD2DEG: 180 / Math.PI,

  clamp(v, min, max) { return Math.max(min, Math.min(max, v)); },

  lerp(a, b, t) { return a + (b - a) * t; },

  /** Project a 3D world point to 2D canvas space (simple perspective) */
  project(x, y, z, cam, canvas) {
    // Translate relative to camera
    const dx = x - cam.x;
    const dy = y - cam.y;
    const dz = z - cam.z;

    // Apply camera Y-axis rotation (yaw)
    const cosY = Math.cos(cam.rotY * CryonMath.DEG2RAD);
    const sinY = Math.sin(cam.rotY * CryonMath.DEG2RAD);
    const rx = cosY * dx + sinY * dz;
    const ry2 = dy;
    const rz = -sinY * dx + cosY * dz;

    // Apply camera X-axis rotation (pitch)
    const cosX = Math.cos(cam.rotX * CryonMath.DEG2RAD);
    const sinX = Math.sin(cam.rotX * CryonMath.DEG2RAD);
    const ry = cosX * ry2 - sinX * rz;
    const rz2 = sinX * ry2 + cosX * rz;

    if (rz2 <= 0.01) return null; // behind camera

    const fov  = cam.fov * CryonMath.DEG2RAD;
    const f    = (canvas.height / 2) / Math.tan(fov / 2);
    const sx   = (rx / rz2) * f + canvas.width / 2;
    const sy   = -(ry / rz2) * f + canvas.height / 2;
    const depth = rz2;
    return { x: sx, y: sy, z: depth };
  },

  /** Unproject a 2D canvas point to a 3D ray direction */
  unproject(px, py, cam, canvas) {
    const fov  = cam.fov * CryonMath.DEG2RAD;
    const f    = (canvas.height / 2) / Math.tan(fov / 2);
    const ndx  = (px - canvas.width / 2) / f;
    const ndy  = -(py - canvas.height / 2) / f;

    const cosX = Math.cos(-cam.rotX * CryonMath.DEG2RAD);
    const sinX = Math.sin(-cam.rotX * CryonMath.DEG2RAD);
    const cosY = Math.cos(-cam.rotY * CryonMath.DEG2RAD);
    const sinY = Math.sin(-cam.rotY * CryonMath.DEG2RAD);

    // Local ray
    let lx = ndx, ly = ndy, lz = 1;

    // Rotate by -rotX
    let tly = cosX * ly - sinX * lz;
    let tlz = sinX * ly + cosX * lz;
    ly = tly; lz = tlz;

    // Rotate by -rotY
    let tlx = cosY * lx + sinY * lz;
    tlz = -sinY * lx + cosY * lz;
    lx = tlx; lz = tlz;

    const len = Math.sqrt(lx*lx + ly*ly + lz*lz);
    return { x: lx/len, y: ly/len, z: lz/len };
  },

  /** Ray-sphere intersection. Returns t (distance) or null */
  raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
    const ex = ox - cx, ey = oy - cy, ez = oz - cz;
    const a = dx*dx + dy*dy + dz*dz;
    const b = 2 * (ex*dx + ey*dy + ez*dz);
    const c = ex*ex + ey*ey + ez*ez - r*r;
    const disc = b*b - 4*a*c;
    if (disc < 0) return null;
    const t = (-b - Math.sqrt(disc)) / (2*a);
    return t > 0.001 ? t : null;
  },

  /** Ray-AABB intersection. Returns t or null */
  rayAABB(ox, oy, oz, dx, dy, dz, minX, minY, minZ, maxX, maxY, maxZ) {
    let tmin = -Infinity, tmax = Infinity;
    const axes = [
      [ox, dx, minX, maxX],
      [oy, dy, minY, maxY],
      [oz, dz, minZ, maxZ]
    ];
    for (const [o, d, mn, mx] of axes) {
      if (Math.abs(d) < 1e-8) {
        if (o < mn || o > mx) return null;
      } else {
        const t1 = (mn - o) / d;
        const t2 = (mx - o) / d;
        tmin = Math.max(tmin, Math.min(t1, t2));
        tmax = Math.min(tmax, Math.max(t1, t2));
      }
    }
    return tmax >= tmin && tmax > 0.001 ? Math.max(tmin, 0.001) : null;
  }
};

/* ================================================================
   COMPONENT DEFINITIONS
================================================================ */
const COMPONENT_DEFS = {
  Transform: {
    icon: '⤢',
    color: '#00e5ff',
    removable: false,
    fields: {
      position: { type: 'vec3', default: [0, 0, 0] },
      rotation: { type: 'vec3', default: [0, 0, 0] },
      scale:    { type: 'vec3', default: [1, 1, 1] }
    }
  },
  Renderer: {
    icon: '🎨',
    color: '#ff6d00',
    removable: true,
    fields: {
      meshType:    { type: 'select', options: ['Cube', 'Sphere', 'Custom'], default: 'Cube' },
      color:       { type: 'color', default: '#4499ff' },
      wireframe:   { type: 'bool', default: false },
      castShadow:  { type: 'bool', default: true },
      visible:     { type: 'bool', default: true }
    }
  }
};

/* ================================================================
   GAME OBJECT
================================================================ */
let _uidCounter = 0;

class GameObject {
  constructor(name = 'GameObject', type = 'empty') {
    this.id       = ++_uidCounter;
    this.name     = name;
    this.type     = type;         // 'cube' | 'sphere' | 'empty'
    this.visible  = true;
    this.active   = true;
    this.children = [];
    this.parentId = null;

    this.components = {
      Transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale:    { x: 1, y: 1, z: 1 }
      }
    };

    if (type === 'cube' || type === 'sphere') {
      this.components.Renderer = {
        meshType:   type === 'cube' ? 'Cube' : 'Sphere',
        color:      this._randomColor(),
        wireframe:  false,
        castShadow: true,
        visible:    true
      };
    }
  }

  _randomColor() {
    const colors = ['#4499ff', '#ff6b6b', '#69ff47', '#ffd740', '#ff6d00', '#ea80fc', '#00e5ff'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  getComponent(name) { return this.components[name] || null; }

  addComponent(name) {
    if (this.components[name]) return false;
    const def = COMPONENT_DEFS[name];
    if (!def) return false;
    const comp = {};
    for (const [k, v] of Object.entries(def.fields)) {
      comp[k] = Array.isArray(v.default)
        ? (v.type === 'vec3' ? { x: v.default[0], y: v.default[1], z: v.default[2] } : [...v.default])
        : v.default;
    }
    this.components[name] = comp;
    return true;
  }

  removeComponent(name) {
    if (!COMPONENT_DEFS[name]?.removable) return false;
    delete this.components[name];
    return true;
  }

  get transform() { return this.components.Transform; }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      visible: this.visible,
      active: this.active,
      components: JSON.parse(JSON.stringify(this.components)),
      children: this.children.map(c => c.id),
      parentId: this.parentId
    };
  }
}

/* ================================================================
   ENGINE STATE (global singleton)
================================================================ */
window.CryonEngine = {
  Math: CryonMath,
  COMPONENT_DEFS,
  GameObject,

  // Current scene objects map  id -> GameObject
  objects: new Map(),

  // Current project metadata
  currentProject: null,

  // Selected object id
  selectedId: null,

  // Active tool
  activeTool: 'move',

  // Camera state
  camera: {
    x: 0, y: 3, z: -10,
    rotX: 15, rotY: 0,
    fov: 60,
    ortho: false
  },

  // Camera orbit state
  _orbit: { active: false, startX: 0, startY: 0, startRotX: 0, startRotY: 0 },
  _pan:   { active: false, startX: 0, startY: 0, startCX: 0, startCY: 0, startCZ: 0 },

  // Runtime flags
  isPlaying: false,
  isPaused:  false,

  // Helpers
  getSelected() {
    return this.selectedId ? this.objects.get(this.selectedId) : null;
  },

  selectObject(id) {
    this.selectedId = id;
    // Will be picked up by Inspector & Hierarchy
    window.dispatchEvent(new CustomEvent('cryon:select', { detail: { id } }));
  },

  getAllObjects() {
    return Array.from(this.objects.values());
  },

  addObject(obj) {
    this.objects.set(obj.id, obj);
    window.dispatchEvent(new CustomEvent('cryon:scene-changed'));
    return obj;
  },

  removeObject(id) {
    this.objects.delete(id);
    if (this.selectedId === id) {
      this.selectedId = null;
      window.dispatchEvent(new CustomEvent('cryon:select', { detail: { id: null } }));
    }
    window.dispatchEvent(new CustomEvent('cryon:scene-changed'));
  },

  sceneToJSON() {
    const objs = [];
    for (const obj of this.objects.values()) objs.push(obj.toJSON());
    return { objects: objs, camera: { ...this.camera } };
  },

  sceneFromJSON(json) {
    this.objects.clear();
    _uidCounter = 0;
    if (!json || !json.objects) return;
    for (const data of json.objects) {
      const go = new GameObject(data.name, data.type);
      go.id = data.id;
      go.visible = data.visible;
      go.active = data.active;
      go.components = data.components;
      if (data.id > _uidCounter) _uidCounter = data.id;
      this.objects.set(go.id, go);
    }
    if (json.camera) Object.assign(this.camera, json.camera);
    window.dispatchEvent(new CustomEvent('cryon:scene-changed'));
  }
};
