// UI System for Cryon Engine
class CryonUI {
    constructor(engine, sceneManager) {
        this.engine = engine;
        this.sceneManager = sceneManager;
        this.selectedObject = null;
        
        this.setupUI();
        this.setupEventListeners();
    }
    
    setupUI() {
        // Create main UI container
        this.container = document.createElement('div');
        this.container.className = 'cryon-ui';
        
        // Create hierarchy panel
        this.hierarchy = document.createElement('div');
        this.hierarchy.className = 'ui-panel hierarchy-panel';
        this.hierarchy.innerHTML = `
            <div class="panel-header">
                <span>Hierarchy</span>
                <button class="create-object-btn">+</button>
            </div>
            <div class="panel-content hierarchy-content"></div>
        `;
        
        // Create inspector panel
        this.inspector = document.createElement('div');
        this.inspector.className = 'ui-panel inspector-panel';
        this.inspector.innerHTML = `
            <div class="panel-header">Inspector</div>
            <div class="panel-content inspector-content">
                <div class="inspector-placeholder">Select an object to inspect</div>
            </div>
        `;
        
        // Create asset panel
        this.assetPanel = document.createElement('div');
        this.assetPanel.className = 'ui-panel asset-panel';
        this.assetPanel.innerHTML = `
            <div class="panel-header">Assets</div>
            <div class="panel-content asset-content">
                <div class="asset-item" data-type="cube">
                    <div class="asset-icon">📦</div>
                    <div class="asset-name">Cube</div>
                </div>
                <div class="asset-item" data-type="sphere">
                    <div class="asset-icon">⚪</div>
                    <div class="asset-name">Sphere</div>
                </div>
            </div>
        `;
        
        this.container.appendChild(this.hierarchy);
        this.container.appendChild(this.inspector);
        this.container.appendChild(this.assetPanel);
        document.body.appendChild(this.container);
    }
    
