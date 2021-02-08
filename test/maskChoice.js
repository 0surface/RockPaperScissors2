const RockPaperScissors = artifacts.require("RockPaperScissors");
const truffleAssert = require("truffle-assertions");
const timeHelper = require("../util/timeHelper");
const chai = require("chai");
const { assert } = chai;

contract("RockPaperScissors", (accounts) => {
  let snapShotId;
  before("", async () => {
    it("TestRPC  must have adequate number of addresses", async () => {
      assert.isAtLeast(accounts.length, 2, "Test has enough addresses");
    });
    snapShotId = (await timeHelper.takeSnapshot()).id;
  });

  let rockPaperScissors;
  let MASK_TIMESTAMP_SLACK;
  let MASK_BLOCK_SLACK;
  const deployer = accounts[0];
  const maskerAddress = accounts[1];
  const CHOICE = {
    NONE: 0,
    ROCK: 1,
    PAPER: 2,
    SCISSORS: 3,
  };
  const mask = web3.utils.fromAscii("1c04ddc043e");
  const NULL_BYTES = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

  describe("maskChoice tests", () => {
    before("deploy a fresh contract", async () => {
      rockPaperScissors = await RockPaperScissors.new({ from: deployer });
      MASK_TIMESTAMP_SLACK = (await rockPaperScissors.MASK_TIMESTAMP_SLACK.call()).toNumber();
      MASK_BLOCK_SLACK = (await rockPaperScissors.MASK_BLOCK_SLACK.call()).toNumber();
    });

    it("should generate a valid maskedChoice - Happy path", async () => {
      const block = await web3.eth.getBlock("latest");

      const maskedChoice = await rockPaperScissors.contract.methods
        .maskChoice(CHOICE.ROCK, mask, maskerAddress, block.timestamp, true, block.number)
        .call({ from: maskerAddress });

      assert.isDefined(maskedChoice, "did not generate result");
      assert.notEqual(maskedChoice, NULL_BYTES, "generated invalid result");
    });

    it("should be able to generate result from web3 soliditySha3", async () => {
      const block = await web3.eth.getBlock("latest");

      const web3SoliditySha3Value = web3.utils.soliditySha3(
        { type: "address", value: rockPaperScissors.address },
        { type: "uint8", value: CHOICE.ROCK },
        { type: "bytes32", value: mask },
        { type: "address", value: maskerAddress },
        { type: "uint", value: block.timestamp }
      );

      const soliditykeccak256Value = await rockPaperScissors.contract.methods
        .maskChoice(CHOICE.ROCK, mask, maskerAddress, block.timestamp, true, block.number)
        .call({ from: maskerAddress });

      assert.strictEqual(web3SoliditySha3Value, soliditykeccak256Value, "web3 and keccak256 generated value don't match");
    });

    it("reverts when maskTimestamp is above maximum allowed", async () => {
      const block = await web3.eth.getBlock("latest");
      await truffleAssert.reverts(
        rockPaperScissors.contract.methods
          .maskChoice(CHOICE.ROCK, mask, maskerAddress, block.timestamp + MASK_TIMESTAMP_SLACK + 1, true, block.number)
          .call({ from: maskerAddress }),
        "RockPaperScissors::maskChoice:maskTimestamp above maximum, use latest block timestamp"
      );
    });

    it("reverts when maskTimestamp is below minimum allowed", async () => {
      const block = await web3.eth.getBlock("latest");
      await truffleAssert.reverts(
        rockPaperScissors.contract.methods
          .maskChoice(CHOICE.PAPER, mask, maskerAddress, block.timestamp - MASK_TIMESTAMP_SLACK - 1, true, block.number)
          .call({ from: maskerAddress }),
        "RockPaperScissors::maskChoice:maskTimestamp below minimum, use latest block timestamp"
      );
    });

    it("reverts when blockNo is above allowed slack", async () => {
      const block = await web3.eth.getBlock("latest");
      await truffleAssert.reverts(
        rockPaperScissors.contract.methods
          .maskChoice(CHOICE.PAPER, mask, maskerAddress, block.timestamp, true, block.number + MASK_BLOCK_SLACK + 1)
          .call({ from: maskerAddress }),
        "RockPaperScissors::maskChoice:blockNo is invalid"
      );
    });

    it("reverts when blockNo is below allowed slack", async () => {
      const block = await web3.eth.getBlock("latest");
      await truffleAssert.reverts(
        rockPaperScissors.contract.methods
          .maskChoice(CHOICE.PAPER, mask, maskerAddress, block.timestamp, true, block.number - MASK_BLOCK_SLACK - 1)
          .call({ from: maskerAddress }),
        "RockPaperScissors::maskChoice:blockNo is invalid"
      );
    });

    it("reverts when maskTimestamp for reveal is invalid", async () => {
      const block = await web3.eth.getBlock("latest");
      await truffleAssert.reverts(
        rockPaperScissors.contract.methods
          .maskChoice(CHOICE.PAPER, mask, maskerAddress, block.timestamp, false, block.number)
          .call({ from: maskerAddress }),
        "RockPaperScissors::maskChoice:Invalid maskTimestamp for reveal"
      );
    });

    it("reverts when choice is NONE", async () => {
      const block = await web3.eth.getBlock("latest");
      await truffleAssert.reverts(
        rockPaperScissors.contract.methods
          .maskChoice(CHOICE.NONE, mask, maskerAddress, block.timestamp, true, block.number)
          .call({ from: maskerAddress }),
        "RockPaperScissors::maskChoice:game move choice can not be NONE"
      );
    });

    it("reverts when mask can is empty", async () => {
      const block = await web3.eth.getBlock("latest");
      await truffleAssert.reverts(
        rockPaperScissors.contract.methods
          .maskChoice(CHOICE.SCISSORS, NULL_BYTES, maskerAddress, block.timestamp, true, block.number)
          .call({ from: maskerAddress }),
        "RockPaperScissors::maskChoice:mask can not be empty"
      );
    });

    it("reverts when opponent address is empty", async () => {
      const block = await web3.eth.getBlock("latest");
      await truffleAssert.reverts(
        rockPaperScissors.contract.methods
          .maskChoice(CHOICE.SCISSORS, mask, NULL_ADDRESS, block.timestamp, true, block.number)
          .call({ from: maskerAddress }),
        "RockPaperScissors::maskChoice:masker can not be null address"
      );
    });

    after(async () => {
      await timeHelper.revertToSnapShot(snapShotId);
    });
  });
});
