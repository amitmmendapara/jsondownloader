const express = require('express');
const router = express.Router();

// Mount all user-related routes
router.use('/json', require('../routes/json.routes.js'));

module.exports = router;