    setupEventListeners() {
        // Create object button
        const createBtn = this.hierarchy.querySelector('.create-object-btn');
        createBtn.addEventListener('click', () => this.showCreateMenu());
        
        // Asset drag and drop
        const assets = this.assetPanel.querySelectorAll('.asset-item');
        assets.forEach(asset => {
            asset.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', asset.dataset.type);
                e.dataTransfer.effectAllowed = 'copy';
            });
            asset.setAttribute('draggable', true);
        });
        
        // Scene click for deselection
        this.sceneManager.renderer.domElement.addEventListener('click', (e) => {
            if (e.target === this.sceneManager.renderer.domElement) {
                this.selectObject(null);
            }
        });
    }
    
    showCreateMenu() {
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = `
            <div class="menu-item" data-type="cube">Create Cube</div>
            <div class="menu-item" data-type="sphere">Create Sphere</div>
        `;
        
        const btn = this.hierarchy.querySelector('.create-object-btn');
        const rect = btn.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = `${rect.bottom}px`;
        menu.style.left = `${rect.left}px`;
        
        menu.addEventListener('click', (e) => {
            const type = e.target.dataset.type;
            if (type) {
                this.createObject(type);
            }
            menu.remove();
        });
        
        document.body.appendChild(menu);
        
        // Remove menu on click outside
        setTimeout(() => {
            document.addEventListener('click', function removeMenu() {
                menu.remove();
                document.removeEventListener('click', removeMenu);
            });
        }, 0);
    }
    
    createObject(type) {
        let geometry, material;
        
        switch(type) {
            case 'cube':
                geometry = new THREE.BoxGeometry(1, 1, 1);
                material = new THREE.MeshStandardMaterial({ color: 0x44aa88 });
                break;
            case 'sphere':
                geometry = new THREE.SphereGeometry(0.5, 32, 32);
                material = new THREE.MeshStandardMaterial({ color: 0x8844aa });
                break;
        }
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = {
            name: `${type}_${Date.now()}`,
            type: type,
            components: {
                transform: {
                    position: { x: 0, y: 0, z: 0 },
                    rotation: { x: 0, y: 0, z: 0 },
                    scale: { x: 1, y: 1, z: 1 }
                },
                renderer: {
                    visible: true,
                    castShadow: true,
                    receiveShadow: true
                }
            }
        };
        
        this.sceneManager.addObject(mesh);
        this.updateHierarchy();
        console.log(`Created ${type} in scene`);
    }
    
    updateHierarchy() {
        const hierarchyContent = this.hierarchy.querySelector('.hierarchy-content');
        hierarchyContent.innerHTML = '';
        
        this.sceneManager.scene.children.forEach(child => {
            if (child.isMesh) {
                const item = document.createElement('div');
                item.className = 'hierarchy-item';
                if (this.selectedObject === child) {
                    item.classList.add('selected');
                }
                
                item.innerHTML = `
                    <span class="hierarchy-icon">${child.userData.type === 'cube' ? '📦' : '⚪'}</span>
                    <span class="hierarchy-name">${child.userData.name || child.userData.type}</span>
                `;
                
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.selectObject(child);
                });
                
                hierarchyContent.appendChild(item);
            }
        });
    }
    
    selectObject(object) {
        this.selectedObject = object;
        
        // Update hierarchy selection
        const items = this.hierarchy.querySelectorAll('.hierarchy-item');
        items.forEach(item => item.classList.remove('selected'));
        if (object) {
            const index = this.sceneManager.scene.children.indexOf(object);
            if (index >= 0) {
                items[index].classList.add('selected');
            }
        }
        
        this.updateInspector();
        
        // Emit selection event
        if (this.engine.onObjectSelected) {
            this.engine.onObjectSelected(object);
        }
    }
    
    updateInspector() {
        const inspectorContent = this.inspector.querySelector('.inspector-content');
        
        if (!this.selectedObject) {
            inspectorContent.innerHTML = '<div class="inspector-placeholder">Select an object to inspect</div>';
            return;
        }
        
        const data = this.selectedObject.userData;
        inspectorContent.innerHTML = `
            <div class="inspector-section">
                <div class="section-header">Name</div>
                <input type="text" class="object-name" value="${data.name || ''}">
            </div>
            
            <div class="inspector-section">
                <div class="section-header">Transform</div>
                <div class="transform-component">
                    <label>Position</label>
                    <div class="vector3">
                        <input type="number" class="pos-x" value="${this.selectedObject.position.x}" step="0.1" placeholder="X">
                        <input type="number" class="pos-y" value="${this.selectedObject.position.y}" step="0.1" placeholder="Y">
                        <input type="number" class="pos-z" value="${this.selectedObject.position.z}" step="0.1" placeholder="Z">
                    </div>
                    
                    <label>Rotation</label>
                    <div class="vector3">
                        <input type="number" class="rot-x" value="${this.selectedObject.rotation.x}" step="0.1" placeholder="X">
                        <input type="number" class="rot-y" value="${this.selectedObject.rotation.y}" step="0.1" placeholder="Y">
                        <input type="number" class="rot-z" value="${this.selectedObject.rotation.z}" step="0.1" placeholder="Z">
                    </div>
                    
                    <label>Scale</label>
                    <div class="vector3">
                        <input type="number" class="scl-x" value="${this.selectedObject.scale.x}" step="0.1" placeholder="X">
                        <input type="number" class="scl-y" value="${this.selectedObject.scale.y}" step="0.1" placeholder="Y">
                        <input type="number" class="scl-z" value="${this.selectedObject.scale.z}" step="0.1" placeholder="Z">
                    </div>
                </div>
            </div>
            
            <div class="inspector-section">
                <div class="section-header">Renderer</div>
                <div class="renderer-component">
                    <label>
                        <input type="checkbox" class="renderer-visible" ${data.components.renderer.visible ? 'checked' : ''}>
                        Visible
                    </label>
                    <label>Color</label>
                    <input type="color" class="object-color" value="${this.selectedObject.material.color.getHexString()}">
                </div>
            </div>
            
            <div class="inspector-section">
                <div class="section-header">Components</div>
                <div class="components-list">
                    <div class="component-item">Transform</div>
                    <div class="component-item">Renderer</div>
                    <button class="add-component-btn">Add Component</button>
                </div>
            </div>
        `;
        
        // Setup event listeners for inspector controls
        this.setupInspectorEvents();
    }
    
    setupInspectorEvents() {
        if (!this.selectedObject) return;
        
        // Name change
        const nameInput = this.inspector.querySelector('.object-name');
        if (nameInput) {
            nameInput.addEventListener('change', (e) => {
                this.selectedObject.userData.name = e.target.value;
                this.updateHierarchy();
            });
        }
        
        // Transform controls
        const posX = this.inspector.querySelector('.pos-x');
        const posY = this.inspector.querySelector('.pos-y');
        const posZ = this.inspector.querySelector('.pos-z');
        
        if (posX) posX.addEventListener('change', (e) => this.selectedObject.position.x = parseFloat(e.target.value));
        if (posY) posY.addEventListener('change', (e) => this.selectedObject.position.y = parseFloat(e.target.value));
        if (posZ) posZ.addEventListener('change', (e) => this.selectedObject.position.z = parseFloat(e.target.value));
        
        const rotX = this.inspector.querySelector('.rot-x');
        const rotY = this.inspector.querySelector('.rot-y');
        const rotZ = this.inspector.querySelector('.rot-z');
        
        if (rotX) rotX.addEventListener('change', (e) => this.selectedObject.rotation.x = parseFloat(e.target.value));
        if (rotY) rotY.addEventListener('change', (e) => this.selectedObject.rotation.y = parseFloat(e.target.value));
        if (rotZ) rotZ.addEventListener('change', (e) => this.selectedObject.rotation.z = parseFloat(e.target.value));
        
        const sclX = this.inspector.querySelector('.scl-x');
        const sclY = this.inspector.querySelector('.scl-y');
        const sclZ = this.inspector.querySelector('.scl-z');
        
        if (sclX) sclX.addEventListener('change', (e) => this.selectedObject.scale.x = parseFloat(e.target.value));
        if (sclY) sclY.addEventListener('change', (e) => this.selectedObject.scale.y = parseFloat(e.target.value));
        if (sclZ) sclZ.addEventListener('change', (e) => this.selectedObject.scale.z = parseFloat(e.target.value));
        
        // Renderer controls
        const visibleCheck = this.inspector.querySelector('.renderer-visible');
        if (visibleCheck) {
            visibleCheck.addEventListener('change', (e) => {
                this.selectedObject.visible = e.target.checked;
                this.selectedObject.userData.components.renderer.visible = e.target.checked;
            });
        }
        
        const colorPicker = this.inspector.querySelector('.object-color');
        if (colorPicker) {
            colorPicker.addEventListener('change', (e) => {
                this.selectedObject.material.color.set(e.target.value);
            });
        }
        
        // Add component button
        const addBtn = this.inspector.querySelector('.add-component-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showComponentMenu());
        }
    }
    
    showComponentMenu() {
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = `
            <div class="menu-item" data-component="script">Script (Coming Soon)</div>
            <div class="menu-item" data-component="light">Light (Coming Soon)</div>
            <div class="menu-item" data-component="collider">Collider (Coming Soon)</div>
        `;
        
        const btn = this.inspector.querySelector('.add-component-btn');
        const rect = btn.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = `${rect.bottom}px`;
        menu.style.left = `${rect.left}px`;
        
        document.body.appendChild(menu);
        
        setTimeout(() => {
            document.addEventListener('click', function removeMenu() {
                menu.remove();
                document.removeEventListener('click', removeMenu);
            });
        }, 0);
    }
}
