const gameData = require("./gameData");
const gameUtil = require("./gameUtil");

gameListRefresh = async function (activeAddress, blockTimeStamp) {
  try {
    $("#gamesTableContainer").show();
    $("#noGamesBanner").hide().html(``);
    const docs = await gameData.fetchData();

    document.getElementById("gamesTableData").innerHTML =
      docs !== undefined && docs.total_rows > 0
        ? docs.rows
            .filter((x) => x.doc.playerOne === activeAddress || x.doc.playerTwo === activeAddress)
            .map((y) => gameUtil.createHtmlGameRow(y.doc, activeAddress, blockTimeStamp))
            .join("\n")
        : "";

    if (document.getElementById("gamesTableData").innerHTML === "") {
      $("#gamesTableContainer").hide();
      $("#noGamesBanner").show().html(`<h4>You have no games</h4>`);
    }
  } catch (ex) {
    console.error("fetchData error: ", ex);
  }
};

$(function () {
  $('[data-toggle="tooltip"]').tooltip();
});

$("#playModal").on("show.bs.modal", function (event) {
  let button = $(event.relatedTarget);
  const gameId = button.data("gameid");
  const gameStake = button.data("gamestake");
  let modal = $(this);
  modal.find("#play_gameId").val(gameId);
  modal.find("#play_gamestake").val(`${gameStake}`);
  modal.find(".modal-title").text("Play - Game = " + `${gameId.substring(0, 8)} ...`);
});

$("#revealModal").on("show.bs.modal", async function (event) {
  let button = $(event.relatedTarget);
  const gameId = button.data("gameid");
  const revealer = button.data("revealer");

  let modal = $(this);
  modal.find("#reveal_gameId").val(gameId);
  modal.find("#reveal_revealer").val(revealer);
  modal.find(".modal-title").text("Reveal Game " + `${gameId.substring(0, 8)} ...`);

  await displayRevealState(gameId, revealer);
});

$("#settleModal").on("show.bs.modal", async function (event) {
  let button = $(event.relatedTarget);
  const gameId = button.data("gameid");
  let modal = $(this);
  modal.find("#settle_gameId").val(button.data("gameid"));
  modal.find(".modal-title").text("Settle Game " + `${gameId.substring(0, 8)} ...`);
});

$("#payoutModal").on("show.bs.modal", async function (event) {
  const winnings = $("#winningsAmount").html();
  $(this).find("#payout_balance").html(`You get : <strong> ${winnings} </strpng>`);
});

displayRevealState = async (gameId, revealer) => {
  const game = await gameData.getGame(gameId);

  document.getElementById(
    "reveal_yourchoice_html"
  ).innerHTML = `<button type="button" class="btn btn-lg btn-secondary rpsChoice"  value="${game.choiceOne}"">
  ${getChoiceIcon(game.choiceOne)} </button>`;

  document.getElementById(
    "reveal_theirchoice_html"
  ).innerHTML = `<button type="button" class="btn btn-lg btn-secondary rpsChoice"  value="${game.choiceTwo}"">
    ${getChoiceIcon(game.choiceTwo)} </button>`;

  document.getElementById("reveal_outcome_html").innerHTML = solveGame(game.choiceOne, game.choiceTwo);
};

solveGame = (revealer_choice, opponent_choice) => {
  switch ((revealer_choice + 3 - opponent_choice) % 3) {
    case 0:
      return `<button type="button" class="btn btn-lg btn-secondary rpsChoice"><i class="fas fa-3x fa-equals"></i>Tie</button>`;
    case 1:
      return `<button type="button" class="btn btn-lg btn-success rpsChoice"><i class="fas fa-3x fa-check"></i>Win</button>`;
    case 2:
      return `<button type="button" class="btn btn-lg btn-danger rpsChoice"><i class="fas fa-3x fa-times"></i>Lose</button>`;
    default:
      return `<button type="button" class="btn btn-lg btn-secondary rpsChoice"></button>`;
  }
};

getChoiceIcon = (choice) => {
  switch (choice) {
    case "0":
      return `<i class="fas fa-question"></i>`;
    case "1":
      return `<i class="fas fa-3x fa-hand-rock" ></i>`;
    case "2":
      return `<i class="fas fa-3x fa-hand-paper"></i>`;
    case "3":
      return `<i class="fas fa-3x fa-hand-scissors"></i>`;
    default:
      return `<i class="fas fa-question"></i>`;
  }
};

module.exports = {
  gameListRefresh,
};
