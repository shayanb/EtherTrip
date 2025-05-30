document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('canvas-container');
    const visualizer = new PsychedelicVisualizer(container);
    const audioEngine = new PsychedelicAudioEngine();
    const ethereum = new EthereumConnection();
    
    await audioEngine.init();
    
    let transactionQueue = [];
    let isProcessingQueue = false;
    const BLOCK_TIME = 12000; // 12 seconds in milliseconds
    
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
    
    // Load saved RPC endpoint from localStorage
    const savedEndpoint = localStorage.getItem('ethVisualizerRpcEndpoint');
    if (savedEndpoint) {
        document.getElementById('rpcEndpoint').value = savedEndpoint;
    }
    
    document.getElementById('connectBtn').addEventListener('click', async () => {
        const btn = document.getElementById('connectBtn');
        const rpcEndpoint = document.getElementById('rpcEndpoint').value;
        
        if (!rpcEndpoint) {
            alert('Please enter an RPC endpoint URL');
            return;
        }
        
        if (ethereum.connected) {
            await ethereum.disconnect();
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
    
    document.getElementById('toggleControls').addEventListener('click', () => {
        const controls = document.getElementById('controls');
        const btn = document.getElementById('toggleControls');
        
        controls.classList.toggle('hidden');
        
        if (controls.classList.contains('hidden')) {
            btn.textContent = '☰';
            btn.title = 'Show Controls';
        } else {
            btn.textContent = '✕';
            btn.title = 'Hide Controls';
        }
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
    
    function updateStats() {
        const stats = ethereum.getStats();
        document.getElementById('blockCount').textContent = stats.blockCount;
        document.getElementById('txCount').textContent = stats.txCount;
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