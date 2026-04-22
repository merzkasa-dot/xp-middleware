// Load environment variables
require("dotenv").config();

// Start server
require("./middleware/server.js");

// Import bot (make sure it exports client)
const client = require("./bot/bot.js");

console.log("All services started...");