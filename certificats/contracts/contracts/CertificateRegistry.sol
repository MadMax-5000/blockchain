// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title CertificateRegistry
/// @notice Devoir 1 — registre de certificats académiques stockés directement on-chain.
/// @dev Contrôle d'accès : owner + mapping d'admins. Aucun token, aucun transfert.
contract CertificateRegistry is Ownable, Pausable {
    struct Certificate {
        string studentName;
        string studentId;
        string diplomaTitle;
        string issueDate;
        string grade;
        address recipient;
        bool revoked;
    }

    /// @notice Taille maximale d'un batch pour rester dans une limite de gas raisonnable.
    uint256 public constant MAX_BATCH_SIZE = 50;

    mapping(address account => bool) public isAdmin;
    mapping(uint256 certId => Certificate) private _certificates;
    mapping(bytes32 studentIdHash => uint256 certId) private _certificateByStudentId;
    uint256 private _nextCertId = 1;

    event CertificateMinted(
        uint256 indexed certId,
        address indexed recipient,
        string studentId,
        string diplomaTitle,
        string issueDate
    );
    event CertificateRevoked(uint256 indexed certId, address indexed revokedBy);
    event AdminUpdated(address indexed account, bool enabled);

    error NotAdmin(address account);
    error ZeroAddress();
    error EmptyField(string field);
    error DuplicateStudentId(string studentId);
    error CertificateNotFound(uint256 certId);
    error CertificateNotFoundByStudentId(string studentId);
    error AlreadyRevoked(uint256 certId);
    error BatchTooLarge(uint256 size, uint256 max);
    error EmptyBatch();
    error LengthMismatch();

    modifier onlyAdmin() {
        if (msg.sender != owner() && !isAdmin[msg.sender]) revert NotAdmin(msg.sender);
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
    }

    // ---------------------------------------------------------------------
    // Administration
    // ---------------------------------------------------------------------

    /// @notice Ajoute ou retire un compte émetteur. Réservé au owner.
    function setAdmin(address account, bool enabled) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        isAdmin[account] = enabled;
        emit AdminUpdated(account, enabled);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ---------------------------------------------------------------------
    // Émission
    // ---------------------------------------------------------------------

    /// @notice Émet un certificat unique.
    function mintCertificate(
        address to,
        string calldata studentName,
        string calldata studentId,
        string calldata diplomaTitle,
        string calldata issueDate,
        string calldata grade
    ) external onlyAdmin whenNotPaused returns (uint256 certId) {
        certId = _mint(to, studentName, studentId, diplomaTitle, issueDate, grade);
    }

    /// @notice Émet plusieurs certificats en une seule transaction.
    function batchMint(
        address[] calldata recipients,
        string[] calldata studentNames,
        string[] calldata studentIds,
        string[] calldata diplomaTitles,
        string[] calldata issueDates,
        string[] calldata grades
    ) external onlyAdmin whenNotPaused returns (uint256[] memory certIds) {
        uint256 length = recipients.length;
        if (length == 0) revert EmptyBatch();
        if (length > MAX_BATCH_SIZE) revert BatchTooLarge(length, MAX_BATCH_SIZE);
        if (
            studentNames.length != length ||
            studentIds.length != length ||
            diplomaTitles.length != length ||
            issueDates.length != length ||
            grades.length != length
        ) revert LengthMismatch();

        certIds = new uint256[](length);
        for (uint256 i = 0; i < length; ++i) {
            certIds[i] = _mint(
                recipients[i],
                studentNames[i],
                studentIds[i],
                diplomaTitles[i],
                issueDates[i],
                grades[i]
            );
        }
    }

    /// @notice Révoque un certificat sans supprimer son historique.
    function revoke(uint256 certId) external onlyAdmin {
        Certificate storage certificate = _certificates[certId];
        if (certificate.recipient == address(0)) revert CertificateNotFound(certId);
        if (certificate.revoked) revert AlreadyRevoked(certId);
        certificate.revoked = true;
        emit CertificateRevoked(certId, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Lecture
    // ---------------------------------------------------------------------

    function getCertificate(uint256 certId) external view returns (Certificate memory) {
        Certificate memory certificate = _certificates[certId];
        if (certificate.recipient == address(0)) revert CertificateNotFound(certId);
        return certificate;
    }

    function getCertificateByStudentId(string calldata studentId) external view returns (Certificate memory) {
        uint256 certId = _certificateByStudentId[keccak256(bytes(studentId))];
        if (certId == 0) revert CertificateNotFoundByStudentId(studentId);
        return _certificates[certId];
    }

    /// @notice Retourne 0 si l'identifiant étudiant n'a jamais été enregistré.
    function certificateIdByStudentId(string calldata studentId) external view returns (uint256) {
        return _certificateByStudentId[keccak256(bytes(studentId))];
    }

    function totalCertificates() external view returns (uint256) {
        return _nextCertId - 1;
    }

    // ---------------------------------------------------------------------
    // Interne
    // ---------------------------------------------------------------------

    function _mint(
        address to,
        string calldata studentName,
        string calldata studentId,
        string calldata diplomaTitle,
        string calldata issueDate,
        string calldata grade
    ) internal returns (uint256 certId) {
        if (to == address(0)) revert ZeroAddress();
        _requireText(studentName, "studentName");
        _requireText(studentId, "studentId");
        _requireText(diplomaTitle, "diplomaTitle");
        _requireText(issueDate, "issueDate");

        bytes32 studentIdHash = keccak256(bytes(studentId));
        if (_certificateByStudentId[studentIdHash] != 0) revert DuplicateStudentId(studentId);

        certId = _nextCertId++;
        _certificateByStudentId[studentIdHash] = certId;
        _certificates[certId] = Certificate({
            studentName: studentName,
            studentId: studentId,
            diplomaTitle: diplomaTitle,
            issueDate: issueDate,
            grade: grade,
            recipient: to,
            revoked: false
        });

        emit CertificateMinted(certId, to, studentId, diplomaTitle, issueDate);
    }

    function _requireText(string calldata value, string memory field) internal pure {
        if (bytes(value).length == 0) revert EmptyField(field);
    }
}
