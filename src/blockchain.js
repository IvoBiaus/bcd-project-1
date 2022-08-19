/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message`
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *
 */

const SHA256 = require("crypto-js/sha256");
const BlockClass = require("./block.js");
const bitcoinMessage = require("bitcoinjs-message");

class Blockchain {
  /**
   * Constructor of the class, you will need to setup your chain array and the height
   * of your chain (the length of your chain array).
   * Also everytime you create a Blockchain class you will need to initialized the chain creating
   * the Genesis Block.
   * The methods in this class will always return a Promise to allow client applications or
   * other backends to call asynchronous functions.
   */
  constructor() {
    this.chain = [];
    this.height = -1;
    this.initializeChain();
  }

  /**
   * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
   * You should use the `addBlock(block)` to create the Genesis Block
   * Passing as a data `{data: 'Genesis Block'}`
   */
  async initializeChain() {
    if (this.height === -1) {
      const block = new BlockClass.Block({ data: "Genesis Block" });
      await this._addBlock(block);
    }
  }

  /**
   * Utility method that return a Promise that will resolve with the height of the chain
   */
  getChainHeight() {
    return new Promise((resolve, reject) => {
      resolve(this.height);
    });
  }

  /**
   * _addBlock(block) will store a block in the chain
   * @param {*} block
   * The method will return a Promise that will resolve with the block added
   * or reject if an error happen during the execution.
   * You will need to check for the height to assign the `previousBlockHash`,
   * assign the `timestamp` and the correct `height`...At the end you need to
   * create the `block hash` and push the block into the chain array. Don't for get
   * to update the `this.height`
   * Note: the symbol `_` in the method name indicates in the javascript convention
   * that this method is a private method.
   */
  async _addBlock(block) {
    const self = this;

    // Validate chain
    const errors = await this.validateChain();
    const hasErrors = !!errors.length;
    if (hasErrors) {
      throw Error("Cannot add block because chain has errors.");
    }

    // Add block to the chain
    const isNotGenesisBlock = self.height !== -1;

    if (isNotGenesisBlock) {
      const prevHash = self.chain[self.height - 1]?.hash;
      if (!prevHash) {
        throw Error("Previous block hash not found.");
      }
      block.previousBlockHash = prevHash;
    }

    block.time = new Date().getTime().toString().slice(0, -3);
    block.height = self.chain.length;
    const blockHash = SHA256(JSON.stringify(block)).toString();
    block.hash = blockHash;

    self.chain.push(block);
    self.height = self.chain.length;
    return block;
  }

  /**
   * The requestMessageOwnershipVerification(address) method
   * will allow you  to request a message that you will use to
   * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
   * This is the first step before submit your Block.
   * The method return a Promise that will resolve with the message to be signed
   * @param {*} address
   */
  requestMessageOwnershipVerification(address) {
    return new Promise((resolve) => {
      resolve(
        `${address}:${new Date()
          .getTime()
          .toString()
          .slice(0, -3)}:starRegistry`
      );
    });
  }

  /**
   * The submitStar(address, message, signature, star) method
   * will allow users to register a new Block with the star object
   * into the chain. This method will resolve with the Block added or
   * reject with an error.
   * Algorithm steps:
   * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
   * 2. Get the current time: `const currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
   * 3. Check if the time elapsed is less than 5 minutes
   * 4. Verify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
   * 5. Create the block and add it to the chain
   * 6. Resolve with the block added.
   * @param {*} address
   * @param {*} message
   * @param {*} signature
   * @param {*} star
   */
  async submitStar(address, message, signature, star) {
    const fiveMinutes = 5 * 60;

    const msgTime = parseInt(message.split(":")[1]);
    const currentTime = parseInt(new Date().getTime().toString().slice(0, -3));

    const elapsedTime = currentTime - msgTime;
    const elapsedIsMoreThan5Minutes = elapsedTime > fiveMinutes;
    if (elapsedIsMoreThan5Minutes) {
      throw Error("Elapsed time is more then 5 minutes.");
    }

    const isValid = bitcoinMessage.verify(message, address, signature);
    if (!isValid) {
      throw Error("Message validation with address and signature failed.");
    }

    const newStarBlock = new BlockClass.Block({ star, address });
    try {
      const blockAdded = await this._addBlock(newStarBlock);
      return blockAdded;
    } catch (e) {
      throw Error(e);
    }
  }

  /**
   * This method will return a Promise that will resolve with the Block
   *  with the hash passed as a parameter.
   * Search on the chain array for the block that has the hash.
   * @param {*} hash
   */
  getBlockByHash(hash) {
    const self = this;
    return new Promise((resolve, reject) => {
      const block = self.chain.find((b) => b.hash === hash);
      if (block) {
        resolve(block);
      }
      reject(`Block with hash "${hash}" was not found.`);
    });
  }

  /**
   * This method will return a Promise that will resolve with the Block object
   * with the height equal to the parameter `height`
   * @param {*} height
   */
  getBlockByHeight(height) {
    const self = this;
    return new Promise((resolve, reject) => {
      const block = self.chain.find((b) => b.height === height);
      if (block) {
        resolve(block);
      } else {
        resolve(null); // reject(`Block with height "${height}" was not found.`);
      }
    });
  }

  /**
   * This method will return a Promise that will resolve with an array of Stars objects existing in the chain
   * and are belongs to the owner with the wallet address passed as parameter.
   * Remember the star should be returned decoded.
   * @param {*} address
   */
  async getStarsByWalletAddress(address) {
    const stars = [];

    try {
      for (const block of this.chain) {
        const blockData = await block.getBData();
        if (blockData?.address === address && blockData?.star) {
          stars.push(blockData);
        }
      }
      return stars;
    } catch (e) {
      throw Error(e);
    }
  }

  /**
   * This method will return a Promise that will resolve with the list of errors when validating the chain.
   * Steps to validate:
   * 1. You should validate each block using `validateBlock`
   * 2. Each Block should check the with the previousBlockHash
   */

  async validateChain() {
    const self = this;
    const errorLog = [];
    let prevHash = null;

    try {
      for (const block of self.chain) {
        const wasTampered = !(await block.validate());
        if (wasTampered) {
          errorLog.push(`Block ${block.hash} was tampered.`);
        }

        const hashesDontMatch = block.previousBlockHash !== prevHash;
        if (hashesDontMatch) {
          errorLog.push(
            `Previous block hash doesnt match with ${block.hash} block's previous hash property.`
          );
        }
        prevHash = block.hash;
      }
      return errorLog;
    } catch (e) {
      throw Error(e);
    }
  }
}

module.exports.Blockchain = Blockchain;
