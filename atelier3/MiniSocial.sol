// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MiniSocial
/// @notice Mini réseau social on-chain : publication et lecture de messages.
contract MiniSocial {
    struct Post {
        string message;
        address author;
    }

    Post[] private posts;

    /// @notice Publie un message depuis l'adresse de l'appelant.
    function publishPost(string memory _message) public {
        posts.push(Post(_message, msg.sender));
    }

    /// @notice Retourne le message et son auteur pour un index donné.
    function getPost(uint index) public view returns (string memory, address) {
        Post storage post = posts[index];
        return (post.message, post.author);
    }

    /// @notice Retourne le nombre total de messages publiés.
    function getTotalPosts() public view returns (uint) {
        return posts.length;
    }
}
