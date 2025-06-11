document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('canvas-container');
    const visualizer = new PsychedelicVisualizer(container);
    const audioEngine = new PsychedelicAudioEngine();
    const ethereum = new EthereumConnection();
    
    await audioEngine.init();
    
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
    
    // Set random default public node or load saved RPC endpoint from localStorage
    const savedEndpoint = localStorage.getItem('ethVisualizerRpcEndpoint');
    const rpcSelect = document.getElementById('rpcEndpoint');
    const customInput = document.getElementById('customRpcEndpoint');
    
    if (savedEndpoint) {
        // Check if saved endpoint matches any dropdown options
        const optionExists = Array.from(rpcSelect.options).some(option => option.value === savedEndpoint);
        
        if (optionExists) {
            rpcSelect.value = savedEndpoint;
        } else {
            // Use custom option for saved endpoints not in dropdown
            rpcSelect.value = 'custom';
            customInput.value = savedEndpoint;
            customInput.style.display = 'block';
        }
    } else {
        // No saved endpoint, set random public node as default
        const publicNodes = [
            "wss://ethereum.publicnode.com",
            "https://ethereum-rpc.publicnode.com",
            "wss://eth.drpc.org",
            "wss://ethereum-rpc.publicnode.com"
       ];
        const randomNode = publicNodes[Math.floor(Math.random() * publicNodes.length)];
        rpcSelect.value = randomNode;
    }
    
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
    
    document.getElementById('colorIntensity').addEventListener('input', (e) => {
        visualizer.updateSettings({ colorIntensity: e.target.value / 100 });
    });
    
    document.getElementById('particleCount').addEventListener('input', (e) => {
        visualizer.updateSettings({ particleCount: parseInt(e.target.value) });
    });
    
    document.getElementById('rotationSpeed').addEventListener('input', (e) => {
        visualizer.updateSettings({ rotationSpeed: e.target.value / 100 });
    });
    
    document.getElementById('waveAmplitude').addEventListener('input', (e) => {
        visualizer.updateSettings({ waveAmplitude: e.target.value / 100 });
    });
    
    document.getElementById('itemLifespan').addEventListener('input', (e) => {
        visualizer.updateSettings({ itemLifespan: parseFloat(e.target.value) });
    });
    
    document.getElementById('blockchainFocus').addEventListener('input', (e) => {
        visualizer.updateSettings({ blockchainFocus: e.target.value / 100 });
    });
    
    document.getElementById('masterVolume').addEventListener('input', (e) => {
        audioEngine.updateSettings({ masterVolume: parseInt(e.target.value) });
    });
    
    document.getElementById('transactionPitch').addEventListener('input', (e) => {
        audioEngine.updateSettings({ transactionPitch: parseInt(e.target.value) });
    });
    
    document.getElementById('blockBass').addEventListener('input', (e) => {
        audioEngine.updateSettings({ blockBass: parseInt(e.target.value) });
    });
    
    document.getElementById('reverbAmount').addEventListener('input', (e) => {
        audioEngine.updateSettings({ reverbAmount: e.target.value / 100 });
    });
    
    document.getElementById('filterCutoff').addEventListener('input', (e) => {
        audioEngine.updateSettings({ filterCutoff: parseInt(e.target.value) });
    });
    
    document.getElementById('filterResonance').addEventListener('input', (e) => {
        audioEngine.updateSettings({ filterResonance: parseInt(e.target.value) });
    });
    
    document.getElementById('delayTime').addEventListener('input', (e) => {
        audioEngine.updateSettings({ delayTime: e.target.value / 1000 });
    });
    
    document.getElementById('delayFeedback').addEventListener('input', (e) => {
        audioEngine.updateSettings({ delayFeedback: e.target.value / 100 });
    });
    
    document.getElementById('showAddressGraph').addEventListener('change', (e) => {
        visualizer.updateSettings({ showAddressGraph: e.target.checked });
    });
    
    document.getElementById('soundStyle').addEventListener('change', (e) => {
        audioEngine.updateSettings({ soundStyle: e.target.value });
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