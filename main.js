document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('canvas-container');
    const visualizer = new PsychedelicVisualizer(container);
    const audioEngine = new PsychedelicAudioEngine();
    const ethereum = new EthereumConnection();
    
    await audioEngine.init();
    
    // Default settings
    const defaultSettings = {
        // Connection settings
        rpcEndpoint: 'wss://ethereum.publicnode.com',
        customRpcEndpoint: '',
        apiKey: '',
        
        // Audio settings
        masterVolume: 50,
        transactionPitch: 440,
        blockBass: 80,
        reverbAmount: 30,
        filterCutoff: 2000,
        filterResonance: 10,
        delayTime: 375,
        delayFeedback: 50,
        soundStyle: 'minimal',
        
        // Visual settings
        colorIntensity: 50,
        particleCount: 1000,
        rotationSpeed: 50,
        waveAmplitude: 50,
        itemLifespan: 8,
        blockchainFocus: 30,
        showAddressGraph: true
    };
    
    // Load settings from localStorage
    function loadSettings() {
        const saved = localStorage.getItem('etherTripSettings');
        return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    }
    
    // Save settings to localStorage
    function saveSettings(settings) {
        localStorage.setItem('etherTripSettings', JSON.stringify(settings));
    }
    
    // Apply settings to controls
    function applySettingsToControls(settings) {
        // Connection settings
        document.getElementById('rpcEndpoint').value = settings.rpcEndpoint;
        document.getElementById('customRpcEndpoint').value = settings.customRpcEndpoint;
        
        // Show custom input if needed
        const customInput = document.getElementById('customRpcEndpoint');
        if (settings.rpcEndpoint === 'custom') {
            customInput.style.display = 'block';
        }
        
        // Audio settings
        document.getElementById('masterVolume').value = settings.masterVolume;
        document.getElementById('transactionPitch').value = settings.transactionPitch;
        document.getElementById('blockBass').value = settings.blockBass;
        document.getElementById('reverbAmount').value = settings.reverbAmount;
        document.getElementById('filterCutoff').value = settings.filterCutoff;
        document.getElementById('filterResonance').value = settings.filterResonance;
        document.getElementById('delayTime').value = settings.delayTime;
        document.getElementById('delayFeedback').value = settings.delayFeedback;
        document.getElementById('soundStyle').value = settings.soundStyle;
        
        // Visual settings
        document.getElementById('colorIntensity').value = settings.colorIntensity;
        document.getElementById('particleCount').value = settings.particleCount;
        document.getElementById('rotationSpeed').value = settings.rotationSpeed;
        document.getElementById('waveAmplitude').value = settings.waveAmplitude;
        document.getElementById('itemLifespan').value = settings.itemLifespan;
        document.getElementById('blockchainFocus').value = settings.blockchainFocus;
        document.getElementById('showAddressGraph').checked = settings.showAddressGraph;
        
        // Apply settings to engines
        visualizer.updateSettings({
            colorIntensity: settings.colorIntensity / 100,
            particleCount: parseInt(settings.particleCount),
            rotationSpeed: settings.rotationSpeed / 100,
            waveAmplitude: settings.waveAmplitude / 100,
            itemLifespan: parseFloat(settings.itemLifespan),
            blockchainFocus: settings.blockchainFocus / 100,
            showAddressGraph: settings.showAddressGraph
        });
        
        audioEngine.updateSettings({
            masterVolume: parseInt(settings.masterVolume),
            transactionPitch: parseInt(settings.transactionPitch),
            blockBass: parseInt(settings.blockBass),
            reverbAmount: settings.reverbAmount / 100,
            filterCutoff: parseInt(settings.filterCutoff),
            filterResonance: parseInt(settings.filterResonance),
            delayTime: settings.delayTime / 1000,
            delayFeedback: settings.delayFeedback / 100,
            soundStyle: settings.soundStyle
        });
    }
    
    // Get current settings from controls
    function getCurrentSettings() {
        return {
            // Connection settings
            rpcEndpoint: document.getElementById('rpcEndpoint').value,
            customRpcEndpoint: document.getElementById('customRpcEndpoint').value,
            
            // Audio settings
            masterVolume: parseInt(document.getElementById('masterVolume').value),
            transactionPitch: parseInt(document.getElementById('transactionPitch').value),
            blockBass: parseInt(document.getElementById('blockBass').value),
            reverbAmount: parseInt(document.getElementById('reverbAmount').value),
            filterCutoff: parseInt(document.getElementById('filterCutoff').value),
            filterResonance: parseInt(document.getElementById('filterResonance').value),
            delayTime: parseInt(document.getElementById('delayTime').value),
            delayFeedback: parseInt(document.getElementById('delayFeedback').value),
            soundStyle: document.getElementById('soundStyle').value,
            
            // Visual settings
            colorIntensity: parseInt(document.getElementById('colorIntensity').value),
            particleCount: parseInt(document.getElementById('particleCount').value),
            rotationSpeed: parseInt(document.getElementById('rotationSpeed').value),
            waveAmplitude: parseInt(document.getElementById('waveAmplitude').value),
            itemLifespan: parseFloat(document.getElementById('itemLifespan').value),
            blockchainFocus: parseInt(document.getElementById('blockchainFocus').value),
            showAddressGraph: document.getElementById('showAddressGraph').checked
        };
    }
    
    // Load and apply saved settings
    const currentSettings = loadSettings();
    applySettingsToControls(currentSettings);
    
    let transactionQueue = [];
    let isProcessingQueue = false;
    const BLOCK_TIME = 12000; // 12 seconds in milliseconds
    
    // Track actual processed transactions for accurate stats
    let processedTxCount = 0;
    
    function animate() {
        requestAnimationFrame(animate);
        visualizer.animate();
    }
    animate();
    
    function processTransactionQueue() {
        if (isProcessingQueue || transactionQueue.length === 0) return;
        
        isProcessingQueue = true;
        const transactions = transactionQueue.shift();
        const totalTxs = transactions.length;
        const interval = totalTxs > 0 ? BLOCK_TIME / totalTxs : BLOCK_TIME;
        
        transactions.forEach((tx, index) => {
            setTimeout(() => {
                if (tx.type === 'erc20') {
                    visualizer.addTransaction(tx);
                    audioEngine.playERC20Transfer(tx);
                } else if (tx.isSmartContract) {
                    visualizer.addSmartContractCall(tx);
                    audioEngine.playSmartContract(tx);
                } else {
                    visualizer.addTransaction(tx);
                    audioEngine.playTransaction(tx);
                }
                
                // Increment processed transaction count
                processedTxCount++;
                updateStats();
                
                if (index === totalTxs - 1) {
                    isProcessingQueue = false;
                    processTransactionQueue();
                }
            }, index * interval);
        });
        
        if (totalTxs === 0) {
            isProcessingQueue = false;
            setTimeout(processTransactionQueue, 100);
        }
    }
    
    ethereum.onBlock((block) => {
        visualizer.addBlock(block);
        audioEngine.playBlock(block);
        
        if (block.transactions && block.transactions.length > 0) {
            const ethTransactions = block.transactions.map(tx => ({ ...tx, type: 'eth' }));
            transactionQueue.push(ethTransactions);
            processTransactionQueue();
        }
        
        updateStats();
    });
    
    ethereum.onTransaction((tx) => {
        // Skip pending transactions, we'll process them when they're in a block
    });
    
    ethereum.onPendingTransaction((tx) => {
        visualizer.addPendingTransaction(tx);
        audioEngine.playPendingTransaction(tx);
    });
    
    ethereum.onERC20Transfer((transfer) => {
        transactionQueue.push([transfer]);
        processTransactionQueue();
        updateStats();
    });
    
    ethereum.onConnect(() => {
        const status = document.getElementById('connectionStatus');
        status.textContent = 'Connected';
        status.className = 'status connected';
        document.getElementById('connectBtn').textContent = 'Disconnect';
    });
    
    ethereum.onDisconnect(() => {
        const status = document.getElementById('connectionStatus');
        status.textContent = 'Disconnected';
        status.className = 'status disconnected';
        document.getElementById('connectBtn').textContent = 'Connect to Ethereum';
    });
    
    ethereum.onError((error) => {
        console.error('Connection error:', error);
        alert('Connection error: ' + error.message);
    });
    
    
    // Handle RPC endpoint dropdown changes
    document.getElementById('rpcEndpoint').addEventListener('change', (e) => {
        const customInput = document.getElementById('customRpcEndpoint');
        const apiKeySection = document.getElementById('apiKeySection');
        const apiKeyInput = document.getElementById('apiKeyInput');
        const apiKeyHelp = document.getElementById('apiKeyHelp');
        
        // Hide all inputs first
        customInput.style.display = 'none';
        apiKeySection.style.display = 'none';
        
        const selectedValue = e.target.value;
        
        if (selectedValue === 'custom') {
            customInput.style.display = 'block';
            customInput.focus();
        } else if (['infura', 'alchemy', 'tenderly'].includes(selectedValue)) {
            // Show API key input for services that require keys
            apiKeySection.style.display = 'block';
            apiKeyInput.focus();
            
            // Set helpful text for each service
            switch (selectedValue) {
                case 'infura':
                    apiKeyHelp.textContent = 'Get your free API key from infura.io';
                    break;
                case 'alchemy':
                    apiKeyHelp.textContent = 'Get your free API key from alchemy.com';
                    break;
                case 'tenderly':
                    apiKeyHelp.textContent = 'Get your API key from tenderly.co';
                    break;
            }
        }
    });
    
    document.getElementById('connectBtn').addEventListener('click', async () => {
        const btn = document.getElementById('connectBtn');
        const rpcSelect = document.getElementById('rpcEndpoint');
        const customInput = document.getElementById('customRpcEndpoint');
        const apiKeyInput = document.getElementById('apiKeyInput');
        
        let rpcEndpoint;
        const selectedValue = rpcSelect.value;
        
        if (selectedValue === 'custom') {
            rpcEndpoint = customInput.value;
            if (!rpcEndpoint) {
                alert('Please enter a custom RPC endpoint URL');
                return;
            }
        } else if (['infura', 'alchemy', 'tenderly'].includes(selectedValue)) {
            // Construct URL with API key
            const apiKey = apiKeyInput.value;
            if (!apiKey) {
                alert('Please enter your API key for ' + selectedValue);
                return;
            }
            
            // Build URL based on service
            switch (selectedValue) {
                case 'infura':
                    rpcEndpoint = `wss://mainnet.infura.io/ws/v3/${apiKey}`;
                    break;
                case 'alchemy':
                    rpcEndpoint = `wss://eth-mainnet.alchemyapi.io/v2/${apiKey}`;
                    break;
                case 'tenderly':
                    rpcEndpoint = `wss://mainnet.gateway.tenderly.co/${apiKey}`;
                    break;
            }
        } else {
            // Direct URL (no API key needed)
            rpcEndpoint = selectedValue;
        }
        
        if (!rpcEndpoint) {
            alert('Please select or enter a valid RPC endpoint');
            return;
        }
        
        if (ethereum.connected) {
            // Immediately update UI when disconnect is clicked
            btn.disabled = true;
            btn.textContent = 'Disconnecting...';
            const status = document.getElementById('connectionStatus');
            status.textContent = 'Disconnecting...';
            status.className = 'status disconnected';
            
            await ethereum.disconnect();
            
            // Re-enable button after disconnect
            btn.disabled = false;
        } else {
            btn.disabled = true;
            btn.textContent = 'Connecting...';
            
            try {
                await ethereum.connect(rpcEndpoint);
                // Save successful connection endpoint
                localStorage.setItem('ethVisualizerRpcEndpoint', rpcEndpoint);
            } catch (error) {
                alert('Failed to connect: ' + error.message);
                btn.disabled = false;
                btn.textContent = 'Connect to Ethereum';
            }
            
            btn.disabled = false;
        }
    });
    
    // Helper function to save settings after any change
    function saveCurrentSettings() {
        const settings = getCurrentSettings();
        saveSettings(settings);
    }
    
    document.getElementById('colorIntensity').addEventListener('input', (e) => {
        visualizer.updateSettings({ colorIntensity: e.target.value / 100 });
        saveCurrentSettings();
    });
    
    document.getElementById('particleCount').addEventListener('input', (e) => {
        visualizer.updateSettings({ particleCount: parseInt(e.target.value) });
        saveCurrentSettings();
    });
    
    document.getElementById('rotationSpeed').addEventListener('input', (e) => {
        visualizer.updateSettings({ rotationSpeed: e.target.value / 100 });
        saveCurrentSettings();
    });
    
    document.getElementById('waveAmplitude').addEventListener('input', (e) => {
        visualizer.updateSettings({ waveAmplitude: e.target.value / 100 });
        saveCurrentSettings();
    });
    
    document.getElementById('itemLifespan').addEventListener('input', (e) => {
        visualizer.updateSettings({ itemLifespan: parseFloat(e.target.value) });
        saveCurrentSettings();
    });
    
    document.getElementById('blockchainFocus').addEventListener('input', (e) => {
        visualizer.updateSettings({ blockchainFocus: e.target.value / 100 });
        saveCurrentSettings();
    });
    
    document.getElementById('masterVolume').addEventListener('input', (e) => {
        audioEngine.updateSettings({ masterVolume: parseInt(e.target.value) });
        saveCurrentSettings();
    });
    
    document.getElementById('transactionPitch').addEventListener('input', (e) => {
        audioEngine.updateSettings({ transactionPitch: parseInt(e.target.value) });
        saveCurrentSettings();
    });
    
    document.getElementById('blockBass').addEventListener('input', (e) => {
        audioEngine.updateSettings({ blockBass: parseInt(e.target.value) });
        saveCurrentSettings();
    });
    
    document.getElementById('reverbAmount').addEventListener('input', (e) => {
        audioEngine.updateSettings({ reverbAmount: e.target.value / 100 });
        saveCurrentSettings();
    });
    
    document.getElementById('filterCutoff').addEventListener('input', (e) => {
        audioEngine.updateSettings({ filterCutoff: parseInt(e.target.value) });
        saveCurrentSettings();
    });
    
    document.getElementById('filterResonance').addEventListener('input', (e) => {
        audioEngine.updateSettings({ filterResonance: parseInt(e.target.value) });
        saveCurrentSettings();
    });
    
    document.getElementById('delayTime').addEventListener('input', (e) => {
        audioEngine.updateSettings({ delayTime: e.target.value / 1000 });
        saveCurrentSettings();
    });
    
    document.getElementById('delayFeedback').addEventListener('input', (e) => {
        audioEngine.updateSettings({ delayFeedback: e.target.value / 100 });
        saveCurrentSettings();
    });
    
    document.getElementById('showAddressGraph').addEventListener('change', (e) => {
        visualizer.updateSettings({ showAddressGraph: e.target.checked });
        saveCurrentSettings();
    });
    
    document.getElementById('soundStyle').addEventListener('change', (e) => {
        audioEngine.updateSettings({ soundStyle: e.target.value });
        saveCurrentSettings();
    });
    
    // RPC endpoint change should also save settings
    document.getElementById('rpcEndpoint').addEventListener('change', (e) => {
        saveCurrentSettings();
    });
    
    document.getElementById('customRpcEndpoint').addEventListener('input', (e) => {
        saveCurrentSettings();
    });
    
    // Reset controls functionality
    document.getElementById('resetControls').addEventListener('click', () => {
        if (confirm('Reset all settings to default values?')) {
            // Clear saved settings
            localStorage.removeItem('etherTripSettings');
            
            // Apply default settings
            applySettingsToControls(defaultSettings);
            
            // Force hide API key section and custom input
            document.getElementById('apiKeySection').style.display = 'none';
            document.getElementById('customRpcEndpoint').style.display = 'none';
        }
    });
    
    // Toggle controls button (inside controls panel)
    document.getElementById('toggleControls').addEventListener('click', () => {
        const controls = document.getElementById('controls');
        const toggleBtn = document.getElementById('toggleControls');
        const showBtn = document.getElementById('showControls');
        
        controls.classList.add('hidden');
        showBtn.style.display = 'flex';
        showBtn.style.animation = 'fadeIn 0.3s ease';
    });
    
    // Show controls button (in floating controls)
    document.getElementById('showControls').addEventListener('click', () => {
        const controls = document.getElementById('controls');
        const showBtn = document.getElementById('showControls');
        
        controls.classList.remove('hidden');
        showBtn.style.display = 'none';
    });
    
    document.getElementById('muteBtn').addEventListener('click', () => {
        const btn = document.getElementById('muteBtn');
        if (btn.classList.contains('muted')) {
            audioEngine.unmute();
            btn.classList.remove('muted');
            btn.textContent = '🔊';
            btn.title = 'Mute';
        } else {
            audioEngine.mute();
            btn.classList.add('muted');
            btn.textContent = '🔇';
            btn.title = 'Unmute';
        }
    });
    
    document.getElementById('pauseBtn').addEventListener('click', () => {
        const btn = document.getElementById('pauseBtn');
        if (btn.classList.contains('paused')) {
            audioEngine.unpause();
            btn.classList.remove('paused');
            btn.textContent = '⏸️';
            btn.title = 'Pause';
        } else {
            audioEngine.pause();
            btn.classList.add('paused');
            btn.textContent = '▶️';
            btn.title = 'Play';
        }
    });
    
    document.getElementById('surfModeBtn').addEventListener('click', () => {
        const btn = document.getElementById('surfModeBtn');
        const surfMode = !visualizer.settings.surfMode;
        visualizer.updateSettings({ surfMode: surfMode });
        
        if (surfMode) {
            btn.classList.add('active');
            btn.title = 'Exit Surf Mode';
        } else {
            btn.classList.remove('active');
            btn.title = 'Toggle Surf Mode';
        }
    });
    
    function updateStats() {
        const stats = ethereum.getStats();
        document.getElementById('blockCount').textContent = stats.blockCount;
        document.getElementById('txCount').textContent = processedTxCount; // Use actual processed count
        document.getElementById('erc20Count').textContent = stats.erc20Count;
        document.getElementById('gasPrice').textContent = stats.gasPrice;
        
        // Update visualizer with current gas price
        visualizer.updateGasPrice(parseFloat(stats.gasPrice));
    }
    
    document.addEventListener('click', () => {
        audioEngine.resume();
    }, { once: true });
    
    console.log(`
    ╔══════════════════════════════════════════╗
    ║  ETHEREUM PSYCHEDELIC VISUALIZER         ║
    ║  ────────────────────────────────────    ║
    ║  Welcome to the Ethereum World Computer  ║
    ║  Experience the blockchain in color      ║
    ╚══════════════════════════════════════════╝
    `);
});