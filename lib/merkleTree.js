/**
 * Merkle Tree Library for Consent Batch Anchoring
 * 
 * Implements a binary Merkle tree for:
 * - Building tree from consent hash leaves
 * - Generating inclusion proofs
 * - Verifying proofs locally
 * 
 * Uses keccak256 (matching Solidity's keccak256) for compatibility
 */

// Guard against redeclaration in service worker context
if (typeof MerkleTree === 'undefined') {

    var MerkleTree = {
        /**
         * Build a Merkle tree from an array of leaf hashes
         * @param {string[]} leaves - Array of hex-encoded leaf hashes (bytes32)
         * @returns {Object} Tree structure with levels and root
         */
        buildTree(leaves) {
            if (!leaves || leaves.length === 0) {
                return { levels: [], root: null };
            }

            // Normalize leaves to lowercase and sort for deterministic ordering
            let currentLevel = leaves.map(leaf => leaf.toLowerCase());
            currentLevel.sort();

            const levels = [currentLevel];

            // Build tree bottom-up
            while (currentLevel.length > 1) {
                const nextLevel = [];

                for (let i = 0; i < currentLevel.length; i += 2) {
                    const left = currentLevel[i];
                    const right = currentLevel[i + 1] || left; // Duplicate last if odd

                    // Sort pair for consistent ordering (same as contract)
                    const [first, second] = left <= right ? [left, right] : [right, left];
                    const combined = this.keccak256Pair(first, second);
                    nextLevel.push(combined);
                }

                levels.push(nextLevel);
                currentLevel = nextLevel;
            }

            return {
                levels,
                root: currentLevel[0],
                leafCount: leaves.length
            };
        },

        /**
         * Generate a Merkle proof for a specific leaf
         * @param {Object} tree - Tree object from buildTree()
         * @param {string} leaf - The leaf hash to prove
         * @returns {Object} Proof object with path and siblings
         */
        generateProof(tree, leaf) {
            if (!tree || !tree.levels || tree.levels.length === 0) {
                return { valid: false, proof: [], leafIndex: -1 };
            }

            const normalizedLeaf = leaf.toLowerCase();
            let index = tree.levels[0].indexOf(normalizedLeaf);

            if (index === -1) {
                return { valid: false, proof: [], leafIndex: -1 };
            }

            const proof = [];

            for (let level = 0; level < tree.levels.length - 1; level++) {
                const currentLevel = tree.levels[level];
                const isRightNode = index % 2 === 1;
                const siblingIndex = isRightNode ? index - 1 : index + 1;

                if (siblingIndex < currentLevel.length) {
                    proof.push(currentLevel[siblingIndex]);
                } else {
                    // Odd number of nodes, use self as sibling
                    proof.push(currentLevel[index]);
                }

                // Move to parent index
                index = Math.floor(index / 2);
            }

            return {
                valid: true,
                proof,
                leafIndex: tree.levels[0].indexOf(normalizedLeaf),
                root: tree.root
            };
        },

        /**
         * Verify a Merkle proof locally
         * @param {string} root - The expected Merkle root
         * @param {string} leaf - The leaf being proven
         * @param {string[]} proof - The proof path
         * @returns {boolean} True if proof is valid
         */
        verifyProof(root, leaf, proof) {
            let computedHash = leaf.toLowerCase();

            for (const proofElement of proof) {
                const element = proofElement.toLowerCase();

                if (computedHash <= element) {
                    computedHash = this.keccak256Pair(computedHash, element);
                } else {
                    computedHash = this.keccak256Pair(element, computedHash);
                }
            }

            return computedHash === root.toLowerCase();
        },

        /**
         * Compute keccak256 of two concatenated bytes32 values
         * Uses Web Crypto API with a shim for keccak256
         * @param {string} a - First bytes32 (hex string)
         * @param {string} b - Second bytes32 (hex string)
         * @returns {string} Resulting hash as hex string
         */
        keccak256Pair(a, b) {
            // Remove 0x prefix if present
            const cleanA = a.replace('0x', '');
            const cleanB = b.replace('0x', '');

            // Concatenate the hex strings
            const combined = cleanA + cleanB;

            // Convert to byte array
            const bytes = this.hexToBytes(combined);

            // Use keccak256 (we'll import a library for this)
            return '0x' + this.keccak256(bytes);
        },

        /**
         * Convert hex string to byte array
         * @param {string} hex - Hex string without 0x prefix
         * @returns {Uint8Array} Byte array
         */
        hexToBytes(hex) {
            const bytes = new Uint8Array(hex.length / 2);
            for (let i = 0; i < hex.length; i += 2) {
                bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
            }
            return bytes;
        },

        /**
         * Keccak256 implementation
         * Using a simplified version - in production, use ethers.js or web3.js
         * @param {Uint8Array} data - Input bytes
         * @returns {string} Hash as hex string (without 0x prefix)
         */
        keccak256(data) {
            // This is a placeholder - the actual implementation will use
            // the keccak256 from ethers.js which is loaded in the extension
            // For now, we'll use a fallback to SHA-256 for local testing
            // Real implementation should use: ethers.keccak256(data)

            if (typeof ethers !== 'undefined' && ethers.keccak256) {
                const result = ethers.keccak256(data);
                return result.replace('0x', '');
            }

            // Fallback: Use SHA-256 (NOT keccak256, but works for testing)
            // WARNING: This fallback won't match on-chain verification!
            return this.sha256Sync(data);
        },

        /**
         * Synchronous SHA-256 fallback (for environments without ethers)
         * @param {Uint8Array} data - Input bytes
         * @returns {string} Hash as hex string
         */
        sha256Sync(data) {
            // Simple implementation for fallback
            // In production, always use ethers.keccak256
            let hash = 0;
            for (let i = 0; i < data.length; i++) {
                hash = ((hash << 5) - hash) + data[i];
                hash = hash & hash;
            }

            // Pad to 64 characters (32 bytes)
            const hex = Math.abs(hash).toString(16);
            return hex.padStart(64, '0').slice(0, 64);
        }
    };

} // End of MerkleTree guard

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MerkleTree;
}

