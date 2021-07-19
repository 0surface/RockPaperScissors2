const gameStatusEnum = { created: 1, played: 2, revealed: 3, playexpired: 4, revealexpired: 5, finished: 6 };

getEvent = (minedTxRecepit, eventIndex) => minedTxRecepit.logs[eventIndex].topics;

getGameLifeTimeSeconds = (days, hours, minutes) => {
  return 3600 * 24 * days + 3600 * hours + 60 * minutes;
};

setTxProgress = async (progress, delay) => {
  const percentVal = `${progress}%`;
  setTimeout(
    () => {
      $(".progress-bar").css("width", percentVal);
      $(".progress-bar").html(percentVal);
    },
    delay ? delay : 500
  );

  if (progress == "0") {
    $(".progress").css("display", "none");
  }
};

updateUI = async (txObj, txName, $txStatus) => {
  if (!txObj.receipt.status) {
    console.error("Wrong status");
    console.error(txObj.receipt);
    await $txStatus.html(`There was an error in the ${txName} transaction execution, status not 1`, `error`);
  } else if (txObj.receipt.logs.length == 0) {
    console.log("Empty logs");
    console.log(txObj.receipt);
    await $txStatus.html(`There was an error in the ${txName} transaction, missing expected event`, `error`);
  } else {
    await $txStatus.html(`${txName} transaction executed`, ``);
  }
};

secondsToDisplayString = (seconds) => {
  let days = Math.floor(seconds / (24 * 60 * 60));
  seconds -= days * (24 * 60 * 60);
  let hours = Math.floor(seconds / (60 * 60));
  seconds -= hours * (60 * 60);
  let minutes = Math.floor(seconds / 60);
  seconds -= minutes * 60;

  let dayStr = days === 0 ? `` : days === 1 ? `1d` : `${days}d`;
  let hourStr = hours === 0 ? `` : hours === 1 ? `1h` : `${hours}h`;
  let minStr = minutes === 0 ? `` : minutes === 1 ? `1m` : `${minutes}m`;
  return `${dayStr} ${hourStr} ${minStr}`;
};

createHtmlGameRow = (game, activeAddress, blockTimeStamp) => {
  return `<td>${activeAddress == game.playerOne ? game.playerTwoLabel : game.playerOneLabel}</td>
    <td>${game.stakeInEther}</td>
    <td>${makeExpiryButton(game.playDeadline, game.status, blockTimeStamp)}</td>
    <td>${makeExpiryButton(game.revealDeadline, game.status, blockTimeStamp)}</td>
    <td>${makeActionButton(game, activeAddress, blockTimeStamp)}</td>    
  </tr>`;
};

makeExpiryButton = (deadline, status, blockTimeStamp) => {
  const expiredStateElem = `<button class="btn btn-sm btn-warning" disabled><i class="fas fa-hourglass-end"></i>&nbsp Expired</button>`;
  return status === gameStatusEnum.finished || deadline < blockTimeStamp
    ? expiredStateElem
    : `${secondsToDisplayString(deadline - blockTimeStamp)}`;
};

makeActionButton = (game, activeAddress, blockTimeStamp) => {
  const settleActionButton = `<button class="btn btn-sm btn-warning" data-toggle="modal" data-target="#settleModal" 
  data-gameid="${game._id}" data-settler="${activeAddress}"> 
  <i class="fas fa-1x fa-gavel"></i>&nbsp Settle</a></button>`;
  const playActionButton = `<button class="btn btn-sm btn-primary"  data-toggle="modal" data-target="#playModal" 
  data-deadline="${game.playDeadline}" data-gamestake="${game.stakeInEther}" data-gameid="${game._id}">
  <i class="fas fa-1x fa-door-open"></i>&nbsp &nbsp Play</a></button>`;
  const waitActionButton = `<button class="btn btn-sm btn-secondary" disabled>Wait</a></button>`;
  const expiredActionButton = `<button class="btn btn-sm btn-danger" disabled><i class="fas fa-hourglass-end"></i>&nbsp Expired</a></button>`;
  const finishedActionButton = `<button class="btn btn-sm btn-danger" disabled><i class="fas fa-1x fa-dizzy"></i>&nbsp Deleted</a></button>`;
  const revealActionButton = `<button class="btn btn-sm btn-success" data-toggle="modal" data-target="#revealModal" 
  data-gameid="${game._id}" data-address="${activeAddress}">
  <i class="fas fa-1x fa-eye"></i>&nbsp Reveal</a></button>`;

  const isPlayerOne = activeAddress === game.playerOne;
  const playHasExpired = game.playDeadline < blockTimeStamp;
  const revealHasExpired = game.revealDeadline < blockTimeStamp;

  if (revealHasExpired && game.status != gameStatusEnum.finished) {
    return settleActionButton;
  }
  switch (game.status) {
    case gameStatusEnum.created:
      if (isPlayerOne) {
        return playHasExpired ? (revealHasExpired ? settleActionButton : revealActionButton) : waitActionButton;
      } else {
        return playHasExpired ? finishedActionButton : playActionButton;
      }

    case gameStatusEnum.played:
      if (isPlayerOne) {
        return revealHasExpired ? settleActionButton : revealActionButton;
      } else {
        return revealHasExpired ? settleActionButton : waitActionButton;
      }

    case gameStatusEnum.playexpired:
      return isPlayerOne ? (revealHasExpired ? settleActionButton : revealActionButton) : expiredActionButton;

    case gameStatusEnum.revealexpired:
      return settleActionButton;

    case gameStatusEnum.finished:
      return finishedActionButton;

    case gameStatusEnum.expired:
      return settleActionButton;

    default:
      return "";
  }
};

module.exports = {
  getEvent,
  getGameLifeTimeSeconds,
  setTxProgress,
  updateUI,
  secondsToDisplayString,
  createHtmlGameRow,
  makeActionButton,
  gameStatusEnum,
};
