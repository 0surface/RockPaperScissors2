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
  let maskTimestamp;
  let maskBlockNo;
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

  describe("withdraw tests", () => {
    async function maskChoice(_choice) {
      const block = await web3.eth.getBlock("latest");
      maskTimestamp = block.timestamp;
      maskBlockNo = block.number;
      return await rockPaperScissors.contract.methods
        .maskChoice(_choice, mask, creator, maskTimestamp, true, maskBlockNo)
        .call({ from: creator });
    }

    async function createGame(_maskedChoice) {
      gameId = _maskedChoice;
      await rockPaperScissors.contract.methods
        .create(opponent, _maskedChoice, _stake, MIN_CUTOFF_INTERVAL)
        .send({ from: creator, value: _stake, gas: gas });
    }

    async function setGameVariables() {
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
        .reveal(gameId, _choice, mask, maskTimestamp, maskBlockNo)
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
    });

    it("reverts if winnings balance is zero", async () => {
      //Arrange
      const winningBalance = Number(await rockPaperScissors.winnings.call(somebody));
      assert.isTrue(winningBalance === 0, "balance is not zero");

      //Act, Assert
      await truffleAssert.reverts(rockPaperScissors.contract.methods.withdraw().send({ from: creator }));
    });

    it("should emit LogWithdrawal event", async () => {
      //Arrange
      await createGame(await maskChoice(CHOICE.SCISSORS));
      await setGameVariables();
      await playGame(CHOICE.PAPER);
      await timeHelper.advanceTimeAndBlock(MIN_CUTOFF_INTERVAL);
      await reveal(CHOICE.SCISSORS);
      const winningsBefore = Number(await rockPaperScissors.winnings.call(creator));

      //Act
      const txReceipt = await rockPaperScissors.contract.methods.withdraw().send({ from: creator });

      //Assert
      eventAssert.eventIsEmitted(txReceipt, "LogWithdrawal");
      eventAssert.parameterIsValid(txReceipt, "LogWithdrawal", "withdrawer", creator, "LogWithdrawal withdrawer incorrect");
      eventAssert.parameterIsValid(txReceipt, "LogWithdrawal", "withdrawn", winningsBefore, "LogWithdrawal withdrawn incorrect");
    });

    it("should withdraw staked when game creator Wins", async () => {
      //Arrange
      await createGame(await maskChoice(CHOICE.SCISSORS));
      await setGameVariables();
      await playGame(CHOICE.PAPER);
      await timeHelper.advanceTimeAndBlock(MIN_CUTOFF_INTERVAL);
      await reveal(CHOICE.SCISSORS);
      const balanceBefore = new BN(await web3.eth.getBalance(creator));
      const expected = _stake * 2;

      //Act
      const txReceipt = await rockPaperScissors.contract.methods.withdraw().send({ from: creator });
      const balanceAfter = new BN(await web3.eth.getBalance(creator));
      const gasCost = new BN(await calculateGasSpent(txReceipt));

      //Assert
      assert.equal(Number(balanceAfter.add(gasCost).sub(balanceBefore)), expected, "creator winnings withdrawal failed");
    });

    it("should allow both players to withdraw half stake when game Draws", async () => {
      //Arrange
      await createGame(await maskChoice(CHOICE.PAPER));
      await setGameVariables();
      await playGame(CHOICE.PAPER);
      await timeHelper.advanceTimeAndBlock(MIN_CUTOFF_INTERVAL);
      await reveal(CHOICE.PAPER);
      const balanceBefore1 = new BN(await web3.eth.getBalance(creator));
      const balanceBefore2 = new BN(await web3.eth.getBalance(opponent));
      const expected = _stake;

      //Act
      const txReceipt1 = await rockPaperScissors.contract.methods.withdraw().send({ from: creator });
      const txReceipt2 = await rockPaperScissors.contract.methods.withdraw().send({ from: opponent });
      const balanceAfter1 = new BN(await web3.eth.getBalance(creator));
      const balanceAfter2 = new BN(await web3.eth.getBalance(opponent));
      const gasCost1 = new BN(await calculateGasSpent(txReceipt1));
      const gasCost2 = new BN(await calculateGasSpent(txReceipt2));

      //Assert
      assert.equal(Number(balanceAfter2.add(gasCost2).sub(balanceBefore2)), expected, "opponent withdrawal failed");
      assert.equal(Number(balanceAfter1.add(gasCost1).sub(balanceBefore1)), expected, "creator withdrawal failed");
    });

    it("should withdraw staked when game opponent Wins", async () => {
      //Arrange
      await createGame(await maskChoice(CHOICE.PAPER));
      await setGameVariables();
      await playGame(CHOICE.SCISSORS);
      await timeHelper.advanceTimeAndBlock(MIN_CUTOFF_INTERVAL);
      await reveal(CHOICE.PAPER);
      const balanceBefore = new BN(await web3.eth.getBalance(opponent));
      const expected = _stake * 2;

      //Act
      const txReceipt = await rockPaperScissors.contract.methods.withdraw().send({ from: opponent });
      const balanceAfter = new BN(await web3.eth.getBalance(opponent));
      const gasCost = new BN(await calculateGasSpent(txReceipt));

      //Assert
      assert.strictEqual(Number(balanceAfter.add(gasCost).sub(balanceBefore)), expected, "opponent winnings withdrawal failed");
    });

    after(async () => {
      await timeHelper.revertToSnapShot(snapShotId);
    });
  });
});
