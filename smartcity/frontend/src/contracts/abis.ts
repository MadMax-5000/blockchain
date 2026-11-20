// Fichier généré par scripts/export-frontend.ts — ne pas éditer à la main.
// Relancer `npm run export` après chaque compilation.

export const registryAbi = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "AccessControlBadConfirmation",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "neededRole",
        "type": "bytes32"
      }
    ],
    "name": "AccessControlUnauthorizedAccount",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "size",
        "type": "uint256"
      }
    ],
    "name": "BatchTooLarge",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "EmptyBatch",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "field",
        "type": "string"
      }
    ],
    "name": "EmptyField",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "EnforcedPause",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ExpectedPause",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint8",
        "name": "from",
        "type": "uint8"
      },
      {
        "internalType": "uint8",
        "name": "to",
        "type": "uint8"
      }
    ],
    "name": "InvalidStatusTransition",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "issueId",
        "type": "string"
      }
    ],
    "name": "IssueAlreadyExists",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "issueId",
        "type": "string"
      }
    ],
    "name": "IssueNotFound",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ReentrancyGuardReentrantCall",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "field",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "maxLength",
        "type": "uint256"
      }
    ],
    "name": "StringTooLong",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint8",
        "name": "currentStatus",
        "type": "uint8"
      }
    ],
    "name": "TeamChangeNotAllowed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TeamRequired",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "issueKey",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "issueId",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "team",
        "type": "string"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "actor",
        "type": "address"
      }
    ],
    "name": "IssueAssigned",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "issueKey",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "issueId",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "issueType",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "location",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "enum UrbanIssueRegistry.Priority",
        "name": "priority",
        "type": "uint8"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "createdBy",
        "type": "address"
      }
    ],
    "name": "IssueCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "issueKey",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "index",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "enum UrbanIssueRegistry.Status",
        "name": "status",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "comment",
        "type": "string"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "actor",
        "type": "address"
      }
    ],
    "name": "IssueHistoryAdded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "issueKey",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "issueId",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "enum UrbanIssueRegistry.Status",
        "name": "previousStatus",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "enum UrbanIssueRegistry.Status",
        "name": "newStatus",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "comment",
        "type": "string"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "actor",
        "type": "address"
      }
    ],
    "name": "IssueStatusUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "Paused",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "previousAdminRole",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "newAdminRole",
        "type": "bytes32"
      }
    ],
    "name": "RoleAdminChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      }
    ],
    "name": "RoleGranted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      }
    ],
    "name": "RoleRevoked",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "Unpaused",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "AGENT_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "DEFAULT_ADMIN_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MAX_BATCH_SIZE",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "issueId",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "team",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "comment",
        "type": "string"
      }
    ],
    "name": "assignTeam",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "string",
            "name": "issueId",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "issueType",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "location",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "description",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "reportDate",
            "type": "string"
          },
          {
            "internalType": "enum UrbanIssueRegistry.Priority",
            "name": "priority",
            "type": "uint8"
          },
          {
            "internalType": "string",
            "name": "reportedBy",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "assignedTo",
            "type": "string"
          },
          {
            "internalType": "enum UrbanIssueRegistry.Status",
            "name": "status",
            "type": "uint8"
          }
        ],
        "internalType": "struct UrbanIssueRegistry.IssueInput[]",
        "name": "inputs",
        "type": "tuple[]"
      }
    ],
    "name": "batchCreateIssues",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "created",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "string",
            "name": "issueId",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "issueType",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "location",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "description",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "reportDate",
            "type": "string"
          },
          {
            "internalType": "enum UrbanIssueRegistry.Priority",
            "name": "priority",
            "type": "uint8"
          },
          {
            "internalType": "string",
            "name": "reportedBy",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "assignedTo",
            "type": "string"
          },
          {
            "internalType": "enum UrbanIssueRegistry.Status",
            "name": "status",
            "type": "uint8"
          }
        ],
        "internalType": "struct UrbanIssueRegistry.IssueInput",
        "name": "input",
        "type": "tuple"
      }
    ],
    "name": "createIssue",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "issueId",
        "type": "string"
      }
    ],
    "name": "getHistory",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint64",
            "name": "timestamp",
            "type": "uint64"
          },
          {
            "internalType": "enum UrbanIssueRegistry.Status",
            "name": "status",
            "type": "uint8"
          },
          {
            "internalType": "string",
            "name": "assignedTo",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "comment",
            "type": "string"
          },
          {
            "internalType": "address",
            "name": "actor",
            "type": "address"
          }
        ],
        "internalType": "struct UrbanIssueRegistry.HistoryEntry[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "issueId",
        "type": "string"
      }
    ],
    "name": "getIssue",
    "outputs": [
      {
        "components": [
          {
            "internalType": "string",
            "name": "issueId",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "issueType",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "location",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "description",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "reportDate",
            "type": "string"
          },
          {
            "internalType": "enum UrbanIssueRegistry.Priority",
            "name": "priority",
            "type": "uint8"
          },
          {
            "internalType": "string",
            "name": "reportedBy",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "assignedTo",
            "type": "string"
          },
          {
            "internalType": "enum UrbanIssueRegistry.Status",
            "name": "status",
            "type": "uint8"
          },
          {
            "internalType": "uint64",
            "name": "createdAt",
            "type": "uint64"
          },
          {
            "internalType": "uint64",
            "name": "updatedAt",
            "type": "uint64"
          },
          {
            "internalType": "bool",
            "name": "exists",
            "type": "bool"
          }
        ],
        "internalType": "struct UrbanIssueRegistry.Issue",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "offset",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "limit",
        "type": "uint256"
      }
    ],
    "name": "getIssueIds",
    "outputs": [
      {
        "internalType": "string[]",
        "name": "result",
        "type": "string[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      }
    ],
    "name": "getRoleAdmin",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "grantRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "hasRole",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "issueId",
        "type": "string"
      }
    ],
    "name": "issueExists",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "pause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "paused",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "callerConfirmation",
        "type": "address"
      }
    ],
    "name": "renounceRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "revokeRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes4",
        "name": "interfaceId",
        "type": "bytes4"
      }
    ],
    "name": "supportsInterface",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalIssues",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "unpause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "issueId",
        "type": "string"
      },
      {
        "internalType": "enum UrbanIssueRegistry.Status",
        "name": "newStatus",
        "type": "uint8"
      },
      {
        "internalType": "string",
        "name": "comment",
        "type": "string"
      }
    ],
    "name": "updateStatus",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;
