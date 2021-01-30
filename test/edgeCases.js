const RockPaperScissors = artifacts.require("RockPaperScissors");
const truffleAssert = require("truffle-assertions");
const timeHelper = require("../util/timeHelper");
const eventAssert = require("../util/eventAssertionHelper");
const chai = require("chai");

const { BN } = web3.utils.BN;
const { assert } = chai;
chai.use(require("chai-bn")(BN));

contract("RockPaperScissors", (accounts) => {
  let snapShotId;
  before(async () => {
    it("TestRPC  must have adequate number of addresses", () => {
      assert.isAtLeast(accounts.length, 4, "Test has enough addresses");
    });
    snapShotId = (await timeHelper.takeSnapshot()).id;
  });

  let rockPaperScissors;
  let MIN_CUTOFF_INTERVAL;
  let MAX_CUTOFF_INTERVAL;
  let MASK_TIMESTAMP_SLACK;
  let MASK_BLOCK_SLACK;
  let cutOffInterval;
  let maskTimestamp;
  let gameId;
  const deployer = accounts[0];
  const creator = accounts[1];
  const opponent = accounts[2];
  const somebody = accounts[3];
  const gas = 4000000;
  const CHOICE = {
    NONE: 0,
    ROCK: 1,
    PAPER: 2,
    SCISSORS: 3,
  };
  const mask = web3.utils.fromAscii("1c04ddc043e");
  const _stake = web3.utils.toWei("0.01", "ether");

  describe("edge case tests", () => {
    async function maskChoice(_choice) {
      const block = await web3.eth.getBlock("latest");
      maskTimestamp = block.timestamp;
      return await rockPaperScissors.contract.methods
        .maskChoice(_choice, mask, creator, maskTimestamp, true, block.number)
        .call({ from: creator });
    }

    async function createGame(_maskedChoice, cutOffInterval) {
      await rockPaperScissors.contract.methods
        .create(opponent, _maskedChoice, _stake, cutOffInterval)
        .send({ from: creator, value: _stake, gas: gas });
    }

    async function setGameVariables(gameId) {
      const game = await rockPaperScissors.games.call(gameId);
      assert.isDefined(game, "game has not been written to storage");

      playDeadline = Number(game.playDeadline);
      revealDeadline = Number(game.revealDeadline);
    }

    async function playGame(_choice) {
      await rockPaperScissors.contract.methods.play(gameId, _choice).send({ from: opponent, value: _stake, gas });
    }

    async function reveal(_choice) {
      const txReceipt = await rockPaperScissors.contract.methods
        .reveal(gameId, _choice, mask, maskTimestamp)
        .send({ from: creator, gas });
      assert.isDefined(txReceipt, "reveal Tx has not been mined");
    }

    async function calculateGasSpent(txReceipt) {
      const tx = await web3.eth.getTransaction(txReceipt.transactionHash);
      const bn_gasPrice = new BN(tx.gasPrice);
      const bn_gasAmount = new BN(txReceipt.gasUsed);
      return Number(bn_gasPrice.mul(bn_gasAmount));
    }

    beforeEach("deploy a fresh contract, create game, advance block & timestamp", async () => {
      rockPaperScissors = await RockPaperScissors.new({ from: deployer });
      MIN_STAKE = (await rockPaperScissors.MIN_STAKE.call()).toNumber();
      MIN_CUTOFF_INTERVAL = (await rockPaperScissors.MIN_CUTOFF_INTERVAL.call()).toNumber();
      MAX_CUTOFF_INTERVAL = (await rockPaperScissors.MAX_CUTOFF_INTERVAL.call()).toNumber();
      MASK_TIMESTAMP_SLACK = (await rockPaperScissors.MASK_TIMESTAMP_SLACK.call()).toNumber();
      MASK_BLOCK_SLACK = (await rockPaperScissors.MASK_BLOCK_SLACK.call()).toNumber();
    });

    it("should play maximum gamelifetime game to completion", async () => {
      //Arrange
      const winningsBefore = Number(await rockPaperScissors.winnings.call(creator));

      //Act
      gameId = await maskChoice(CHOICE.SCISSORS);
      await createGame(gameId, MAX_CUTOFF_INTERVAL);
      await setGameVariables(gameId);
      await playGame(CHOICE.PAPER);
      await timeHelper.advanceTimeAndBlock(MAX_CUTOFF_INTERVAL);
      await reveal(CHOICE.SCISSORS);

      //Assert
      const winningsAfter = Number(await rockPaperScissors.winnings.call(creator));
      assert.strictEqual(Number(winningsAfter), _stake * 2, "creator winnings is incorrect");
    });

    it("should play maximum timestamp Slack game to completion", async () => {
      //Arrange
      const block = await web3.eth.getBlock("latest");
      maskTimestamp = block.timestamp + MASK_TIMESTAMP_SLACK;
      gameId = await rockPaperScissors.contract.methods
        .maskChoice(CHOICE.SCISSORS, mask, creator, maskTimestamp, true, block.number)
        .call({ from: creator });

      //Act
      const winningsBefore = Number(await rockPaperScissors.winnings.call(creator));
      await createGame(gameId, MAX_CUTOFF_INTERVAL);
      await setGameVariables(gameId);
      await playGame(CHOICE.PAPER);
      await timeHelper.advanceTimeAndBlock(MAX_CUTOFF_INTERVAL);
      await reveal(CHOICE.SCISSORS);

      //Assert
      const winningsAfter = Number(await rockPaperScissors.winnings.call(creator));
      assert.strictEqual(winningsAfter - winningsBefore, _stake * 2, "creator winnings is incorrect");
    });

    it("should play minimum timestamp Slack game to completion", async () => {
      //Arrange
      const block = await web3.eth.getBlock("latest");
      maskTimestamp = block.timestamp - MASK_TIMESTAMP_SLACK;
      gameId = await rockPaperScissors.contract.methods
        .maskChoice(CHOICE.SCISSORS, mask, creator, maskTimestamp, true, block.number)
        .call({ from: creator });

      //Act
      const winningsBefore = Number(await rockPaperScissors.winnings.call(creator));
      await createGame(gameId, MAX_CUTOFF_INTERVAL);
      await setGameVariables(gameId);
      await playGame(CHOICE.PAPER);
      await timeHelper.advanceTimeAndBlock(MAX_CUTOFF_INTERVAL);
      await reveal(CHOICE.SCISSORS);

      //Assert
      const winningsAfter = Number(await rockPaperScissors.winnings.call(creator));
      assert.strictEqual(winningsAfter - winningsBefore, _stake * 2, "creator winnings is incorrect");
    });

    it("should play maximum block number Slack game to completion", async () => {
      //Arrange
      const block = await web3.eth.getBlock("latest");
      const cutoff = (MAX_CUTOFF_INTERVAL + MIN_CUTOFF_INTERVAL) / 2;
      maskTimestamp = block.timestamp;
      gameId = await rockPaperScissors.contract.methods
        .maskChoice(CHOICE.SCISSORS, mask, creator, maskTimestamp, true, block.number + MASK_BLOCK_SLACK)
        .call({ from: creator });

      //Act
      const winningsBefore = Number(await rockPaperScissors.winnings.call(creator));
      await createGame(gameId, cutoff);
      await setGameVariables(gameId);
      await playGame(CHOICE.PAPER);
      await timeHelper.advanceTimeAndBlock(cutoff);
      await reveal(CHOICE.SCISSORS);

      //Assert
      const winningsAfter = Number(await rockPaperScissors.winnings.call(creator));
      assert.strictEqual(winningsAfter - winningsBefore, _stake * 2, "creator winnings is incorrect");
    });

    it("should play minumum block number Slack game to completion", async () => {
      //Arrange
      const block = await web3.eth.getBlock("latest");
      const cutoff = (MAX_CUTOFF_INTERVAL + MIN_CUTOFF_INTERVAL) / 2;
      maskTimestamp = block.timestamp;
      gameId = await rockPaperScissors.contract.methods
        .maskChoice(CHOICE.SCISSORS, mask, creator, maskTimestamp, true, block.number - MASK_BLOCK_SLACK)
        .call({ from: creator });

      //Act
      const winningsBefore = Number(await rockPaperScissors.winnings.call(creator));
      await createGame(gameId, cutoff);
      await setGameVariables(gameId);
      await playGame(CHOICE.PAPER);
      await timeHelper.advanceTimeAndBlock(cutoff);
      await reveal(CHOICE.SCISSORS);

      //Assert
      const winningsAfter = Number(await rockPaperScissors.winnings.call(creator));
      assert.strictEqual(winningsAfter - winningsBefore, _stake * 2, "creator winnings is incorrect");
    });

    it("should play maximum timestamp Slack and block number  game to completion", async () => {
      //Arrange
      const block = await web3.eth.getBlock("latest");
      maskTimestamp = block.timestamp + MASK_TIMESTAMP_SLACK;
      gameId = await rockPaperScissors.contract.methods
        .maskChoice(CHOICE.SCISSORS, mask, creator, maskTimestamp, true, block.number + MASK_BLOCK_SLACK)
        .call({ from: creator });

      //Act
      const winningsBefore = Number(await rockPaperScissors.winnings.call(creator));
      await createGame(gameId, MAX_CUTOFF_INTERVAL);
      await setGameVariables(gameId);
      await playGame(CHOICE.PAPER);
      await timeHelper.advanceTimeAndBlock(MAX_CUTOFF_INTERVAL);
      await reveal(CHOICE.SCISSORS);

      //Assert
      const winningsAfter = Number(await rockPaperScissors.winnings.call(creator));
      assert.strictEqual(winningsAfter - winningsBefore, _stake * 2, "creator winnings is incorrect");
    });

    it("should play minimum timestamp Slack and block number  game to completion", async () => {
      //Arrange
      const block = await web3.eth.getBlock("latest");
      maskTimestamp = block.timestamp - MASK_TIMESTAMP_SLACK;
      gameId = await rockPaperScissors.contract.methods
        .maskChoice(CHOICE.SCISSORS, mask, creator, maskTimestamp, true, block.number - MASK_BLOCK_SLACK)
        .call({ from: creator });

      //Act
      const winningsBefore = Number(await rockPaperScissors.winnings.call(creator));
      await createGame(gameId, MAX_CUTOFF_INTERVAL);
      await setGameVariables(gameId);
      await playGame(CHOICE.PAPER);
      await timeHelper.advanceTimeAndBlock(MAX_CUTOFF_INTERVAL);
      await reveal(CHOICE.SCISSORS);

      //Assert
      const winningsAfter = Number(await rockPaperScissors.winnings.call(creator));
      assert.strictEqual(winningsAfter - winningsBefore, _stake * 2, "creator winnings is incorrect");
    });

    after(async () => {
      await timeHelper.revertToSnapShot(snapShotId);
    });
  });
});
