const Web3 = require("web3");
const rockPaperScissorsJson = require("../../build/contracts/RockPaperScissors.json");
const truffleContract = require("truffle-contract");

const App = {
  web3: null,
  activeAccount: null,
  wallets: [],
  rockPaperScissors: truffleContract(rockPaperScissorsJson),

  start: async function () {
    const { web3 } = this;

    try {
      this.rockPaperScissors.setProvider(web3.currentProvider);
      await this.setUpApp();
    } catch (error) {
      console.error("Could not connect to contract or chain.");
    }
  },

  setUpApp: async function () {
    console.log("in setUpApp()");
  },
};

window.App = App;

window.addEventListener("load", function () {
  if (window.ethereum) {
    App.web3 = new Web3(window.ethereum);
    window.ethereum.enable(); // get permission to access accounts
  } else {
    //Fall back local provider
    App.web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:8545"));
  }

  App.start();
});
