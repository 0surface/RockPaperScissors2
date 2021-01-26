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
      assert.isAtLeast(accounts.length, 4, "Test has enough addresses");
    });
    snapShotId = (await timeHelper.takeSnapshot()).id;
  });

  let rockPaperScissors;
  let MIN_STAKE;
  let MIN_CUTOFF_INTERVAL;
  let maskedChoice;
  let gameId;
  const timestampSkipSeconds = 15;
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

  describe("play tests", () => {
    beforeEach("deploy a fresh contract, creates masked choice & game, advances block & timestamp", async () => {
      rockPaperScissors = await RockPaperScissors.new({ from: deployer });
      deployedInstanceAddress = rockPaperScissors.address;
      MIN_STAKE = (await rockPaperScissors.MIN_STAKE.call()).toNumber();
      MIN_CUTOFF_INTERVAL = (await rockPaperScissors.MIN_CUTOFF_INTERVAL.call()).toNumber();

      /*create masked choice*/
      const block = await web3.eth.getBlock("latest");
      maskedChoice = await rockPaperScissors.contract.methods
        .maskChoice(CHOICE.ROCK, mask, creator, block.timestamp, true, block.number)
        .call({ from: creator });

      /*create game*/
      const txReceipt = await rockPaperScissors.contract.methods
        .create(opponent, maskedChoice, MIN_STAKE, MIN_CUTOFF_INTERVAL)
        .send({ from: creator, value: MIN_STAKE, gas: gas });

      gameId = (await rockPaperScissors.latestGameId.call()).toNumber();
      const game = await rockPaperScissors.games.call(gameId);
      assert.isDefined(game, "beforeEach - game has not been written to storage");

      /*advance block & timestamp*/
      await timeHelper.advanceTimeAndBlock(timestampSkipSeconds);
    });

    function revertSituations() {
      return [
        {
          gameId: gameId,
          choice: CHOICE.NONE,
          msgsender: opponent,
          msgvalue: MIN_STAKE,
          error: "did not fail for invalid Choice- CHOICE.NONE",
        },
        {
          gameId: gameId,
          choice: CHOICE.SCISSORS,
          msgsender: somebody,
          msgvalue: MIN_STAKE,
          error: "did not for incorrect opponent address",
        },
        {
          gameId: gameId,
          choice: CHOICE.SCISSORS,
          msgsender: opponent,
          msgvalue: MIN_STAKE > 0 ? MIN_STAKE - 1 : 0,
          error: "did not fail with insuffcient balance to stake",
        },
      ];
    }

    revertSituations().forEach(async (d) => {
      it(d.error, async () => {
        await truffleAssert.reverts(
          rockPaperScissors.contract.methods.play(gameId, d.choice).send({ from: d.msgsender, value: d.msgvalue, gas: gas })
        );
      });
    });

    it("should play and set choice to storage", async () => {
      //Arrange
      const expected = CHOICE.ROCK;

      //Act
      const txReceipt = await rockPaperScissors.contract.methods
        .play(gameId, expected)
        .send({ from: opponent, value: MIN_STAKE, gas });

      //Assert
      assert.isDefined(txReceipt, "transaction is not mined");
      const game = await rockPaperScissors.games.call(gameId);
      assert.strictEqual(Number(game.opponentChoice), expected);
    });

    it("should emit LogGamePlayed event", async () => {
      //Arrange
      const expected = CHOICE.PAPER;

      //Act
      const txReceipt = await rockPaperScissors.contract.methods
        .play(gameId, expected)
        .send({ from: opponent, value: MIN_STAKE, gas });
      const txResult = await truffleAssert.createTransactionResult(rockPaperScissors, txReceipt.transactionHash);

      //Assert
      eventAssert.eventIsEmitted(txReceipt, "LogGamePlayed");
      eventAssert.parameterIsValid(txReceipt, "LogGamePlayed", "gameId", gameId, "LogGamePlayed gameId incorrect");
      eventAssert.parameterIsValid(txReceipt, "LogGamePlayed", "player", opponent, "LogGamePlayed player incorrect");
      eventAssert.parameterIsValid(txReceipt, "LogGamePlayed", "choice", expected, "LogGamePlayed choice incorrect");
    });
  });

  after(async () => {
    await timeHelper.revertToSnapShot(snapShotId);
  });
});
