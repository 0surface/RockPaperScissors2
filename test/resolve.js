const RockPaperScissors = artifacts.require("RockPaperScissors");
const timeHelper = require("../util/timeHelper");
const chai = require("chai");
const { assert } = chai;

contract("RockPaperScissors::resolve", (accounts) => {
  let snapShotId;
  before(async () => {
    it("TestRPC  must have adequate number of addresses", () => {
      assert.isAtLeast(accounts.length, 1, "Test has enough addresses");
    });
    snapShotId = (await timeHelper.takeSnapshot()).id;
  });

  let rockPaperScissors;
  const deployer = accounts[0];
  const CHOICE = {
    NONE: 0,
    ROCK: 1,
    PAPER: 2,
    SCISSORS: 3,
  };
  const OUTCOME = { NONE: 0, DRAW: 1, WIN: 2, LOSE: 3 };
  const testData = [
    { c1: CHOICE.ROCK, c2: CHOICE.ROCK, r: OUTCOME.DRAW },
    { c1: CHOICE.PAPER, c2: CHOICE.PAPER, r: OUTCOME.DRAW },
    { c1: CHOICE.SCISSORS, c2: CHOICE.SCISSORS, r: OUTCOME.DRAW },
    { c1: CHOICE.ROCK, c2: CHOICE.SCISSORS, r: OUTCOME.WIN },
    { c1: CHOICE.PAPER, c2: CHOICE.ROCK, r: OUTCOME.WIN },
    { c1: CHOICE.SCISSORS, c2: CHOICE.PAPER, r: OUTCOME.WIN },
    { c1: CHOICE.SCISSORS, c2: CHOICE.ROCK, r: OUTCOME.LOSE },
    { c1: CHOICE.ROCK, c2: CHOICE.PAPER, r: OUTCOME.LOSE },
    { c1: CHOICE.PAPER, c2: CHOICE.SCISSORS, r: OUTCOME.LOSE },
    //player 2 didn't play
    { c1: CHOICE.ROCK, c2: CHOICE.NONE, r: OUTCOME.WIN },
    { c1: CHOICE.PAPER, c2: CHOICE.NONE, r: OUTCOME.WIN },
    { c1: CHOICE.SCISSORS, c2: CHOICE.NONE, r: OUTCOME.WIN },
    //player 1 did not reveal
    { c1: CHOICE.NONE, c2: CHOICE.ROCK, r: OUTCOME.LOSE },
    { c1: CHOICE.NONE, c2: CHOICE.PAPER, r: OUTCOME.LOSE },
    { c1: CHOICE.NONE, c2: CHOICE.SCISSORS, r: OUTCOME.LOSE },
    //player1 did not reveal, player2 did not play
    { c1: CHOICE.NONE, c2: CHOICE.NONE, r: OUTCOME.WIN },
  ];

  describe("resolve tests", () => {
    before("deploy a fresh contract", async () => {
      rockPaperScissors = await RockPaperScissors.new({ from: deployer });
    });

    testData.forEach(async (d) => {
      it(`Given [${d.c1}, ${d.c2}], resolves to : ${d.r}`, async () => {
        const result = await rockPaperScissors.contract.methods.resolve(d.c1, d.c2).call({ from: deployer });
        assert.strictEqual(d.r, Number(result), `Error  outcome :${Number(result)} given choice1:${d.c1}, choice2: ${d.c2}`);
      });
    });

    after(async () => {
      await timeHelper.revertToSnapShot(snapShotId);
    });
  });
});
