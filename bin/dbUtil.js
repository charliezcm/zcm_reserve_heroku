/**
 * Util module for db operation
 */

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// common query template
exports.execQuery = async (query) => {
  const client = await pool.connect();
  try {
    return await client.query(query);
  } catch (err) {
    throw err;
  } finally {
    client.release();
  }
};
