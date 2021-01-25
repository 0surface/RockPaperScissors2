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
  let maskTimestamp;
  let maskedChoice;
  let gameId;
  const timestampSkipSeconds = 15;
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
  const creatorChoice = CHOICE.SCISSORS;
  const opponentChoice = CHOICE.SCISSORS;
  const OUTCOME = { NONE: 0, DRAW: 1, WIN: 2, LOSE: 3 };
  const mask = web3.utils.fromAscii("1c04ddc043e");

  describe("settle tests", () => {
    async function maskChoice() {
      /*create masked choice*/
      const block = await web3.eth.getBlock("latest");
      maskTimestamp = block.timestamp;
      maskedChoice = await rockPaperScissors.contract.methods
        .maskChoice(creatorChoice, mask, creator, maskTimestamp, true, block.number)
        .call({ from: creator });
    }

    async function createGame() {
      /*create game*/
      const txReceipt = await rockPaperScissors.contract.methods
        .create(opponent, maskedChoice, MIN_STAKE, MIN_CUTOFF_INTERVAL)
        .send({ from: creator, value: MIN_STAKE, gas: gas });
    }

    async function setGameVariables() {
      gameId = (await rockPaperScissors.latestGameId.call()).toNumber();
      const game = await rockPaperScissors.games.call(gameId);
      assert.isDefined(game, "game has not been written to storage");

      playDeadline = Number(game.playDeadline);
      revealDeadline = Number(game.revealDeadline);
    }

    async function playGame(min_cuttoff_interval) {
      const txReceipt = await rockPaperScissors.contract.methods
        .play(gameId, opponentChoice)
        .send({ from: opponent, value: MIN_STAKE, gas });
      assert.isDefined(txReceipt, "opponent's play has not been mined");

      /*advance block & timestamp*/
      await timeHelper.advanceTimeAndBlock(min_cuttoff_interval);
    }

    beforeEach("deploy a fresh contract, create game, advance block & timestamp", async () => {
      rockPaperScissors = await RockPaperScissors.new({ from: deployer });
      MIN_STAKE = (await rockPaperScissors.MIN_STAKE.call()).toNumber();
      MIN_CUTOFF_INTERVAL = (await rockPaperScissors.MIN_CUTOFF_INTERVAL.call()).toNumber();
      await maskChoice();
      await createGame();
      await setGameVariables();
      await timeHelper.advanceTimeAndBlock(timestampSkipSeconds);
    });

    it("reverts if block timestamp is less than revealDeadline", async () => {
      //Arrange
      await playGame(MIN_CUTOFF_INTERVAL);
      await timeHelper.advanceTimeAndBlock(1);
      //Act
      const block = await web3.eth.getBlock("latest");
      const id = await rockPaperScissors.latestGameId.call();
      const game = await rockPaperScissors.games.call(id);
      assert.isTrue(
        block.timestamp < Number(game.revealDeadline),
        "Arrange Eror: block timestamp is not less than revealDeadline"
      );
      //Assert
      await truffleAssert.reverts(rockPaperScissors.contract.methods.settle(gameId).send({ from: creator, gas }));
    });

    it("should emit LogGameFinished event", async () => {
      //Arrange
      await playGame(MIN_CUTOFF_INTERVAL);
      await timeHelper.advanceTimeAndBlock(MIN_CUTOFF_INTERVAL);
      //Act
      const _gameId = await rockPaperScissors.latestGameId.call();
      const txReceipt = await rockPaperScissors.contract.methods.settle(_gameId).send({ from: creator, gas });
      //Assert
      eventAssert.eventIsEmitted(txReceipt, "LogGameFinished");
      eventAssert.parameterIsValid(txReceipt, "LogGameFinished", "gameId", gameId, "LogGameFinished gameId incorrect");
      eventAssert.parameterIsValid(txReceipt, "LogGameFinished", "outcome", OUTCOME.LOSE, "LogGameFinished outcome incorrect");
      eventAssert.parameterIsValid(txReceipt, "LogGameFinished", "stake", MIN_STAKE * 2, "LogGameFinished stake incorrect");
    });

    it("should settle creator as loser for an unrevealed game", async () => {
      //Arrange
      await playGame(MIN_CUTOFF_INTERVAL);
      await timeHelper.advanceTimeAndBlock(MIN_CUTOFF_INTERVAL);
      //Act
      const txReceipt = await rockPaperScissors.contract.methods.settle(gameId).send({ from: creator, gas });
      //Assert
      eventAssert.parameterIsValid(txReceipt, "LogGameFinished", "outcome", OUTCOME.LOSE, "LogGameFinished outcome incorrect");
    });

    it("should settle creator as winner for an unplayed game", async () => {
      //Arrange
      await timeHelper.advanceTimeAndBlock(MIN_CUTOFF_INTERVAL * 2);
      //Act
      const txReceipt = await rockPaperScissors.contract.methods.settle(gameId).send({ from: creator, gas });
      //Assert
      assert.isDefined(txReceipt, "settle transaction is not mined");
      eventAssert.parameterIsValid(txReceipt, "LogGameFinished", "outcome", OUTCOME.WIN, "LogGameFinished outcome incorrect");
    });

    after(async () => {
      await timeHelper.revertToSnapShot(snapShotId);
    });
  });
});
