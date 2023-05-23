var express = require('express');
var router = express.Router();
const { ClientBuilder } = require('@iota/client');
require('dotenv').config({ path: '../.env' }); //store database username and password here?
const {AccountBuilder, ExplorerUrl, DID, Resolver, ProofOptions, VerifierOptions,} = require('@iota/identity-wasm/node')
const { Stronghold } = require('@iota/identity-stronghold-nodejs');
const axios = require('axios');
const {createStakeholderInfoTable} = require('../db');

router.get('/time', function(req, res){
    createStakeholderInfoTable();
    res.sendStatus(200);
});

//record new message
//since we do not implement applications for the people recording transactions but need the private keys for signatures, 
//a new DID will be created for each message and stored in the database
//Parameters:
// req.body.index = index of the message to be created
// req.body.data = data to be stored in the tangle in JSON format
router.post('/message', async function(req, res) {
    const client = new ClientBuilder().localPow(true).build();
    
    // This generates a new keypair, constructs a new DID Document, and publishes it to the IOTA Mainnet.
    let builder = new AccountBuilder();
    let account = await builder.createIdentity();

    //add time of recording to the message
    let reqData = JSON.parse(req.body.data);
    reqData.recordTime = new Date();

    //create signature by signing the data
    const signedData = await account.createSignedData("#sign-0", {data: reqData}, ProofOptions.default());
    // JSON to String, required for Buffer
    var jsonStr = JSON.stringify({signedData});    
    // JSON string to int8Array, required for message payload data
    const buf = Buffer.from(jsonStr);

    //index can later be used to retrieve all messages with the same index
    const messageId = await client.postMessage({payload: { index: req.body.index, data: buf}});
    if(messageId.length !== 0){
        res.send(axios.HttpStatusCode.Ok);
    }else{
        res.send("Error");
    }
});

//get messages by index from the tangle, combine wiht information from virk.dk and database
//Parameters:
// req.body.index = index of the messages to be retrieved
router.get('/messages/:index', async function(req, res) {
    console.log(req.params)
    let continueValues = [];
    let scData = [];
    await getMessages(req.params.index, continueValues, scData);
    console.log(continueValues, scData);

    //in this case, maximum of two different indexes will need to be checked, so no loop is needed
    if(continueValues.length !== 0){
        for (let i=0; i<continueValues.length; i++){
            await getMessages(continueValues[i], [], scData);
        }
    }
    //console.log(continueValues, scData);

    //console.log(scData);
    //TODO: make sure data is in order from farm to store --> based on what? Automatically in order of recording,
    // is this assumed to be enough?
    scData = scData.sort((a, b) => {
        if(a.recordTime < b.recordTime){
            return -1;
        }
    })
    //console.log("After sorting")
    //console.log(scData);

    //TODO: retrieve the CVR numbers from database? Check if CVR number matches the one in database?

    //get additional information from other sources
    for(i=0; i<scData.length; i++){
        const CVRnumber = scData[i].CVR;
        if(CVRnumber){
            console.log("Here");
            const url = "https://cvrapi.dk/api?search=" + CVRnumber + "&country=dk";
            console.log(url);

            const CVRinfo = await axios.get(url).then( response => {
                return {"name": response.data.name, "address": response.data.address, "city": response.data.city}
            })
            //console.log("scData: " + CVRinfo);
            scData[i].name = CVRinfo.name;
            scData[i].address = CVRinfo.address;
            scData[i].city = CVRinfo.city;
            //console.log("scData: " + JSON.stringify(scData[i]));
        }
    }

    //TODO: retrieve rest of information from database
    
    //send data back to the client
    res.send(scData);
});

//retrieve messages from the tangle, check if more messages need to be looked for
async function getMessages(index, continueValues, scData){
    // client will connect to testnet by default
    const client = new ClientBuilder().localPow(true).build();
    // get messages by index
    const message_ids = await client.getMessage().index(index);

    for (message_id of message_ids) {
        const desiredMessage = await client.getMessage().data(message_id)
        //console.log(Buffer.from(desiredMessage.message.payload.data, 'hex').toString('utf8'))
        //console.log(desiredMessage);

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
            console.log(signedDataJSON);
            //let data = JSON.parse(signedDataJSON.data);
            if(signedDataJSON.data.continue){
                //retrieve next messages using this value as index
                continueValues.push(signedDataJSON.data["continue"]);
                delete signedDataJSON.data["continue"];
            }
            //add DID string to data for fetching additional information from database
            signedDataJSON.data.did = didString;
            scData.push(signedDataJSON.data);
        }
    }
}

//create a new DID document (will not be used for our solution)
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

    // Print the local state of the DID Document.
    const document = account.document();
    console.log(JSON.stringify(document, null, 2));

    // Print the Explorer URL for the DID.
    console.log(`Explorer URL:`, ExplorerUrl.mainnet().resolverUrl(did));
    res.send("ok");
});

module.exports = router;