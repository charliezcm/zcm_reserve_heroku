/**
 * heroku batch for removing old space frames periodically.
 * more info can be found in following wiki:
 * https://github.com/cainz-technology/cainz_reserve_heroku/wiki
 */

const db = require('./dbUtil');
const { checkInt, MSG, checkNegative, BatchError } = require('./commonUtil');
const format = require('pg-format');

//Globally Set Variable?
OFFSET = process.env.MONTHS_SPACE_FRAME_DEL || -1; // delete old record x months ago

exports.execBatch = async () => {
  try {
    console.log('======start to execute batch=======');

    console.log('---MONTHS_SPACE_FRAME_DEL:' + OFFSET + '---');
    //check variables date type and validity
    checkInt(OFFSET, format(MSG.VAR_TYPE_ERR, 'MONTHS_SPACE_FRAME_DEL'));
    checkNegative(OFFSET, format(MSG.VAR_DATA_ERR, 'MONTHS_SPACE_FRAME_DEL'));

    console.log('start to delete old space frames...month:' + OFFSET);
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + parseInt(OFFSET));
    const result = await removeOldFrames(targetDate);
    console.log('remove old space frames completed...rows:' + result.length);

    console.log('============exit batch=============');
    return result;
  } catch (err) {
    const berr = new BatchError(err.message);
    console.error(berr);
    return berr;
  }
};

/**
 * @desc delete old frames from db.
 * @param Date targetDate - target date of the frames
 * @return array - deleted frames.
 */
removeOldFrames = async (targetDate) => {
  const query = format(
    "DELETE FROM custom.reserve_space_frames__c WHERE start_time__c < '%s' returning uid",
    targetDate.toISOString().slice(0, 10)
  );
  const { rows } = await db.execQuery(query);
  return rows;
};
