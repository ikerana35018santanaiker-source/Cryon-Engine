/**
 * CRYON ENGINE — gizmos.js
 * Handles object picking (click to select) and transform gizmo handles
 * (move arrows, rotation rings, scale boxes) drawn on canvas.
 */

'use strict';

window.Gizmos = {
  canvas: null,
  ctx:    null,

  // Drag state
  _drag: {
    active: false,
    axis: null,         // 'x' | 'y' | 'z' | 'xy' | 'xz'
    tool: null,
    startMouseX: 0, startMouseY: 0,
    startVal: null,     // snapshot of position/rotation/scale at drag start
    objId: null
  },

  // Hover state
  _hover: { axis: null },

  init() {
    this.canvas = document.getElementById('scene-canvas');
    this.ctx    = this.canvas.getContext('2d');
    this._bindEvents();
  },

  _bindEvents() {
    const c = this.canvas;

    c.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const rect = c.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Check if clicking a gizmo handle
      if (CryonEngine.selectedId) {
        const axis = this._hitTestGizmo(mx, my);
        if (axis) {
          this._startDrag(axis, mx, my, e);
          return;
        }
      }

      // Otherwise: pick an object
      this._pick(mx, my);
    });

    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (this._drag.active) {
        this._updateDrag(mx, my, e);
      } else {
        // Update hover
        if (CryonEngine.selectedId) {
          this._hover.axis = this._hitTestGizmo(mx, my);
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this._endDrag();
    });

    // Context menu on right-click for objects
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const hit = this._raycastObjects(mx, my);
      if (hit) {
        CryonEngine.selectObject(hit.id);
        UI.showContextMenu(e.clientX, e.clientY, [
          { label: '⤢ Focus', action: () => SceneManager.focusSelected() },
          { label: '⎘ Duplicate', action: () => SceneManager.duplicateSelected() },
          { sep: true },
          { label: '✕ Delete', action: () => SceneManager.deleteSelected(), danger: true }
        ]);
      }
    });
  },

  /* ─── PICKING ─── */
  _pick(mx, my) {
    const hit = this._raycastObjects(mx, my);
    if (hit) {
      CryonEngine.selectObject(hit.id);
    } else {
      CryonEngine.selectObject(null);
    }
  },

  _raycastObjects(mx, my) {
    const canvas = this.canvas;
    const cam    = CryonEngine.camera;
    const ray    = CryonMath.unproject(mx, my, cam, canvas);
    const ox = cam.x, oy = cam.y, oz = cam.z;
    const { dx, dy, dz } = { dx: ray.x, dy: ray.y, dz: ray.z };

    let closest = null, closestT = Infinity;

    for (const obj of CryonEngine.getAllObjects()) {
      if (!obj.visible) continue;
      const comp = obj.components.Renderer;
      if (!comp || !comp.visible) continue;

      const t = obj.components.Transform;
      const pos = t.position, sc = t.scale, ro = t.rotation;
      let hitT = null;

      if (comp.meshType === 'Sphere') {
        const r = (sc.x + sc.y + sc.z) / 3 * 0.5;
        hitT = CryonMath.raySphere(ox, oy, oz, ray.x, ray.y, ray.z, pos.x, pos.y, pos.z, r);
      } else {
        // AABB (ignoring rotation for simplicity — rotate ray instead)
        const hx = 0.5 * sc.x, hy = 0.5 * sc.y, hz = 0.5 * sc.z;
        // Simple unrotated AABB
        hitT = CryonMath.rayAABB(
          ox - pos.x, oy - pos.y, oz - pos.z,
          ray.x, ray.y, ray.z,
          -hx, -hy, -hz, hx, hy, hz
        );
      }

      if (hitT !== null && hitT < closestT) {
        closestT = hitT;
        closest = obj;
      }
    }
    return closest;
  },

  /* ─── GIZMO HIT TEST ─── */
  _hitTestGizmo(mx, my) {
    const obj = CryonEngine.getSelected();
    if (!obj) return null;
    const handles = this._getGizmoHandles(obj);
    if (!handles) return null;

    for (const [axis, screen] of Object.entries(handles)) {
      if (!screen) continue;
      const dx = mx - screen.x, dy = my - screen.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 12) return axis;
    }

    // Check center handle for XZ plane movement
    const center = CryonMath.project(
      obj.transform.position.x, obj.transform.position.y, obj.transform.position.z,
      CryonEngine.camera, this.canvas
    );
    if (center) {
      const dx = mx - center.x, dy = my - center.y;
      if (Math.sqrt(dx*dx + dy*dy) < 10) return 'center';
    }
    return null;
  },

  _getGizmoHandles(obj) {
    const t = obj.transform;
    const pos = t.position;
    const cam = CryonEngine.camera;
    const c   = this.canvas;
    const size = 1.5; // handle arm length in world units

    const center = CryonMath.project(pos.x, pos.y, pos.z, cam, c);
    if (!center) return null;

    // Scale handle distance by depth so it stays consistent on screen
    const screenSize = 60;
    const scale = screenSize / center.z;
    const s = Math.min(scale, 2);

    if (CryonEngine.activeTool === 'move' || CryonEngine.activeTool === 'scale') {
      return {
        x:  CryonMath.project(pos.x + size, pos.y, pos.z, cam, c),
        y:  CryonMath.project(pos.x, pos.y + size, pos.z, cam, c),
        z:  CryonMath.project(pos.x, pos.y, pos.z + size, cam, c)
      };
    } else if (CryonEngine.activeTool === 'rotate') {
      // For rotate we use the same endpoints but semantics differ
      return {
        x: CryonMath.project(pos.x + size, pos.y, pos.z, cam, c),
        y: CryonMath.project(pos.x, pos.y + size, pos.z, cam, c),
        z: CryonMath.project(pos.x, pos.y, pos.z + size, cam, c)
      };
    }
    return null;
  },

  /* ─── DRAG ─── */
  _startDrag(axis, mx, my, e) {
    const obj = CryonEngine.getSelected();
    if (!obj) return;
    this._drag = {
      active: true,
      axis,
      tool: CryonEngine.activeTool,
      startMouseX: mx, startMouseY: my,
      startVal: {
        position: { ...obj.transform.position },
        rotation: { ...obj.transform.rotation },
        scale:    { ...obj.transform.scale }
      },
      objId: obj.id
    };
  },

  _updateDrag(mx, my, e) {
    const d = this._drag;
    if (!d.active) return;
    const obj = CryonEngine.objects.get(d.objId);
    if (!obj) return;

    const dxPx = mx - d.startMouseX;
    const dyPx = my - d.startMouseY;
    const speed = 0.02;

    if (d.tool === 'move') {
      const cam = CryonEngine.camera;
      const radY = cam.rotY * CryonMath.DEG2RAD;

      if (d.axis === 'x') {
        obj.transform.position.x = d.startVal.position.x + dxPx * speed * Math.cos(radY);
        obj.transform.position.z = d.startVal.position.z + dxPx * speed * -Math.sin(radY);
      } else if (d.axis === 'y') {
        obj.transform.position.y = d.startVal.position.y - dyPx * speed * 1.5;
      } else if (d.axis === 'z') {
        obj.transform.position.z = d.startVal.position.z + dxPx * speed * Math.cos(radY + Math.PI/2);
        obj.transform.position.x = d.startVal.position.x + dxPx * speed * Math.sin(radY + Math.PI/2);
      } else if (d.axis === 'center') {
        obj.transform.position.x = d.startVal.position.x + dxPx * speed * Math.cos(radY);
        obj.transform.position.z = d.startVal.position.z + dxPx * speed * -Math.sin(radY);
      }
    } else if (d.tool === 'rotate') {
      const rotSpeed = 1.2;
      if (d.axis === 'x') {
        obj.transform.rotation.x = d.startVal.rotation.x + dyPx * rotSpeed;
      } else if (d.axis === 'y') {
        obj.transform.rotation.y = d.startVal.rotation.y + dxPx * rotSpeed;
      } else if (d.axis === 'z') {
        obj.transform.rotation.z = d.startVal.rotation.z + dxPx * rotSpeed;
      }
    } else if (d.tool === 'scale') {
      const sSpeed = 0.015;
      const delta = dxPx * sSpeed;
      if (d.axis === 'x') {
        obj.transform.scale.x = Math.max(0.01, d.startVal.scale.x + delta);
      } else if (d.axis === 'y') {
        obj.transform.scale.y = Math.max(0.01, d.startVal.scale.y - dyPx * sSpeed);
      } else if (d.axis === 'z') {
        obj.transform.scale.z = Math.max(0.01, d.startVal.scale.z + delta);
      }
    }

    // Refresh inspector
    InspectorUI.refresh();
  },

  _endDrag() {
    this._drag.active = false;
    this._drag.axis = null;
  },

  /* ─── GIZMO DRAW (called after renderer each frame) ─── */
  draw() {
    const obj = CryonEngine.getSelected();
    if (!obj || !obj.visible) return;
    const r = obj.components.Renderer;
    if (!r && obj.type !== 'empty') return;

    const { ctx } = this;
    const pos = obj.transform.position;
    const cam = CryonEngine.camera;
    const c   = this.canvas;

    const center = CryonMath.project(pos.x, pos.y, pos.z, cam, c);
    if (!center) return;

    const worldLen = 1.5;
    const px = CryonMath.project(pos.x + worldLen, pos.y, pos.z, cam, c);
    const py = CryonMath.project(pos.x, pos.y + worldLen, pos.z, cam, c);
    const pz = CryonMath.project(pos.x, pos.y, pos.z + worldLen, cam, c);

    const tool = CryonEngine.activeTool;
    const hov  = this._hover.axis;

    if (tool === 'move' || tool === 'scale') {
      this._drawArrow(ctx, center, px, '#ff4444', hov === 'x', tool);
      this._drawArrow(ctx, center, py, '#44ff44', hov === 'y', tool);
      this._drawArrow(ctx, center, pz, '#4488ff', hov === 'z', tool);
    } else if (tool === 'rotate') {
      this._drawRotateHandle(ctx, center, px, '#ff4444', hov === 'x');
      this._drawRotateHandle(ctx, center, py, '#44ff44', hov === 'y');
      this._drawRotateHandle(ctx, center, pz, '#4488ff', hov === 'z');
    }

    // Center dot
    ctx.save();
    ctx.beginPath();
    ctx.arc(center.x, center.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  },

  _drawArrow(ctx, from, to, color, hovered, tool) {
    if (!from || !to) return;
    ctx.save();
    ctx.strokeStyle = hovered ? '#ffffff' : color;
    ctx.fillStyle   = hovered ? '#ffffff' : color;
    ctx.lineWidth   = hovered ? 2.5 : 2;

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    if (tool === 'scale') {
      // Scale: small cube at tip
      const size = hovered ? 8 : 6;
      ctx.fillRect(to.x - size/2, to.y - size/2, size, size);
    } else {
      // Move: arrow head
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      const arrowSize = hovered ? 10 : 8;
      ctx.beginPath();
      ctx.moveTo(to.x, to.y);
      ctx.lineTo(to.x - arrowSize * Math.cos(angle - 0.4), to.y - arrowSize * Math.sin(angle - 0.4));
      ctx.lineTo(to.x - arrowSize * Math.cos(angle + 0.4), to.y - arrowSize * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  },

  _drawRotateHandle(ctx, from, to, color, hovered) {
    if (!from || !to) return;
    ctx.save();
    ctx.strokeStyle = hovered ? '#ffffff' : color;
    ctx.lineWidth   = hovered ? 2.5 : 2;

    // Draw an arc instead of a line for rotate
    const radius = Math.sqrt((to.x - from.x)**2 + (to.y - from.y)**2);
    const angle  = Math.atan2(to.y - from.y, to.x - from.x);
    ctx.beginPath();
    ctx.arc(from.x, from.y, radius, angle - Math.PI/4, angle + Math.PI/4);
    ctx.stroke();

    // Arrow at end
    const endX = from.x + radius * Math.cos(angle + Math.PI/4);
    const endY = from.y + radius * Math.sin(angle + Math.PI/4);
    const arrowAngle = angle + Math.PI/4 + Math.PI/2;
    const as = 8;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - as * Math.cos(arrowAngle - 0.4), endY - as * Math.sin(arrowAngle - 0.4));
    ctx.lineTo(endX - as * Math.cos(arrowAngle + 0.4), endY - as * Math.sin(arrowAngle + 0.4));
    ctx.closePath();
    ctx.fillStyle = hovered ? '#ffffff' : color;
    ctx.fill();

    ctx.restore();
  }
};
