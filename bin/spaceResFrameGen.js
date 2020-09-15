/**
 * heroku batch for generating space frames for each shop.
 * more info can be found in following wiki:
 * https://github.com/cainz-technology/cainz_reserve_heroku/wiki
 */

const db = require('./dbUtil');
const { BatchError, MSG } = require('./commonUtil');
const { checkInt, checkPositive, checkNegative } = require('./commonUtil');
const format = require('pg-format');

//Globally Set Variable?
UNIT_TIME = 30; // 30 min
RES_STATUS = 0; // available
CREATE_DATE = new Date(); // today
IS_RETRY = process.env.IS_RETRY_SPACE_FRAME_GEN || false; // re-run the batch
OFFSET = process.env.OFFSET_SPACE_FRAME_GEN || 3; // after 3 months from now on
DAYS_MONTHS = process.env.DAYS_MONTHS_SPACE_FRAME_GEN || 1; // generate x days/months' data
DAY_OR_MONTH = process.env.DAY_OR_MONTH_SPACE_FRAME || 'D'; // M: by month, D: by day
DELETE_DATE = process.env.DELETE_START_DATE_SPACE_FRAME || 0; // delete the data from now + x

exports.execBatch = async () => {
  try {
    console.log('======start to execute batch=======');

    // output global variables settings
    console.log('---IS_RETRY_SPACE_FRAME_GEN:' + IS_RETRY + '---');
    console.log('---OFFSET_SPACE_FRAME_GEN:' + OFFSET + '---');
    console.log('---DAY_OR_MONTH_SPACE_FRAME:' + DAY_OR_MONTH + '---');
    console.log('---DAYS_MONTHS_SPACE_FRAME_GEN:' + DAYS_MONTHS + '---');
    console.log('---DELETE_START_DATE_SPACE_FRAME:' + DELETE_DATE + '---');

    //check variables data type and validity
    checkInt(OFFSET, format(MSG.VAR_TYPE_ERR, 'OFFSET_SPACE_FRAME_GEN'));
    checkInt(
      DAYS_MONTHS,
      format(MSG.VAR_TYPE_ERR, 'DAYS_MONTHS_SPACE_FRAME_GEN')
    );
    checkInt(
      DELETE_DATE,
      format(MSG.VAR_TYPE_ERR, 'DELETE_START_DATE_SPACE_FRAME')
    );
    checkPositive(OFFSET, format(MSG.VAR_DATA_ERR, 'OFFSET_SPACE_FRAME_GEN'));
    checkPositive(
      DAYS_MONTHS,
      format(MSG.VAR_DATA_ERR, 'DAYS_MONTHS_SPACE_FRAME_GEN')
    );
    checkNegative(
      DELETE_DATE,
      format(MSG.VAR_DATA_ERR, 'DELETE_START_DATE_SPACE_FRAME')
    );

    // re-run the batch?
    if (IS_RETRY === 'true') {
      const targetDate = new Date(CREATE_DATE);
      targetDate.setDate(targetDate.getDate() + parseInt(DELETE_DATE));
      // check status before delete
      const statusRows = await getStatus(targetDate);
      if (statusRows.length > 0) {
        throw new BatchError(
          format(MSG.CMN_BATCH_ERR, 'remove incomplete frames')
        );
      }
      // remove incomplete frames created at last execution
      const removedFrames = await removeIncompleteFrames(targetDate);
      console.log('remove incomplete frames...rows:' + removedFrames.length);
    }

    console.log('start to query spaces...');
    spaces = await getSpaces();
    console.log('query spaces completed...rows:' + spaces.length);

    console.log('start to query spaces from frame...');
    createdFrames = await getFrames();
    console.log('query frames completed...rows:' + createdFrames.length);

    // calculate the frame start date
    AUTO_START_DATE = setAutoStartDate(createdFrames);
    AUTO_START_DATE = new Date(AUTO_START_DATE.toLocaleDateString());
    console.log(
      'auto startDate is computed...date:' +
        AUTO_START_DATE.toLocaleDateString()
    );

    // since we only keep frame data for $OFFSET's worth, skip it if frame already exist
    STOP_DATE = new Date();
    STOP_DATE.setMonth(STOP_DATE.getMonth() + parseInt(OFFSET));
    STOP_DATE = new Date(STOP_DATE.toLocaleDateString());
    console.log(
      'frames would be generated up to date:' + STOP_DATE.toLocaleDateString()
    );

    // get the created frames to figure out new space
    createdFrames = createdFrames.map((frame) => {
      return frame.space__c;
    });

    console.log('start to prepare frames for update...');
    const spacesForUpdate = prepareFrames();
    console.log('frames for update are ready...rows:' + spacesForUpdate.length);

    console.log('start to create frames...');
    const result = await updateFrames(spacesForUpdate);
    console.log('create frames completed...rows:' + result.length);

    console.log('============exit batch=============');
    return result;
  } catch (err) {
    const berr = new BatchError(err.message);
    console.error(berr);
    return berr;
  }
};

