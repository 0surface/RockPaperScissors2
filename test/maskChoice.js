const RockPaperScissors = artifacts.require("RockPaperScissors");
const truffleAssert = require("truffle-assertions");

contract("RockPaperScissors", (accounts) => {
  before(async () => {
    it("TestRPC  must have adequate number of addresses", () => {
      assert.isAtLeast(accounts.length, 3, "Test has enough addresses");
    });
  });

  let rockPaperScissors;
  let deployedInstanceAddress;
  const deployer = accounts[0];
  const playerOne = accounts[1];
  const CHOICE = {
    NONE: 0,
    ROCK: 1,
    PAPER: 2,
    SCISSORS: 3,
  };
  const mask = web3.utils.fromAscii("1c04ddc043e");
  const NULL_BYTES = "0x0000000000000000000000000000000000000000000000000000000000000000";

  describe("maskChoice tests", () => {
    beforeEach("deploy a fresh contract", async () => {
      rockPaperScissors = await RockPaperScissors.new({ from: deployer });
      deployedInstanceAddress = rockPaperScissors.address;
    });

    it("should generate a valid maskedChoice", async () => {
      const block = await web3.eth.getBlock("latest");
      const maskingTimestamp = block.timestamp;
      const blockNo = block.number;

      const maskedChoice = await rockPaperScissors.contract.methods
        .maskChoice(CHOICE.ROCK, mask, playerOne, maskingTimestamp, true, blockNo)
        .call({ from: playerOne });

      assert.isDefined(maskedChoice, "did not generate result");
      assert.notEqual(maskedChoice, NULL_BYTES, "generated invalid result");
    });

    it("should be able to generate result from web3 soliditySha3", async () => {
      const block = await web3.eth.getBlock("latest");
      const maskingTimestamp = block.timestamp;
      const blockNo = block.number;

      const web3SoliditySha3Value = web3.utils.soliditySha3(
        { type: "address", value: deployedInstanceAddress },
        { type: "uint8", value: CHOICE.ROCK },
        { type: "bytes32", value: mask },
        { type: "address", value: playerOne },
        { type: "uint", value: maskingTimestamp }
      );

      const soliditykeccak256Value = await rockPaperScissors.contract.methods
        .maskChoice(CHOICE.ROCK, mask, playerOne, maskingTimestamp, true, blockNo)
        .call({ from: playerOne });

      assert.strictEqual(web3SoliditySha3Value, soliditykeccak256Value, "web3 and keccak256 generated value don't match");
    });

    //TODO: set up an array of all input and outcome combinations, run test in loop.

    it("reverts with invalid maskTimestamp", async () => {
      const block = await web3.eth.getBlock("latest");
      const maskingTimestamp = block.timestamp;
      const blockNo = block.number;
      const maskingOnly = true;
      const invalidTimeStamp = maskingTimestamp + 100;

      await truffleAssert.reverts(
        rockPaperScissors.contract.methods
          .maskChoice(CHOICE.ROCK, mask, playerOne, invalidTimeStamp, maskingOnly, blockNo)
          .call({ from: playerOne })
      );
    });

    it("reverts when maskingOnly flag is set to false", async () => {
      const block = await web3.eth.getBlock("latest");
      const maskingTimestamp = block.timestamp;
      const blockNo = block.number;

      await truffleAssert.reverts(
        rockPaperScissors.contract.methods
          .maskChoice(CHOICE.ROCK, mask, playerOne, maskingTimestamp, false, blockNo)
          .call({ from: playerOne })
      );
    });
  });
});
