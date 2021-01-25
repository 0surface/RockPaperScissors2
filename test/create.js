const RockPaperScissors = artifacts.require("RockPaperScissors");
const truffleAssert = require("truffle-assertions");
const timeHelper = require("../util/timeHelper");
const eventAssert = require("../util/eventAssertionHelper");
const chai = require("chai");
const { assert } = chai;

contract("RockPaperScissors", (accounts) => {
  let snapShotId;
  before(async () => {
    it("TestRPC  must have adequate number of addresses", () => {
      assert.isAtLeast(accounts.length, 3, "Test has enough addresses");
    });
    snapShotId = (await timeHelper.takeSnapshot()).id;
  });

  let rockPaperScissors;
  let MIN_STAKE;
  let MIN_CUTOFF_INTERVAL;
  let MAX_CUTOFF_INTERVAL;
  let maskedChoice;
  const deployer = accounts[0];
  const creator = accounts[1];
  const opponent = accounts[2];
  const gas = 4000000;
  const CHOICE = {
    NONE: 0,
    ROCK: 1,
    PAPER: 2,
    SCISSORS: 3,
  };
  const mask = web3.utils.fromAscii("1c04ddc043e");
  const NULL_BYTES = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

  function revertSituations() {
    return [
      {
        opponent: creator,
        maskedChoice: maskedChoice,
        toStake: MIN_STAKE,
        cutOff: MIN_CUTOFF_INTERVAL,
        msgsender: creator,
        msgvalue: MIN_STAKE,
      },
      {
        opponent: NULL_ADDRESS,
        maskedChoice: maskedChoice,
        toStake: MIN_STAKE,
        cutOff: MIN_CUTOFF_INTERVAL,
        msgsender: creator,
        msgvalue: MIN_STAKE,
      },
      {
        opponent: opponent,
        maskedChoice: NULL_BYTES,
        toStake: MIN_STAKE,
        cutOff: MIN_CUTOFF_INTERVAL,
        msgsender: creator,
        msgvalue: MIN_STAKE,
      },
      {
        opponent: opponent,
        maskedChoice: maskedChoice,
        toStake: MIN_STAKE,
        cutOff: MIN_CUTOFF_INTERVAL,
        msgsender: creator,
        msgvalue: MIN_STAKE > 0 ? MIN_STAKE - 1 : 0,
      },
      {
        opponent: opponent,
        maskedChoice: maskedChoice,
        toStake: MIN_STAKE,
        cutOff: MIN_CUTOFF_INTERVAL - 1,
        msgsender: creator,
        msgvalue: MIN_STAKE,
      },
      {
        opponent: opponent,
        maskedChoice: maskedChoice,
        toStake: MIN_STAKE,
        cutOff: MAX_CUTOFF_INTERVAL + 1,
        msgsender: creator,
        msgvalue: MIN_STAKE,
      },
    ];
  }

  describe("create tests", () => {
    beforeEach("deploy a fresh contract, created masked choice", async () => {
      rockPaperScissors = await RockPaperScissors.new({ from: deployer });
      MIN_STAKE = (await rockPaperScissors.MIN_STAKE.call()).toNumber();
      MIN_CUTOFF_INTERVAL = (await rockPaperScissors.MIN_CUTOFF_INTERVAL.call()).toNumber();
      MAX_CUTOFF_INTERVAL = (await rockPaperScissors.MAX_CUTOFF_INTERVAL.call()).toNumber();

      const block = await web3.eth.getBlock("latest");
      maskedChoice = await rockPaperScissors.contract.methods
        .maskChoice(CHOICE.ROCK, mask, creator, block.timestamp, true, block.number)
        .call({ from: creator });
    });

    it("reverts when given invalid parameters", async () => {
      revertSituations().forEach(async (d) => {
        await truffleAssert.reverts(
          rockPaperScissors.contract.methods
            .create(d.opponent, d.maskedChoice, d.toStake, d.cutOff)
            .send({ from: d.msgsender, value: d.msgvalue })
        );
      });
    });

    it("should create and set game to storage", async () => {
      //Arrange
      const priorId = (await rockPaperScissors.latestGameId.call()).toNumber();

      //Act
      const txReceipt = await rockPaperScissors.contract.methods
        .create(opponent, maskedChoice, MIN_STAKE, MIN_CUTOFF_INTERVAL)
        .send({ from: creator, value: MIN_STAKE, gas: gas });

      //Assert
      assert.isDefined(txReceipt, "transaction is not mined");
      const game = await rockPaperScissors.games.call(priorId + 1);
      assert.isDefined(game, "game has not been written to storage");
      const txTimestamp = (await web3.eth.getBlock(txReceipt.blockNumber)).timestamp;

      assert.strictEqual(Number(game.stake), MIN_STAKE);
      assert.strictEqual(game.creatorMaskedChoice, maskedChoice);
      assert.strictEqual(game.opponent, opponent);
      assert.strictEqual(Number(game.playDeadline), MIN_CUTOFF_INTERVAL + txTimestamp);
      assert.strictEqual(Number(game.revealDeadline), MIN_CUTOFF_INTERVAL + MIN_CUTOFF_INTERVAL + txTimestamp);
    });

    it("should emit LogGameCreated event", async () => {
      //Act
      const txReceipt = await rockPaperScissors.contract.methods
        .create(opponent, maskedChoice, MIN_STAKE, MIN_CUTOFF_INTERVAL)
        .send({ from: creator, value: MIN_STAKE, gas });

      const gameId = await rockPaperScissors.latestGameId.call();
      const txTimestamp = (await web3.eth.getBlock(txReceipt.blockNumber)).timestamp;

      //Assert
      eventAssert.eventIsEmitted(txReceipt, "LogGameCreated");
      eventAssert.parameterIsValid(txReceipt, "LogGameCreated", "gameId", gameId, "LogGameCreated gameId incorrect");
      eventAssert.parameterIsValid(txReceipt, "LogGameCreated", "opponent", opponent, "LogGameCreated opponent incorrect");
      eventAssert.parameterIsValid(
        txReceipt,
        "LogGameCreated",
        "playDeadline",
        MIN_CUTOFF_INTERVAL + txTimestamp,
        "LogGameCreated playDeadline incorrect"
      );
      eventAssert.parameterIsValid(txReceipt, "LogGameCreated", "staked", MIN_STAKE, "LogGameCreated staked incorrect");
    });

    after(async () => {
      await timeHelper.revertToSnapShot(snapShotId);
    });
  });
});
