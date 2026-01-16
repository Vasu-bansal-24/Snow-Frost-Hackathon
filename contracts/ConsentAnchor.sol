// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ConsentAnchor
 * @author SnowFrost Hackathon Team
 * @notice Batch anchoring contract for consent proof integrity
 * @dev Optimized for gas efficiency - stores only Merkle roots and minimal metadata
 * 
 * Architecture:
 * - Users' daily consent activities are batched off-chain
 * - Only the Merkle root of each day's consents is stored on-chain
 * - Individual consents can be verified via Merkle proofs
 */
contract ConsentAnchor {
    
    // ============ Structs ============
    
    /// @notice Represents a single daily batch anchor
    struct BatchAnchor {
        bytes32 merkleRoot;      // Root hash of consent Merkle tree
        bytes32 storagePointer;  // IPFS CID or storage reference (hashed)
        uint40 timestamp;        // Block timestamp (40 bits = ~34K years)
        uint40 dayTimestamp;     // Start of the day this batch represents
        uint16 batchSize;        // Number of consents in batch (max 65535)
        uint8 version;           // Schema version for future upgrades
        bool revoked;            // GDPR revocation flag
    }
    
    // ============ State ============
    
    /// @notice User address => array of batch anchors
    mapping(address => BatchAnchor[]) public userBatches;
    
    /// @notice Merkle root => anchor existence (for quick verification)
    mapping(bytes32 => bool) public anchorExists;
    
    /// @notice Merkle root => user address (reverse lookup)
    mapping(bytes32 => address) public anchorOwner;
    
    /// @notice User => day timestamp => batch index (for day lookups)
    mapping(address => mapping(uint40 => uint256)) public dayToBatchIndex;
    
    /// @notice User => day timestamp => has batch
    mapping(address => mapping(uint40 => bool)) public hasDayBatch;
    
    /// @notice Total anchors across all users
    uint256 public totalAnchors;
    
    /// @notice Contract version
    uint8 public constant CONTRACT_VERSION = 1;
    
    // ============ Events ============
    
    event BatchAnchored(
        address indexed user,
        bytes32 indexed merkleRoot,
        bytes32 storagePointer,
        uint40 dayTimestamp,
        uint16 batchSize,
        uint256 batchIndex
    );
    
    event BatchRevoked(
        address indexed user,
        bytes32 indexed merkleRoot,
        uint256 batchIndex
    );
    
    // ============ Errors ============
    
    error InvalidMerkleRoot();
    error BatchAlreadyAnchored();
    error EmptyBatch();
    error DayBatchAlreadyExists();
    error IndexOutOfBounds();
    error NotBatchOwner();
    error BatchAlreadyRevoked();
    
    // ============ Core Functions ============
    
    /**
     * @notice Anchor a new daily batch of consent hashes
     * @param merkleRoot The Merkle root of the consent batch
     * @param storagePointer Hash of off-chain storage location (IPFS CID)
     * @param dayTimestamp The start-of-day timestamp this batch represents
     * @param batchSize Number of consent events in this batch
     * @dev Emits BatchAnchored event
     */
    function anchorBatch(
        bytes32 merkleRoot,
        bytes32 storagePointer,
        uint40 dayTimestamp,
        uint16 batchSize
    ) external {
        if (merkleRoot == bytes32(0)) revert InvalidMerkleRoot();
        if (anchorExists[merkleRoot]) revert BatchAlreadyAnchored();
        if (batchSize == 0) revert EmptyBatch();
        if (hasDayBatch[msg.sender][dayTimestamp]) revert DayBatchAlreadyExists();
        
        BatchAnchor memory anchor = BatchAnchor({
            merkleRoot: merkleRoot,
            storagePointer: storagePointer,
            timestamp: uint40(block.timestamp),
            dayTimestamp: dayTimestamp,
            batchSize: batchSize,
            version: CONTRACT_VERSION,
            revoked: false
        });
        
        uint256 batchIndex = userBatches[msg.sender].length;
        userBatches[msg.sender].push(anchor);
        
        anchorExists[merkleRoot] = true;
        anchorOwner[merkleRoot] = msg.sender;
        dayToBatchIndex[msg.sender][dayTimestamp] = batchIndex;
        hasDayBatch[msg.sender][dayTimestamp] = true;
        
        unchecked {
            totalAnchors++;
        }
        
        emit BatchAnchored(
            msg.sender, 
            merkleRoot, 
            storagePointer, 
            dayTimestamp,
            batchSize, 
            batchIndex
        );
    }
    
    /**
     * @notice Anchor batch with user signature (for meta-transactions)
     * @param merkleRoot The Merkle root of the consent batch
     * @param storagePointer Hash of off-chain storage location
     * @param dayTimestamp The start-of-day timestamp
     * @param batchSize Number of consent events
     * @param nonce Unique nonce for replay protection
     * @param signature User's signature over the batch data
     */
    function anchorBatchWithSignature(
        bytes32 merkleRoot,
        bytes32 storagePointer,
        uint40 dayTimestamp,
        uint16 batchSize,
        uint256 nonce,
        bytes calldata signature
    ) external {
        // Reconstruct message hash
        bytes32 messageHash = keccak256(abi.encodePacked(
            merkleRoot, 
            storagePointer, 
            dayTimestamp, 
            batchSize, 
            nonce,
            block.chainid,
            address(this)
        ));
        
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32", 
            messageHash
        ));
        
        address signer = _recoverSigner(ethSignedMessageHash, signature);
        
        if (merkleRoot == bytes32(0)) revert InvalidMerkleRoot();
        if (anchorExists[merkleRoot]) revert BatchAlreadyAnchored();
        if (batchSize == 0) revert EmptyBatch();
        if (hasDayBatch[signer][dayTimestamp]) revert DayBatchAlreadyExists();
        
        BatchAnchor memory anchor = BatchAnchor({
            merkleRoot: merkleRoot,
            storagePointer: storagePointer,
            timestamp: uint40(block.timestamp),
            dayTimestamp: dayTimestamp,
            batchSize: batchSize,
            version: CONTRACT_VERSION,
            revoked: false
        });
        
        uint256 batchIndex = userBatches[signer].length;
        userBatches[signer].push(anchor);
        
        anchorExists[merkleRoot] = true;
        anchorOwner[merkleRoot] = signer;
        dayToBatchIndex[signer][dayTimestamp] = batchIndex;
        hasDayBatch[signer][dayTimestamp] = true;
        
        unchecked {
            totalAnchors++;
        }
        
        emit BatchAnchored(
            signer, 
            merkleRoot, 
            storagePointer, 
            dayTimestamp,
            batchSize, 
            batchIndex
        );
    }
    
    // ============ Query Functions ============
    
    /**
     * @notice Get all batch anchors for a user
     * @param user The wallet address to query
     * @return Array of BatchAnchor structs
     */
    function getUserBatches(address user) 
        external 
        view 
        returns (BatchAnchor[] memory) 
    {
        return userBatches[user];
    }
    
    /**
     * @notice Get a specific batch by index
     * @param user The wallet address
     * @param index The batch index
     * @return The BatchAnchor at that index
     */
    function getBatch(address user, uint256 index) 
        external 
        view 
        returns (BatchAnchor memory) 
    {
        if (index >= userBatches[user].length) revert IndexOutOfBounds();
        return userBatches[user][index];
    }
    
    /**
     * @notice Get batch for a specific day
     * @param user The wallet address
     * @param dayTimestamp The start-of-day timestamp
     * @return The BatchAnchor for that day
     */
    function getBatchByDay(address user, uint40 dayTimestamp)
        external
        view
        returns (BatchAnchor memory)
    {
        if (!hasDayBatch[user][dayTimestamp]) revert IndexOutOfBounds();
        uint256 index = dayToBatchIndex[user][dayTimestamp];
        return userBatches[user][index];
    }
    
    /**
     * @notice Get total number of batches for a user
     * @param user The wallet address
     * @return The count of anchored batches
     */
    function getBatchCount(address user) external view returns (uint256) {
        return userBatches[user].length;
    }
    
    // ============ Verification Functions ============
    
    /**
     * @notice Check if a Merkle root has been anchored
     * @param merkleRoot The root hash to verify
     * @return exists True if anchored, false otherwise
     * @return owner The address that anchored the batch (or zero)
     */
    function verifyAnchor(bytes32 merkleRoot) 
        external 
        view 
        returns (bool exists, address owner) 
    {
        exists = anchorExists[merkleRoot];
        owner = anchorOwner[merkleRoot];
    }
    
    /**
     * @notice Verify a specific consent exists in a batch using Merkle proof
     * @param merkleRoot The batch's Merkle root (must be anchored)
     * @param consentHash The hash of the specific consent event
     * @param proof The Merkle proof path
     * @return True if the consent is proven to exist in the batch
     */
    function verifyConsent(
        bytes32 merkleRoot,
        bytes32 consentHash,
        bytes32[] calldata proof
    ) external view returns (bool) {
        if (!anchorExists[merkleRoot]) return false;
        
        bytes32 computedHash = consentHash;
        
        for (uint256 i = 0; i < proof.length; ) {
            bytes32 proofElement = proof[i];
            
            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
            
            unchecked { i++; }
        }
        
        return computedHash == merkleRoot;
    }
    
    // ============ Revocation (GDPR Support) ============
    
    /**
     * @notice Mark a batch as revoked (for GDPR right-to-erasure support)
     * @param batchIndex The index of the batch to revoke
     * @dev Does not delete on-chain data, marks it as superseded
     */
    function revokeBatch(uint256 batchIndex) external {
        if (batchIndex >= userBatches[msg.sender].length) revert IndexOutOfBounds();
        
        BatchAnchor storage anchor = userBatches[msg.sender][batchIndex];
        if (anchor.revoked) revert BatchAlreadyRevoked();
        
        bytes32 merkleRoot = anchor.merkleRoot;
        anchor.revoked = true;
        
        emit BatchRevoked(msg.sender, merkleRoot, batchIndex);
    }
    
    // ============ Internal Functions ============
    
    /**
     * @notice Recover signer from signature
     * @param messageHash The hash that was signed
     * @param signature The signature bytes
     * @return The recovered signer address
     */
    function _recoverSigner(bytes32 messageHash, bytes calldata signature) 
        internal 
        pure 
        returns (address) 
    {
        require(signature.length == 65, "Invalid signature length");
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        
        if (v < 27) {
            v += 27;
        }
        
        require(v == 27 || v == 28, "Invalid signature v value");
        
        return ecrecover(messageHash, v, r, s);
    }
}
