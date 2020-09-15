/**
 * Utility module for common usage
 */

// custom error class for batch error throwable
class BatchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BatchError';
  }
}

// constant error messages
const MSG = Object.freeze({
  CMN_BATCH_ERR: 'batch error occurred. --%s',
  VAR_TYPE_ERR: 'invalid data type. --%s',
  VAR_DATA_ERR: 'invalid data. --%s',
});

// check Integer type
checkInt = (varInt, errMsg) => {
  if (isNaN(varInt)) {
    throw new BatchError(errMsg);
  }
};

// check Positive Integer
checkPositive = (varInt, errMsg) => {
  if (parseInt(varInt) < 0) {
    throw new BatchError(errMsg);
  }
};

// check Negative Integer
checkNegative = (varInt, errMsg) => {
  if (parseInt(varInt) > 0) {
    throw new BatchError(errMsg);
  }
};

// module exports
exports.BatchError = BatchError;
exports.MSG = MSG;
exports.checkInt = checkInt;
exports.checkPositive = checkPositive;
exports.checkNegative = checkNegative;
