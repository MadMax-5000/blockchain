// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title UrbanIssueRegistry
/// @notice Mini-projet Smart City — cycle de vie des signalements urbains, tracé on-chain.
/// @dev AccessControl + Pausable + ReentrancyGuard. Aucun transfert d'ETH, aucun appel externe.
contract UrbanIssueRegistry is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    uint256 public constant MAX_BATCH_SIZE = 50;
    uint256 private constant MAX_ID_LENGTH = 64;
    uint256 private constant MAX_SHORT_TEXT = 128;
    uint256 private constant MAX_DESCRIPTION = 512;

    enum Status {
        Reported,
        Assigned,
        InProgress,
        Resolved,
        Closed
    }

    enum Priority {
        Low,
        Medium,
        High,
        Critical
    }

    struct IssueInput {
        string issueId;
        string issueType;
        string location;
        string description;
        string reportDate;
        Priority priority;
        string reportedBy;
        string assignedTo;
        Status status;
    }

    struct Issue {
        string issueId;
        string issueType;
        string location;
        string description;
        string reportDate;
        Priority priority;
        string reportedBy;
        string assignedTo;
        Status status;
        uint64 createdAt;
        uint64 updatedAt;
        bool exists;
    }

    struct HistoryEntry {
        uint64 timestamp;
        Status status;
        string assignedTo;
        string comment;
        address actor;
    }

    event IssueCreated(
        bytes32 indexed issueKey,
        string issueId,
        string issueType,
        string location,
        Priority priority,
        address indexed createdBy
    );
    event IssueAssigned(
        bytes32 indexed issueKey,
        string issueId,
        string team,
        address indexed actor
    );
    event IssueStatusUpdated(
        bytes32 indexed issueKey,
        string issueId,
        Status previousStatus,
        Status newStatus,
        string comment,
        address indexed actor
    );
    event IssueHistoryAdded(
        bytes32 indexed issueKey,
        uint256 index,
        Status status,
        string comment,
        address indexed actor
    );

    error IssueAlreadyExists(string issueId);
    error IssueNotFound(string issueId);
    error EmptyField(string field);
    error StringTooLong(string field, uint256 maxLength);
    error TeamRequired();
    error InvalidStatusTransition(uint8 from, uint8 to);
    error TeamChangeNotAllowed(uint8 currentStatus);
    error EmptyBatch();
    error BatchTooLarge(uint256 size);

    mapping(bytes32 issueKey => Issue) private _issues;
    mapping(bytes32 issueKey => HistoryEntry[]) private _history;
    bytes32[] private _keys;

    uint256 public totalIssues;

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(AGENT_ROLE, msg.sender);
    }

    /// @notice Crée un signalement. Outil pour les citoyens ; l'import de masse est réservé aux agents.
    function createIssue(IssueInput calldata input)
        external
        whenNotPaused
        nonReentrant
        returns (bytes32)
    {
        return _create(input);
    }

    /// @notice Import Excel : crée jusqu'à 50 signalements en une transaction.
    function batchCreateIssues(IssueInput[] calldata inputs)
        external
        onlyRole(AGENT_ROLE)
        whenNotPaused
        nonReentrant
        returns (uint256 created)
    {
        uint256 length = inputs.length;
        if (length == 0) revert EmptyBatch();
        if (length > MAX_BATCH_SIZE) revert BatchTooLarge(length);

        for (uint256 index = 0; index < length; ++index) {
            _create(inputs[index]);
            ++created;
        }
    }

    /// @notice Affecte une équipe. Fait passer Reported → Assigned, ou change l'équipe en cours de traitement.
    function assignTeam(string calldata issueId, string calldata team, string calldata comment)
        external
        onlyRole(AGENT_ROLE)
        whenNotPaused
        nonReentrant
    {
        bytes32 key = _key(issueId);
        Issue storage issue = _issue(key, issueId);
        _checkText("team", team, MAX_SHORT_TEXT);

        Status current = issue.status;
        if (current == Status.Resolved || current == Status.Closed) {
            revert TeamChangeNotAllowed(uint8(current));
        }

        Status next = current;
        if (current == Status.Reported) {
            next = Status.Assigned;
            issue.status = next;
            emit IssueStatusUpdated(key, issueId, current, next, comment, msg.sender);
        }

        issue.assignedTo = team;
        issue.updatedAt = uint64(block.timestamp);
        _addHistory(key, next, team, comment, msg.sender);
        emit IssueAssigned(key, issueId, team, msg.sender);
    }

    /// @notice Met à jour le statut selon la chaîne Reported → Assigned → InProgress → Resolved → Closed.
    function updateStatus(string calldata issueId, Status newStatus, string calldata comment)
        external
        onlyRole(AGENT_ROLE)
        whenNotPaused
        nonReentrant
    {
        bytes32 key = _key(issueId);
        Issue storage issue = _issue(key, issueId);
        Status previous = issue.status;

        if (!_isValidTransition(previous, newStatus)) {
            revert InvalidStatusTransition(uint8(previous), uint8(newStatus));
        }
        if (newStatus == Status.Assigned && bytes(issue.assignedTo).length == 0) {
            revert TeamRequired();
        }

        issue.status = newStatus;
        issue.updatedAt = uint64(block.timestamp);
        _addHistory(key, newStatus, issue.assignedTo, comment, msg.sender);
        emit IssueStatusUpdated(key, issueId, previous, newStatus, comment, msg.sender);
    }

    function getIssue(string calldata issueId) external view returns (Issue memory) {
        return _issue(_key(issueId), issueId);
    }

    function getHistory(string calldata issueId) external view returns (HistoryEntry[] memory) {
        bytes32 key = _key(issueId);
        _issue(key, issueId);
        return _history[key];
    }

    function issueExists(string calldata issueId) external view returns (bool) {
        return _issues[_key(issueId)].exists;
    }

    /// @notice Liste paginée des identifiants pour l'écran de consultation publique.
    function getIssueIds(uint256 offset, uint256 limit) external view returns (string[] memory result) {
        uint256 length = _keys.length;
        if (offset >= length || limit == 0) return new string[](0);

        uint256 size = limit > 100 ? 100 : limit;
        if (offset + size > length) size = length - offset;

        result = new string[](size);
        for (uint256 index = 0; index < size; ++index) {
            result[index] = _issues[_keys[offset + index]].issueId;
        }
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function _create(IssueInput calldata input) internal returns (bytes32 key) {
        key = _key(input.issueId);
        if (_issues[key].exists) revert IssueAlreadyExists(input.issueId);

        _checkText("issueId", input.issueId, MAX_ID_LENGTH);
        _checkText("issueType", input.issueType, MAX_SHORT_TEXT);
        _checkText("location", input.location, MAX_SHORT_TEXT);
        _checkText("description", input.description, MAX_DESCRIPTION);
        _checkText("reportDate", input.reportDate, MAX_SHORT_TEXT);
        _checkText("reportedBy", input.reportedBy, MAX_SHORT_TEXT);
        if (bytes(input.assignedTo).length > 0) {
            _checkText("assignedTo", input.assignedTo, MAX_SHORT_TEXT);
        }
        if (input.status != Status.Reported && bytes(input.assignedTo).length == 0) {
            revert TeamRequired();
        }

        uint64 now_ = uint64(block.timestamp);
        Issue storage issue = _issues[key];
        issue.issueId = input.issueId;
        issue.issueType = input.issueType;
        issue.location = input.location;
        issue.description = input.description;
        issue.reportDate = input.reportDate;
        issue.priority = input.priority;
        issue.reportedBy = input.reportedBy;
        issue.assignedTo = input.assignedTo;
        issue.status = input.status;
        issue.createdAt = now_;
        issue.updatedAt = now_;
        issue.exists = true;

        _keys.push(key);
        ++totalIssues;
        _addHistory(key, input.status, input.assignedTo, "Signalement cree", msg.sender);

        emit IssueCreated(
            key,
            input.issueId,
            input.issueType,
            input.location,
            input.priority,
            msg.sender
        );
    }

    function _addHistory(
        bytes32 key,
        Status status,
        string memory assignedTo,
        string memory comment,
        address actor
    ) internal {
        uint256 index = _history[key].length;
        _history[key].push(
            HistoryEntry({
                timestamp: uint64(block.timestamp),
                status: status,
                assignedTo: assignedTo,
                comment: comment,
                actor: actor
            })
        );
        emit IssueHistoryAdded(key, index, status, comment, actor);
    }

    function _issue(bytes32 key, string calldata issueId) internal view returns (Issue storage issue) {
        issue = _issues[key];
        if (!issue.exists) revert IssueNotFound(issueId);
    }

    function _key(string calldata issueId) internal pure returns (bytes32) {
        return keccak256(bytes(issueId));
    }

    function _checkText(string memory field, string calldata value, uint256 maxLength) internal pure {
        uint256 length = bytes(value).length;
        if (length == 0) revert EmptyField(field);
        if (length > maxLength) revert StringTooLong(field, maxLength);
    }

    function _isValidTransition(Status from, Status to) internal pure returns (bool) {
        if (from == Status.Reported) return to == Status.Assigned;
        if (from == Status.Assigned) return to == Status.InProgress;
        if (from == Status.InProgress) return to == Status.Resolved;
        if (from == Status.Resolved) return to == Status.Closed;
        return false;
    }
}