/**
 * @desc calculate the start date from which frames to be created
 * @param array frames - frames created previously
 * @return date - start date
 */
setAutoStartDate = (frames) => {
  let result = new Date();
  // if it is first-run, start date is today;
  // else get the latest frame date, take the next day as the start date.
  if (frames.length > 0) {
    lastDate = new Date(frames[0].start_time__c);
    lastDate.setDate(lastDate.getDate() + 1);
    result = lastDate;
  }
  return result;
};

/**
 * @desc generate the frames for table insert based on Heroku Config Vars.
 * @param N/A - use global variables (spaces) instead
 * @return array - frames for table insert
 */
prepareFrames = () => {
  let spacesForUpdate = [];

  // iterate spaces for each shop
  spaces.map((space) => {
    const shopId = space.shop__c;
    const spaceId = space.sfid;
    let frames = [];

    // if there is a new space, take today as the start date;
    // else take $AUTO_START_DATE as start date;
    if (!createdFrames.includes(spaceId)) {
      console.log('new space found...spaceId:' + spaceId);
      const offset = parseInt(OFFSET);
      const startDate = new Date();

      // generate frames for specified spaceId for $offset days/months
      frames = genFramesByMonth(spaceId, startDate, offset);
      console.log('prepare frames for new space...month:' + offset);
    } else {
      let startDate = new Date(AUTO_START_DATE);
      // keep frame data for $OFFSET worth
      if (STOP_DATE > startDate) {
        // 'M': frame generation unit is month.
        // 'D': frame generation unit is Day.
        if (DAY_OR_MONTH === 'M') {
          frames = genFramesByMonth(spaceId, startDate, DAYS_MONTHS);
        } else if (DAY_OR_MONTH === 'D') {
          frames = genFramesByDay(spaceId, startDate, DAYS_MONTHS);
        } else {
          frames = [];
          console.log('alert: should not go to here!');
        }
      } else {
        console.log(
          'skip this space since the frames are already created...spaceId:' +
            spaceId
        );
      }
    }
    // prepare the fields for insert
    const dataForUpdate = frames.map((frame) => {
      const startTime = new Date(frame);
      const endTime = new Date(frame);
      endTime.setMinutes(endTime.getMinutes() + parseInt(UNIT_TIME));
      // work hour from SFDC is set as Tokyo time, we have to convert it to UTC time for heroku db
      startTime.setHours(startTime.getHours() - 9);
      endTime.setHours(endTime.getHours() - 9);
      return [spaceId, shopId, startTime, endTime, RES_STATUS, CREATE_DATE];
    });
    spacesForUpdate = spacesForUpdate.concat(dataForUpdate);
  });
  return spacesForUpdate;
};

/**
 * @desc retrieve all spaces from db.
 * @param N/A -
 * @return array - spaces for each shop in db.
 */
getSpaces = async () => {
  let query =
    'SELECT * FROM salesforce.reserve_shop_space__c WHERE isdeleted = false AND isActive__c = true;';
  const { rows } = await db.execQuery(query);
  return rows;
};

/**
 * @desc retrieve latest frame for each space from db.
 * @param N/A -
 * @return array - distinct frames for each shop/space in db.
 */
getFrames = async () => {
  let query =
    'SELECT * FROM ( SELECT DISTINCT on (space__c) space__c, start_time__c FROM custom.reserve_space_frames__c order by space__c, start_time__c desc ) p order by start_time__c desc;';
  const { rows } = await db.execQuery(query);
  return rows;
};

/**
 * @desc insert new frames to db.
 * @param array frames - new frames prepared for table insert.
 * @return array - newly created frames for each shop/space in db.
 */
updateFrames = async (frames) => {
  if (frames.length === 0) return [];
  const query = format(
    'INSERT INTO custom.reserve_space_frames__c (space__c, shop_id__c, start_time__c, end_time__c, status__c, createddate_utc) VALUES %L returning uid',
    frames
  );
  const { rows } = await db.execQuery(query);
  return rows;
};

/**
 * @desc retrieve frames that status has been changed from 0:available for reservation since last execution.
 * @param Date targetDate - last execution date.
 * @return array - status changed frames since $targetDate in db.
 */
