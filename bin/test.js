/**
 * heroku batch for generating space frames for each shop.
 * more info can be found in following wiki:
 * https://github.com/cainz-technology/cainz_reserve_heroku/wiki
 */

//Globally Set Variable?
UNIT_TIME = 30; // 30 min
RES_STATUS = 0; // available
CREATE_DATE = new Date(); // today
IS_RETRY = process.env.IS_RETRY_SPACE_FRAME_GEN || false; // re-run the batch
OFFSET = process.env.OFFSET_SPACE_FRAME_GEN || 3; // after 3 months from now on
DAYS_MONTHS = process.env.DAYS_MONTHS_SPACE_FRAME_GEN || 1; // generate x days/months' data
DAY_OR_MONTH = process.env.DAY_OR_MONTH_SPACE_FRAME || 'D'; // M: by month, D: by day
DELETE_DATE = process.env.DELETE_START_DATE_SPACE_FRAME || 0; // delete the data from now + x
DB_URL = process.env.DATABASE_URL;

exports.execBatch = async () => {
  try {
    console.log('======start to execute batch=======');

    console.log('DB URL is ' + DB_URL);
    console.log('---IS_RETRY_SPACE_FRAME_GEN:' + IS_RETRY + '---');
    console.log('---OFFSET_SPACE_FRAME_GEN:' + OFFSET + '---');
    console.log('---DAY_OR_MONTH_SPACE_FRAME:' + DAY_OR_MONTH + '---');
    console.log('---DAYS_MONTHS_SPACE_FRAME_GEN:' + DAYS_MONTHS + '---');
    console.log('---DELETE_START_DATE_SPACE_FRAME:' + DELETE_DATE + '---');

    console.log('============exit batch=============');
    return 'ok';
  } catch (err) {
    console.error(err);
    return err;
  }
};
