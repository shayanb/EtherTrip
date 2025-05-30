class EthereumConnection {
    constructor() {
        this.web3 = null;
        this.connected = false;
        this.subscriptions = {
            blocks: null,
            pendingTransactions: null,
            logs: null
        };
        this.callbacks = {
            onBlock: null,
            onTransaction: null,
            onPendingTransaction: null,
            onERC20Transfer: null,
            onConnect: null,
            onDisconnect: null,
            onError: null
        };
        this.stats = {
            blockCount: 0,
            txCount: 0,
            gasPrice: 0,
            erc20Count: 0
        };
        
        this.TRANSFER_EVENT_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    }
    
    async connect(rpcEndpoint) {
        try {
            if (this.web3) {
                await this.disconnect();
            }
            
            const provider = new Web3.providers.WebsocketProvider(rpcEndpoint, {
                reconnect: {
                    auto: true,
                    delay: 5000,
                    maxAttempts: 5,
                    onTimeout: false
                }
            });
            
            this.web3 = new Web3(provider);
            
            provider.on('connect', () => {
                console.log('Connected to Ethereum network');
                this.connected = true;
                if (this.callbacks.onConnect) {
                    this.callbacks.onConnect();
                }
                this.startSubscriptions();
            });
            
            provider.on('error', (error) => {
                console.error('WebSocket error:', error);
                if (this.callbacks.onError) {
                    this.callbacks.onError(error);
                }
            });
            
            provider.on('end', () => {
                console.log('WebSocket connection ended');
                this.connected = false;
                if (this.callbacks.onDisconnect) {
                    this.callbacks.onDisconnect();
                }
            });
            
            const isConnected = await this.web3.eth.net.isListening();
            if (!isConnected) {
                throw new Error('Failed to connect to Ethereum network');
            }
            
            const gasPrice = await this.web3.eth.getGasPrice();
            this.stats.gasPrice = Web3.utils.fromWei(gasPrice, 'gwei');
            
        } catch (error) {
            console.error('Connection error:', error);
            throw error;
        }
    }
    
    async startSubscriptions() {
        try {
            this.subscriptions.blocks = this.web3.eth.subscribe('newBlockHeaders');
            this.subscriptions.blocks.on('data', async (blockHeader) => {
                this.stats.blockCount++;
                
                try {
                    const block = await this.web3.eth.getBlock(blockHeader.hash, true);
                    
                    const gasPrice = await this.web3.eth.getGasPrice();
                    this.stats.gasPrice = parseFloat(Web3.utils.fromWei(gasPrice, 'gwei')).toFixed(2);
                    
                    if (this.callbacks.onBlock) {
                        this.callbacks.onBlock(block);
                    }
                    
                    if (block.transactions && block.transactions.length > 0) {
                        const sampleSize = Math.min(block.transactions.length, 10);
                        const sampledTxs = this.sampleArray(block.transactions, sampleSize);
                        
                        // Process transactions and identify smart contract calls
                        sampledTxs.forEach(tx => {
                            if (tx.to && tx.input && tx.input.length > 2) {
                                // This is likely a smart contract call
                                tx.isSmartContract = true;
                                tx.calldata = tx.input;
                            }
                        });
                        
                        this.stats.txCount += sampledTxs.length;
                    }
                } catch (error) {
                    console.error('Error processing block:', error);
                }
            });
            
            this.subscriptions.blocks.on('error', (error) => {
                console.error('Block subscription error:', error);
            });
            
            this.subscriptions.pendingTransactions = this.web3.eth.subscribe('pendingTransactions');
            this.subscriptions.pendingTransactions.on('data', async (txHash) => {
                try {
                    // Sample pending transactions more aggressively to see them
                    if (Math.random() > 0.9) {
                        const tx = await this.web3.eth.getTransaction(txHash);
                        if (tx && this.callbacks.onPendingTransaction) {
                            this.callbacks.onPendingTransaction(tx);
                        }
                    }
                } catch (error) {
                    // Silently ignore errors for pending transactions
                }
            });
            
            this.subscriptions.pendingTransactions.on('error', (error) => {
                console.error('Pending transaction subscription error:', error);
            });
            
            this.subscriptions.logs = this.web3.eth.subscribe('logs', {
                topics: [this.TRANSFER_EVENT_SIGNATURE]
            });
            
            this.subscriptions.logs.on('data', (log) => {
                try {
                    const transfer = this.decodeTransferEvent(log);
                    if (transfer) {
                        this.stats.erc20Count++;
                        if (this.callbacks.onERC20Transfer) {
                            this.callbacks.onERC20Transfer(transfer);
                        }
                    }
                } catch (error) {
                    console.error('Error decoding transfer event:', error);
                }
            });
            
            this.subscriptions.logs.on('error', (error) => {
                console.error('Logs subscription error:', error);
            });
            
        } catch (error) {
            console.error('Subscription error:', error);
            throw error;
        }
    }
    
    decodeTransferEvent(log) {
        if (!log.topics || log.topics.length < 3) return null;
        
        try {
            const from = '0x' + log.topics[1].slice(26);
            const to = '0x' + log.topics[2].slice(26);
            const value = this.web3.utils.toBN(log.data);
            
            return {
                type: 'erc20',
                contractAddress: log.address,
                from: from,
                to: to,
                value: value.toString(),
                transactionHash: log.transactionHash,
                blockNumber: log.blockNumber,
                topics: log.topics.length > 3 ? log.topics[3] : null
            };
        } catch (error) {
            console.error('Error decoding transfer:', error);
            return null;
        }
    }
    
    sampleArray(array, sampleSize) {
        const result = [];
        const step = Math.floor(array.length / sampleSize);
        for (let i = 0; i < array.length && result.length < sampleSize; i += step) {
            result.push(array[i]);
        }
        return result;
    }
    
    async disconnect() {
        if (this.subscriptions.blocks) {
            await this.subscriptions.blocks.unsubscribe();
            this.subscriptions.blocks = null;
        }
        
        if (this.subscriptions.pendingTransactions) {
            await this.subscriptions.pendingTransactions.unsubscribe();
            this.subscriptions.pendingTransactions = null;
        }
        
        if (this.subscriptions.logs) {
            await this.subscriptions.logs.unsubscribe();
            this.subscriptions.logs = null;
        }
        
        if (this.web3 && this.web3.currentProvider) {
            this.web3.currentProvider.disconnect();
        }
        
        this.connected = false;
        this.web3 = null;
    }
    
    onBlock(callback) {
        this.callbacks.onBlock = callback;
    }
    
    onTransaction(callback) {
        this.callbacks.onTransaction = callback;
    }
    
    onPendingTransaction(callback) {
        this.callbacks.onPendingTransaction = callback;
    }
    
    onERC20Transfer(callback) {
        this.callbacks.onERC20Transfer = callback;
    }
    
    onConnect(callback) {
        this.callbacks.onConnect = callback;
    }
    
    onDisconnect(callback) {
        this.callbacks.onDisconnect = callback;
    }
    
    onError(callback) {
        this.callbacks.onError = callback;
    }
    
    getStats() {
        return this.stats;
    }
}