var express = require('express');
var router = express.Router();
const { ClientBuilder } = require('@iota/client');
require('dotenv').config({ path: '../.env' });


//test
router.get('/data', async function(req, res, next) {

    // client will connect to testnet by default
    const client = new ClientBuilder()
        .localPow(true)
        .build();

    //client.getInfo().then(console.log).catch(console.error);

    try {
        const nodeInfo = await client.getInfo();
        res.send(nodeInfo);
    } catch (error) {
        res.send(error);
    }
});


module.exports = router;