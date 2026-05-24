// Main entry point for Cryon Engine
class CryonEngine {
    constructor() {
        this.sceneManager = null;
        this.ui = null;
        this.console = null;
        this.projectManager = null;
        this.currentProject = null;
        
        this.init();
    }
    
    async init() {
        console.log('Cryon Engine v0.1.0 - Initializing...');
        
        // Initialize Three.js
        this.initThreeJS();
        
        // Initialize managers
        this.projectManager = new ProjectManager(this);
        this.ui = new CryonUI(this, this.sceneManager);
        this.console = new ConsoleUI();
        
        // Setup scene and camera
        this.setupScene();
        
        // Setup controls
        this.setupControls();
        
        // Setup raycaster for object selection
        this.setupRaycaster();
        
        // Start animation loop
        this.animate();
        
        // Load default project or create new
        await this.projectManager.loadProjects();
        
        console.log('Cryon Engine initialized successfully!');
    }
    
    initThreeJS() {
        this.sceneManager = {
            scene: new THREE.Scene(),
            camera: null,
            renderer: null,
            controls: null,
            objects: []
        };
        
        // Setup renderer
        this.sceneManager.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.sceneManager.renderer.setSize(window.innerWidth, window.innerHeight);
        this.sceneManager.renderer.shadowMap.enabled = true;
        this.sceneManager.renderer.setClearColor(0x1a1a2e);
        document.body.appendChild(this.sceneManager.renderer.domElement);
        
        // Setup camera
        this.sceneManager.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.sceneManager.camera.position.set(5, 5, 5);
        this.sceneManager.camera.lookAt(0, 0, 0);
        
        // Setup lighting
        this.setupLighting();
        
        // Setup grid helper
        const gridHelper = new THREE.GridHelper(20, 20, 0x888888, 0x444444);
        this.sceneManager.scene.add(gridHelper);
        
        // Setup axis helper
        const axesHelper = new THREE.AxesHelper(5);
        this.sceneManager.scene.add(axesHelper);
    }
    
    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040);
        this.sceneManager.scene.add(ambientLight);
        
        // Directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 10, 7);
        directionalLight.castShadow = true;
        directionalLight.receiveShadow = true;
        this.sceneManager.scene.add(directionalLight);
        
        // Fill light
        const fillLight = new THREE.PointLight(0x4466cc, 0.3);
        fillLight.position.set(-2, 1, 3);
        this.sceneManager.scene.add(fillLight);
        
        // Back light
        const backLight = new THREE.PointLight(0xffaa66, 0.2);
        backLight.position.set(0, 2, -5);
        this.sceneManager.scene.add(backLight);
    }
    
    setupScene() {
        // Add some default objects for demonstration
        const demoObjects = [
            { type: 'cube', position: { x: -2, y: 0, z: -2 }, color: 0x44aa88 },
            { type: 'sphere', position: { x: 2, y: 0, z: -2 }, color: 0x8844aa },
            { type: 'cube', position: { x: 0, y: 0, z: 0 }, color: 0xaa6644 }
        ];
        
        demoObjects.forEach(obj => {
            let geometry, material;
            if (obj.type === 'cube') {
                geometry = new THREE.BoxGeometry(1, 1, 1);
            } else {
                geometry = new THREE.SphereGeometry(0.5, 32, 32);
            }
            material = new THREE.MeshStandardMaterial({ color: obj.color });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(obj.position.x, obj.position.y, obj.position.z);
            mesh.userData = {
                name: `${obj.type}_${Date.now()}`,
                type: obj.type,
                components: {
                    transform: {
                        position: mesh.position,
                        rotation: mesh.rotation,
                        scale: mesh.scale
                    },
                    renderer: {
                        visible: true,
                        castShadow: true,
                        receiveShadow: true
                    }
                }
            };
            this.sceneManager.scene.add(mesh);
        });
    }
    
    setupControls() {
        // Orbit controls for camera
        this.sceneManager.controls = new THREE.OrbitControls(this.sceneManager.camera, this.sceneManager.renderer.domElement);
        this.sceneManager.controls.enableDamping = true;
        this.sceneManager.controls.dampingFactor = 0.05;
        this.sceneManager.controls.screenSpacePanning = true;
        this.sceneManager.controls.maxPolarAngle = Math.PI / 2;
    }
    
    setupRaycaster() {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.sceneManager.renderer.domElement.addEventListener('click', (event) => {
            this.mouse.x = (event.clientX / this.sceneManager.renderer.domElement.clientWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / this.sceneManager.renderer.domElement.clientHeight) * 2 + 1;
            
            this.raycaster.setFromCamera(this.mouse, this.sceneManager.camera);
            const intersects = this.raycaster.intersectObjects(this.sceneManager.scene.children, true);
            
            if (intersects.length > 0) {
                const clickedObject = intersects[0].object;
                if (clickedObject.isMesh) {
                    this.selectObject(clickedObject);
                }
            }
        });
    }
    
    selectObject(object) {
        this.ui.selectObject(object);
        console.log(`Selected: ${object.userData.name || object.userData.type}`);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Update controls
        if (this.sceneManager.controls) {
            this.sceneManager.controls.update();
        }
        
        // Render scene
        this.sceneManager.renderer.render(this.sceneManager.scene, this.sceneManager.camera);
    }
    
    addObjectToScene(object) {
        this.sceneManager.scene.add(object);
        this.ui.updateHierarchy();
        console.log(`Object added to scene: ${object.userData.name || object.userData.type}`);
    }
    
    removeObjectFromScene(object) {
        this.sceneManager.scene.remove(object);
        if (this.ui.selectedObject === object) {
            this.ui.selectObject(null);
        }
        this.ui.updateHierarchy();
        console.log(`Object removed from scene`);
    }
    
    saveScene() {
        const sceneData = {
            objects: this.sceneManager.scene.children
                .filter(child => child.isMesh)
                .map(mesh => ({
                    type: mesh.userData.type,
                    position: mesh.position.toArray(),
                    rotation: mesh.rotation.toArray(),
                    scale: mesh.scale.toArray(),
                    color: mesh.material.color.getHex(),
                    name: mesh.userData.name
                }))
        };
        
        return sceneData;
    }
    
    loadScene(sceneData) {
        // Clear existing objects (keep lights and helpers)
        const toRemove = [];
        this.sceneManager.scene.children.forEach(child => {
            if (child.isMesh && !child.userData.isHelper) {
                toRemove.push(child);
            }
        });
        toRemove.forEach(child => this.sceneManager.scene.remove(child));
        
        // Load objects from data
        sceneData.objects.forEach(objData => {
            let geometry, material;
            if (objData.type === 'cube') {
                geometry = new THREE.BoxGeometry(1, 1, 1);
            } else if (objData.type === 'sphere') {
                geometry = new THREE.SphereGeometry(0.5, 32, 32);
            }
            
            material = new THREE.MeshStandardMaterial({ color: objData.color });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.fromArray(objData.position);
            mesh.rotation.fromArray(objData.rotation);
            mesh.scale.fromArray(objData.scale);
            mesh.userData = {
                name: objData.name,
                type: objData.type,
                components: {
                    transform: {
                        position: mesh.position,
                        rotation: mesh.rotation,
                        scale: mesh.scale
                    },
                    renderer: {
                        visible: true,
                        castShadow: true,
                        receiveShadow: true
                    }
                }
            };
            
            this.sceneManager.scene.add(mesh);
        });
        
        this.ui.updateHierarchy();
        console.log('Scene loaded successfully');
    }
}

