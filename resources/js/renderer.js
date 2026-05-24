/**
 * CRYON ENGINE — renderer.js
 * Software wireframe+filled renderer on HTML Canvas.
 * Draws grid, cubes, spheres with per-face shading.
 * Handles camera orbit (right-click drag) and zoom (scroll).
 */

'use strict';

window.Renderer = {
  canvas: null,
  ctx: null,
  animFrame: null,

  init() {
    this.canvas = document.getElementById('scene-canvas');
    this.ctx    = this.canvas.getContext('2d');
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this._setupCameraControls();
    this._loop();
  },

  _resize() {
    const wrap = document.getElementById('viewport-wrapper');
    if (!wrap) return;
    this.canvas.width  = wrap.clientWidth;
    this.canvas.height = wrap.clientHeight;
  },

  /* ─── CAMERA CONTROLS ─── */
  _setupCameraControls() {
    const c = this.canvas;

    // Right-click drag → orbit
    c.addEventListener('mousedown', (e) => {
      if (e.button === 2) {
        e.preventDefault();
        CryonEngine._orbit = {
          active: true,
          startX: e.clientX, startY: e.clientY,
          startRotX: CryonEngine.camera.rotX,
          startRotY: CryonEngine.camera.rotY
        };
      }
      if (e.button === 1) {
        e.preventDefault();
        const cam = CryonEngine.camera;
        CryonEngine._pan = {
          active: true,
          startX: e.clientX, startY: e.clientY,
          startCX: cam.x, startCY: cam.y, startCZ: cam.z
        };
      }
    });

    window.addEventListener('mousemove', (e) => {
      const orb = CryonEngine._orbit;
      if (orb.active) {
        const dx = e.clientX - orb.startX;
        const dy = e.clientY - orb.startY;
        CryonEngine.camera.rotY = orb.startRotY + dx * 0.4;
        CryonEngine.camera.rotX = CryonMath.clamp(orb.startRotX + dy * 0.4, -89, 89);
        window.dispatchEvent(new CustomEvent('cryon:camera-moved'));
      }
      const pan = CryonEngine._pan;
      if (pan.active) {
        const dx = (e.clientX - pan.startX) * 0.02;
        const dy = (e.clientY - pan.startY) * 0.02;
        const cam = CryonEngine.camera;
        const rad = cam.rotY * CryonMath.DEG2RAD;
        cam.x = pan.startCX - Math.cos(rad) * dx;
        cam.z = pan.startCZ + Math.sin(rad) * dx;
        cam.y = pan.startCY + dy;
        window.dispatchEvent(new CustomEvent('cryon:camera-moved'));
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) CryonEngine._orbit.active = false;
      if (e.button === 1) CryonEngine._pan.active = false;
    });

    // Scroll → zoom (dolly)
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const cam = CryonEngine.camera;
      const rad = cam.rotY * CryonMath.DEG2RAD;
      const radX = cam.rotX * CryonMath.DEG2RAD;
      const speed = e.deltaY * 0.02;
      cam.x += Math.sin(rad) * Math.cos(radX) * speed;
      cam.y -= Math.sin(radX) * speed;
      cam.z += Math.cos(rad) * Math.cos(radX) * speed;
      window.dispatchEvent(new CustomEvent('cryon:camera-moved'));
    }, { passive: false });

    // Disable context menu on canvas
    c.addEventListener('contextmenu', e => e.preventDefault());
  },

  /* ─── MAIN LOOP ─── */
  _loop() {
    this.animFrame = requestAnimationFrame(() => this._loop());
    this._draw();
  },

  _draw() {
    const { canvas, ctx } = this;
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bg.addColorStop(0, '#0c0d10');
    bg.addColorStop(1, '#070809');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    this._drawGrid();

    // Gather and sort objects by depth for painter's algorithm
    const objects = CryonEngine.getAllObjects();
    const toRender = [];

    for (const obj of objects) {
      if (!obj.visible) continue;
      const comp = obj.components.Renderer;
      if (!comp || !comp.visible) continue;
      const t = obj.components.Transform;
      const p = this._project(t.position.x, t.position.y, t.position.z);
      if (!p) continue;
      toRender.push({ obj, depth: p.z });
    }

    // Sort back to front
    toRender.sort((a, b) => b.depth - a.depth);

    for (const { obj } of toRender) {
      this._drawObject(obj);
    }

    // Draw selection outline on top
    const sel = CryonEngine.getSelected();
    if (sel && sel.visible && sel.components.Renderer?.visible) {
      this._drawSelectionOutline(sel);
    }
  },

  /* ─── GRID ─── */
  _drawGrid() {
    const { canvas, ctx } = this;
    const cam = CryonEngine.camera;
    const size = 20;
    const step = 1;

    ctx.save();
    ctx.globalAlpha = 0.35;

    for (let i = -size; i <= size; i += step) {
      const isMajor = i % 5 === 0;
      // X-axis line (along Z)
      const pa = this._project(i, 0, -size);
      const pb = this._project(i, 0, size);
      if (pa && pb) {
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.strokeStyle = isMajor ? '#3a3d45' : '#1e2025';
        ctx.lineWidth = isMajor ? 1 : 0.5;
        ctx.stroke();
      }
      // Z-axis line (along X)
      const pc = this._project(-size, 0, i);
      const pd = this._project(size, 0, i);
      if (pc && pd) {
        ctx.beginPath();
        ctx.moveTo(pc.x, pc.y);
        ctx.lineTo(pd.x, pd.y);
        ctx.strokeStyle = isMajor ? '#3a3d45' : '#1e2025';
        ctx.lineWidth = isMajor ? 1 : 0.5;
        ctx.stroke();
      }
    }

    // World axes
    const ori = this._project(0, 0, 0);
    if (ori) {
      // X-axis (red)
      const ax = this._project(4, 0, 0);
      if (ax) { ctx.beginPath(); ctx.moveTo(ori.x, ori.y); ctx.lineTo(ax.x, ax.y); ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 2; ctx.globalAlpha = 0.6; ctx.stroke(); }
      // Y-axis (green)
      const ay = this._project(0, 4, 0);
      if (ay) { ctx.beginPath(); ctx.moveTo(ori.x, ori.y); ctx.lineTo(ay.x, ay.y); ctx.strokeStyle = '#44ff44'; ctx.lineWidth = 2; ctx.stroke(); }
      // Z-axis (blue)
      const az = this._project(0, 0, 4);
      if (az) { ctx.beginPath(); ctx.moveTo(ori.x, ori.y); ctx.lineTo(az.x, az.y); ctx.strokeStyle = '#4488ff'; ctx.lineWidth = 2; ctx.stroke(); }
    }

    ctx.restore();
  },

  /* ─── OBJECT DRAWING ─── */
  _drawObject(obj) {
    const t = obj.components.Transform;
    const r = obj.components.Renderer;
    if (!r) return;

    if (r.meshType === 'Cube') {
      this._drawCube(t, r);
    } else if (r.meshType === 'Sphere') {
      this._drawSphere(t, r);
    }
  },

  _drawCube(t, r) {
    const { ctx } = this;
    const p = t.position, sc = t.scale, ro = t.rotation;

    // 8 vertices of a unit cube, scaled and positioned
    const hx = 0.5 * sc.x, hy = 0.5 * sc.y, hz = 0.5 * sc.z;

    // Local cube vertices
    const verts = [
      [-hx, -hy, -hz], [ hx, -hy, -hz], [ hx,  hy, -hz], [-hx,  hy, -hz],
      [-hx, -hy,  hz], [ hx, -hy,  hz], [ hx,  hy,  hz], [-hx,  hy,  hz]
    ];

    // Apply rotation (Y, X, Z order)
    const rotated = verts.map(([x, y, z]) => this._rotateVert(x, y, z, ro));

    // Project to screen
    const pts = rotated.map(([x, y, z]) =>
      this._project(x + p.x, y + p.y, z + p.z)
    );

    // 6 faces: front, back, left, right, top, bottom
    const faces = [
      { indices: [0,1,2,3], normal: [0, 0,-1] }, // back
      { indices: [4,5,6,7], normal: [0, 0, 1] }, // front
      { indices: [0,4,7,3], normal: [-1,0, 0] }, // left
      { indices: [1,5,6,2], normal: [ 1,0, 0] }, // right
      { indices: [3,2,6,7], normal: [0, 1, 0] }, // top
      { indices: [0,1,5,4], normal: [0,-1, 0] }  // bottom
    ];

    // Light direction (normalized)
    const lx = 0.5, ly = 1, lz = -0.5;
    const ll = Math.sqrt(lx*lx + ly*ly + lz*lz);

    // Parse color
    const baseColor = this._hexToRgb(r.color);

    // Sort faces by depth (painter's algorithm)
    const facesWithDepth = faces.map(face => {
      const depths = face.indices.map(i => pts[i]?.z ?? 0);
      return { ...face, avgDepth: depths.reduce((a, b) => a + b, 0) / 4 };
    }).filter(f => f.indices.every(i => pts[i]));

    facesWithDepth.sort((a, b) => b.avgDepth - a.avgDepth);

    for (const face of facesWithDepth) {
      const [nx, ny, nz] = face.normal;
      const dot = Math.max(0, nx*(lx/ll) + ny*(ly/ll) + nz*(lz/ll));
      const ambient = 0.25;
      const bright = ambient + (1 - ambient) * dot;

      const fr = Math.round(baseColor.r * bright);
      const fg = Math.round(baseColor.g * bright);
      const fb = Math.round(baseColor.b * bright);

      const screenPts = face.indices.map(i => pts[i]);

      if (!r.wireframe) {
        ctx.beginPath();
        ctx.moveTo(screenPts[0].x, screenPts[0].y);
        for (let i = 1; i < screenPts.length; i++) {
          ctx.lineTo(screenPts[i].x, screenPts[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = `rgb(${fr},${fg},${fb})`;
        ctx.fill();
      }

      // Edge lines
      ctx.beginPath();
      ctx.moveTo(screenPts[0].x, screenPts[0].y);
      for (let i = 1; i < screenPts.length; i++) ctx.lineTo(screenPts[i].x, screenPts[i].y);
      ctx.closePath();
      ctx.strokeStyle = r.wireframe ? r.color : `rgba(0,0,0,0.4)`;
      ctx.lineWidth = r.wireframe ? 1.5 : 0.5;
      ctx.stroke();
    }
  },

  _drawSphere(t, r) {
    const { ctx } = this;
    const p = t.position, sc = t.scale;
    const radius = (sc.x + sc.y + sc.z) / 3 * 0.5;

    // Project center
    const center = this._project(p.x, p.y, p.z);
    if (!center) return;

    // Approximate screen radius from projected points
    const right = this._project(p.x + radius, p.y, p.z);
    if (!right) return;
    const screenR = Math.abs(right.x - center.x);

    const baseColor = this._hexToRgb(r.color);

    if (!r.wireframe) {
      // Radial gradient for 3D shading
      const lox = center.x - screenR * 0.3;
      const loy = center.y - screenR * 0.3;
      const grad = ctx.createRadialGradient(lox, loy, screenR * 0.1, center.x, center.y, screenR);
      const hi = this._lighten(baseColor, 1.6);
      const mid = baseColor;
      const dk = this._lighten(baseColor, 0.3);
      grad.addColorStop(0, `rgb(${hi.r},${hi.g},${hi.b})`);
      grad.addColorStop(0.5, `rgb(${mid.r},${mid.g},${mid.b})`);
      grad.addColorStop(1, `rgb(${dk.r},${dk.g},${dk.b})`);

      ctx.beginPath();
      ctx.arc(center.x, center.y, screenR, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Wireframe circles
    if (r.wireframe || true) {
      const segments = r.wireframe ? 24 : 16;
      ctx.strokeStyle = r.wireframe ? r.color : `rgba(0,0,0,0.3)`;
      ctx.lineWidth   = r.wireframe ? 1.5 : 0.5;

      // Outline circle
      ctx.beginPath();
      ctx.arc(center.x, center.y, screenR, 0, Math.PI * 2);
      ctx.stroke();

      if (r.wireframe) {
        // Latitude lines
        for (let lat = -60; lat <= 60; lat += 30) {
          const yr = radius * Math.sin(lat * CryonMath.DEG2RAD);
          const xr = radius * Math.cos(lat * CryonMath.DEG2RAD);
          const c2 = this._project(p.x, p.y + yr, p.z);
          const c2r = this._project(p.x + xr, p.y + yr, p.z);
          if (c2 && c2r) {
            const r2s = Math.abs(c2r.x - c2.x);
            ctx.beginPath();
            ctx.arc(c2.x, c2.y, r2s, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        // Longitude lines (as ellipses — simplified as lines for now)
        for (let lon = 0; lon < 180; lon += 30) {
          const pts2 = [];
          for (let lat2 = -90; lat2 <= 90; lat2 += 15) {
            const rad2 = lat2 * CryonMath.DEG2RAD;
            const lonR = lon * CryonMath.DEG2RAD;
            const lx = radius * Math.cos(rad2) * Math.cos(lonR);
            const ly2 = radius * Math.sin(rad2);
            const lz = radius * Math.cos(rad2) * Math.sin(lonR);
            const pp = this._project(p.x + lx, p.y + ly2, p.z + lz);
            if (pp) pts2.push(pp);
          }
          if (pts2.length > 1) {
            ctx.beginPath();
            ctx.moveTo(pts2[0].x, pts2[0].y);
            pts2.forEach(pt => ctx.lineTo(pt.x, pt.y));
            ctx.stroke();
          }
        }
      }
    }
  },

  _drawSelectionOutline(obj) {
    const { ctx } = this;
    const t = obj.components.Transform;
    const r = obj.components.Renderer;
    const p = t.position, sc = t.scale;

    ctx.save();
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.9;

    if (r.meshType === 'Sphere') {
      const radius = (sc.x + sc.y + sc.z) / 3 * 0.5;
      const center = this._project(p.x, p.y, p.z);
      const right  = this._project(p.x + radius, p.y, p.z);
      if (center && right) {
        const sr = Math.abs(right.x - center.x) + 4;
        ctx.beginPath();
        ctx.arc(center.x, center.y, sr, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      // Bounding box outline for cube
      const hx = 0.5 * sc.x + 0.05, hy = 0.5 * sc.y + 0.05, hz = 0.5 * sc.z + 0.05;
      const ro = t.rotation;
      const verts = [
        [-hx,-hy,-hz],[ hx,-hy,-hz],[ hx, hy,-hz],[-hx, hy,-hz],
        [-hx,-hy, hz],[ hx,-hy, hz],[ hx, hy, hz],[-hx, hy, hz]
      ].map(([x,y,z]) => this._rotateVert(x,y,z,ro));

      const pts = verts.map(([x,y,z]) => this._project(x+p.x, y+p.y, z+p.z));
      const edges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];

      ctx.setLineDash([4, 3]);
      for (const [a, b] of edges) {
        if (pts[a] && pts[b]) {
          ctx.beginPath();
          ctx.moveTo(pts[a].x, pts[a].y);
          ctx.lineTo(pts[b].x, pts[b].y);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
    }

    ctx.restore();
  },

  /* ─── HELPERS ─── */
  _project(x, y, z) {
    return CryonMath.project(x, y, z, CryonEngine.camera, this.canvas);
  },

  _rotateVert(x, y, z, rot) {
    // Y rotation
    const ry = rot.y * CryonMath.DEG2RAD;
    let tx = Math.cos(ry) * x + Math.sin(ry) * z;
    let tz = -Math.sin(ry) * x + Math.cos(ry) * z;
    x = tx; z = tz;

    // X rotation
    const rx = rot.x * CryonMath.DEG2RAD;
    let ty = Math.cos(rx) * y - Math.sin(rx) * z;
    tz = Math.sin(rx) * y + Math.cos(rx) * z;
    y = ty; z = tz;

    // Z rotation
    const rz = rot.z * CryonMath.DEG2RAD;
    tx = Math.cos(rz) * x - Math.sin(rz) * y;
    ty = Math.sin(rz) * x + Math.cos(rz) * y;
    return [tx, ty, z];
  },

  _hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  },

  _lighten(rgb, factor) {
    return {
      r: Math.min(255, Math.round(rgb.r * factor)),
      g: Math.min(255, Math.round(rgb.g * factor)),
      b: Math.min(255, Math.round(rgb.b * factor))
    };
  }
};
