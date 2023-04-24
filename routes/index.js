var express = require('express');
var router = express.Router();
const { Client, initLogger } = require('@iota/client');
require('dotenv').config({ path: '../.env' });

//initialize logger already here so the program doesn't crash after each request
initLogger();

//test
router.get('/data', async function(req, res, next) {
    if (!process.env.NODE_URL) {
        throw new Error('.env NODE_URL is undefined, see .env.example');
    }

    const client = new Client({
        // Insert your node URL in the .env.
        nodes: [process.env.NODE_URL],
        localPow: true,
    });

    try {
        const nodeInfo = await client.getInfo();
        res.send(nodeInfo);
    } catch (error) {
        res.send(error);
    }
});


module.exports = router;