// Project Manager class
class ProjectManager {
    constructor(engine) {
        this.engine = engine;
        this.projects = [];
        this.currentProject = null;
    }
    
    async loadProjects() {
        const saved = localStorage.getItem('cryon_projects');
        if (saved) {
            this.projects = JSON.parse(saved);
        }
        
        // Create default project if none exists
        if (this.projects.length === 0) {
            await this.createProject('Default Project');
        } else {
            await this.loadProject(this.projects[0].id);
        }
        
        this.updateProjectUI();
    }
    
    async createProject(name) {
        const project = {
            id: Date.now(),
            name: name,
            createdAt: new Date().toISOString(),
            sceneData: { objects: [] }
        };
        
        this.projects.push(project);
        await this.saveProjects();
        await this.loadProject(project.id);
        console.log(`Project created: ${name}`);
    }
    
    async loadProject(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (project) {
            this.currentProject = project;
            if (project.sceneData) {
                this.engine.loadScene(project.sceneData);
            }
            console.log(`Project loaded: ${project.name}`);
        }
    }
    
    async saveCurrentProject() {
        if (this.currentProject) {
            this.currentProject.sceneData = this.engine.saveScene();
            await this.saveProjects();
            console.log(`Project saved: ${this.currentProject.name}`);
        }
    }
    
    async saveProjects() {
        localStorage.setItem('cryon_projects', JSON.stringify(this.projects));
    }
    
    updateProjectUI() {
        // Create project selector UI
        const selector = document.createElement('div');
        selector.className = 'project-selector';
        selector.innerHTML = `
            <select class="project-dropdown">
                ${this.projects.map(p => `<option value="${p.id}" ${this.currentProject && this.currentProject.id === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
            </select>
            <button class="new-project-btn">New Project</button>
            <button class="save-project-btn">Save</button>
        `;
        
        const existing = document.querySelector('.project-selector');
        if (existing) existing.remove();
        
        document.body.insertBefore(selector, document.body.firstChild);
        
        selector.querySelector('.project-dropdown').addEventListener('change', (e) => {
            this.loadProject(parseInt(e.target.value));
        });
        
        selector.querySelector('.new-project-btn').addEventListener('click', () => {
            const name = prompt('Enter project name:');
            if (name) this.createProject(name);
        });
        
        selector.querySelector('.save-project-btn').addEventListener('click', () => {
            this.saveCurrentProject();
        });
    }
}

// Initialize engine when page loads
window.addEventListener('DOMContentLoaded', () => {
    window.cryonEngine = new CryonEngine();
});