getStatus = async (targetDate) => {
  const query = format(
    "SELECT * FROM custom.reserve_space_frames__c WHERE createddate_utc > '%s' and status__c != '0'",
    targetDate.toISOString().slice(0, 10)
  );
  const { rows } = await db.execQuery(query);
  return rows;
};

/**
 * @desc delete incomplete frame records since last execution.
 * @param Date targetDate - last execution date.
 * @return array - deleted frames in db.
 */
removeIncompleteFrames = async (targetDate) => {
  const query = format(
    "DELETE FROM custom.reserve_space_frames__c WHERE createddate_utc > '%s' returning uid",
    targetDate.toISOString().slice(0, 10)
  );
  const { rows } = await db.execQuery(query);
  return rows;
};

/**
 * @desc get work hours for each day by spaceId.
 * @param String spaceId - space of shop.
 * @return object - work hours from monday to sunday.
 */
getWorkHours = (spaceId) => {
  const wh = spaces.find((r) => r.sfid === spaceId);
  const result = {
    1: { startTime: wh.mon_openingtime__c, endTime: wh.mon_closingtime__c },
    2: { startTime: wh.tus_openingtime__c, endTime: wh.tus_closingtime__c },
    3: { startTime: wh.wed_openingtime__c, endTime: wh.wed_closingtime__c },
    4: { startTime: wh.thu_openingtime__c, endTime: wh.thu_closingtime__c },
    5: { startTime: wh.fri_openingtime__c, endTime: wh.fri_closingtime__c },
    6: { startTime: wh.sat_openingtime__c, endTime: wh.sat_closingtime__c },
    0: { startTime: wh.sun_openingtime__c, endTime: wh.sun_closingtime__c },
  };
  return result;
};

/**
 * @desc generate frames for specified space.
 * @param String spaceId - space of shop.
 * @param Date startDate - start date of the frame.
 * @param Date endDate - end date of the frame.
 * @return array - a bulk of frames
 */
genFramesByDate = (spaceId, startDate, endDate) => {
  let result = [];
  const currentDate = new Date(startDate);
  const workHours = getWorkHours(spaceId);
  while (currentDate < endDate) {
    //Sunday is 0, Monday is 1, etc.
    const weekDay = currentDate.getDay();
    const { startTime, endTime } = workHours[weekDay];
    if (startTime == null || endTime == null) break;
    result = result.concat(
      genFrames(currentDate.toLocaleDateString(), startTime, endTime)
    );
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return result;
};

/**
 * @desc generate frames for specified space.
 * @param String spaceId - space of shop.
 * @param Date startDate - start date of the frame.
 * @param String monthNo - offset unit is month, generate $monthNo months' frames.
 * @return array - a bulk of frames
 */
genFramesByMonth = (spaceId, startDate, monthNo) => {
  const endDate = new Date(startDate);
  endDate.setMonth(startDate.getMonth() + parseInt(monthNo));
  return genFramesByDate(spaceId, startDate, endDate);
};

/**
 * @desc generate frames for specified space.
 * @param String spaceId - space of shop.
 * @param Date startDate - start date of the frame.
 * @param String weekNo - offset unit is week, generate $weekNo weeks' frames.
 * @return array - a bulk of frames
 */
genFramesByWeek = (spaceId, startDate, weekNo) => {
  return genFramesByDay(spaceId, startDate, weekNo * 7);
};

/**
 * @desc generate frames for specified space.
 * @param String spaceId - space of shop.
 * @param Date startDate - start date of the frame.
 * @param String dayNo - offset unit is day, generate $dayNo days' frames.
 * @return array - a bulk of frames
 */
genFramesByDay = (spaceId, startDate, dayNo) => {
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + parseInt(dayNo));
  return genFramesByDate(spaceId, startDate, endDate);
};

/**
 * @desc generate frames for specified startTime and endTime.
 * @param Date targetDate - target date of the frame.
 * @param Date startTime - start time of the frame.
 * @param Date endTime - end time of the frame.
 * @return array - a bulk of frames
 */
genFrames = (targetDate, startTime, endTime) => {
  const result = [];
  let startDate = new Date(targetDate + ' ' + startTime);
  const endDate = new Date(targetDate + ' ' + endTime);
  while (startDate < endDate) {
    result.push(new Date(startDate.getTime()));
    const frameDate = startDate;
    frameDate.setMinutes(startDate.getMinutes() + parseInt(UNIT_TIME));
    startDate = frameDate;
  }
  return result;
};
