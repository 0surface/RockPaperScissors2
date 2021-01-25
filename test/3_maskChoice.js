const RockPaperScissors = artifacts.require("RockPaperScissors");
const truffleAssert = require("truffle-assertions");
const timeHelper = require("../util/timeHelper");

contract("RockPaperScissors::maskChoice", (accounts) => {
  let snapShotId;
  before("sdfs", async () => {
    it("TestRPC  must have adequate number of addresses", () => {
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

    async function revertSituations() {
      const block = await web3.eth.getBlock("latest");
      MASK_TIMESTAMP_SLACK = (await rockPaperScissors.MASK_TIMESTAMP_SLACK.call()).toNumber();
      MASK_BLOCK_SLACK = (await rockPaperScissors.MASK_BLOCK_SLACK.call()).toNumber();
      const no = block.number;
      const stamp = block.timestamp;
      return [
        {
          choice: CHOICE.PAPER,
          mask: mask,
          masker: maskerAddress,
          timestamp: stamp + MASK_TIMESTAMP_SLACK + 1,
          maskingOnly: true,
          blockNo: no,
          error: "RockPaperScissors::maskChoice:maskTimestamp above maximum, use latest block timestamp",
        },
        {
          choice: CHOICE.PAPER,
          mask: mask,
          masker: maskerAddress,
          timestamp: stamp - MASK_TIMESTAMP_SLACK - 1,
          maskingOnly: true,
          blockNo: no,
          error: "RockPaperScissors::maskChoice:maskTimestamp below minimum, use latest block timestamp",
        },
        {
          choice: CHOICE.PAPER,
          mask: mask,
          masker: maskerAddress,
          timestamp: stamp,
          maskingOnly: true,
          blockNo: no + MASK_BLOCK_SLACK + 1,
          error: "RockPaperScissors::maskChoice:blockNo is invalid",
        },
        {
          choice: CHOICE.PAPER,
          mask: mask,
          masker: maskerAddress,
          timestamp: stamp,
          maskingOnly: true,
          blockNo: no - MASK_BLOCK_SLACK - 1,
          error: "RockPaperScissors::maskChoice:blockNo is invalid",
        },
        {
          choice: CHOICE.PAPER,
          mask: mask,
          masker: maskerAddress,
          timestamp: stamp,
          maskingOnly: false,
          blockNo: no,
          error: "RockPaperScissors::maskChoice:Invalid maskTimestamp for reveal",
        },
        {
          choice: CHOICE.NONE,
          mask: mask,
          masker: maskerAddress,
          timestamp: stamp,
          maskingOnly: true,
          blockNo: no,
          error: "RockPaperScissors::maskChoice:game move choice can not be NONE",
        },
        {
          choice: CHOICE.PAPER,
          mask: NULL_BYTES,
          masker: maskerAddress,
          timestamp: stamp,
          maskingOnly: true,
          blockNo: no,
          error: "RockPaperScissors::maskChoice:mask can not be empty",
        },
        {
          choice: CHOICE.PAPER,
          mask: mask,
          masker: NULL_ADDRESS,
          timestamp: stamp,
          maskingOnly: true,
          blockNo: no,
          error: "RockPaperScissors::maskChoice:masker can not be null address",
        },
      ];
    }

    it("reverts when given invalid parameters", async () => {
      const data = await revertSituations();
      data.forEach(async (d) => {
        await truffleAssert.reverts(
          rockPaperScissors.contract.methods
            .maskChoice(d.choice, d.mask, d.masker, d.timestamp, d.maskingOnly, d.blockNo)
            .call({ from: maskerAddress })
        );
      });
    });

    after(async () => {
      await timeHelper.revertToSnapShot(snapShotId);
    });
  });
});
