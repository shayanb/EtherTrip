class PsychedelicVisualizer {
    constructor(container) {
        this.container = container;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.particles = null;
        this.blocks = [];
        this.transactions = [];
        this.pendingTransactions = new Map(); // Map txHash to star mesh
        this.smartContracts = [];
        this.time = 0;
        
        this.addressNodes = new Map();
        this.connections = [];
        this.maxAddressNodes = 50; // Reduced for sparsity
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.hoveredObject = null;
        this.tooltip = null;
        
        // Spatial growth system
        this.blockPositions = [];
        this.currentBranch = 0;
        this.branchLength = 0;
        this.maxBranchLength = 5;
        this.universeExtent = { min: -500, max: 500 };
        
        // Block transaction elevation system
        this.blockTransactionElevation = 0; // Tracks cumulative elevation for each new block
        
        this.settings = {
            colorIntensity: 0.5,
            particleCount: 500, // Reduced from 1000 to 500 to reduce visual noise
            rotationSpeed: 0.5,
            waveAmplitude: 0.5,
            showAddressGraph: true,
            itemLifespan: 12.0, // Extended lifespan - connections persist for at least 1 block duration (12s)
            blockchainFocus: 0.3 // 0 = all effects, 1 = data only
        };
        
        this.gasPriceEffect = {
            currentGasPrice: 20,
            targetGasPrice: 20,
            backgroundColor: new THREE.Color(0x000000),
            smoothingFactor: 0.02 // Slower transitions
        };
        
        // PERFORMANCE MONITORING to prevent system overload
        this.performanceMonitor = {
            particleCount: 0,
            connectionCount: 0,
            maxParticles: 200, // Hard limit on active particles
            maxConnections: 100, // Hard limit on active connections
            lastCleanup: Date.now(),
            isOverloaded: false
        };
        
        this.colors = {
            transaction: [0xff00ff, 0x00ffff, 0xffff00, 0xff00aa, 0x00ff00],
            block: [0xff0000, 0x0000ff, 0xff00ff, 0xffffff, 0x00ff00],
            addressNode: [0x00ff88, 0xff8800, 0x8800ff, 0xff0088, 0x88ff00],
            smartContract: [0xff6600, 0xff0099, 0x9900ff, 0x00ff99, 0xff9900, 0x6600ff, 0xff3366, 0x33ff66]
        };
        
        this.init();
    }
    
    init() {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000000, 0.001);
        
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            10000
        );
        this.camera.position.z = 500;
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.container.appendChild(this.renderer.domElement);
        
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 50;
        this.controls.maxDistance = 5000; // Expand for open world
        this.controls.maxPolarAngle = Math.PI;
        
        // Auto camera movement
        this.cameraAutoMove = {
            enabled: true,
            target: new THREE.Vector3(0, 0, 0),
            speed: 0.01
        };
        
        this.setupLights();
        this.createParticleSystem();
        this.createCentralCore();
        this.createAddressGraphGroup();
        this.createPendingTransactionsGroup();
        this.setupPostProcessing();
        this.setupInteraction();
        this.createTooltip();
        
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }
    
    setupLights() {
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);
        
        const pointLight1 = new THREE.PointLight(0xff00ff, 1, 1000);
        pointLight1.position.set(200, 200, 200);
        this.scene.add(pointLight1);
        
        const pointLight2 = new THREE.PointLight(0x00ffff, 1, 1000);
        pointLight2.position.set(-200, -200, 200);
        this.scene.add(pointLight2);
        
        const pointLight3 = new THREE.PointLight(0xffff00, 1, 1000);
        pointLight3.position.set(0, 0, -300);
        this.scene.add(pointLight3);
    }
    
    createParticleSystem() {
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];
        const sizes = [];
        
        // Reduce particle count based on blockchain focus (0 = full effects, 1 = data only)
        const focusMultiplier = 1 - this.settings.blockchainFocus;
        const adjustedParticleCount = Math.floor(this.settings.particleCount * focusMultiplier);
        
        for (let i = 0; i < adjustedParticleCount; i++) {
            positions.push(
                (Math.random() - 0.5) * 2000,
                (Math.random() - 0.5) * 2000,
                (Math.random() - 0.5) * 2000
            );
            
            const color = new THREE.Color();
            color.setHSL(Math.random(), 1.0, 0.5);
            colors.push(color.r, color.g, color.b);
            
            sizes.push(Math.random() * 10 + 5);
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
        
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                colorIntensity: { value: this.settings.colorIntensity }
            },
            vertexShader: `
                attribute float size;
                varying vec3 vColor;
                uniform float time;
                
                void main() {
                    vColor = color;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    float scale = sin(time * 0.5 + position.x * 0.01) * 0.3 + 1.0;
                    gl_PointSize = size * scale * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                uniform float colorIntensity;
                
                void main() {
                    vec2 center = gl_PointCoord - vec2(0.5);
                    float dist = length(center);
                    if (dist > 0.5) discard;
                    
                    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
                    vec3 finalColor = vColor * (1.0 + colorIntensity);
                    gl_FragColor = vec4(finalColor, alpha * 0.8);
                }
            `,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            transparent: true,
            vertexColors: true
        });
        
        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }
    
    createCentralCore() {
        const geometry = new THREE.IcosahedronGeometry(50, 2);
        const material = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            emissive: 0xff00ff,
            emissiveIntensity: 0.5,
            wireframe: true,
            transparent: true,
            opacity: 0.8
        });
        
        this.core = new THREE.Mesh(geometry, material);
        this.scene.add(this.core);
        
        const glowGeometry = new THREE.IcosahedronGeometry(55, 2);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xff00ff,
            transparent: true,
            opacity: 0.3,
            side: THREE.BackSide
        });
        
        this.coreGlow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.scene.add(this.coreGlow);
    }
    
    setupPostProcessing() {
        this.composer = null;
    }
    
    createAddressGraphGroup() {
        this.addressGraphGroup = new THREE.Group();
        this.scene.add(this.addressGraphGroup);
    }
    
    createPendingTransactionsGroup() {
        this.pendingTransactionsGroup = new THREE.Group();
        this.scene.add(this.pendingTransactionsGroup);
    }
    
    setupInteraction() {
        this.isDragging = false;
        this.draggedObject = null;
        this.dragStartMouse = new THREE.Vector2();
        this.dragStartPosition = new THREE.Vector3();
        
        window.addEventListener('mousemove', (event) => {
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            
            if (this.isDragging && this.draggedObject) {
                this.handleDrag(event);
            }
        });
        
        window.addEventListener('mousedown', (event) => {
            this.handleMouseDown(event);
        });
        
        window.addEventListener('mouseup', (event) => {
            this.handleMouseUp(event);
        });
    }
    
    handleMouseDown(event) {
        // Only handle left mouse button
        if (event.button !== 0) return;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const draggableObjects = [
            ...this.transactions,
            ...this.blocks,
            ...Array.from(this.addressNodes.values()),
            ...this.smartContracts
        ];
        
        const intersects = this.raycaster.intersectObjects(draggableObjects, true);
        
        if (intersects.length > 0) {
            let object = intersects[0].object;
            // If the object is part of a group (like blocks), use the group
            while (object.parent && object.parent.userData && object.parent.userData.block) {
                object = object.parent;
            }
            
            this.isDragging = true;
            this.draggedObject = object;
            this.dragStartMouse.copy(this.mouse);
            this.dragStartPosition.copy(object.position);
            
            // Disable camera controls during drag
            this.controls.enabled = false;
            
            // Add visual feedback
            if (object.material) {
                object.material.emissiveIntensity = (object.material.emissiveIntensity || 0) + 0.3;
            }
            
            event.preventDefault();
        }
    }
    
    handleDrag(event) {
        if (!this.draggedObject) return;
        
        // Calculate world position for the mouse
        const vector = new THREE.Vector3();
        vector.set(this.mouse.x, this.mouse.y, 0.5);
        vector.unproject(this.camera);
        
        const dir = vector.sub(this.camera.position).normalize();
        const distance = -this.camera.position.z / dir.z;
        const pos = this.camera.position.clone().add(dir.multiplyScalar(distance));
        
        // Apply position with smooth interpolation
        this.draggedObject.position.lerp(pos, 0.2);
        
        // Add rotation during drag for visual appeal
        if (this.draggedObject.rotation) {
            this.draggedObject.rotation.y += 0.02;
        }
    }
    
    handleMouseUp(event) {
        if (this.isDragging && this.draggedObject) {
            // Re-enable camera controls
            this.controls.enabled = true;
            
            // Remove visual feedback
            if (this.draggedObject.material) {
                this.draggedObject.material.emissiveIntensity = Math.max(0, (this.draggedObject.material.emissiveIntensity || 0) - 0.3);
            }
            
            // Add drop animation
            this.addDropAnimation(this.draggedObject);
            
            this.isDragging = false;
            this.draggedObject = null;
        }
    }
    
    addDropAnimation(object) {
        const startScale = object.scale.clone();
        const targetScale = startScale.clone().multiplyScalar(1.2);
        
        // Bounce animation
        const animateDrop = () => {
            const duration = 500; // ms
            const startTime = Date.now();
            
            const bounce = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Bounce curve
                const bounceProgress = Math.sin(progress * Math.PI);
                const scale = startScale.clone().lerp(targetScale, bounceProgress);
                object.scale.copy(scale);
                
                if (progress < 1) {
                    requestAnimationFrame(bounce);
                } else {
                    object.scale.copy(startScale);
                }
            };
            
            bounce();
        };
        
        animateDrop();
    }
    
    createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.style.position = 'absolute';
        this.tooltip.style.padding = '10px';
        this.tooltip.style.background = 'rgba(0, 0, 0, 0.9)';
        this.tooltip.style.color = '#00ffff';
        this.tooltip.style.border = '1px solid #00ffff';
        this.tooltip.style.borderRadius = '5px';
        this.tooltip.style.fontFamily = 'Courier New, monospace';
        this.tooltip.style.fontSize = '12px';
        this.tooltip.style.pointerEvents = 'none';
        this.tooltip.style.display = 'none';
        this.tooltip.style.zIndex = '1000';
        this.tooltip.style.maxWidth = '300px';
        document.body.appendChild(this.tooltip);
    }
    
    updateTooltip(object, event) {
        if (!object || !object.userData || !object.userData.info) {
            this.tooltip.style.display = 'none';
            return;
        }
        
        const info = object.userData.info;
        let content = '';
        
        if (info.type === 'transaction') {
            content = `
                <div><strong>Transaction</strong></div>
                <div>Hash: ${info.hash ? info.hash.slice(0, 6) + '...' + info.hash.slice(-4) : 'N/A'}</div>
                <div>From: ${info.from ? info.from.slice(0, 6) + '...' + info.from.slice(-4) : 'N/A'}</div>
                <div>To: ${info.to ? info.to.slice(0, 6) + '...' + info.to.slice(-4) : 'N/A'}</div>
                <div>Value: ${info.value} ETH</div>
                <div>Type: ${info.txType || 'ETH'}</div>
            `;
        } else if (info.type === 'block') {
            content = `
                <div><strong>Block</strong></div>
                <div>Number: ${info.number}</div>
                <div>Hash: ${info.hash ? info.hash.slice(0, 6) + '...' + info.hash.slice(-4) : 'N/A'}</div>
                <div>Transactions: ${info.transactionCount}</div>
                <div>Gas Used: ${info.gasUsed}</div>
            `;
        } else if (info.type === 'address') {
            const addressType = info.isSmartContract ? 'Smart Contract' : 'EOA Address';
            const typeIcon = info.isSmartContract ? '🔺' : '🔵'; // Pyramid for contracts, circle for EOA
            content = `
                <div><strong>${typeIcon} ${addressType}</strong></div>
                <div>${info.address.slice(0, 6)}...${info.address.slice(-4)}</div>
                <div>Activity: ${info.activity} transactions</div>
            `;
        } else if (info.type === 'pending') {
            content = `
                <div><strong>Pending Transaction</strong></div>
                <div>Hash: ${info.hash.slice(0, 6)}...${info.hash.slice(-4)}</div>
                <div>From: ${info.from ? info.from.slice(0, 6) + '...' + info.from.slice(-4) : 'N/A'}</div>
                <div>To: ${info.to ? info.to.slice(0, 6) + '...' + info.to.slice(-4) : 'N/A'}</div>
                <div>Value: ${info.value || 'N/A'}</div>
                <div>Status: Waiting for confirmation</div>
            `;
        } else if (info.type === 'smartcontract') {
            content = `
                <div><strong>Smart Contract Call</strong></div>
                <div>Hash: ${info.hash ? info.hash.slice(0, 6) + '...' + info.hash.slice(-4) : 'N/A'}</div>
                <div>From: ${info.from ? info.from.slice(0, 6) + '...' + info.from.slice(-4) : 'N/A'}</div>
                <div>To: ${info.to ? info.to.slice(0, 6) + '...' + info.to.slice(-4) : 'N/A'}</div>
                <div>Value: ${info.value} ETH</div>
                <div>Function: ${info.functionSelector}</div>
            `;
        }
        
        this.tooltip.innerHTML = content;
        this.tooltip.style.display = 'block';
        this.tooltip.style.left = (event.clientX + 10) + 'px';
        this.tooltip.style.top = (event.clientY + 10) + 'px';
    }
    
    getOrCreateAddressNode(address, isSmartContract = false) {
        if (!this.settings.showAddressGraph) return null;
        
        if (this.addressNodes.has(address)) {
            const node = this.addressNodes.get(address);
            node.userData.activity++;
            node.userData.info.activity = node.userData.activity;
            
            // Update smart contract status if newly detected
            if (isSmartContract && !node.userData.isSmartContract) {
                node.userData.isSmartContract = true;
                node.userData.info.isSmartContract = true;
                // Update visual appearance to reflect smart contract status
                this.updateNodeAppearanceForSmartContract(node);
            }
            
            return node;
        }
        
        if (this.addressNodes.size >= this.maxAddressNodes) {
            // Find least important address to remove (low activity + old)
            const addressesToRemove = Array.from(this.addressNodes.entries())
                .map(([addr, node]) => ({
                    address: addr,
                    node: node,
                    // Importance score: higher activity and more recent = higher score (keep)
                    importance: node.userData.activity * 10 - (Date.now() - node.userData.lastActive) / 60000 // activity weight - minutes since last active
                }))
                .sort((a, b) => a.importance - b.importance); // Lower importance = remove first
            
            this.removeAddressNode(addressesToRemove[0].address);
        }
        
        // Create different geometry and materials for smart contracts vs regular addresses
        let geometry, material, color;
        
        if (isSmartContract) {
            // Smart contracts: Use pyramid (cone) with randomized colors
            geometry = new THREE.ConeGeometry(6, 12, 4); // 4-sided pyramid
            color = this.colors.smartContract[Math.floor(Math.random() * this.colors.smartContract.length)];
            material = new THREE.MeshPhongMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: 0.7, // Brighter emissive
                transparent: true,
                opacity: 0.9,
                wireframe: false // Solid pyramid for better distinction
            });
        } else {
            // EOA addresses: Spheres as requested
            geometry = new THREE.SphereGeometry(5, 16, 16);
            color = this.colors.addressNode[Math.floor(Math.random() * this.colors.addressNode.length)];
            material = new THREE.MeshPhongMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: 0.5,
                transparent: true,
                opacity: 0.8
            });
        }
        
        const node = new THREE.Mesh(geometry, material);
        
        // ENHANCED SPARSE POSITIONING: Increased spacing with gap checking
        let position;
        let attempts = 0;
        const maxAttempts = 20;
        const minDistanceFromOthers = 150; // Minimum distance from other address nodes
        
        do {
            const angle = Math.random() * Math.PI * 2;
            const radius = 500 + Math.random() * 1000; // MUCH SPARSER: 500-1500 units from center
            const height = (Math.random() - 0.5) * 800; // SPARSER: ±400 units vertically
            
            position = new THREE.Vector3(
                Math.cos(angle) * radius,
                height,
                Math.sin(angle) * radius
            );
            
            // Check distance from existing address nodes
            let tooClose = false;
            for (const [addr, existingNode] of this.addressNodes) {
                if (existingNode.position.distanceTo(position) < minDistanceFromOthers) {
                    tooClose = true;
                    break;
                }
            }
            
            if (!tooClose) break;
            attempts++;
        } while (attempts < maxAttempts);
        
        node.position.copy(position);
        
        node.userData = {
            address: address,
            activity: 1,
            lastActive: Date.now(),
            connections: new Set(),
            label: this.createAddressLabel(address, isSmartContract),
            isSmartContract: isSmartContract,
            info: {
                type: 'address',
                address: address,
                activity: 1,
                isSmartContract: isSmartContract
            }
        };
        
        this.addressGraphGroup.add(node);
        this.addressGraphGroup.add(node.userData.label);
        this.addressNodes.set(address, node);
        
        // Play subtle sound for new address
        if (window.audioEngine) {
            window.audioEngine.playNewAddress(address);
        }
        
        return node;
    }
    
    updateNodeAppearanceForSmartContract(node) {
        // Update existing regular address node to smart contract appearance (pyramid)
        const newGeometry = new THREE.ConeGeometry(6, 12, 4); // 4-sided pyramid
        const color = 0xff6600; // Orange color for smart contracts
        const newMaterial = new THREE.MeshPhongMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.7,
            transparent: true,
            opacity: 0.9,
            wireframe: false // Solid pyramid
        });
        
        // Dispose old geometry and material
        node.geometry.dispose();
        node.material.dispose();
        
        // Apply new geometry and material
        node.geometry = newGeometry;
        node.material = newMaterial;
        
        // Update label
        this.addressGraphGroup.remove(node.userData.label);
        node.userData.label = this.createAddressLabel(node.userData.address, true);
        this.addressGraphGroup.add(node.userData.label);
        
        // Position label
        node.userData.label.position.copy(node.position);
        node.userData.label.position.y += 15;
    }
    
    createAddressLabel(address, isSmartContract = false) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = isSmartContract ? 80 : 64; // Taller for smart contract labels
        
        context.fillStyle = 'rgba(0, 0, 0, 0.8)';
        context.fillRect(0, 0, 256, canvas.height);
        
        if (isSmartContract) {
            // Smart contract label with distinctive styling
            context.font = 'bold 14px Courier New';
            context.fillStyle = '#ff6600'; // Orange text for smart contracts
            context.textAlign = 'center';
            context.fillText('SMART CONTRACT', 128, 20);
            
            context.font = '12px Courier New';
            context.fillStyle = '#ffaa55';
            context.fillText(address.slice(0, 6) + '...' + address.slice(-4), 128, 45);
            
            // Add contract icon/symbol
            context.font = '16px Arial';
            context.fillStyle = '#ff6600';
            context.fillText('⚙️', 128, 65);
        } else {
            // Regular address label
            context.font = '16px Courier New';
            context.fillStyle = '#00ffff';
            context.textAlign = 'center';
            context.fillText(address.slice(0, 6) + '...' + address.slice(-4), 128, 40);
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        
        if (isSmartContract) {
            sprite.scale.set(45, 12, 1); // Slightly wider and taller for smart contracts
            sprite.position.y = 18;
        } else {
            sprite.scale.set(40, 10, 1);
            sprite.position.y = 15;
        }
        
        return sprite;
    }
    
    createBlockLabel(blockNumber, color) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;
        
        context.fillStyle = 'rgba(0, 0, 0, 0.8)';
        context.fillRect(0, 0, 256, 64);
        
        context.font = 'bold 18px Courier New';
        context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
        context.textAlign = 'center';
        context.fillText(`BLOCK ${blockNumber}`, 128, 25);
        
        context.font = '12px Courier New';
        context.fillStyle = '#ffffff';
        context.fillText(`#${blockNumber}`, 128, 45);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(60, 15, 1);
        
        return sprite;
    }
    
    removeAddressNode(address) {
        const node = this.addressNodes.get(address);
        if (node) {
            this.addressGraphGroup.remove(node);
            this.addressGraphGroup.remove(node.userData.label);
            this.addressNodes.delete(address);
        }
    }
    
    createConnection(fromNode, toNode, value, isERC20 = false) {
        // VALIDATION: Ensure we have valid nodes with positions
        if (!fromNode || !toNode || !fromNode.position || !toNode.position) {
            console.warn('Invalid nodes for connection:', { fromNode: !!fromNode, toNode: !!toNode });
            return;
        }
        
        const points = [];
        points.push(fromNode.position.clone());
        
        // FIXED: Create proper 3D arc between actual node positions
        const fromPos = fromNode.position.clone();
        const toPos = toNode.position.clone();
        
        // Ensure positions are valid
        if (!fromPos || !toPos || isNaN(fromPos.x) || isNaN(toPos.x)) {
            console.warn('Invalid node positions for connection:', { fromPos, toPos });
            return;
        }
        
        // Calculate midpoint naturally between the two nodes
        const midPoint = new THREE.Vector3();
        midPoint.addVectors(fromPos, toPos);
        midPoint.multiplyScalar(0.5);
        
        // Add RELATIVE arc height based on distance between nodes, not absolute offset
        const distance = fromPos.distanceTo(toPos);
        const arcHeight = Math.min(distance * 0.2, isERC20 ? 40 : 80); // Proportional to distance
        
        // Create natural arc direction (perpendicular to connection line)
        const direction = new THREE.Vector3().subVectors(toPos, fromPos).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const perpendicular = new THREE.Vector3().crossVectors(direction, up).normalize();
        
        // Add arc in natural 3D direction, not just upward
        if (perpendicular.length() > 0.1) {
            midPoint.add(perpendicular.multiplyScalar(arcHeight * 0.5));
        }
        midPoint.y += arcHeight * 0.5; // Small upward component for visibility
        
        points.push(midPoint);
        points.push(toPos.clone());
        
        // DEBUG: Log connection creation
        console.log(`Creating connection:`, {
            from: `(${fromPos.x.toFixed(0)}, ${fromPos.y.toFixed(0)}, ${fromPos.z.toFixed(0)})`,
            to: `(${toPos.x.toFixed(0)}, ${toPos.y.toFixed(0)}, ${toPos.z.toFixed(0)})`,
            midpoint: `(${midPoint.x.toFixed(0)}, ${midPoint.y.toFixed(0)}, ${midPoint.z.toFixed(0)})`,
            distance: distance.toFixed(0),
            arcHeight: arcHeight.toFixed(0),
            isERC20
        });
        
        // Create more prominent graph edge visualization
        const curve = new THREE.CatmullRomCurve3(points);
        const tubeRadius = Math.max(1.0, Math.min(4, value * 3 + (isERC20 ? 1 : 2))); // Thicker, more visible
        const geometry = new THREE.TubeGeometry(curve, 24, tubeRadius, 8, false); // Higher quality
        
        // Enhanced edge materials with better visibility
        const baseColor = isERC20 ? 0x00ff88 : 0x0088ff;
        const material = new THREE.MeshBasicMaterial({
            color: baseColor,
            transparent: true,
            opacity: Math.max(0.6, Math.min(0.9, value * 0.6 + 0.6)), // Higher base opacity
            blending: THREE.AdditiveBlending
        });
        
        const connection = new THREE.Mesh(geometry, material);
        connection.userData = {
            from: fromNode,
            to: toNode,
            value: value,
            isERC20: isERC20,
            lifespan: this.settings.itemLifespan * 1.2, // Extra duration for graph connections
            age: 0,
            curve: curve, // Store curve for flow effects
            baseColor: baseColor
        };
        
        this.addressGraphGroup.add(connection);
        this.connections.push(connection);
        
        // Update performance monitor
        this.performanceMonitor.connectionCount++;
        
        // ENHANCED DIRECTIONAL FLOW - Only if blockchain focus allows and not overloaded
        if (this.settings.blockchainFocus < 0.8 && 
            this.performanceMonitor.particleCount < this.performanceMonitor.maxParticles) {
            this.createDirectionalFlow(connection, curve, isERC20, value);
        }
        
        // Add connection creation pulse effect
        this.animateConnectionCreation(connection);
    }
    
    createDirectionalFlow(connection, curve, isERC20, value) {
        // PERFORMANCE OPTIMIZED: Reduced flow for better performance
        const baseFlowCount = Math.min(3, Math.max(1, Math.floor(value * 2 + 1))); // Reduced from 5 to 3 max
        const focusMultiplier = Math.max(0.2, 1 - this.settings.blockchainFocus); // More aggressive reduction
        const flowCount = Math.floor(baseFlowCount * focusMultiplier);
        
        if (flowCount <= 0) return; // Skip if blockchain focus is too high
        
        const flowColor = isERC20 ? 0x00ffaa : 0x0099ff;
        
        // OPTIMIZED: Create first particle immediately, delay others
        for (let i = 0; i < flowCount; i++) {
            const delay = i * 150; // Reduced from 200ms to 150ms
            if (delay === 0) {
                this.createDirectionalParticle(curve, flowColor, isERC20, value);
            } else {
                setTimeout(() => {
                    this.createDirectionalParticle(curve, flowColor, isERC20, value);
                }, delay);
            }
        }
    }
    
    createDirectionalParticle(curve, color, isERC20, value) {
        // Create arrow-like geometry for clear direction indication
        const geometry = new THREE.ConeGeometry(1.5, 4, 6);
        const material = new THREE.MeshPhongMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.9
        });
        
        const particle = new THREE.Mesh(geometry, material);
        
        // Add glowing trail effect
        const trailGeometry = new THREE.SphereGeometry(0.8, 6, 6);
        const trailMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending
        });
        const trail = new THREE.Mesh(trailGeometry, trailMaterial);
        
        particle.userData = {
            curve: curve,
            progress: 0,
            speed: 0.015 + (value * 0.005), // Faster for higher value transactions
            trail: trail,
            lifespan: 2 + (value * 0.5), // Longer life for higher value
            age: 0,
            isERC20: isERC20
        };
        
        this.addressGraphGroup.add(particle);
        this.addressGraphGroup.add(trail);
        
        // Update performance monitor
        this.performanceMonitor.particleCount++;
        
        // Animate the particle along the curve
        this.animateDirectionalParticle(particle);
    }
    
    animateDirectionalParticle(particle) {
        const animate = () => {
            if (!particle.parent) return; // Particle was removed
            
            particle.userData.age += 0.05;
            particle.userData.progress += particle.userData.speed;
            
            if (particle.userData.progress >= 1.0) {
                // Particle reached destination - create arrival effect
                this.createArrivalEffect(particle.position, particle.userData.isERC20);
                
                // Remove particle and trail
                this.addressGraphGroup.remove(particle);
                this.addressGraphGroup.remove(particle.userData.trail);
                
                // Update performance monitor
                this.performanceMonitor.particleCount--;
                return;
            }
            
            // Update position along curve
            const point = particle.userData.curve.getPoint(particle.userData.progress);
            particle.position.copy(point);
            
            // Update trail position (slightly behind)
            const trailProgress = Math.max(0, particle.userData.progress - 0.05);
            const trailPoint = particle.userData.curve.getPoint(trailProgress);
            particle.userData.trail.position.copy(trailPoint);
            
            // Orient particle in direction of movement
            if (particle.userData.progress < 0.95) {
                const nextPoint = particle.userData.curve.getPoint(particle.userData.progress + 0.01);
                particle.lookAt(nextPoint);
            }
            
            // Fade based on age
            const alpha = Math.max(0, 1 - (particle.userData.age / particle.userData.lifespan));
            particle.material.opacity = alpha * 0.9;
            particle.userData.trail.material.opacity = alpha * 0.4;
            
            if (alpha > 0) {
                requestAnimationFrame(animate);
            } else {
                // Remove expired particle
                this.addressGraphGroup.remove(particle);
                this.addressGraphGroup.remove(particle.userData.trail);
                
                // Update performance monitor
                this.performanceMonitor.particleCount--;
            }
        };
        
        animate();
    }
    
    createArrivalEffect(position, isERC20) {
        // Create burst effect when particle reaches destination
        const particleCount = 8;
        const color = isERC20 ? 0x00ffaa : 0x0099ff;
        
        for (let i = 0; i < particleCount; i++) {
            const geometry = new THREE.SphereGeometry(0.5, 4, 4);
            const material = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.8
            });
            
            const burstParticle = new THREE.Mesh(geometry, material);
            burstParticle.position.copy(position);
            
            const angle = (i / particleCount) * Math.PI * 2;
            const velocity = new THREE.Vector3(
                Math.cos(angle) * 10,
                Math.random() * 5,
                Math.sin(angle) * 10
            );
            
            burstParticle.userData = { velocity, age: 0 };
            this.addressGraphGroup.add(burstParticle);
            
            // Animate burst particle
            const animateBurst = () => {
                burstParticle.userData.age += 0.1;
                burstParticle.position.add(burstParticle.userData.velocity.clone().multiplyScalar(0.1));
                burstParticle.userData.velocity.multiplyScalar(0.95); // Friction
                
                const alpha = Math.max(0, 1 - burstParticle.userData.age);
                burstParticle.material.opacity = alpha * 0.8;
                burstParticle.scale.setScalar(1 + burstParticle.userData.age * 0.5);
                
                if (alpha > 0) {
                    requestAnimationFrame(animateBurst);
                } else {
                    this.addressGraphGroup.remove(burstParticle);
                }
            };
            
            animateBurst();
        }
    }
    
    animateConnectionCreation(connection) {
        // Animate connection appearing with a pulse effect
        const originalScale = connection.scale.clone();
        connection.scale.set(0.1, 0.1, 0.1);
        
        const animateScale = () => {
            const now = Date.now();
            const duration = 500; // 0.5 seconds
            const startTime = now;
            
            const scaleUp = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Ease-out cubic curve
                const easeProgress = 1 - Math.pow(1 - progress, 3);
                connection.scale.lerpVectors(new THREE.Vector3(0.1, 0.1, 0.1), originalScale, easeProgress);
                
                // Add pulse effect
                const pulse = 1 + Math.sin(progress * Math.PI * 6) * 0.1 * (1 - progress);
                connection.scale.multiplyScalar(pulse);
                
                if (progress < 1) {
                    requestAnimationFrame(scaleUp);
                } else {
                    connection.scale.copy(originalScale);
                }
            };
            
            scaleUp();
        };
        
        animateScale();
    }
    
    addTransaction(tx) {
        const isERC20 = tx.type === 'erc20';
        const value = isERC20 ? 
            (parseFloat(tx.value) / 1e18) : 
            (parseInt(tx.value || '0', 16) / 1e18);
        const size = isERC20 ? 
            Math.max(3, Math.min(20, value * 5)) : 
            Math.max(8, Math.min(50, value * 10));
        
        if (tx.from && tx.to && this.settings.showAddressGraph) {
            // IMPROVED GRAPH VISUALIZATION: Show most transactions for proper graph representation
            const minValueThreshold = isERC20 ? 0.01 : 0.001; // Lower thresholds for better graph visibility
            const showConnection = value > minValueThreshold; // Show all qualifying transactions
            
            // Detect if the 'to' address is a smart contract
            const isToAddressSmartContract = tx.to && tx.input && tx.input.length > 2;
            
            // DEBUG: Log transaction processing
            if (showConnection) {
                console.log(`Processing ${isERC20 ? 'ERC20' : 'ETH'} transaction:`, {
                    from: tx.from?.slice(0, 8) + '...',
                    to: tx.to?.slice(0, 8) + '...',
                    value: value.toFixed(4),
                    isSmartContract: isToAddressSmartContract
                });
            }
            
            const fromNode = this.getOrCreateAddressNode(tx.from, false); // 'from' is typically an EOA
            const toNode = this.getOrCreateAddressNode(tx.to, isToAddressSmartContract);
            
            // DEBUG: Log node creation results
            if (showConnection) {
                console.log(`Nodes created:`, {
                    fromNode: fromNode ? `${fromNode.userData.isSmartContract ? 'Contract' : 'EOA'} at (${fromNode.position.x.toFixed(0)}, ${fromNode.position.y.toFixed(0)}, ${fromNode.position.z.toFixed(0)})` : 'NULL',
                    toNode: toNode ? `${toNode.userData.isSmartContract ? 'Contract' : 'EOA'} at (${toNode.position.x.toFixed(0)}, ${toNode.position.y.toFixed(0)}, ${toNode.position.z.toFixed(0)})` : 'NULL'
                });
            }
            
            if (fromNode && toNode && showConnection) {
                // Create connection between sender and receiver nodes
                this.createConnection(fromNode, toNode, value, isERC20);
                
                fromNode.userData.lastActive = Date.now();
                toNode.userData.lastActive = Date.now();
                
                const scaleBoost = isERC20 ? 
                    1 + Math.min(0.2, value * 0.05) : 
                    1 + Math.min(0.5, value * 0.1);
                fromNode.scale.multiplyScalar(scaleBoost);
                toNode.scale.multiplyScalar(scaleBoost);
                
                setTimeout(() => {
                    fromNode.scale.divideScalar(scaleBoost);
                    toNode.scale.divideScalar(scaleBoost);
                }, 1000);
            }
        }
        
        // FIXED: PURE GRAPH VISUALIZATION - No separate transaction objects!
        // Transactions are now ONLY represented as graph edges between address nodes
        // The graph structure is: Spheres (EOA) <--edges--> Pyramids (Smart Contracts)
        
        // Only play transaction sound if we created a connection
        if (tx.from && tx.to && this.settings.showAddressGraph) {
            const minValueThreshold = isERC20 ? 0.01 : 0.001;
            if (value > minValueThreshold) {
                // Play subtle new transaction sound for streaming transactions
                if (window.audioEngine) {
                    window.audioEngine.playNewTransaction();
                }
            }
        }
        
        // NOTE: No transaction objects created - pure graph visualization only!
    }
    
    addSmartContractCall(tx) {
        // FIXED: PURE GRAPH VISUALIZATION - Smart contract calls are also graph edges!
        // Create graph connection between caller (EOA) and contract (pyramid)
        
        if (!tx.from || !tx.to || !this.settings.showAddressGraph) return;
        
        const value = parseInt(tx.value || '0', 16) / 1e18;
        const minValueThreshold = 0.0001; // Show most smart contract calls
        
        if (value < minValueThreshold && (!tx.input || tx.input.length <= 2)) {
            return; // Skip very low value calls without data
        }
        
        // DEBUG: Log smart contract call processing
        console.log(`Processing smart contract call:`, {
            from: tx.from?.slice(0, 8) + '...',
            to: tx.to?.slice(0, 8) + '...',
            value: value.toFixed(4),
            hasInput: !!(tx.input && tx.input.length > 2)
        });
        
        // Create nodes: caller (EOA) and target contract (pyramid)
        const fromNode = this.getOrCreateAddressNode(tx.from, false); // Caller is EOA
        const toNode = this.getOrCreateAddressNode(tx.to, true); // Target is smart contract
        
        if (fromNode && toNode) {
            // Create special connection for smart contract calls
            this.createSmartContractConnection(fromNode, toNode, value, tx);
            
            // Update node activity
            fromNode.userData.lastActive = Date.now();
            toNode.userData.lastActive = Date.now();
            fromNode.userData.activity += 2; // Smart contract calls are more significant
            toNode.userData.activity += 2;
            
            // Visual feedback for smart contract interaction
            const scaleBoost = 1.3 + Math.min(0.4, value * 0.2);
            fromNode.scale.multiplyScalar(scaleBoost);
            toNode.scale.multiplyScalar(scaleBoost);
            
            setTimeout(() => {
                fromNode.scale.divideScalar(scaleBoost);
                toNode.scale.divideScalar(scaleBoost);
            }, 1500); // Longer boost for contract calls
            
            // Play smart contract interaction sound
            if (window.audioEngine) {
                window.audioEngine.playSmartContract(tx);
            }
        }
    }
    
    createSmartContractConnection(fromNode, toNode, value, tx) {
        // Enhanced connection for smart contract calls with distinctive appearance
        const points = [];
        const fromPos = fromNode.position.clone();
        const toPos = toNode.position.clone();
        points.push(fromPos);
        
        // Calculate special arc for smart contract calls
        const midPoint = new THREE.Vector3();
        midPoint.addVectors(fromPos, toPos);
        midPoint.multiplyScalar(0.5);
        
        const distance = fromPos.distanceTo(toPos);
        const arcHeight = Math.min(distance * 0.4, 100); // Higher arc for contract calls
        
        // Create distinctive arc for smart contract calls
        const direction = new THREE.Vector3().subVectors(toPos, fromPos).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const perpendicular = new THREE.Vector3().crossVectors(direction, up).normalize();
        
        if (perpendicular.length() > 0.1) {
            midPoint.add(perpendicular.multiplyScalar(arcHeight * 0.7));
        }
        midPoint.y += arcHeight * 0.3;
        
        points.push(midPoint);
        points.push(toPos);
        
        const curve = new THREE.CatmullRomCurve3(points);
        const tubeRadius = Math.max(1.5, Math.min(5, value * 4 + 2)); // Thicker for contract calls
        const geometry = new THREE.TubeGeometry(curve, 32, tubeRadius, 12, false);
        
        // Distinctive color for smart contract calls (purple/magenta)
        const material = new THREE.MeshBasicMaterial({
            color: 0xff00cc, // Bright magenta for smart contracts
            transparent: true,
            opacity: Math.max(0.7, Math.min(0.95, value * 0.8 + 0.7)),
            blending: THREE.AdditiveBlending
        });
        
        const connection = new THREE.Mesh(geometry, material);
        connection.userData = {
            from: fromNode,
            to: toNode,
            value: value,
            isERC20: false,
            isSmartContract: true,
            lifespan: this.settings.itemLifespan * 1.3, // Longer lifespan for contract calls
            age: 0,
            curve: curve,
            tx: tx
        };
        
        this.addressGraphGroup.add(connection);
        this.connections.push(connection);
        
        // Update performance monitor
        this.performanceMonitor.connectionCount++;
        
        // Enhanced flow for smart contract calls
        if (this.settings.blockchainFocus < 0.9 && 
            this.performanceMonitor.particleCount < this.performanceMonitor.maxParticles) {
            this.createSmartContractFlow(connection, curve, value, tx);
        }
        
        // Add creation animation
        this.animateConnectionCreation(connection);
    }
    
    createSmartContractFlow(connection, curve, value, tx) {
        // Special flow for smart contract calls - more dramatic
        const flowCount = Math.min(6, Math.max(2, Math.floor(value * 3 + 3)));
        const flowColor = 0xff00cc; // Magenta for smart contracts
        
        for (let i = 0; i < flowCount; i++) {
            const delay = i * 100;
            if (delay === 0) {
                this.createSmartContractParticle(curve, flowColor, value, tx);
            } else {
                setTimeout(() => {
                    this.createSmartContractParticle(curve, flowColor, value, tx);
                }, delay);
            }
        }
    }
    
    createSmartContractParticle(curve, color, value, tx) {
        // Diamond-shaped particles for smart contract calls
        const geometry = new THREE.OctahedronGeometry(2, 0);
        const material = new THREE.MeshPhongMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 1.2,
            transparent: true,
            opacity: 0.9
        });
        
        const particle = new THREE.Mesh(geometry, material);
        
        // Glowing trail for smart contract particles
        const trailGeometry = new THREE.SphereGeometry(1, 6, 6);
        const trailMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending
        });
        const trail = new THREE.Mesh(trailGeometry, trailMaterial);
        
        particle.userData = {
            curve: curve,
            progress: 0,
            speed: 0.018 + (value * 0.008), // Slightly faster for contracts
            trail: trail,
            lifespan: 3 + (value * 0.8),
            age: 0,
            isSmartContract: true,
            tx: tx
        };
        
        this.addressGraphGroup.add(particle);
        this.addressGraphGroup.add(trail);
        
        // Update performance monitor
        this.performanceMonitor.particleCount++;
        
        // Animate the particle along the curve
        this.animateDirectionalParticle(particle);
    }
    
    createShootingStarTrail(mesh) {
        const trailGeometry = new THREE.BufferGeometry();
        const trailPositions = new Float32Array(60); // 20 points * 3 coordinates
        
        for (let i = 0; i < 20; i++) {
            trailPositions[i * 3] = mesh.position.x;
            trailPositions[i * 3 + 1] = mesh.position.y;
            trailPositions[i * 3 + 2] = mesh.position.z;
        }
        
        trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
        
        const trailMaterial = new THREE.LineBasicMaterial({
            color: mesh.material.color,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });
        
        const trailMesh = new THREE.Line(trailGeometry, trailMaterial);
        mesh.userData.trailMesh = trailMesh;
        mesh.userData.trailPositions = trailPositions;
        this.scene.add(trailMesh);
    }
    
    createTransactionTrail(mesh) {
        const trailGeometry = new THREE.BufferGeometry();
        const trailPositions = new Float32Array(30);
        
        for (let i = 0; i < 10; i++) {
            trailPositions[i * 3] = mesh.position.x;
            trailPositions[i * 3 + 1] = mesh.position.y;
            trailPositions[i * 3 + 2] = mesh.position.z;
        }
        
        trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
        
        const trailMaterial = new THREE.LineBasicMaterial({
            color: mesh.material.color,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending
        });
        
        const trail = new THREE.Line(trailGeometry, trailMaterial);
        mesh.userData.trail = trail;
        this.scene.add(trail);
    }
    
    addPendingTransaction(tx) {
        if (this.pendingTransactions.has(tx.hash)) return;
        
        const geometry = new THREE.SphereGeometry(2, 8, 8);
        const material = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.3
        });
        
        const star = new THREE.Mesh(geometry, material);
        
        // Place stars far away - INCREASED SPACING for more sparse layout
        const distance = 1200 + Math.random() * 600; // 1200-1800 units from center
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        
        star.position.set(
            distance * Math.sin(phi) * Math.cos(theta),
            distance * Math.sin(phi) * Math.sin(theta),
            distance * Math.cos(phi)
        );
        
        star.userData = {
            hash: tx.hash,
            tx: tx,
            twinkleSpeed: 2 + Math.random() * 2,
            twinklePhase: Math.random() * Math.PI * 2,
            info: {
                type: 'pending',
                hash: tx.hash,
                from: tx.from,
                to: tx.to,
                value: (parseInt(tx.value || '0', 16) / 1e18).toFixed(4) + ' ETH'
            }
        };
        
        this.pendingTransactionsGroup.add(star);
        this.pendingTransactions.set(tx.hash, star);
        
        // Clean up old pending transactions
        if (this.pendingTransactions.size > 50) {
            const oldestHash = this.pendingTransactions.keys().next().value;
            const oldStar = this.pendingTransactions.get(oldestHash);
            this.pendingTransactionsGroup.remove(oldStar);
            this.pendingTransactions.delete(oldestHash);
        }
    }
    
    removePendingTransaction(hash) {
        const star = this.pendingTransactions.get(hash);
        if (star) {
            // Animate the star moving towards center before removal
            const duration = 1000;
            const startTime = Date.now();
            const startPos = star.position.clone();
            
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                star.position.lerpVectors(startPos, new THREE.Vector3(0, 0, 0), progress);
                star.scale.setScalar(1 - progress);
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.pendingTransactionsGroup.remove(star);
                    this.pendingTransactions.delete(hash);
                }
            };
            
            animate();
        }
    }
    
    addBlock(block) {
        // Remove pending transactions that are now in this block
        if (block.transactions) {
            block.transactions.forEach(tx => {
                if (tx.hash) {
                    this.removePendingTransaction(tx.hash);
                }
            });
        }
        
        // Create distinctive block with geometric core
        const group = new THREE.Group();
        const color = this.colors.block[Math.floor(Math.random() * this.colors.block.length)];
        
        // Create central block core - large distinctive shape
        const coreGeometry = new THREE.OctahedronGeometry(15, 1);
        const coreMaterial = new THREE.MeshPhongMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.9,
            wireframe: true
        });
        const core = new THREE.Mesh(coreGeometry, coreMaterial);
        group.add(core);
        
        // Add inner solid core for more distinction
        const innerCoreGeometry = new THREE.SphereGeometry(8, 16, 16);
        const innerCoreMaterial = new THREE.MeshPhongMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.4,
            transparent: true,
            opacity: 0.6
        });
        const innerCore = new THREE.Mesh(innerCoreGeometry, innerCoreMaterial);
        group.add(innerCore);
        
        // Create structured constellation points around the core (reduced by blockchain focus)
        const focusMultiplier = 1 - this.settings.blockchainFocus;
        const baseStarCount = Math.min(16, 4 + Math.floor(block.transactions.length / 2));
        const starCount = Math.floor(baseStarCount * focusMultiplier);
        const stars = [];
        
        for (let i = 0; i < starCount; i++) {
            const starGeometry = new THREE.SphereGeometry(1.5 + Math.random() * 2, 8, 8);
            const starMaterial = new THREE.MeshPhongMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: 0.5 + Math.random() * 0.3,
                transparent: true,
                opacity: 0.7
            });
            
            const star = new THREE.Mesh(starGeometry, starMaterial);
            
            // Position stars in a more structured pattern around the core
            const angle = (i / starCount) * Math.PI * 2;
            const radius = 25 + Math.random() * 15;
            const height = (Math.random() - 0.5) * 20;
            
            star.position.set(
                Math.cos(angle) * radius,
                height,
                Math.sin(angle) * radius
            );
            
            stars.push(star);
            group.add(star);
        }
        
        // Add block number label
        const blockLabel = this.createBlockLabel(block.number, color);
        blockLabel.position.set(0, 25, 0);
        group.add(blockLabel);
        
        // Create constellation lines
        const lineGeometry = new THREE.BufferGeometry();
        const linePositions = [];
        
        // Connect stars in a meaningful pattern
        for (let i = 0; i < stars.length - 1; i++) {
            if (Math.random() > 0.3) { // Don't connect all stars
                linePositions.push(
                    stars[i].position.x, stars[i].position.y, stars[i].position.z,
                    stars[i + 1].position.x, stars[i + 1].position.y, stars[i + 1].position.z
                );
            }
        }
        
        lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        const lineMaterial = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending
        });
        
        const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
        group.add(lines);
        
        // Position constellation using spatial growth
        const blockPosition = this.getNextBlockPosition();
        group.position.copy(blockPosition);
        
        group.scale.set(0.1, 0.1, 0.1);
        
        group.userData = {
            targetScale: 1,
            rotationSpeed: 0.005,
            pulsePhase: Math.random() * Math.PI * 2,
            block: block,
            stars: stars,
            core: core,
            innerCore: innerCore,
            info: {
                type: 'block',
                number: block.number,
                hash: block.hash,
                transactionCount: block.transactions ? block.transactions.length : 0,
                gasUsed: block.gasUsed
            }
        };
        
        this.scene.add(group);
        this.blocks.push(group);
        
        this.createBlockExplosion(group.position, color, block);
        
        if (this.blocks.length > 20) {
            const oldBlock = this.blocks.shift();
            this.scene.remove(oldBlock);
        }
    }
    
    createBlockExplosion(position, color, block) {
        const particles = [];
        
        // ENHANCED BLOCK VISUALIZATION: Create both particles AND larger node/edge connections
        if (block.transactions && block.transactions.length > 0) {
            const maxParticles = Math.min(block.transactions.length, 20); // Limit for performance
            
            // First, create larger address nodes and connections for block transactions
            this.createBlockTransactionConnections(block);
            
            for (let i = 0; i < maxParticles; i++) {
                const tx = block.transactions[i];
                const value = parseInt(tx.value || '0', 16) / 1e18;
                const isSmartContract = tx.to && tx.input && tx.input.length > 2;
                
                // Different shapes for different transaction types
                let geometry;
                let txColor;
                
                if (isSmartContract) {
                    // Smart contracts as cubes
                    geometry = new THREE.BoxGeometry(3, 3, 3);
                    const functionSelector = tx.input ? tx.input.slice(0, 10) : '0x00000000';
                    const colorSeed = parseInt(functionSelector.slice(2, 6), 16);
                    const hue = (colorSeed % 360) / 360;
                    txColor = new THREE.Color().setHSL(hue, 1, 0.6);
                } else {
                    // Regular transactions as tetrahedrons
                    const size = Math.max(1, Math.min(4, value * 20));
                    geometry = new THREE.TetrahedronGeometry(size);
                    txColor = new THREE.Color(this.colors.transaction[i % this.colors.transaction.length]);
                }
                
                const material = new THREE.MeshBasicMaterial({
                    color: txColor,
                    transparent: true,
                    opacity: 1
                });
                
                const particle = new THREE.Mesh(geometry, material);
                particle.position.copy(position);
                
                // Random explosion velocity
                const explosionForce = 15 + Math.random() * 10;
                particle.userData = {
                    velocity: new THREE.Vector3(
                        (Math.random() - 0.5) * explosionForce,
                        (Math.random() - 0.5) * explosionForce,
                        (Math.random() - 0.5) * explosionForce
                    ),
                    rotationSpeed: new THREE.Vector3(
                        (Math.random() - 0.5) * 0.2,
                        (Math.random() - 0.5) * 0.2,
                        (Math.random() - 0.5) * 0.2
                    ),
                    lifespan: 3,
                    age: 0,
                    tx: tx,
                    info: {
                        type: 'explosion_particle',
                        hash: tx.hash,
                        value: value.toFixed(4),
                        isSmartContract: isSmartContract
                    }
                };
                
                this.scene.add(particle);
                particles.push(particle);
            }
        } else {
            // Fallback: create generic particles if no transactions
            for (let i = 0; i < 10; i++) {
                const geometry = new THREE.SphereGeometry(2, 4, 4);
                const material = new THREE.MeshBasicMaterial({
                    color: color,
                    transparent: true,
                    opacity: 1
                });
                
                const particle = new THREE.Mesh(geometry, material);
                particle.position.copy(position);
                
                particle.userData = {
                    velocity: new THREE.Vector3(
                        (Math.random() - 0.5) * 20,
                        (Math.random() - 0.5) * 20,
                        (Math.random() - 0.5) * 20
                    ),
                    lifespan: 2,
                    age: 0
                };
                
                this.scene.add(particle);
                particles.push(particle);
            }
        }
        
        // Animate explosion particles
        const animateExplosion = () => {
            let aliveParticles = 0;
            
            particles.forEach(particle => {
                particle.userData.age += 0.05;
                
                // Move particle
                particle.position.add(particle.userData.velocity);
                
                // Apply gravity and friction
                particle.userData.velocity.y -= 0.3; // Gravity
                particle.userData.velocity.multiplyScalar(0.98); // Friction
                
                // Rotate particle
                if (particle.userData.rotationSpeed) {
                    particle.rotation.x += particle.userData.rotationSpeed.x;
                    particle.rotation.y += particle.userData.rotationSpeed.y;
                    particle.rotation.z += particle.userData.rotationSpeed.z;
                }
                
                // Fade out over time
                const opacity = Math.max(0, 1 - particle.userData.age / particle.userData.lifespan);
                particle.material.opacity = opacity;
                
                if (opacity > 0) {
                    aliveParticles++;
                } else if (particle.parent) {
                    this.scene.remove(particle);
                }
            });
            
            if (aliveParticles > 0) {
                requestAnimationFrame(animateExplosion);
            }
        };
        
        animateExplosion();
    }
    
    createBlockTransactionConnections(block) {
        // Create prominent node/edge connections for transactions within this block
        // OPTIMIZED BATCH PROCESSING: Prevent main thread blocking
        if (!block.transactions || !this.settings.showAddressGraph) return;
        
        // ELEVATION SYSTEM: Each new block's transactions are 10% higher
        this.blockTransactionElevation += 50; // Increase elevation by 50 units for each new block
        
        // Filter qualifying transactions with performance optimization
        const qualifyingTxs = block.transactions.filter(tx => {
            if (!tx.from || !tx.to) return false;
            
            const isERC20 = tx.type === 'erc20' || (tx.input && tx.input.includes('a9059cbb'));
            const value = isERC20 ? 
                (parseFloat(tx.value || '0') / 1e18) : 
                (parseInt(tx.value || '0', 16) / 1e18);
            
            return value >= 0.0001 || isERC20;
        });
        
        if (qualifyingTxs.length === 0) return;
        
        // PERFORMANCE OPTIMIZED: Limit processing to prevent freezing
        const maxTransactions = Math.min(qualifyingTxs.length, 50); // Cap at 50 transactions per block
        const limitedTxs = qualifyingTxs.slice(0, maxTransactions);
        
        // Use requestAnimationFrame for non-blocking processing
        this.scheduleBlockTransactionProcessing(limitedTxs, block.number, this.blockTransactionElevation);
    }
    
    scheduleBlockTransactionProcessing(transactions, blockNumber, elevation) {
        // NON-BLOCKING PROCESSING using requestAnimationFrame
        let currentIndex = 0;
        const batchSize = 3; // Small batches to prevent blocking
        const totalDuration = 11000; // 11 seconds total
        const intervalBetweenBatches = totalDuration / Math.ceil(transactions.length / batchSize);
        
        const processNextBatch = () => {
            if (currentIndex >= transactions.length) return;
            
            // Process small batch
            const batch = transactions.slice(currentIndex, currentIndex + batchSize);
            
            // Process batch with minimal blocking
            try {
                this.processBatchTransactions(batch, blockNumber, elevation);
            } catch (error) {
                console.warn('Error processing batch:', error);
            }
            
            currentIndex += batchSize;
            
            // Schedule next batch using setTimeout to maintain timing
            if (currentIndex < transactions.length) {
                setTimeout(() => {
                    // Use requestAnimationFrame to ensure non-blocking
                    requestAnimationFrame(() => {
                        processNextBatch();
                    });
                }, intervalBetweenBatches);
            }
        };
        
        // Start processing with initial delay
        setTimeout(() => {
            requestAnimationFrame(() => {
                processNextBatch();
            });
        }, 100); // Small initial delay to let block visualization complete
    }
    
    processBatchTransactions(transactions, blockNumber, elevation) {
        // OPTIMIZED: Process batch immediately without additional setTimeout delays
        transactions.forEach((tx, batchIndex) => {
            try {
                const isERC20 = tx.type === 'erc20' || (tx.input && tx.input.includes('a9059cbb'));
                const value = isERC20 ? 
                    (parseFloat(tx.value || '0') / 1e18) : 
                    (parseInt(tx.value || '0', 16) / 1e18);
                
                // Detect smart contracts
                const isToAddressSmartContract = tx.to && tx.input && tx.input.length > 2;
                
                const fromNode = this.getOrCreateAddressNode(tx.from, false);
                const toNode = this.getOrCreateAddressNode(tx.to, isToAddressSmartContract);
                
                if (fromNode && toNode) {
                    // Create ENHANCED connection for block transactions
                    this.createBlockTransactionConnection(fromNode, toNode, value, isERC20, blockNumber, elevation);
                    
                    // Boost node activity for block transactions
                    fromNode.userData.activity += 2;
                    toNode.userData.activity += 2;
                    fromNode.userData.lastActive = Date.now();
                    toNode.userData.lastActive = Date.now();
                    
                    // OPTIMIZED: Simpler scale boost without heavy setTimeout
                    const scaleBoost = 1.2 + Math.min(0.3, value * 0.1); // Reduced intensity
                    fromNode.scale.multiplyScalar(scaleBoost);
                    toNode.scale.multiplyScalar(scaleBoost);
                    
                    // Store scale info for gradual reduction in animation loop
                    fromNode.userData.scaleBoost = { factor: scaleBoost, startTime: Date.now(), duration: 3000 };
                    toNode.userData.scaleBoost = { factor: scaleBoost, startTime: Date.now(), duration: 3000 };
                    
                    // THROTTLED AUDIO: Only play audio for every other transaction to reduce load
                    if (batchIndex % 2 === 0) {
                        // Play subtle new transaction sound
                        if (window.audioEngine) {
                            window.audioEngine.playNewTransaction();
                        }
                        
                        // Play audio for this transaction
                        if (window.audioEngine) {
                            window.audioEngine.playTransaction(tx);
                        }
                    }
                }
            } catch (error) {
                console.warn('Error processing transaction:', error);
            }
        });
    }
    
    createBlockTransactionConnection(fromNode, toNode, value, isERC20, blockNumber, elevation = 0) {
        // Enhanced connection for block transactions - larger and more prominent
        const points = [];
        points.push(fromNode.position.clone());
        
        // FIXED: Create proper 3D arc for block transactions
        const fromPos = fromNode.position.clone();
        const toPos = toNode.position.clone();
        
        // Calculate midpoint naturally between the two nodes
        const midPoint = new THREE.Vector3();
        midPoint.addVectors(fromPos, toPos);
        midPoint.multiplyScalar(0.5);
        
        // Block transactions get higher arcs but still relative to distance
        const distance = fromPos.distanceTo(toPos);
        const baseArcHeight = Math.min(distance * 0.3, isERC20 ? 60 : 120); // Higher than regular connections
        const arcHeight = baseArcHeight + elevation * 0.2; // Add elevation factor
        
        // Create natural arc direction for block transactions
        const direction = new THREE.Vector3().subVectors(toPos, fromPos).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const perpendicular = new THREE.Vector3().crossVectors(direction, up).normalize();
        
        // Add arc in natural 3D direction with block transaction enhancement
        if (perpendicular.length() > 0.1) {
            midPoint.add(perpendicular.multiplyScalar(arcHeight * 0.6));
        }
        midPoint.y += arcHeight * 0.4; // Slight upward bias for block transactions
        
        points.push(midPoint);
        points.push(toPos.clone());
        
        const curve = new THREE.CatmullRomCurve3(points);
        
        // LARGER tubes for block transactions
        const tubeRadius = Math.max(2.0, Math.min(6, value * 4 + (isERC20 ? 1.5 : 2.5))); // Even thicker for block txs
        const geometry = new THREE.TubeGeometry(curve, 32, tubeRadius, 12, false); // Higher quality
        
        // Special colors for block transactions with distinctive appearance
        const baseColor = isERC20 ? 0xffaa00 : 0xaa00ff; // Orange for ERC20, purple for ETH in blocks
        const material = new THREE.MeshBasicMaterial({
            color: baseColor,
            transparent: true,
            opacity: Math.max(0.7, Math.min(0.95, value * 0.8 + 0.7)), // Higher base opacity
            blending: THREE.AdditiveBlending
        });
        
        const connection = new THREE.Mesh(geometry, material);
        connection.userData = {
            from: fromNode,
            to: toNode,
            value: value,
            isERC20: isERC20,
            isBlockTransaction: true,
            blockNumber: blockNumber,
            lifespan: this.settings.itemLifespan * 1.5, // 1.5x longer lifespan for block transactions
            age: 0,
            curve: curve,
            baseColor: baseColor
        };
        
        this.addressGraphGroup.add(connection);
        this.connections.push(connection);
        
        // ENHANCED BLOCK TRANSACTION FLOW - More prominent than regular transactions
        if (this.settings.blockchainFocus < 0.9) { // Allow slightly more flow for block transactions
            this.createEnhancedBlockFlow(connection, curve, isERC20, value, blockNumber);
        }
        
        // Add connection creation pulse effect with block-specific styling
        this.animateBlockConnectionCreation(connection);
    }
    
    createEnhancedBlockFlow(connection, curve, isERC20, value, blockNumber) {
        // PERFORMANCE OPTIMIZED: Reduced particle count to prevent blocking
        const baseFlowCount = Math.min(4, Math.max(2, Math.floor(value * 2 + 2))); // Reduced particle count
        const focusMultiplier = Math.max(0.3, 1 - this.settings.blockchainFocus); // More aggressive reduction
        const flowCount = Math.floor(baseFlowCount * focusMultiplier);
        
        if (flowCount <= 0) return; // Skip if blockchain focus is too high
        
        const flowColor = isERC20 ? 0xffcc33 : 0xcc33ff; // Brighter colors for block transactions
        
        // Create particles immediately without setTimeout to reduce event loop pressure
        for (let i = 0; i < flowCount; i++) {
            // Add small delay using requestAnimationFrame instead of setTimeout
            const delay = i * 100; // Reduced from 150ms to 100ms
            if (delay === 0) {
                this.createEnhancedBlockParticle(curve, flowColor, isERC20, value, blockNumber);
            } else {
                setTimeout(() => {
                    this.createEnhancedBlockParticle(curve, flowColor, isERC20, value, blockNumber);
                }, delay);
            }
        }
    }
    
    createEnhancedBlockParticle(curve, color, isERC20, value, blockNumber) {
        // Larger, more prominent particles for block transactions
        const geometry = new THREE.ConeGeometry(2.5, 6, 8); // Larger arrow geometry
        const material = new THREE.MeshPhongMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 1.0, // Higher intensity for block transactions
            transparent: true,
            opacity: 0.95
        });
        
        const particle = new THREE.Mesh(geometry, material);
        
        // Enhanced trail effect for block transactions
        const trailGeometry = new THREE.SphereGeometry(1.2, 8, 8);
        const trailMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });
        const trail = new THREE.Mesh(trailGeometry, trailMaterial);
        
        particle.userData = {
            curve: curve,
            progress: 0,
            speed: 0.012 + (value * 0.004), // Slightly slower for more visibility
            trail: trail,
            lifespan: 3 + (value * 0.7), // Longer life for block transactions
            age: 0,
            isERC20: isERC20,
            isBlockTransaction: true,
            blockNumber: blockNumber
        };
        
        this.addressGraphGroup.add(particle);
        this.addressGraphGroup.add(trail);
        
        // Animate the particle along the curve
        this.animateDirectionalParticle(particle);
    }
    
    animateBlockConnectionCreation(connection) {
        // Enhanced animation for block transactions with glow effect
        const originalScale = connection.scale.clone();
        connection.scale.set(0.05, 0.05, 0.05);
        
        const animateScale = () => {
            const now = Date.now();
            const duration = 800; // Longer animation for block transactions
            const startTime = now;
            
            const scaleUp = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Ease-out cubic curve with extra bounce
                const easeProgress = 1 - Math.pow(1 - progress, 3);
                connection.scale.lerpVectors(new THREE.Vector3(0.05, 0.05, 0.05), originalScale, easeProgress);
                
                // Add enhanced pulse effect for block transactions
                const pulse = 1 + Math.sin(progress * Math.PI * 8) * 0.15 * (1 - progress);
                connection.scale.multiplyScalar(pulse);
                
                // Add color intensity animation
                if (connection.material) {
                    const intensity = 0.5 + Math.sin(progress * Math.PI * 4) * 0.3;
                    connection.material.opacity = connection.material.opacity * intensity;
                }
                
                if (progress < 1) {
                    requestAnimationFrame(scaleUp);
                } else {
                    connection.scale.copy(originalScale);
                }
            };
            
            scaleUp();
        };
        
        animateScale();
    }
    
    updateSettings(settings) {
        Object.assign(this.settings, settings);
        
        // Update particle system color intensity
        if (this.particles && this.particles.material.uniforms) {
            this.particles.material.uniforms.colorIntensity.value = this.settings.colorIntensity;
        }
        
        // Update particle count - recreate particle system if needed
        if (settings.particleCount !== undefined && this.particles) {
            this.scene.remove(this.particles);
            this.createParticleSystem();
        }
        
        // Update blockchain focus - recreate particle system to reflect new focus level
        if (settings.blockchainFocus !== undefined && this.particles) {
            this.scene.remove(this.particles);
            this.createParticleSystem();
        }
        
        // Update rotation speed for existing blocks
        if (settings.rotationSpeed !== undefined) {
            this.blocks.forEach(block => {
                // Scale the rotation speed based on new setting
                block.userData.rotationSpeed = 0.005 * this.settings.rotationSpeed;
            });
        }
        
        // Update color intensity for existing address nodes
        if (settings.colorIntensity !== undefined) {
            this.addressNodes.forEach((node, address) => {
                if (node.material) {
                    // Update emissive intensity for address nodes
                    const baseIntensity = node.userData.isSmartContract ? 0.7 : 0.5;
                    node.material.emissiveIntensity = baseIntensity * (0.5 + this.settings.colorIntensity * 0.5);
                }
            });
            
            // Update existing transactions
            this.transactions.forEach(tx => {
                if (tx.material) {
                    const baseIntensity = tx.userData.tx.type === 'erc20' ? 0.3 : 0.5;
                    tx.material.emissiveIntensity = baseIntensity * (0.5 + this.settings.colorIntensity * 0.5);
                }
            });
            
            // Update existing smart contracts
            this.smartContracts.forEach(sc => {
                if (sc.material) {
                    sc.material.emissiveIntensity = 0.8 * (0.5 + this.settings.colorIntensity * 0.5);
                }
            });
            
            // Update existing blocks
            this.blocks.forEach(block => {
                if (block.userData.core && block.userData.core.material) {
                    block.userData.core.material.emissiveIntensity = 0.8 * (0.5 + this.settings.colorIntensity * 0.5);
                }
                if (block.userData.innerCore && block.userData.innerCore.material) {
                    block.userData.innerCore.material.emissiveIntensity = 0.4 * (0.5 + this.settings.colorIntensity * 0.5);
                }
                if (block.userData.stars) {
                    block.userData.stars.forEach(star => {
                        if (star.material) {
                            star.material.emissiveIntensity = 0.5 * (0.5 + this.settings.colorIntensity * 0.5);
                        }
                    });
                }
            });
        }
        
        // No need to update waveAmplitude for existing particles as it's applied in real-time during animation
    }
    
    updateGasPrice(gasPrice) {
        this.gasPriceEffect.targetGasPrice = gasPrice;
    }
    
    getNextBlockPosition() {
        if (this.blockPositions.length === 0) {
            // First block at origin
            const position = new THREE.Vector3(0, 0, 0);
            this.blockPositions.push(position);
            return position;
        }
        
        // Get the last block position
        const lastPos = this.blockPositions[this.blockPositions.length - 1];
        let newPos;
        
        if (this.branchLength < this.maxBranchLength) {
            // Continue current branch - INCREASED SPACING for more sparse layout
            const directions = [
                new THREE.Vector3(250, 0, 0),    // X axis
                new THREE.Vector3(0, 250, 0),    // Y axis  
                new THREE.Vector3(0, 0, 250),    // Z axis
                new THREE.Vector3(-250, 0, 0),   // -X axis
                new THREE.Vector3(0, -250, 0),   // -Y axis
                new THREE.Vector3(0, 0, -250)    // -Z axis
            ];
            
            const direction = directions[this.currentBranch % directions.length];
            newPos = lastPos.clone().add(direction);
            this.branchLength++;
        } else {
            // Start new branch from a random previous block
            const branchPoint = this.blockPositions[Math.floor(Math.random() * this.blockPositions.length)];
            
            // Choose a new direction
            this.currentBranch = Math.floor(Math.random() * 6);
            this.branchLength = 1;
            
            const directions = [
                new THREE.Vector3(250, 80, 80),
                new THREE.Vector3(80, 250, 80),
                new THREE.Vector3(80, 80, 250),
                new THREE.Vector3(-250, 80, 80),
                new THREE.Vector3(80, -250, 80),
                new THREE.Vector3(80, 80, -250)
            ];
            
            const direction = directions[this.currentBranch];
            newPos = branchPoint.clone().add(direction);
        }
        
        // Expand universe if needed
        if (newPos.x > this.universeExtent.max) {
            this.universeExtent.max = newPos.x + 200;
        }
        if (newPos.x < this.universeExtent.min) {
            this.universeExtent.min = newPos.x - 200;
        }
        if (newPos.y > this.universeExtent.max) {
            this.universeExtent.max = newPos.y + 200;
        }
        if (newPos.y < this.universeExtent.min) {
            this.universeExtent.min = newPos.y - 200;
        }
        if (newPos.z > this.universeExtent.max) {
            this.universeExtent.max = newPos.z + 200;
        }
        if (newPos.z < this.universeExtent.min) {
            this.universeExtent.min = newPos.z - 200;
        }
        
        this.blockPositions.push(newPos);
        return newPos;
    }
    
    animate() {
        this.time += 0.01;
        
        // Update gas price effect with smoother transitions
        this.gasPriceEffect.currentGasPrice += (this.gasPriceEffect.targetGasPrice - this.gasPriceEffect.currentGasPrice) * this.gasPriceEffect.smoothingFactor;
        
        // Calculate background color based on gas price with smoother curves
        const normalizedGas = Math.min(this.gasPriceEffect.currentGasPrice / 150, 1); // Normalize to 0-1 range (150 Gwei max)
        const slowPulse = Math.sin(this.time * 0.5) * 0.2 + 0.8; // Slower pulse
        const fastPulse = Math.sin(this.time * 3) * 0.1 + 0.9; // Subtle fast pulse
        const pulseIntensity = slowPulse * fastPulse * normalizedGas;
        
        // More sophisticated color mixing
        const baseIntensity = normalizedGas * 0.3;
        const r = baseIntensity + pulseIntensity * 0.08; // Purple-red
        const g = baseIntensity * 0.3 + pulseIntensity * 0.03; // Minimal green
        const b = baseIntensity + pulseIntensity * 0.12; // Blue-purple
        
        this.gasPriceEffect.backgroundColor.setRGB(r, g, b);
        this.scene.fog.color.lerp(this.gasPriceEffect.backgroundColor, 0.05);
        this.renderer.setClearColor(this.scene.fog.color);
        
        if (this.particles) {
            this.particles.rotation.x += 0.0001 * this.settings.rotationSpeed;
            this.particles.rotation.y += 0.0002 * this.settings.rotationSpeed;
            this.particles.material.uniforms.time.value = this.time;
            
            const positions = this.particles.geometry.attributes.position.array;
            for (let i = 0; i < positions.length; i += 3) {
                positions[i + 1] += Math.sin(this.time + positions[i] * 0.01) * this.settings.waveAmplitude;
            }
            this.particles.geometry.attributes.position.needsUpdate = true;
        }
        
        if (this.core) {
            this.core.rotation.x += 0.01;
            this.core.rotation.y += 0.02;
            this.core.scale.setScalar(1 + Math.sin(this.time * 2) * 0.1);
            
            this.coreGlow.rotation.x = -this.core.rotation.x;
            this.coreGlow.rotation.y = -this.core.rotation.y;
            this.coreGlow.scale.setScalar(1 + Math.sin(this.time * 2 + Math.PI) * 0.15);
        }
        
        this.transactions.forEach((tx, index) => {
            tx.rotation.x += tx.userData.rotationSpeed;
            tx.rotation.y += tx.userData.rotationSpeed * 1.5;
            
            tx.position.add(tx.userData.velocity);
            
            const distance = tx.position.length();
            if (distance > 800) {
                tx.userData.velocity.multiplyScalar(-1);
            }
            
            tx.userData.age += 0.016;
            const opacity = Math.max(0, 1 - tx.userData.age / tx.userData.lifespan);
            tx.material.opacity = opacity;
            
            if (tx.userData.trail) {
                const positions = tx.userData.trail.geometry.attributes.position.array;
                for (let i = positions.length - 3; i >= 3; i -= 3) {
                    positions[i] = positions[i - 3];
                    positions[i + 1] = positions[i - 2];
                    positions[i + 2] = positions[i - 1];
                }
                positions[0] = tx.position.x;
                positions[1] = tx.position.y;
                positions[2] = tx.position.z;
                tx.userData.trail.geometry.attributes.position.needsUpdate = true;
                tx.userData.trail.material.opacity = opacity * 0.5;
            }
            
            if (opacity <= 0) {
                this.scene.remove(tx);
                if (tx.userData.trail) {
                    this.scene.remove(tx.userData.trail);
                }
                this.transactions.splice(index, 1);
            }
        });
        
        this.blocks.forEach(block => {
            block.rotation.x += block.userData.rotationSpeed;
            block.rotation.y += block.userData.rotationSpeed * 2;
            block.rotation.z += block.userData.rotationSpeed * 0.5;
            
            const currentScale = block.scale.x;
            const targetScale = block.userData.targetScale;
            block.scale.setScalar(currentScale + (targetScale - currentScale) * 0.1);
            
            const pulse = Math.sin(this.time * 3 + block.userData.pulsePhase) * 0.1 + 1;
            
            // Pulse constellation stars
            if (block.userData.stars) {
                block.userData.stars.forEach((star, index) => {
                    star.material.emissiveIntensity = 0.3 * pulse * (1 + Math.sin(this.time * 5 + index) * 0.2);
                });
            }
            
            // Animate block core
            if (block.userData.core) {
                block.userData.core.rotation.x += block.userData.rotationSpeed * 3;
                block.userData.core.rotation.y += block.userData.rotationSpeed * 4;
                block.userData.core.material.emissiveIntensity = 0.8 + Math.sin(this.time * 2 + block.userData.pulsePhase) * 0.3;
            }
            
            // Animate inner core  
            if (block.userData.innerCore) {
                block.userData.innerCore.rotation.x -= block.userData.rotationSpeed * 2;
                block.userData.innerCore.rotation.z += block.userData.rotationSpeed * 1.5;
                const innerPulse = Math.sin(this.time * 4 + block.userData.pulsePhase + Math.PI) * 0.2 + 0.6;
                block.userData.innerCore.material.emissiveIntensity = innerPulse;
                block.userData.innerCore.scale.setScalar(1 + Math.sin(this.time * 3) * 0.1);
            }
        });
        
        // Animate pending transaction stars
        this.pendingTransactions.forEach((star, hash) => {
            const twinkle = Math.sin(this.time * star.userData.twinkleSpeed + star.userData.twinklePhase);
            star.material.opacity = 0.3 + twinkle * 0.2;
            star.scale.setScalar(1 + twinkle * 0.1);
        });
        
        // Animate smart contract shooting stars
        this.smartContracts.forEach((star, index) => {
            star.userData.age += 0.016;
            star.userData.progress += star.userData.speed;
            
            // Move along trajectory
            if (star.userData.progress < 1) {
                star.position.lerpVectors(
                    star.userData.startPosition,
                    star.userData.targetPosition,
                    star.userData.progress
                );
                
                // Update trail
                if (star.userData.trailPositions) {
                    const positions = star.userData.trailPositions;
                    
                    // Shift trail positions
                    for (let i = positions.length - 3; i >= 3; i -= 3) {
                        positions[i] = positions[i - 3];
                        positions[i + 1] = positions[i - 2];
                        positions[i + 2] = positions[i - 1];
                    }
                    
                    // Add current position
                    positions[0] = star.position.x;
                    positions[1] = star.position.y;
                    positions[2] = star.position.z;
                    
                    star.userData.trailMesh.geometry.attributes.position.needsUpdate = true;
                }
            }
            
            // Fade out over time
            const opacity = Math.max(0, 1 - star.userData.age / star.userData.lifespan);
            star.material.opacity = opacity;
            
            if (star.userData.trailMesh) {
                star.userData.trailMesh.material.opacity = opacity * 0.6;
            }
            
            if (opacity <= 0) {
                this.scene.remove(star);
                if (star.userData.trailMesh) {
                    this.scene.remove(star.userData.trailMesh);
                }
                this.smartContracts.splice(index, 1);
            }
        });
        
        this.addressNodes.forEach((node, address) => {
            const label = node.userData.label;
            label.position.copy(node.position);
            label.position.y += 15;
            
            // OPTIMIZED SCALE HANDLING with gradual reduction
            let baseScale = 1 + Math.sin(this.time * 2 + node.userData.activity) * 0.1;
            const activityScale = Math.min(node.userData.activity * 0.5, 15); // Cap at 15x base size
            
            // Handle scale boost reduction
            if (node.userData.scaleBoost) {
                const elapsed = Date.now() - node.userData.scaleBoost.startTime;
                const progress = elapsed / node.userData.scaleBoost.duration;
                
                if (progress >= 1) {
                    // Remove completed scale boost
                    node.scale.divideScalar(node.userData.scaleBoost.factor);
                    delete node.userData.scaleBoost;
                } else {
                    // Gradual scale reduction
                    const remainingBoost = 1 + (node.userData.scaleBoost.factor - 1) * (1 - progress);
                    baseScale *= remainingBoost;
                }
            }
            
            // Distance-based scaling for better visibility when zooming out
            const distanceToCamera = this.camera.position.distanceTo(node.position);
            const maxDistance = 2000; // Scale objects larger when camera is farther than this
            const minDistanceScale = 1.0; // Minimum scaling factor
            const maxDistanceScale = 3.0; // Maximum scaling factor when far away
            
            // Calculate distance-based scale factor (logarithmic for smoother transition)
            const distanceScale = distanceToCamera > maxDistance ? 
                minDistanceScale + (maxDistanceScale - minDistanceScale) * Math.log(distanceToCamera / maxDistance + 1) / Math.log(3) :
                minDistanceScale;
            
            node.scale.setScalar(baseScale * (5 + activityScale) * distanceScale);
            node.material.emissiveIntensity = 0.5 + Math.sin(this.time * 3) * 0.2;
        });
        
        this.connections = this.connections.filter((connection, index) => {
            connection.userData.age += 0.008; // Slower aging for better visibility
            const opacity = Math.max(0, 1 - connection.userData.age / connection.userData.lifespan);
            
            // Enhanced opacity scaling for better visibility
            const minOpacity = connection.userData.isBlockTransaction ? 0.8 : 0.6;
            connection.material.opacity = Math.max(opacity * minOpacity, 0.1);
            
            // Distance-based scaling for connections to maintain visibility when zooming out
            const connectionCenter = new THREE.Vector3().lerpVectors(
                connection.userData.from.position, 
                connection.userData.to.position, 
                0.5
            );
            const distanceToCamera = this.camera.position.distanceTo(connectionCenter);
            const maxDistance = 2000;
            const minDistanceScale = 1.0;
            const maxDistanceScale = 2.5; // Slightly less aggressive than nodes
            
            const connectionDistanceScale = distanceToCamera > maxDistance ? 
                minDistanceScale + (maxDistanceScale - minDistanceScale) * Math.log(distanceToCamera / maxDistance + 1) / Math.log(3) :
                minDistanceScale;
            
            connection.scale.setScalar(connectionDistanceScale);
            
            // ENHANCED CONNECTION VALIDATION: Ensure edge lines always connect to two valid nodes
            if (connection.userData.from && connection.userData.to) {
                const fromNode = connection.userData.from;
                const toNode = connection.userData.to;
                
                // Check if both nodes are still valid and in the scene
                const fromNodeValid = fromNode && fromNode.parent && this.addressNodes.has(fromNode.userData.address);
                const toNodeValid = toNode && toNode.parent && this.addressNodes.has(toNode.userData.address);
                
                if (!fromNodeValid || !toNodeValid) {
                    // Remove connection if either node is invalid
                    this.addressGraphGroup.remove(connection);
                    if (connection.geometry) connection.geometry.dispose();
                    if (connection.material) connection.material.dispose();
                    return false;
                }
                
                // Update connection visual properties for active connections
                const isERC20 = connection.userData.isERC20 || false;
                const value = connection.userData.value || 1;
                
                // Dynamic tube radius based on value and type
                const baseRadius = connection.userData.isBlockTransaction ? 2.0 : 1.0;
                const newRadius = Math.max(baseRadius, Math.min(6, value * 3 + baseRadius));
                
                // FIXED: Create updated curve points that properly connect nodes
                const points = [];
                const fromPos = fromNode.position.clone();
                const toPos = toNode.position.clone();
                points.push(fromPos);
                
                // Calculate natural midpoint between nodes
                const midPoint = new THREE.Vector3();
                midPoint.addVectors(fromPos, toPos);
                midPoint.multiplyScalar(0.5);
                
                // Add RELATIVE arc height based on connection type and distance
                const distance = fromPos.distanceTo(toPos);
                let arcHeight;
                
                if (connection.userData.isBlockTransaction) {
                    // Block transactions get higher arcs
                    const baseHeight = Math.min(distance * 0.3, isERC20 ? 60 : 120);
                    const elevation = (connection.userData.blockNumber || 0) * 0.2;
                    arcHeight = baseHeight + elevation;
                } else {
                    // Regular transactions get proportional arcs
                    arcHeight = Math.min(distance * 0.2, isERC20 ? 40 : 80);
                }
                
                // Create natural arc direction
                const direction = new THREE.Vector3().subVectors(toPos, fromPos).normalize();
                const up = new THREE.Vector3(0, 1, 0);
                const perpendicular = new THREE.Vector3().crossVectors(direction, up).normalize();
                
                // Add arc in natural 3D direction
                if (perpendicular.length() > 0.1) {
                    const arcFactor = connection.userData.isBlockTransaction ? 0.6 : 0.5;
                    midPoint.add(perpendicular.multiplyScalar(arcHeight * arcFactor));
                }
                
                // Small upward component for visibility
                const upwardFactor = connection.userData.isBlockTransaction ? 0.4 : 0.5;
                midPoint.y += arcHeight * upwardFactor;
                
                points.push(midPoint);
                points.push(toPos);
                
                // Update the curve and geometry for smooth following
                const newCurve = new THREE.CatmullRomCurve3(points);
                const segments = connection.userData.isBlockTransaction ? 32 : 24;
                const radialSegments = connection.userData.isBlockTransaction ? 12 : 8;
                
                // Replace the geometry with updated one
                if (connection.geometry) connection.geometry.dispose();
                connection.geometry = new THREE.TubeGeometry(newCurve, segments, newRadius, radialSegments, false);
                
                // Update stored curve for any active flow particles
                if (connection.userData.curve) {
                    connection.userData.curve = newCurve;
                }
                
                // Add pulsing effect for active connections
                const pulseIntensity = 1 + Math.sin(Date.now() * 0.003 + index) * 0.1;
                if (connection.material) {
                    connection.material.emissiveIntensity = pulseIntensity * 0.5;
                }
            } else {
                // Remove connection if nodes are missing
                this.addressGraphGroup.remove(connection);
                if (connection.geometry) connection.geometry.dispose();
                if (connection.material) connection.material.dispose();
                return false;
            }
            
            // Only remove when fully aged out AND opacity is minimal
            if (connection.userData.age >= connection.userData.lifespan && opacity <= 0.001) {
                this.addressGraphGroup.remove(connection);
                if (connection.geometry) connection.geometry.dispose();
                if (connection.material) connection.material.dispose();
                return false;
            }
            return true;
        });
        
        // SAFE CURVE ANIMATION with proper error handling
        this.addressGraphGroup.children.forEach((child, index) => {
            if (child.userData && child.userData.curve && child.userData.speed) {
                try {
                    child.userData.progress += child.userData.speed;
                    if (child.userData.progress > 1) {
                        child.userData.progress = 0;
                    }
                    
                    // SAFE CURVE ACCESS with validation
                    if (child.userData.curve && 
                        typeof child.userData.curve.getPoint === 'function' && 
                        child.userData.progress >= 0 && 
                        child.userData.progress <= 1) {
                        
                        const point = child.userData.curve.getPoint(child.userData.progress);
                        
                        // Validate point before using it
                        if (point && typeof point.x === 'number' && typeof point.y === 'number' && typeof point.z === 'number') {
                            child.position.copy(point);
                        }
                    }
                } catch (error) {
                    // Silently handle curve errors and remove problematic children
                    console.warn('Curve animation error, removing particle:', error);
                    this.addressGraphGroup.remove(child);
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                }
            }
        });
        
        // PERFORMANCE CLEANUP to prevent system overload
        const now = Date.now();
        if (now - this.performanceMonitor.lastCleanup > 5000) { // Clean up every 5 seconds
            this.performanceCleanup();
            this.performanceMonitor.lastCleanup = now;
        }
        
        // Update hover detection
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const allObjects = [
            ...this.transactions,
            ...this.blocks,
            ...this.smartContracts,
            ...Array.from(this.addressNodes.values()),
            ...Array.from(this.pendingTransactions.values())
        ];
        
        const intersects = this.raycaster.intersectObjects(allObjects, true);
        
        if (intersects.length > 0) {
            let object = intersects[0].object;
            // If the object is part of a group (like blocks), use the group's userData
            while (object.parent && !object.userData.info && object.parent.userData && object.parent.userData.info) {
                object = object.parent;
            }
            if (object !== this.hoveredObject) {
                this.hoveredObject = object;
                this.updateTooltip(object, { clientX: window.innerWidth * (this.mouse.x + 1) / 2, clientY: window.innerHeight * (-this.mouse.y + 1) / 2 });
            }
        } else {
            if (this.hoveredObject) {
                this.hoveredObject = null;
                this.tooltip.style.display = 'none';
            }
        }
        
        // Update camera to follow universe growth (without auto-zoom)
        if (this.cameraAutoMove.enabled && this.blockPositions.length > 0) {
            // Calculate center of universe
            const center = new THREE.Vector3();
            this.blockPositions.forEach(pos => {
                center.add(pos);
            });
            center.divideScalar(this.blockPositions.length);
            
            // Smoothly move camera target to follow center
            this.cameraAutoMove.target.lerp(center, this.cameraAutoMove.speed);
            this.controls.target.lerp(this.cameraAutoMove.target, 0.02);
            
            // Removed automatic camera distance adjustment - let user control zoom
        }
        
        this.controls.update();
        
        this.renderer.render(this.scene, this.camera);
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    performanceCleanup() {
        // AGGRESSIVE CLEANUP when system is overloaded
        const isOverloaded = this.performanceMonitor.particleCount > this.performanceMonitor.maxParticles ||
                           this.performanceMonitor.connectionCount > this.performanceMonitor.maxConnections;
        
        if (isOverloaded) {
            console.warn('System overloaded, performing cleanup...', {
                particles: this.performanceMonitor.particleCount,
                connections: this.performanceMonitor.connectionCount
            });
            
            // Force remove oldest connections if over limit
            while (this.connections.length > this.performanceMonitor.maxConnections / 2) {
                const oldConnection = this.connections.shift();
                if (oldConnection) {
                    this.addressGraphGroup.remove(oldConnection);
                    if (oldConnection.geometry) oldConnection.geometry.dispose();
                    if (oldConnection.material) oldConnection.material.dispose();
                    this.performanceMonitor.connectionCount--;
                }
            }
            
            // Force remove particles by clearing some address graph children
            let particlesRemoved = 0;
            const childrenToRemove = [];
            this.addressGraphGroup.children.forEach(child => {
                if (particlesRemoved < 50 && child.userData && child.userData.curve) {
                    childrenToRemove.push(child);
                    particlesRemoved++;
                }
            });
            
            childrenToRemove.forEach(child => {
                this.addressGraphGroup.remove(child);
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
                this.performanceMonitor.particleCount--;
            });
            
            this.performanceMonitor.isOverloaded = false;
        }
        
        // Sync performance counters with actual counts
        this.performanceMonitor.connectionCount = this.connections.length;
        const actualParticleCount = this.addressGraphGroup.children.filter(child => 
            child.userData && child.userData.curve).length;
        this.performanceMonitor.particleCount = actualParticleCount;
    }
    
    cleanup() {
        if (this.tooltip && this.tooltip.parentNode) {
            this.tooltip.parentNode.removeChild(this.tooltip);
        }
    }
}