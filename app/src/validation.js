playIsValidated = async (choice, amountToStake, gameStaked, winnings) => {
  $("#play_chosen_Error").html("");
  $("#play_deadline_Error").html("");
  $("#play_stake_Error").html("");

  let isValid = true;

  if (!choice) {
    $("#play_chosen_Error").html("Game choice is required").css("color", "red");
    isValid = false;
  }

  if (amountToStake)
    if (amountToStake + winnings < gameStaked) {
      $("#play_stake_Error").html("Insufficient funds to stake").css("color", "red");
      isValid = false;
    }

  return isValid;
};

createIsValidated = async (GAME_MIN_STAKE, gameLifeTime, gameMinLifeTime, gameMaxLifeTime) => {
  $("#create_counterparty_Error").html("");
  $("#create_stake_Error").html("");
  $("#create_mask_Error").html("");
  $("#create_chosen_Error").html("");
  $("#create_gameLength_Error").html("");
  let isValid = true;

  if (!$("#create_counterparty").val()) {
    $("#create_counterparty_Error").html("Opponent address is required").css("color", "red");
    isValid = false;
  }

  if ($("#create_stake").val() < GAME_MIN_STAKE) {
    $("#create_stake_Error").html("Insufficient stake").css("color", "red");
    isValid = false;
  }

  if (!$("#create_mask").val()) {
    $("#create_mask_Error").html("Choice mask is required").css("color", "red");

    isValid = false;
  }

  if (!$("#create_chosen").val()) {
    $("#create_chosen_Error").html("Game choice is required").css("color", "red");
    isValid = false;
  }

  let lifeTimeError = validateGameLifeTime(gameLifeTime, gameMinLifeTime, gameMaxLifeTime);

  if (lifeTimeError) {
    $("#create_gameLength_Error").html(lifeTimeError).css("color", "red");
    isValid = false;
  }

  return isValid;
};

validateGameLifeTime = (totalSeconds, gameMinLifeTime, gameMaxLifeTime) => {
  if (totalSeconds < gameMinLifeTime) {
    return "Game Length below required minimum.";
  } else if (totalSeconds > gameMaxLifeTime) {
    return "Game Length above maximum value.";
  }
  return "";
};

module.exports = {
  createIsValidated,
  playIsValidated,
};
