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
  let playDeadline;
  let revealDeadline;
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
  const creatorChoice = CHOICE.ROCK;
  const opponentChoice = CHOICE.SCISSORS;

  const OUTCOME = { NONE: 0, DRAW: 1, WIN: 2, LOSE: 3 };
  const mask = web3.utils.fromAscii("1c04ddc043e");
  const NULL_BYTES = "0x0000000000000000000000000000000000000000000000000000000000000000";

  describe("reveal tests", () => {
    beforeEach("deploy a fresh contract, creates masked choice & game, advances block & timestamp", async () => {
      rockPaperScissors = await RockPaperScissors.new({ from: deployer });
      MIN_STAKE = (await rockPaperScissors.MIN_STAKE.call()).toNumber();
      MIN_CUTOFF_INTERVAL = (await rockPaperScissors.MIN_CUTOFF_INTERVAL.call()).toNumber();

      /*create masked choice*/
      const block = await web3.eth.getBlock("latest");
      maskTimestamp = block.timestamp;
      maskedChoice = await rockPaperScissors.contract.methods
        .maskChoice(creatorChoice, mask, creator, maskTimestamp, true, block.number)
        .call({ from: creator });

      /*create game*/
      const txReceipt = await rockPaperScissors.contract.methods
        .create(opponent, maskedChoice, MIN_STAKE, MIN_CUTOFF_INTERVAL)
        .send({ from: creator, value: MIN_STAKE, gas: gas });

      gameId = (await rockPaperScissors.latestGameId.call()).toNumber();
      const game = await rockPaperScissors.games.call(gameId);
      assert.isDefined(game, "beforeEach - game has not been written to storage");

      playDeadline = Number(game.playDeadline);
      revealDeadline = Number(game.revealDeadline);

      /*advance block & timestamp*/
      await timeHelper.advanceTimeAndBlock(timestampSkipSeconds);
    });

    async function playGame(min_cuttoff_interval) {
      const txReceipt = await rockPaperScissors.contract.methods
        .play(gameId, opponentChoice)
        .send({ from: opponent, value: MIN_STAKE, gas });
      assert.isDefined(txReceipt, "opponent's play has not been mined");

      /*advance block & timestamp*/
      await timeHelper.advanceTimeAndBlock(min_cuttoff_interval);
    }

    it("reverts when given empty gameId", async () => {
      //Arrange
      await playGame(MIN_CUTOFF_INTERVAL);

      //Assert
      await truffleAssert.reverts(
        rockPaperScissors.contract.methods.reveal(0, creatorChoice, NULL_BYTES, maskTimestamp).send({ from: creator, gas })
      );
    });

    it("reverts when given incorrect gameId", async () => {
      //Arrange
      await playGame(MIN_CUTOFF_INTERVAL);

      //Assert
      await truffleAssert.reverts(
        rockPaperScissors.contract.methods
          .reveal(gameId + 2, creatorChoice, NULL_BYTES, maskTimestamp)
          .send({ from: creator, gas })
      );
    });

    it("reverts when given empty mask", async () => {
      //Arrange
      await playGame(MIN_CUTOFF_INTERVAL);

      //Assert
      await truffleAssert.reverts(
        rockPaperScissors.contract.methods.reveal(gameId, creatorChoice, NULL_BYTES, maskTimestamp).send({ from: creator, gas })
      );
    });

    it("reverts when block.timestamp is less than game's playDeadline", async () => {
      //Arrange
      const blockTimestamp = (await web3.eth.getBlock("latest")).timestamp;
      assert.isTrue(blockTimestamp < playDeadline, "Arrange error: block.timestamp is not less than game's playDeadline");

      //Assert
      await truffleAssert.reverts(
        rockPaperScissors.contract.methods.reveal(gameId, creatorChoice, mask, maskTimestamp).send({ from: creator, gas })
      );
    });

    it("reverts when block.timestamp is greater than game's revealDeadline", async () => {
      //Arrange
      await playGame(MIN_CUTOFF_INTERVAL * 2 + 1);

      //Act
      const blockTimestamp = (await web3.eth.getBlock("latest")).timestamp;
      assert.isTrue(blockTimestamp > revealDeadline, "Arrange error: block.timestamp is not greater than game's revealDeadline");

      //Assert
      await truffleAssert.reverts(
        rockPaperScissors.contract.methods.reveal(gameId, creatorChoice, mask, maskTimestamp).send({ from: creator, gas })
      );
    });

    it("reverts when given incorrect choice", async () => {
      //Arrange
      await playGame(MIN_CUTOFF_INTERVAL);

      //Assert
      await truffleAssert.reverts(
        rockPaperScissors.contract.methods
          .reveal(gameId, (creatorChoice + 1) % 3, mask, maskTimestamp)
          .send({ from: creator, gas })
      );
    });

    it("reverts when given empty mask", async () => {
      //Arrange
      await playGame(MIN_CUTOFF_INTERVAL);

      //Assert
      await truffleAssert.reverts(
        rockPaperScissors.contract.methods.reveal(gameId, creatorChoice, NULL_BYTES, maskTimestamp).send({ from: creator, gas })
      );
    });

    it("reverts when given empty maskTimestamp", async () => {
      //Arrange
      await playGame(MIN_CUTOFF_INTERVAL);

      //Assert
      await truffleAssert.reverts(
        rockPaperScissors.contract.methods.reveal(gameId, creatorChoice, mask, 0).send({ from: creator, gas })
      );
    });

    it("should reveal and delete game storage struct", async () => {
      //Arrange
      await playGame(MIN_CUTOFF_INTERVAL);

      //Act
      const txReceipt = await rockPaperScissors.contract.methods
        .reveal(gameId, creatorChoice, mask, maskTimestamp)
        .send({ from: creator, gas });

      //Assert
      assert.isDefined(txReceipt, "reveal transaction is not mined");
      const game = await rockPaperScissors.games.call(gameId);

      assert.strictEqual(Number(game.playDeadline), 0);
      assert.strictEqual(Number(game.revealDeadline), 0);
    });

    it("should emit LogGameFinished event", async () => {
      //Arrange
      await playGame(MIN_CUTOFF_INTERVAL);

      //Act
      const txReceipt = await rockPaperScissors.contract.methods
        .reveal(gameId, creatorChoice, mask, maskTimestamp)
        .send({ from: creator, gas });

      //Assert
      eventAssert.eventIsEmitted(txReceipt, "LogGameFinished");
      eventAssert.parameterIsValid(txReceipt, "LogGameFinished", "gameId", gameId, "LogGameFinished gameId incorrect");
      eventAssert.parameterIsValid(txReceipt, "LogGameFinished", "outcome", OUTCOME.WIN, "LogGameFinished player incorrect");
      eventAssert.parameterIsValid(txReceipt, "LogGameFinished", "stake", MIN_STAKE * 2, "LogGameFinished stake incorrect");
    });

    after(async () => {
      await timeHelper.revertToSnapShot(snapShotId);
    });
  });
});
