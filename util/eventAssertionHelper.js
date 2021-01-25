// const chai = require("chai");
// const { assert } = chai;

eventIsEmitted = (txObj, eventName) => {
  try {
    assert.isTrue(txObj.events !== undefined && txObj.events.hasOwnProperty(eventName), `Event ${eventName} is not emitted`);
  } catch (ex) {
    console.error(ex);
  }
};

getEventParams = (txObj, eventName) => {
  try {
    assert.isTrue(txObj.events !== undefined && txObj.events.hasOwnProperty(eventName), `Event ${eventName} is not emitted`);
    return txObj.events[eventName].returnValues;
  } catch (ex) {
    console.error(ex);
  }
};

parameterIsValid = (txObj, eventName, propName, expectedValue, message) => {
  assert.equal(txObj.events[eventName].returnValues[propName], expectedValue, message);
  try {
  } catch (ex) {
    console.error(ex);
  }
};
parameterIsValidIsStrictlyValid = (txObj, eventName, propName, expectedValue, message) => {
  assert.strictEqual(txObj.events[eventName].returnValues[propName], expectedValue, message);
  try {
  } catch (ex) {
    console.error(ex);
  }
};

module.exports = {
  eventIsEmitted,
  getEventParams,
  parameterIsValid,
  parameterIsValidIsStrictlyValid,
};
