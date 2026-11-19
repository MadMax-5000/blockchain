// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title CertificateNFT
/// @notice Devoir 2 — certificat académique ERC-721 avec métadonnées on-chain.
/// @dev ERC721URIStorage + AccessControl + Pausable + ReentrancyGuard.
contract CertificateNFT is ERC721URIStorage, AccessControl, Pausable, ReentrancyGuard {
    using Strings for uint256;

    struct Certificate {
        string studentName;
        string studentId;
        string diplomaTitle;
        string issueDate;
        string grade;
        address recipient;
        bool revoked;
        uint64 issuedAt;
    }

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 public constant MAX_BATCH_SIZE = 50;

    /// @notice Si vrai, les certificats sont non transférables (soulbound).
    bool public immutable soulbound;

    uint256 private _nextTokenId = 1;
    mapping(uint256 tokenId => Certificate) private _certificates;
    mapping(bytes32 studentIdHash => uint256 tokenId) private _tokenByStudentId;
    string private _contractURI;
    string private _imageURI;

    event CertificateMinted(
        uint256 indexed tokenId,
        address indexed recipient,
        string studentId,
        string diplomaTitle,
        string issueDate
    );
    event CertificateRevoked(uint256 indexed tokenId, address indexed revokedBy);
    event ContractURIUpdated(string uri);
    event ImageURIUpdated(string uri);

    error ZeroAddress();
    error EmptyField(string field);
    error DuplicateStudentId(string studentId);
    error CertificateNotFound(uint256 tokenId);
    error AlreadyRevoked(uint256 tokenId);
    error BatchTooLarge(uint256 size, uint256 max);
    error EmptyBatch();
    error LengthMismatch();
    error TransferNotAllowed(uint256 tokenId);
    error ApprovalsDisabled();

    constructor(address admin, bool soulbound_) ERC721("Certificat Academique", "CERT") {
        if (admin == address(0)) revert ZeroAddress();
        soulbound = soulbound_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    // ---------------------------------------------------------------------
    // Émission
    // ---------------------------------------------------------------------

    /// @notice Émet un certificat unique avec ses métadonnées on-chain.
    function mintCertificate(
        address to,
        string calldata studentName,
        string calldata studentId,
        string calldata diplomaTitle,
        string calldata issueDate,
        string calldata grade
    ) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant returns (uint256 tokenId) {
        tokenId = _mintWithData(to, studentName, studentId, diplomaTitle, issueDate, grade);
    }

    /// @notice Signature demandée par le sujet : batch de destinataires avec des URI précalculées.
    /// @dev Mode bas niveau pour des métadonnées hébergées hors chaîne (IPFS).
    ///      Aucune métadonnée structurée n'est enregistrée dans ce mode.
    function batchMintCertificates(
        address[] calldata to,
        string[] calldata uris
    ) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant returns (uint256[] memory tokenIds) {
        uint256 length = to.length;
        if (length == 0) revert EmptyBatch();
        if (length > MAX_BATCH_SIZE) revert BatchTooLarge(length, MAX_BATCH_SIZE);
        if (uris.length != length) revert LengthMismatch();

        tokenIds = new uint256[](length);
        for (uint256 i = 0; i < length; ++i) {
            if (to[i] == address(0)) revert ZeroAddress();
            uint256 tokenId = _nextTokenId++;
            _safeMint(to[i], tokenId);
            _setTokenURI(tokenId, uris[i]);
            _certificates[tokenId].recipient = to[i];
            _certificates[tokenId].issuedAt = uint64(block.timestamp);
            tokenIds[i] = tokenId;
            emit CertificateMinted(tokenId, to[i], "", "", "");
        }
    }

    /// @notice Batch complet utilisé par l'import Excel : toutes les métadonnées sont stockées on-chain.
    function batchMintCertificatesWithData(
        address[] calldata to,
        string[] calldata studentNames,
        string[] calldata studentIds,
        string[] calldata diplomaTitles,
        string[] calldata issueDates,
        string[] calldata grades
    ) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant returns (uint256[] memory tokenIds) {
        uint256 length = to.length;
        if (length == 0) revert EmptyBatch();
        if (length > MAX_BATCH_SIZE) revert BatchTooLarge(length, MAX_BATCH_SIZE);
        if (
            studentNames.length != length ||
            studentIds.length != length ||
            diplomaTitles.length != length ||
            issueDates.length != length ||
            grades.length != length
        ) revert LengthMismatch();

        tokenIds = new uint256[](length);
        for (uint256 i = 0; i < length; ++i) {
            tokenIds[i] = _mintWithData(
                to[i],
                studentNames[i],
                studentIds[i],
                diplomaTitles[i],
                issueDates[i],
                grades[i]
            );
        }
    }

    /// @notice Révoque un certificat. Le token reste lisible pour la vérification publique.
    function revokeCertificate(uint256 tokenId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _requireOwned(tokenId);
        Certificate storage certificate = _certificates[tokenId];
        if (certificate.revoked) revert AlreadyRevoked(tokenId);
        certificate.revoked = true;
        emit CertificateRevoked(tokenId, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Administration
    // ---------------------------------------------------------------------

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function setContractURI(string calldata uri) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _contractURI = uri;
        emit ContractURIUpdated(uri);
    }

    function setImageURI(string calldata uri) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _imageURI = uri;
        emit ImageURIUpdated(uri);
    }

    // ---------------------------------------------------------------------
    // Lecture
    // ---------------------------------------------------------------------

    function getCertificate(uint256 tokenId) external view returns (Certificate memory) {
        _requireOwned(tokenId);
        return _certificates[tokenId];
    }

    /// @notice Retourne 0 si l'identifiant étudiant n'a jamais été enregistré.
    function tokenIdByStudentId(string calldata studentId) external view returns (uint256) {
        return _tokenByStudentId[keccak256(bytes(studentId))];
    }

    function totalCertificates() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    function contractURI() external view returns (string memory) {
        if (bytes(_contractURI).length > 0) return _contractURI;
        return string.concat("data:application/json;base64,", Base64.encode(bytes(_contractMetadata())));
    }

    function tokenURI(uint256 tokenId) public view override(ERC721URIStorage) returns (string memory) {
        string memory customURI = super.tokenURI(tokenId);
        if (bytes(customURI).length > 0) return customURI;
        return string.concat("data:application/json;base64,", Base64.encode(bytes(_tokenMetadata(tokenId))));
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // ---------------------------------------------------------------------
    // Soulbound
    // ---------------------------------------------------------------------

    function approve(address, uint256) public pure override(ERC721, IERC721) {
        revert ApprovalsDisabled();
    }

    function setApprovalForAll(address, bool) public pure override(ERC721, IERC721) {
        revert ApprovalsDisabled();
    }

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721) returns (address) {
        address from = super._update(to, tokenId, auth);
        if (soulbound && from != address(0) && to != address(0)) revert TransferNotAllowed(tokenId);
        return from;
    }

    // ---------------------------------------------------------------------
    // Interne
    // ---------------------------------------------------------------------

    function _mintWithData(
        address to,
        string calldata studentName,
        string calldata studentId,
        string calldata diplomaTitle,
        string calldata issueDate,
        string calldata grade
    ) internal returns (uint256 tokenId) {
        if (to == address(0)) revert ZeroAddress();
        _requireText(studentName, "studentName");
        _requireText(studentId, "studentId");
        _requireText(diplomaTitle, "diplomaTitle");
        _requireText(issueDate, "issueDate");

        bytes32 studentIdHash = keccak256(bytes(studentId));
        if (_tokenByStudentId[studentIdHash] != 0) revert DuplicateStudentId(studentId);

        tokenId = _nextTokenId++;
        _tokenByStudentId[studentIdHash] = tokenId;
        _certificates[tokenId] = Certificate({
            studentName: studentName,
            studentId: studentId,
            diplomaTitle: diplomaTitle,
            issueDate: issueDate,
            grade: grade,
            recipient: to,
            revoked: false,
            issuedAt: uint64(block.timestamp)
        });

        _safeMint(to, tokenId);
        emit CertificateMinted(tokenId, to, studentId, diplomaTitle, issueDate);
    }

    function _requireText(string calldata value, string memory field) internal pure {
        if (bytes(value).length == 0) revert EmptyField(field);
    }

    function _tokenMetadata(uint256 tokenId) internal view returns (string memory) {
        Certificate storage certificate = _certificates[tokenId];
        string memory status = certificate.revoked ? "Revoque" : "Valide";
        string memory image = bytes(_imageURI).length > 0
            ? string.concat(',"image":"', _escape(_imageURI), '"')
            : "";

        return string.concat(
            '{"name":"',
            _escape(certificate.diplomaTitle),
            " - ",
            _escape(certificate.studentName),
            '",',
            '"description":"Certificat academique verifiable emis on-chain par CertificateNFT.",',
            '"attributes":[',
            '{"trait_type":"Etudiant","value":"',
            _escape(certificate.studentName),
            '"},',
            '{"trait_type":"Identifiant","value":"',
            _escape(certificate.studentId),
            '"},',
            '{"trait_type":"Diplome","value":"',
            _escape(certificate.diplomaTitle),
            '"},',
            '{"trait_type":"Date emission","value":"',
            _escape(certificate.issueDate),
            '"},',
            '{"trait_type":"Mention","value":"',
            _escape(certificate.grade),
            '"},',
            '{"trait_type":"Statut","value":"',
            status,
            '"}',
            "]",
            image,
            "}"
        );
    }

    function _contractMetadata() internal pure returns (string memory) {
        return string.concat(
            '{"name":"Certificats Academiques",',
            '"description":"Collection ERC-721 de certificats academiques verifiables.",',
            '"external_link":"https://github.com/",',
            '"seller_fee_basis_points":0}'
        );
    }

    /// @dev Échappe les caractères qui casseraient le JSON. Coût supporté uniquement en lecture.
    function _escape(string memory value) internal pure returns (string memory) {
        bytes memory input = bytes(value);
        uint256 extra;
        for (uint256 i = 0; i < input.length; ++i) {
            bytes1 char = input[i];
            if (char == '"' || char == "\\") extra += 1;
            else if (char == "\n") extra += 1;
        }
        if (extra == 0) return value;

        bytes memory output = new bytes(input.length + extra);
        uint256 j;
        for (uint256 i = 0; i < input.length; ++i) {
            bytes1 char = input[i];
            if (char == '"' || char == "\\") {
                output[j++] = "\\";
                output[j++] = char;
            } else if (char == "\n") {
                output[j++] = "\\";
                output[j++] = "n";
            } else {
                output[j++] = char;
            }
        }
        return string(output);
    }
}
