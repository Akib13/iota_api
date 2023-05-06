var express = require('express');
var router = express.Router();
const { ClientBuilder } = require('@iota/client');
require('dotenv').config({ path: '../.env' });
const crypto = require('crypto');


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

router.get('/addresses', async function(req, res, next) {
  
    // Get the seed from environment variable
    //const IOTA_SEED_SECRET = process.env.IOTA_SEED_SECRET;
    const IOTA_SEED_SECRET = generateSeed();
  
    // client will connect to testnet by default
    const client = new ClientBuilder().localPow(true).build();
  
    const addresses = await client.getAddresses(IOTA_SEED_SECRET)
      .accountIndex(0)
      .range(0, 5)
      .get();
  
    res.send(await addressOutputs(addresses));
  });

router.post('/message', async function(req, res, next) {
    const client = new ClientBuilder().localPow(true).build();
    
    // JSON to String, required for Buffer
    //TODO: get data from request, check validity
    var jsonStr = JSON.stringify({"id": 1, "value": "test payload", "jwt": "jwthere"});
    
    // JSON string to Buffer, required for message payload data
    const buf = Buffer.from(jsonStr);

    //index can later be used to retrieve all messages with the same index
    const messageId = await client.postMessage({payload: { index: "test_aau", data: buf}});
    res.send(messageId);
});

router.get('/message', async function(req, res, next) {
    // client will connect to testnet by default
    const client = new ClientBuilder().localPow(true).build();

    // get message data by message id (get a random message id with getTips)
    const tips = await client.getTips();
    const message_data = await client.getMessage().data(tips[0]);
    const message_metadata = await client.getMessage().metadata(tips[0]);
    console.log(message_metadata);
    console.log(message_data);

    // get indexation data by index
    const message_ids = await client.getMessage().index("test_aau")
    for (message_id of message_ids) {
        const message_wrapper = await client.getMessage().data(message_id)
        console.log(Buffer.from(message_wrapper.message.payload.data, 'hex').toString('utf8'));
    }

    //get message based on messageid from request body
    console.log("Message you looked for:");
    const sm = await client.getMessage().data(req.body.messageid.toString());
    console.log(Buffer.from(sm.message.payload.data, 'hex').toString('utf8'));
    res.send("ok");
});

function generateSeed() {
    const seed = crypto.createHash('sha256').update(crypto.randomBytes(256)).digest('hex');
    console.log(seed);

    const client = new ClientBuilder().localPow(true).build();

    const mnemonic = client.generateMnemonic();
    console.log(mnemonic);

    const hexEncodedSeed = client.mnemonicToHexSeed(mnemonic);
    console.log(hexEncodedSeed);
    return hexEncodedSeed;
}

async function addressOutputs(addresses) {
    // client will connect to testnet by default
    const client = new ClientBuilder().localPow(true).build();

    console.log(addresses[1]);
    const outputs = await client.getAddressOutputs(addresses[1]);
    console.log(outputs);
    return(outputs);
}

module.exports = router;