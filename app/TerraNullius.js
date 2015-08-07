var tn_abi =  [
  {
    "constant": false,
    "inputs": [],
    "name": "number_of_claims",
    "outputs": [
      {
        "name": "result",
        "type": "uint256"
      }
    ],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "claims",
    "outputs": [
      {
        "name": "claimant",
        "type": "address"
      },
      {
        "name": "message",
        "type": "string"
      },
      {
        "name": "block_number",
        "type": "uint256"
      }
    ],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "message",
        "type": "string"
      }
    ],
    "name": "claim",
    "outputs": [],
    "type": "function"
  }
]

terra_nullius = eth.contract(tn_abi).at("0x6e38a457c722c6011b2dfa06d49240e797844d66")
