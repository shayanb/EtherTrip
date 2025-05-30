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
        
        this.settings = {
            colorIntensity: 0.5,
            particleCount: 500, // Reduced from 1000 to 500 to reduce visual noise
            rotationSpeed: 0.5,
            waveAmplitude: 0.5,
            showAddressGraph: true
        };
        
        this.gasPriceEffect = {
            currentGasPrice: 20,
            targetGasPrice: 20,
            backgroundColor: new THREE.Color(0x000000),
            smoothingFactor: 0.02 // Slower transitions
        };
        
        this.colors = {
            transaction: [0xff00ff, 0x00ffff, 0xffff00, 0xff00aa, 0x00ff00],
            block: [0xff0000, 0x0000ff, 0xff00ff, 0xffffff, 0x00ff00],
            addressNode: [0x00ff88, 0xff8800, 0x8800ff, 0xff0088, 0x88ff00]
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
        
        for (let i = 0; i < this.settings.particleCount; i++) {
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
            const addressType = info.isSmartContract ? 'Smart Contract' : 'Address';
            const typeIcon = info.isSmartContract ? '⚙️' : '👤';
            content = `
                <div><strong>${typeIcon} ${addressType}</strong></div>
                <div>${info.address.slice(0, 6)}...${info.address.slice(-4)}</div>
                <div>Activity: ${info.activity} transactions</div>
                ${info.isSmartContract ? '<div style="color: #ff6600;">Contract Functions Available</div>' : ''}
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
            // Smart contracts: Use octahedron with distinct colors
            geometry = new THREE.OctahedronGeometry(6, 1); // Slightly larger and different shape
            color = 0xff6600; // Orange color for smart contracts
            material = new THREE.MeshPhongMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: 0.7, // Brighter emissive
                transparent: true,
                opacity: 0.9,
                wireframe: true // Distinctive wireframe appearance
            });
        } else {
            // Regular addresses: Keep existing sphere design
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
        
        const angle = Math.random() * Math.PI * 2;
        const radius = 300 + Math.random() * 600; // INCREASED SPACING: 300-900 units from center
        const height = (Math.random() - 0.5) * 600; // INCREASED SPACING: ±300 units vertically
        node.position.set(
            Math.cos(angle) * radius,
            height,
            Math.sin(angle) * radius
        );
        
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
        
        return node;
    }
    
    updateNodeAppearanceForSmartContract(node) {
        // Update existing regular address node to smart contract appearance
        const newGeometry = new THREE.OctahedronGeometry(6, 1);
        const color = 0xff6600; // Orange color for smart contracts
        const newMaterial = new THREE.MeshPhongMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.7,
            transparent: true,
            opacity: 0.9,
            wireframe: true
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
        const points = [];
        points.push(fromNode.position);
        
        const midPoint = new THREE.Vector3();
        midPoint.addVectors(fromNode.position, toNode.position);
        midPoint.multiplyScalar(0.5);
        midPoint.y += isERC20 ? 25 : 50;
        points.push(midPoint);
        
        points.push(toNode.position);
        
        const curve = new THREE.CatmullRomCurve3(points);
        const tubeRadius = isERC20 ? 1 : 2;
        const geometry = new THREE.TubeGeometry(curve, 20, tubeRadius, 8, false);
        
        const material = new THREE.MeshBasicMaterial({
            color: isERC20 ? 0x00ff00 : 0x00ffff,
            transparent: true,
            opacity: isERC20 ? 0.3 : 0.6,
            blending: THREE.AdditiveBlending
        });
        
        const connection = new THREE.Mesh(geometry, material);
        connection.userData = {
            from: fromNode,
            to: toNode,
            value: value,
            isERC20: isERC20,
            lifespan: 2.5, // Reduced from 5 to 2.5 seconds to reduce visual noise
            age: 0
        };
        
        this.addressGraphGroup.add(connection);
        this.connections.push(connection);
        
        const particleCount = Math.min(10, Math.max(3, Math.floor(value * 5)));
        for (let i = 0; i < particleCount; i++) {
            this.createFlowParticle(curve, i / particleCount);
        }
    }
    
    createFlowParticle(curve, offset) {
        const geometry = new THREE.SphereGeometry(1, 8, 8);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 1,
            transparent: true,
            opacity: 1
        });
        
        const particle = new THREE.Mesh(geometry, material);
        particle.userData = {
            curve: curve,
            progress: offset,
            speed: 0.002 + Math.random() * 0.002
        };
        
        this.addressGraphGroup.add(particle);
        
        setTimeout(() => {
            this.addressGraphGroup.remove(particle);
        }, 5000);
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
            // Only show connections for transactions above a minimum value threshold
            const minValueThreshold = isERC20 ? 1.0 : 0.1; // Higher thresholds to reduce noise
            const showConnection = value > minValueThreshold && Math.random() > 0.7; // 30% chance to show (reduced noise)
            
            // Detect if the 'to' address is a smart contract
            const isToAddressSmartContract = tx.to && tx.input && tx.input.length > 2;
            
            const fromNode = this.getOrCreateAddressNode(tx.from, false); // 'from' is typically an EOA
            const toNode = this.getOrCreateAddressNode(tx.to, isToAddressSmartContract);
            
            if (fromNode && toNode) {
                // Add distance-based filtering to reduce visual noise
                const distance = fromNode.position.distanceTo(toNode.position);
                const maxConnectionDistance = 800; // Limit connection distance to reduce long lines
                const showConnectionWithDistance = showConnection && distance < maxConnectionDistance;
                
                // Only create visual connection if it meets criteria
                if (showConnectionWithDistance) {
                    this.createConnection(fromNode, toNode, value, isERC20);
                }
                
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
        
        const geometry = isERC20 ? 
            new THREE.OctahedronGeometry(size, 0) : 
            new THREE.TetrahedronGeometry(size, 0);
        
        const color = isERC20 ? 
            0x00ff00 : // Green for ERC20
            this.colors.transaction[Math.floor(Math.random() * this.colors.transaction.length)];
        
        const material = new THREE.MeshPhongMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: isERC20 ? 0.3 : 0.5,
            transparent: true,
            opacity: isERC20 ? 0.6 : 0.8,
            wireframe: isERC20
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        
        const angle = Math.random() * Math.PI * 2;
        const radius = 350 + Math.random() * 450; // INCREASED SPACING: 350-800 units from center
        mesh.position.set(
            Math.cos(angle) * radius,
            (Math.random() - 0.5) * 300, // INCREASED SPACING: ±150 units vertically
            Math.sin(angle) * radius
        );
        
        mesh.userData = {
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            ),
            rotationSpeed: (Math.random() - 0.5) * 0.1,
            lifespan: 10,
            age: 0,
            tx: tx,
            info: {
                type: 'transaction',
                hash: tx.hash,
                from: tx.from,
                to: tx.to,
                value: value.toFixed(4),
                txType: isERC20 ? 'ERC20' : 'ETH'
            }
        };
        
        this.scene.add(mesh);
        this.transactions.push(mesh);
        
        this.createTransactionTrail(mesh);
        
        if (this.transactions.length > 100) {
            const oldTx = this.transactions.shift();
            this.scene.remove(oldTx);
        }
    }
    
    addSmartContractCall(tx) {
        const value = parseInt(tx.value || '0', 16) / 1e18;
        
        // Create shooting star geometry
        const geometry = new THREE.SphereGeometry(3, 8, 8);
        
        // Determine color based on first 4 bytes of calldata (function selector)
        const functionSelector = tx.calldata ? tx.calldata.slice(0, 10) : '0x00000000';
        const colorSeed = parseInt(functionSelector.slice(2, 6), 16);
        const hue = (colorSeed % 360) / 360;
        const color = new THREE.Color().setHSL(hue, 1, 0.6);
        
        const material = new THREE.MeshPhongMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.9
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        
        // Start position far away - INCREASED SPACING for more sparse layout
        const startAngle = Math.random() * Math.PI * 2;
        const startRadius = 1200 + Math.random() * 400; // 1200-1600 units from center
        const startHeight = (Math.random() - 0.5) * 600; // ±300 units vertically
        
        mesh.position.set(
            Math.cos(startAngle) * startRadius,
            startHeight,
            Math.sin(startAngle) * startRadius
        );
        
        // Target position near center - INCREASED SPACING 
        const targetRadius = 80 + Math.random() * 160; // 80-240 units from center
        const targetAngle = Math.random() * Math.PI * 2;
        const targetPosition = new THREE.Vector3(
            Math.cos(targetAngle) * targetRadius,
            (Math.random() - 0.5) * 150, // ±75 units vertically
            Math.sin(targetAngle) * targetRadius
        );
        
        mesh.userData = {
            startPosition: mesh.position.clone(),
            targetPosition: targetPosition,
            speed: 0.02 + Math.random() * 0.03,
            progress: 0,
            lifespan: 5,
            age: 0,
            tx: tx,
            functionSelector: functionSelector,
            trail: [],
            info: {
                type: 'smartcontract',
                hash: tx.hash,
                from: tx.from,
                to: tx.to,
                value: value.toFixed(4),
                functionSelector: functionSelector
            }
        };
        
        // Create trail
        this.createShootingStarTrail(mesh);
        
        this.scene.add(mesh);
        this.smartContracts.push(mesh);
        
        if (this.smartContracts.length > 50) {
            const oldSc = this.smartContracts.shift();
            this.scene.remove(oldSc);
            if (oldSc.userData.trailMesh) {
                this.scene.remove(oldSc.userData.trailMesh);
            }
        }
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
        const material = new THREE.MeshBasicMaterial({
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
        
        // Create structured constellation points around the core
        const starCount = Math.min(16, 4 + Math.floor(block.transactions.length / 2));
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
        
        // Create particles for each transaction in the block
        if (block.transactions && block.transactions.length > 0) {
            const maxParticles = Math.min(block.transactions.length, 20); // Limit for performance
            
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
            
            const scale = 1 + Math.sin(this.time * 2 + node.userData.activity) * 0.1;
            const activityScale = Math.min(node.userData.activity * 0.5, 15); // Cap at 15x base size
            node.scale.setScalar(scale * (5 + activityScale));
            
            node.material.emissiveIntensity = 0.5 + Math.sin(this.time * 3) * 0.2;
        });
        
        this.connections = this.connections.filter((connection, index) => {
            connection.userData.age += 0.016;
            const opacity = Math.max(0, 1 - connection.userData.age / connection.userData.lifespan);
            connection.material.opacity = opacity * 0.6;
            
            // Update connection geometry to track current node positions
            if (connection.userData.from && connection.userData.to) {
                const fromNode = connection.userData.from;
                const toNode = connection.userData.to;
                const isERC20 = connection.userData.isERC20 || false;
                
                // Create updated curve points
                const points = [];
                points.push(fromNode.position.clone());
                
                const midPoint = new THREE.Vector3();
                midPoint.addVectors(fromNode.position, toNode.position);
                midPoint.multiplyScalar(0.5);
                midPoint.y += isERC20 ? 25 : 50;
                points.push(midPoint);
                
                points.push(toNode.position.clone());
                
                // Update the curve
                const newCurve = new THREE.CatmullRomCurve3(points);
                const tubeRadius = isERC20 ? 1 : 2;
                
                // Replace the geometry with updated one
                connection.geometry.dispose(); // Clean up old geometry
                connection.geometry = new THREE.TubeGeometry(newCurve, 20, tubeRadius, 8, false);
            }
            
            if (opacity <= 0) {
                this.addressGraphGroup.remove(connection);
                return false;
            }
            return true;
        });
        
        this.addressGraphGroup.children.forEach(child => {
            if (child.userData && child.userData.curve) {
                child.userData.progress += child.userData.speed;
                if (child.userData.progress > 1) {
                    child.userData.progress = 0;
                }
                
                const point = child.userData.curve.getPoint(child.userData.progress);
                child.position.copy(point);
            }
        });
        
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
    
    cleanup() {
        if (this.tooltip && this.tooltip.parentNode) {
            this.tooltip.parentNode.removeChild(this.tooltip);
        }
    }
}