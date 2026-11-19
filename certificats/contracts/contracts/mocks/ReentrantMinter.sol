// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {CertificateNFT} from "../CertificateNFT.sol";

/// @notice Contrat receveur malveillant utilisé uniquement dans les tests de reentrancy.
contract ReentrantMinter is IERC721Receiver {
    CertificateNFT public immutable nft;
    bool public reentered;

    constructor(address nft_) {
        nft = CertificateNFT(nft_);
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external override returns (bytes4) {
        reentered = true;
        nft.mintCertificate(
            address(this),
            "Reentrant",
            "REENTRANT-001",
            "Diplome",
            "2026-01-01",
            "Aucune"
        );
        return IERC721Receiver.onERC721Received.selector;
    }
}
