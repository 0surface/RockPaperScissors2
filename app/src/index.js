const Web3 = require("web3");
const $ = require("jquery");
const truffleContract = require("truffle-contract");
const rockPaperScissorsJson = require("../../build/contracts/RockPaperScissors.json");
const lib = require("./validation");
const gameUtil = require("./gameUtil");
const gameData = require("./gameData");
const gameState = require("./gameState");

const App = {
  web3: null,
  activeAccount: null,
  wallets: [],
  rockPaperScissors: truffleContract(rockPaperScissorsJson),
  dbInit: null,
  GAME_MASK_TIMESTAMP_SLACK: null,
  GAME_MASK_BLOCK_SLACK: null,
  GAME_MIN_STAKE: null,
  GAME_MIN_STAKE_ETH: null,
  GAME_MIN_CUTOFF_INTERVAL: null,
  GAME_MAX_CUTOFF_INTERVAL: null,

  create: async function () {
    $("#btnCreate").prop("disabled", true);
    const { getGameLifeTimeSeconds } = gameUtil;
    const { maskChoice, create, games } = await this.rockPaperScissors.deployed();

    const creator = this.activeAccount.address;
    const opponent = $("#create_counterparty").val();
    const choice = $("#create_chosen").val();
    const mask = $("#create_mask").val();
    const stakeInEther = $("#create_stake").val();
    const days = $("#create_gameDays").val();
    const hours = $("#create_gameHours").val();
    const minutes = $("#create_gameMinutes").val();
    const gameLifetime = getGameLifeTimeSeconds(days, hours, minutes);

    const isValid = await lib.createIsValidated(
      GAME_MIN_STAKE_ETH,
      gameLifetime,
      GAME_MIN_CUTOFF_INTERVAL,
      GAME_MAX_CUTOFF_INTERVAL
    );
    await gameUtil.setTxProgress("25");

    if (!isValid) {
      $("#btnCreate").prop("disabled", true);
      //return;
    } else {
      const stake = this.web3.utils.toWei(stakeInEther);
      const bytes32Mask = this.web3.utils.asciiToHex(mask);
      $("#btnCreate").prop("disabled", false);
      const latestBlock = await this.web3.eth.getBlock("latest");
      const maskBlockNo = latestBlock.number;
      const maskTimestamp = latestBlock.timestamp;

      const maskedChoice = await maskChoice.call(choice, bytes32Mask, creator, maskTimestamp, true, maskBlockNo);
      await gameUtil.setTxProgress("50", 1000);

      const createTxParmsObj = { from: creator, value: stake };

      //simulate send tx
      try {
        await create.call(opponent, maskedChoice, stake, gameLifetime, createTxParmsObj);
        await gameUtil.setTxProgress("75", 1000);
      } catch (error) {
        console.error("create call: ", error);
        await gameUtil.setTxProgress("0");
        return;
      }

      //send tx
      const txObj = await create(opponent, maskedChoice, stake, gameLifetime, createTxParmsObj).on("transactionHash", (txHash) =>
        $("#txStatus").html(`create Tx pending : [ ${txHash} ]`)
      );

      //Post-mining
      await gameUtil.updateUI(txObj, "Create", $("#txStatus"));
      await gameUtil.setTxProgress("0");

      //Fetch game from blockchain (get 'Game' variables)
      const theGame = await games(maskedChoice);

      //save game to 'database'
      const game = {
        _id: maskedChoice,
        playerOne: creator,
        playerOneLabel: this.getAddressLabel(creator),
        choiceOne: choice,
        maskOne: bytes32Mask,
        maskBlockNo: maskBlockNo,
        maskTimestampOne: maskTimestamp,

        playerTwo: opponent,
        playerTwoLabel: this.getAddressLabel(opponent),
        choiceTwo: 0,

        stake: stake,
        stakeInEther: stakeInEther,
        playDeadline: Number(theGame.playDeadline),
        revealDeadline: Number(theGame.revealDeadline),
        stakedFromWinnings: false,
        status: gameUtil.gameStatusEnum.created,
      };
      await gameData.saveGame(game);
      await this.refreshGames();
    }
  },

  play: async function () {
    $("#btnPlay").prop("disabled", true);
    const { play, winnings } = await this.rockPaperScissors.deployed();
    const opponent = this.activeAccount.address;
    const gameId = $("#play_gameId").val();
    const choice = $("#play_chosen").val();
    const amountToStake = $("#play_stake").val();
    const game = await gameData.getGame(gameId);
    const stakeBN = this.web3.utils.toBN(game.stake);
    const latestBlockTimestamp = (await this.web3.eth.getBlock("latest")).timestamp;
    const winningsAmount = await winnings.call(this.activeAccount.address);

    if (game.playDeadline < latestBlockTimestamp) {
      $("#play_deadline_Error").html("Play deadline has expired").css("color", "red");
      await gameData.updateGame(gameId, "status", gameUtil.gameStatusEnum.expired);
      await this.refreshGames();
      return;
    }

    const _amountToStake = amountToStake === "" ? this.web3.utils.toBN(0) : this.web3.utils.toWei(amountToStake);

    if (!(await lib.playIsValidated(choice, _amountToStake, game.stake, winningsAmount))) {
      $("#btnPlay").prop("disabled", true);
    } else {
      $("#btnPlay").prop("disabled", false);

      await gameUtil.setTxProgress("50", 1000);
      const playTxParmsObj = { from: opponent, value: stakeBN };

      //simulate send tx
      try {
        await play.call(gameId, choice, playTxParmsObj);
        await gameUtil.setTxProgress("75", 1000);
      } catch (error) {
        console.error("play call: ", error);
      }

      //send play tx
      const txObj = await play(gameId, choice, playTxParmsObj).on("transactionHash", (txHash) =>
        $("#txStatus").html(`enrolAndCommit Tx pending : [ ${txHash} ]`)
      );

      //Post-mining
      await gameUtil.updateUI(txObj, "Play", $("#txStatus"));
      await gameUtil.setTxProgress("100");

      //update game
      await gameData.updateGame(gameId, "status", gameUtil.gameStatusEnum.played);
      await gameData.updateGame(gameId, "stake", stakeBN.add(stakeBN));
      await gameData.updateGame(gameId, "choiceTwo", choice);
      await gameUtil.setTxProgress("0");

      await this.refreshGames();
    }
  },

  reveal: async function () {
    const gameId = $("#reveal_gameId").val();
    const revealer = this.activeAccount.address;
    const { reveal } = await this.rockPaperScissors.deployed();
    const game = await gameData.getGame(gameId);
    const latestBlockTimestamp = (await this.web3.eth.getBlock("latest")).timestamp;

    if (game.revealDeadline < latestBlockTimestamp) {
      await gameData.updateGame(gameId, "status", gameUtil.gameStatusEnum.expired);
      await this.refreshGames();
      return;
    }

    await gameUtil.setTxProgress("25");
    const revealTxParmsObj = { from: revealer };

    //sim tx
    try {
      await reveal.call(gameId, game.choiceOne, game.maskOne, game.maskTimestampOne, game.maskBlockNo, revealTxParmsObj);
      await gameUtil.setTxProgress("50");
    } catch (error) {
      console.error("reveal call: ", error);
    }

    //send tx
    const txObj = await reveal(
      gameId,
      game.choiceOne,
      game.maskOne,
      game.maskTimestampOne,
      game.maskBlockNo,
      revealTxParmsObj
    ).on("transactionHash", (txHash) => $("#txStatus").html(`reveal Tx pending : [ ${txHash} ]`));

    //post-mining
    await gameUtil.updateUI(txObj, "Reveal", $("#txStatus"));
    await gameUtil.setTxProgress("100");

    //update game db
    await gameData.updateGame(gameId, "status", gameUtil.gameStatusEnum.finished);
    await gameUtil.setTxProgress("0");
    await this.refreshGames();
  },

  settle: async function () {
    const gameId = $("#settle_gameId").val();
    const { settle } = await this.rockPaperScissors.deployed();
    const blockTimeStamp = (await this.web3.eth.getBlock("latest")).timestamp;
    const game = await gameData.getGame(gameId);
    await gameUtil.setTxProgress("25");

    if (game.deadline > blockTimeStamp) return;

    try {
      await settle.call(gameId, { from: this.activeAccount.address });
      await gameUtil.setTxProgress("50");
    } catch (ex) {
      console.error("settle call error ", ex);
    }

    const txRecepit = await settle(gameId, { from: this.activeAccount.address }).on("transactionHash", (txHash) =>
      $("#txStatus").html(`reveal Tx pending : [ ${txHash} ]`)
    );

    //post-mining
    await gameUtil.updateUI(txRecepit, "Settle", $("#txStatus"));
    await gameUtil.setTxProgress("100");

    await gameData.updateGame(gameId, "status", gameUtil.gameStatusEnum.finished);
    await gameUtil.setTxProgress("0");
    await this.refreshGames();
  },

  withdraw: async function () {
    const payee = this.activeAccount.address;
    const { withdraw } = await this.rockPaperScissors.deployed();

    try {
      await gameUtil.setTxProgress("25");
      await withdraw.call({ from: payee });
      await gameUtil.setTxProgress("50");
    } catch (ex) {
      console.error("payout call error: ", ex);
    }

    const txRcpt = await withdraw({ from: payee }).on("transactionHash", (txHash) =>
      $("#txStatus").html(`payout Tx pending : [ ${txHash} ]`)
    );

    await gameUtil.setTxProgress("70");
    await gameUtil.updateUI(txRcpt, "Payout", $("#txStatus"));
    await gameUtil.setTxProgress("100");
    await this.showWinnings();
    await this.showContractBalance();
    await this.refreshGames();
  },

  start: async function () {
    const { web3, $ } = this;
    try {
      this.rockPaperScissors.setProvider(web3.currentProvider);
      await this.setUpApp();
    } catch (error) {
      console.log(error);
      console.error("Could not connect to contract or chain.");
    }
  },

  setUpApp: async function () {
    const { web3 } = this;

    const labelArray = ["Deployer", "Alice", "Bob", "Carol", "Dennis", "Erin", "Fred", "Gina", "Homer", "Jillian"];
    const addressSelector = document.getElementById("addressSelector");

    web3.eth
      .getAccounts()
      .then((accounts) => {
        if (accounts.length == 0) {
          throw new Error("No accounts with which to transact");
        }
        return accounts;
      })
      .then((accountList) => {
        for (i = 0; i < 10; i++) {
          let address = accountList[i];
          let label = i < 10 ? labelArray[i] : `${accountList[i].slice(0, 6)}...`;
          // let label = labelArray[i];
          this.wallets.push({ i, address, label });

          if (i !== 0) {
            var option = document.createElement("option");
            option.value = address;
            option.label = `${label} - ${address}`;
            addressSelector.add(option);
          }
        }
      })
      .catch(console.error);
    const deployed = await this.rockPaperScissors.deployed();
    GAME_MIN_STAKE = (await deployed.MIN_STAKE()).toNumber();
    GAME_MIN_STAKE_ETH = this.web3.utils.fromWei(GAME_MIN_STAKE.toString(), "ether");
    GAME_MIN_CUTOFF_INTERVAL = (await deployed.MIN_CUTOFF_INTERVAL()).toNumber();
    GAME_MAX_CUTOFF_INTERVAL = (await deployed.MAX_CUTOFF_INTERVAL()).toNumber();

    await this.showContractBalance();
    await this.showGameVariables();
    await gameData.init();
    this.setActiveWallet();

    await this.refreshGames();
  },

  updateFromChain: async function () {
    const blockTimeStamp = (await this.web3.eth.getBlock("latest")).timestamp;
    const { games, MIN_STAKE } = await this.rockPaperScissors.deployed();

    const docs = await gameData.fetchData();
    docs !== undefined && docs.total_rows > 0
      ? docs.rows.map(async (x) => {
          if (x.doc.status < gameUtil.gameStatusEnum.finished) {
            //get game data from blockchain directly
            let chainData = await games(x.id);
            console.log(chainData);

            //update Dapp database's  'status'
            if (blockTimeStamp > chainData.playDeadline) {
              await gameData.updateGame(x.id, "status", gameUtil.gameStatusEnum.playexpired);
            }

            if (blockTimeStamp > chainData.revealDeadline) {
              await gameData.updateGame(x.id, "status", gameUtil.gameStatusEnum.revealexpired);
            }
          }
        })
      : [];
  },

  refreshGames: async function () {
    const _now = (await this.web3.eth.getBlock("latest")).timestamp;
    await this.updateFromChain();
    await gameState.gameListRefresh($("#addressSelector option:selected").attr("value"), _now);
    await this.showAccountBalance();
    await this.showWinnings();
    //await gameData.deleteAllGames();
  },

  copyTextToClipBoard: async function (elem) {
    await navigator.clipboard.writeText(document.getElementById(elem).innerText);
  },

  matchStake: function (_from, _to) {
    const x = $(`#${_from}`).val();
    const stakeElem = $(`#${_to}`);
    stakeElem.val(x.toString());
  },

  showContractBalance: async function () {
    const deployed = await this.rockPaperScissors.deployed();
    const balanceInWei = await this.web3.eth.getBalance(deployed.address);
    const balanceInEther = this.web3.utils.fromWei(balanceInWei, "ether");
    $("#contractBalance").html(`${parseFloat(balanceInEther).toFixed(4)} ETH`);
  },

  showAccountBalance: async function () {
    const accountBalanceInEther = await this.web3.utils.fromWei(
      await this.web3.eth.getBalance(this.activeAccount.address),
      "ether"
    );
    $("#activeAccountBalance").html(accountBalanceInEther);
  },

  showWinnings: async function () {
    const { winnings } = await this.rockPaperScissors.deployed();
    const winningsInEther = this.web3.utils.fromWei(await winnings.call(this.activeAccount.address), "ether");
    $("#winningsAmount").html(`${winningsInEther}`);
  },

  choiceSelected: function (id) {
    $("#create_choices button").removeClass("btn-success").addClass("btn-secondary");
    const chosenElem = $(`#${id}`);
    chosenElem.addClass("btn-success");
    $("#create_chosen").val(chosenElem.val());
    $("#btnCreate").prop("disabled", false);
  },

  playChoiceSelected: function (id) {
    $("#play_choices button").removeClass("btn-success").addClass("btn-secondary");
    const chosenElem = $(`#${id}`);
    chosenElem.addClass("btn-success");
    $("#play_chosen").val(chosenElem.val());
    $("#btnPlay").prop("disabled", false);
  },

  setActiveWallet: async function () {
    const active = $("#addressSelector option:selected");
    const activeAddress = active.attr("value");
    document.getElementById("activeWallet").innerHTML = active.attr("label").split(" - ")[0];
    document.getElementById("activeWalletAddress").innerHTML = activeAddress;

    const activeWalletObj = this.wallets.find((x) => x.address === activeAddress.toString());
    this.activeAccount = activeWalletObj;
    this.showWinnings();

    await this.refreshGames();
  },

  getAddressLabel: function (address) {
    try {
      const active = $("#addressSelector option:selected");
      document.getElementById("activeWallet").innerHTML = active.attr("label").split(" - ")[0];
      const activeWalletObj = this.wallets.find((x) => x.address === address.toString());
      return activeWalletObj.label;
    } catch (err) {
      console.error("getAddressLabel::Error:", err);
      return "";
    }
  },

  showGameVariables: async function () {
    const minStakeText = `Minimum Stake  ${GAME_MIN_STAKE_ETH} ETH`;
    $("#create_min_stake_message").html(minStakeText);
    $("#play_min_stake_message").html(minStakeText);
    $("#create_gameLength_limits").html(
      `Minimum ${gameUtil.secondsToDisplayString(GAME_MIN_CUTOFF_INTERVAL)},  Maximum ${gameUtil.secondsToDisplayString(
        GAME_MAX_CUTOFF_INTERVAL
      )}`
    );
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
