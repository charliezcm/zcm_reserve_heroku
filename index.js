const express = require('express');
const batch = require('./bin/spaceResFrameGen');

const PORT = process.env.PORT || 5000;

express()
  //.use(express.static(path.join(__dirname, 'public')))
  .get('/', async (req, res) => {
    res.send('reserved for web entry..');
  })
  .listen(PORT, () => console.log(`Listening on ${PORT}`));
