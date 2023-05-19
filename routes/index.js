var express = require('express');
var router = express.Router();
const { ClientBuilder } = require('@iota/client');
require('dotenv').config({ path: '../.env' });
const crypto = require('crypto');
const {AccountBuilder, ExplorerUrl} = require('@iota/identity-wasm/node')
const {
    DID,
    Resolver,
    ProofOptions,
    VerifierOptions,
} = require('@iota/identity-wasm/node');
const { Stronghold } = require('@iota/identity-stronghold-nodejs');

//record new message
//since we do not implement applications for the people recording transactions but need the private keys for signatures, 
//a new DID will be created for each message and stored in the database
//Parameters:
// req.body.index = index of the message to be created
// req.body.
router.post('/message', async function(req, res, next) {
    const client = new ClientBuilder().localPow(true).build();
    console.log(JSON.parse(req.body.data));
    // This generates a new keypair, constructs a new DID Document, and publishes it to the IOTA Mainnet.
    let builder = new AccountBuilder();
    let account = await builder.createIdentity();

    //print the DID so that it can later be used for fetching the DID document (for development purposes)
    const did = account.did();
    console.log(did.toString());

    //create signature by signing the data
    const signedData = await account.createSignedData("#sign-0", {data: req.body.data}, ProofOptions.default());
    console.log(JSON.stringify(signedData));
    // JSON to String, required for Buffer
    var jsonStr = JSON.stringify({signedData});
    
    // JSON string to Buffer, required for message payload data
    const buf = Buffer.from(jsonStr);

    //index can later be used to retrieve all messages with the same index
    const messageId = await client.postMessage({payload: { index: req.body.index, data: buf}});
    res.send(messageId);
});

router.get('/message', async function(req, res, next) {
    let continueValues = [];
    let scData = [];
    await getMessages("test_aau_2", continueValues, scData);
    console.log(continueValues, scData);
    if(continueValues.length !== 0){
        for (let i=0; i<continueValues.length; i++){
            await getMessages(continueValues[i], [], scData);
        }
    }
    console.log(continueValues, scData);

    /*const client = new ClientBuilder().localPow(true).build();
    //get message based on messageid from request body
    console.log("Message you looked for:");
    const desiredMessage = await client.getMessage().data(req.body.messageid.toString());
    //console.log(Buffer.from(desiredMessage.message.payload.data, 'hex').toString('utf8'));
    console.log(desiredMessage.message);*/

    //get additional information from database
    for(i=0; i<scData.length; i++){

    }

   
   
    //for now, just send the result to the client
    //res.send(validSignature);
    res.send("ok");
});

async function getMessages(index, continueValues, scData){
    // client will connect to testnet by default
    const client = new ClientBuilder().localPow(true).build();
    // get messages by index
    const message_ids = await client.getMessage().index(index);

    for (message_id of message_ids) {
        const desiredMessage = await client.getMessage().data(message_id)
        //console.log(Buffer.from(desiredMessage.message.payload.data, 'hex').toString('utf8'))
        //get signed data in JSON format for later use
        const signedDataJSON = JSON.parse(Buffer.from(desiredMessage.message.payload.data, 'hex')).signedData;
        //get DID document of the sender
        const resolver = new Resolver();
        //use buffer to get message data to usable form, then parse it into JSON to access pieces of information inside data
        //get verification method (= DID + key fragment)
        let didString = signedDataJSON.proof.verificationMethod.toString('utf8');
        //remove key fragment from the string
        didString = didString.substring(0, didString.indexOf('#'));

        //parse DID string into a DID
        const did = DID.parse(didString);
        //get DID document
        const doc = await resolver.resolve(did);
        //check validity of message with the signed data and the information from the DID document
        const validSignature = doc.document().verifyData(signedDataJSON, VerifierOptions.default());
        console.log(validSignature);

        //only take the message into account if the signature was valid
        if(validSignature){
            //if the signature was valid, check message content for an index to look for next
            let data = JSON.parse(signedDataJSON.data);
            if(data.continue){
                //retrieve next messages using this value as index
                continueValues.push(data["continue"]);
                delete data["continue"];
            }
            //add DID string to data for fetching additional information from database
            data.did = didString;
            scData.push(data);
        }
    }
}

//create a new DID document
router.post('/did', async function(req, res, next) {
      // Stronghold settings for the Account storage.
    // This will load an existing Stronghold or create a new one automatically.
    const filepath = "./example-strong.hodl";
    const password = "my-password";
    const stronghold = await Stronghold.build(filepath, password);
    
    // This generates a new keypair stored securely in the above Stronghold, 
    // constructs a new DID Document, and publishes it to the IOTA Mainnet.
    let builder = new AccountBuilder({
        storage: stronghold,
    });
    let account = await builder.createIdentity();

    // Print the DID of the newly created identity.
    const did = account.did();
    console.log(did.toString());

    const signedData = await account.createSignedData("#sign-0", {data: "moikka vaan"}, ProofOptions.default());

    // Print the local state of the DID Document.
    const document = account.document();
    console.log(JSON.stringify(document, null, 2));

    // Print the Explorer URL for the DID.
    console.log(`Explorer URL:`, ExplorerUrl.mainnet().resolverUrl(did));
      res.send("ok");
});


router.get('/did', async function(req, res, next) {
 const resolver = new Resolver();
 const did = DID.parse("did:iota:6DEGud5LCr5StYHxGCYq3he9AKYwEn9EPNjcTCJ7GUDq");
 const doc = await resolver.resolve(did);
 console.log(JSON.stringify(doc, null, 2));
 res.send("ok");
});

//check signature, include sender id/type/etc. in body as well to confirm check?
function checkSenderValidity(body){
    let valid = false;
    if(body.length !== 0){
        console.log(body);
    }
    return valid;
}


//test stuff
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