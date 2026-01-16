// Consent Tracker - Blockchain Service Module v2
// Batch anchoring with Merkle proofs for tamper-proof audit trails
// Note: MerkleTree is imported by background.js before this script

/**
 * Blockchain Service for Consent Batch Anchoring
 * 
 * Architecture:
 * - Consents are collected throughout the day
 * - At day's end (or manually), a batch is anchored on-chain
 * - Only the Merkle root is stored on-chain (gas efficient)
 * - Individual consents can be verified via Merkle proofs
 */

const BlockchainService = {
    // Configuration - Using Polygon for low gas fees
    config: {
        networkName: 'Polygon Mainnet',
        chainId: '0x89', // 137 in hex
        rpcUrl: 'https://polygon-rpc.com',
        blockExplorer: 'https://polygonscan.com',
        // Contract address (will be set after deployment)
        contractAddress: null,
        // ABI for ConsentAnchor contract
        contractABI: [
            "function anchorBatch(bytes32 merkleRoot, bytes32 storagePointer, uint40 dayTimestamp, uint16 batchSize) external",
            "function verifyAnchor(bytes32 merkleRoot) external view returns (bool exists, address owner)",
            "function verifyConsent(bytes32 merkleRoot, bytes32 consentHash, bytes32[] calldata proof) external view returns (bool)",
            "function getUserBatches(address user) external view returns (tuple(bytes32 merkleRoot, bytes32 storagePointer, uint40 timestamp, uint40 dayTimestamp, uint16 batchSize, uint8 version, bool revoked)[])",
            "function getBatchCount(address user) external view returns (uint256)",
            "event BatchAnchored(address indexed user, bytes32 indexed merkleRoot, bytes32 storagePointer, uint40 dayTimestamp, uint16 batchSize, uint256 batchIndex)"
        ],
        // Fallback to simulated mode if no wallet/contract
        simulatedMode: true
    },

    // Pending batch storage
    pendingBatch: {
        consents: [],
        dayTimestamp: null
    },

    // Anchored batches cache
    anchoredBatches: [],

    // Storage for simulated blockchain (for demo/fallback)
    simulatedChain: {
        batches: [],
        currentBlock: 1000000
    },

    // ============ Initialization ============

    /**
     * Initialize the blockchain service
     */
    async init() {
        await this.loadPendingBatch();
        await this.loadAnchoredBatches();
        console.log('🔗 BlockchainService initialized');
    },

    /**
     * Get start of day timestamp (UTC)
     */
    getDayTimestamp(date = new Date()) {
        const d = new Date(date);
        d.setUTCHours(0, 0, 0, 0);
        return Math.floor(d.getTime() / 1000);
    },

    // ============ Consent Hash Generation ============

    /**
     * Generate SHA-256 hash from consent data
     * Hash = SHA256(consent_text + site_url + timestamp + action)
     */
    async generateConsentHash(consentData) {
        const proofString = [
            consentData.context || '',
            consentData.url || '',
            consentData.timestamp.toString(),
            consentData.buttonText || '',
            consentData.category || 'general'
        ].join('|');

        // Use Web Crypto API for SHA-256
        const encoder = new TextEncoder();
        const data = encoder.encode(proofString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);

        // Convert to hex string with 0x prefix (bytes32 format)
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        return hashHex;
    },

    // ============ Batch Collection ============

    /**
     * Add a consent to the pending daily batch
     */
    async addConsentToBatch(consentData) {
        const currentDay = this.getDayTimestamp();

        // If day changed, save old batch and start new one
        if (this.pendingBatch.dayTimestamp && this.pendingBatch.dayTimestamp !== currentDay) {
            // Auto-anchor previous day's batch
            await this.anchorPendingBatch();
        }

        // Generate hash for this consent
        const consentHash = await this.generateConsentHash(consentData);

        // Add to pending batch
        this.pendingBatch.consents.push({
            hash: consentHash,
            data: consentData,
            addedAt: Date.now()
        });
        this.pendingBatch.dayTimestamp = currentDay;

        // Persist pending batch
        await this.savePendingBatch();

        console.log(`📦 Consent added to batch (${this.pendingBatch.consents.length} total)`);

        return consentHash;
    },

    /**
     * Get pending batch info
     */
    getPendingBatchInfo() {
        return {
            count: this.pendingBatch.consents.length,
            dayTimestamp: this.pendingBatch.dayTimestamp,
            consents: this.pendingBatch.consents
        };
    },

    // ============ Batch Anchoring ============

    /**
     * Anchor the pending batch on-chain
     */
    async anchorPendingBatch() {
        if (this.pendingBatch.consents.length === 0) {
            console.log('⚠️ No consents to anchor');
            return null;
        }

        const leaves = this.pendingBatch.consents.map(c => c.hash);
        const tree = MerkleTree.buildTree(leaves);
        const merkleRoot = tree.root;

        // Create storage pointer (hash of batch data for IPFS simulation)
        const batchData = JSON.stringify(this.pendingBatch);
        const storagePointer = await this.hashString(batchData);

        // Anchor on-chain (or simulate)
        const result = await this.anchorBatchOnChain(
            merkleRoot,
            storagePointer,
            this.pendingBatch.dayTimestamp,
            this.pendingBatch.consents.length
        );

        if (result.success) {
            // Store anchored batch locally with tree for proof generation
            const anchoredBatch = {
                merkleRoot,
                storagePointer,
                dayTimestamp: this.pendingBatch.dayTimestamp,
                tree,
                consents: [...this.pendingBatch.consents],
                anchoredAt: Date.now(),
                txHash: result.txHash,
                blockNumber: result.blockNumber,
                network: result.network,
                simulated: result.simulated
            };

            this.anchoredBatches.push(anchoredBatch);
            await this.saveAnchoredBatches();

            // Clear pending batch
            this.pendingBatch = { consents: [], dayTimestamp: null };
            await this.savePendingBatch();

            console.log(`✅ Batch anchored: ${merkleRoot.substring(0, 10)}...`);
        }

        return result;
    },

    /**
     * Anchor batch on blockchain
     */
    async anchorBatchOnChain(merkleRoot, storagePointer, dayTimestamp, batchSize) {
        try {
            const useRealChain = await this.checkWalletAvailable();

            if (useRealChain && !this.config.simulatedMode && this.config.contractAddress) {
                return await this.anchorOnRealChain(merkleRoot, storagePointer, dayTimestamp, batchSize);
            } else {
                return await this.anchorOnSimulatedChain(merkleRoot, storagePointer, dayTimestamp, batchSize);
            }
        } catch (error) {
            console.error('Blockchain anchoring error:', error);
            return await this.anchorOnSimulatedChain(merkleRoot, storagePointer, dayTimestamp, batchSize);
        }
    },

    /**
     * Anchor on real blockchain via MetaMask
     */
    async anchorOnRealChain(merkleRoot, storagePointer, dayTimestamp, batchSize) {
        if (!window.ethereum) {
            throw new Error('MetaMask not detected');
        }

        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const from = accounts[0];

        // Encode contract call
        const iface = new ethers.Interface(this.config.contractABI);
        const data = iface.encodeFunctionData('anchorBatch', [
            merkleRoot,
            storagePointer,
            dayTimestamp,
            batchSize
        ]);

        const txHash = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [{
                from: from,
                to: this.config.contractAddress,
                data: data,
                chainId: this.config.chainId
            }]
        });

        return {
            success: true,
            txHash: txHash,
            blockNumber: 'pending',
            network: this.config.networkName,
            explorerUrl: `${this.config.blockExplorer}/tx/${txHash}`,
            timestamp: Date.now(),
            simulated: false
        };
    },

    /**
     * Simulate anchoring for demo purposes
     */
    async anchorOnSimulatedChain(merkleRoot, storagePointer, dayTimestamp, batchSize) {
        const txHash = '0x' + await this.generateRandomHash();
        const blockNumber = this.simulatedChain.currentBlock++;

        const batchData = {
            merkleRoot,
            storagePointer,
            dayTimestamp,
            batchSize,
            txHash,
            blockNumber,
            timestamp: Date.now(),
            network: 'Simulated (Demo Mode)',
            simulated: true
        };

        this.simulatedChain.batches.push(batchData);

        // Persist to chrome storage
        try {
            const result = await chrome.storage.local.get(['simulatedBatches']);
            const batches = result.simulatedBatches || [];
            batches.push(batchData);
            await chrome.storage.local.set({ simulatedBatches: batches });
        } catch (error) {
            console.log('Running outside extension context');
        }

        return {
            success: true,
            txHash,
            blockNumber,
            network: 'Simulated (Demo Mode)',
            timestamp: Date.now(),
            simulated: true
        };
    },

    // ============ Verification ============

    /**
     * Verify a specific consent exists in an anchored batch
     */
    async verifyConsent(consentHash) {
        // Find which batch contains this consent
        for (const batch of this.anchoredBatches) {
            const consent = batch.consents.find(c => c.hash === consentHash);
            if (consent) {
                // Generate Merkle proof
                const proofResult = MerkleTree.generateProof(batch.tree, consentHash);

                if (!proofResult.valid) {
                    continue;
                }

                // Verify locally first
                const localValid = MerkleTree.verifyProof(
                    batch.merkleRoot,
                    consentHash,
                    proofResult.proof
                );

                // If real chain, verify on-chain too
                let onChainValid = null;
                if (!batch.simulated && this.config.contractAddress) {
                    onChainValid = await this.verifyOnChain(
                        batch.merkleRoot,
                        consentHash,
                        proofResult.proof
                    );
                }

                return {
                    verified: true,
                    batch: {
                        merkleRoot: batch.merkleRoot,
                        dayTimestamp: batch.dayTimestamp,
                        txHash: batch.txHash,
                        blockNumber: batch.blockNumber,
                        network: batch.network
                    },
                    proof: proofResult.proof,
                    localVerification: localValid,
                    onChainVerification: onChainValid,
                    message: 'Consent verified in anchored batch'
                };
            }
        }

        // Check pending batch
        const pending = this.pendingBatch.consents.find(c => c.hash === consentHash);
        if (pending) {
            return {
                verified: false,
                pending: true,
                message: 'Consent is in pending batch (not yet anchored)'
            };
        }

        return {
            verified: false,
            message: 'Consent not found in any batch'
        };
    },

    /**
     * Verify on-chain using contract
     */
    async verifyOnChain(merkleRoot, consentHash, proof) {
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const contract = new ethers.Contract(
                this.config.contractAddress,
                this.config.contractABI,
                provider
            );

            return await contract.verifyConsent(merkleRoot, consentHash, proof);
        } catch (error) {
            console.error('On-chain verification failed:', error);
            return null;
        }
    },

    /**
     * Verify anchor exists on-chain
     */
    async verifyAnchor(merkleRoot) {
        // Check simulated storage first
        const simBatch = this.simulatedChain.batches.find(b => b.merkleRoot === merkleRoot);
        if (simBatch) {
            return {
                verified: true,
                data: simBatch,
                message: 'Anchor verified (simulated)'
            };
        }

        // Check local anchored batches
        const localBatch = this.anchoredBatches.find(b => b.merkleRoot === merkleRoot);
        if (localBatch) {
            return {
                verified: true,
                data: localBatch,
                message: 'Anchor verified in local storage'
            };
        }

        return {
            verified: false,
            message: 'Anchor not found'
        };
    },

    // ============ Wallet & Chain Utilities ============

    /**
     * Check if MetaMask or similar wallet is available
     */
    async checkWalletAvailable() {
        if (typeof window !== 'undefined' && window.ethereum) {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                return accounts.length > 0;
            } catch {
                return false;
            }
        }
        return false;
    },

    /**
     * Generate random hash for simulated tx hashes
     */
    async generateRandomHash() {
        const randomBytes = new Uint8Array(32);
        crypto.getRandomValues(randomBytes);
        return Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    },

    /**
     * Hash a string using SHA-256
     */
    async hashString(str) {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    // ============ Persistence ============

    /**
     * Save pending batch to storage
     */
    async savePendingBatch() {
        try {
            await chrome.storage.local.set({ pendingBatch: this.pendingBatch });
        } catch (error) {
            console.log('Could not persist pending batch');
        }
    },

    /**
     * Load pending batch from storage
     */
    async loadPendingBatch() {
        try {
            const result = await chrome.storage.local.get(['pendingBatch']);
            if (result.pendingBatch) {
                this.pendingBatch = result.pendingBatch;
            }
        } catch (error) {
            console.log('Could not load pending batch');
        }
    },

    /**
     * Save anchored batches to storage
     */
    async saveAnchoredBatches() {
        try {
            // Don't save the full tree to storage (too large)
            const batchesForStorage = this.anchoredBatches.map(b => ({
                ...b,
                tree: { root: b.tree.root, leafCount: b.tree.leafCount }
            }));
            await chrome.storage.local.set({ anchoredBatches: batchesForStorage });
        } catch (error) {
            console.log('Could not persist anchored batches');
        }
    },

    /**
     * Load anchored batches from storage
     */
    async loadAnchoredBatches() {
        try {
            const result = await chrome.storage.local.get(['anchoredBatches']);
            if (result.anchoredBatches) {
                // Rebuild trees from consent data
                this.anchoredBatches = result.anchoredBatches.map(batch => {
                    if (batch.consents) {
                        const leaves = batch.consents.map(c => c.hash);
                        batch.tree = MerkleTree.buildTree(leaves);
                    }
                    return batch;
                });
            }
        } catch (error) {
            console.log('Could not load anchored batches');
        }
    },

    // ============ Statistics ============

    /**
     * Get blockchain statistics
     */
    getStats() {
        return {
            pendingConsents: this.pendingBatch.consents.length,
            anchoredBatches: this.anchoredBatches.length,
            totalAnchoredConsents: this.anchoredBatches.reduce((sum, b) => sum + b.consents.length, 0),
            simulatedMode: this.config.simulatedMode
        };
    },

    /**
     * Get all anchored batches (for dashboard)
     */
    getAllBatches() {
        return this.anchoredBatches.map(b => ({
            merkleRoot: b.merkleRoot,
            dayTimestamp: b.dayTimestamp,
            consentCount: b.consents.length,
            anchoredAt: b.anchoredAt,
            txHash: b.txHash,
            blockNumber: b.blockNumber,
            network: b.network,
            simulated: b.simulated
        }));
    },

    // ============ Configuration ============

    /**
     * Set contract address
     */
    setContractAddress(address) {
        this.config.contractAddress = address;
        console.log(`📋 Contract address set: ${address}`);
    },

    /**
     * Enable/disable simulated mode
     */
    setSimulatedMode(enabled) {
        this.config.simulatedMode = enabled;
        console.log(`Blockchain mode: ${enabled ? 'Simulated' : 'Real'}`);
    },

    /**
     * Format hash for display (truncated)
     */
    formatHashForDisplay(hash) {
        if (!hash || hash.length < 16) return hash || 'N/A';
        return `${hash.substring(0, 10)}...${hash.substring(hash.length - 6)}`;
    }
};

// Initialize on load
BlockchainService.init();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BlockchainService;
}
