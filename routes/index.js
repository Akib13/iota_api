var express = require('express');
var router = express.Router();
const { ClientBuilder } = require('@iota/client');
require('dotenv').config({ path: '../.env' }); //store database username and password here?
const {AccountBuilder, ExplorerUrl, DID, Resolver, ProofOptions, VerifierOptions,} = require('@iota/identity-wasm/node')
const { Stronghold } = require('@iota/identity-stronghold-nodejs');
const axios = require('axios');
const {getStakeholderCVR, dropStakeholderInfoTable, addStakeholderInfo, getAllStakeholderInfo, updateStakeholderInfo, addCertificate, getCertificate, getAllCertificates, dropCertificateTable, deleteStakeholderInfo} = require('../db');

//record new message
//since we do not implement applications for the people recording transactions but we do need the private keys for signatures, 
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
        res.sendStatus(200);
    }else{
        res.send("Error");
    }
});

//get messages by index from the tangle, combine with information from virk.dk and database
//Parameters:
// req.params.index = index of the messages to be retrieved
router.get('/messages/:index', async function(req, res) {
    //index to look for next
    let continueValues = [];
    let scData = [];
    let success = false;
    
    success = await getMessages(req.params.index, continueValues, scData);

    if(!success){
        const error = {error: "Product not found", fetched: true};
        res.send(JSON.stringify(error));
        return;
    }
    //in this case, maximum of two different indexes will need to be checked, so no loop is needed
    if(continueValues.length !== 0){
        await getMessages(continueValues[0], [], scData);
    }

    console.log("Before sorting:")
    console.log(scData);
    //make sure messages are in order of oldest recorder message to newest recorded message
    scData = scData.sort((a, b) => {
        if(a.recordTime < b.recordTime){
            return -1;
        }
    })

    console.log("\nAfter sorting:")
    console.log(scData);

    //get additional information from other sources
    for(i=0; i<scData.length; i++){
        //get CVR number from database
        console.log("checking:");
        console.log(scData[i]);
        const CVRnumber = await getStakeholderCVR(scData[i].did);
        if(CVRnumber[0] && CVRnumber[0].cvr){
            console.log(CVRnumber[0].cvr);
            //get company information from Virk based on CVR number
            const url = "https://cvrapi.dk/api?search=" + CVRnumber[0].cvr + "&country=dk";

            const CVRinfo = await axios.get(url).then( response => {
                return {"name": response.data.name, "address": response.data.address, "city": response.data.city}
            })

            //add new information to list of data
            scData[i].name = CVRinfo.name ? CVRinfo.name : "Unknown";
            scData[i].address = CVRinfo.address ? CVRinfo.address : "Unknown";
            scData[i].city = CVRinfo.city ? CVRinfo.city : "Unknown";
        
            //get certificates for the company
            const certificate = await getCertificate(CVRnumber[0].cvr);
            if(certificate.length !== 0){
                scData[i].cert = {"Date_of_annual_inspection": certificate[0].inspection, "product_category": certificate[0].category, "Date_of_issuing": certificate[0].date, "Place_of_issuing": certificate[0].place, "Valid_until": certificate[0].validity}
            }
        } else {
            console.log("removing:");
            console.log(scData[i]);
            scData.splice(i, 1);
            i--;
        }
    }

    //send data back to the client
    console.log("## FINAL DATA ##")
    console.log(scData);
    res.send(scData);
});

//retrieve messages from the tangle, check if more messages need to be looked for
async function getMessages(index, continueValues, scData){
    // client will connect to testnet by default
    const client = new ClientBuilder().localPow(true).build();
    // get messages by index
    const message_ids = await client.getMessage().index(index);

    if(message_ids.length === 0){
        return false;
    }
    for (message_id of message_ids) {
        const desiredMessage = await client.getMessage().data(message_id)

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

        //only take the message into account if the signature was valid
        if(validSignature){
            //if the signature was valid, check message content for an index to look for next
            if(signedDataJSON.data.pigid){
                //retrieve next messages using this value as index
                continueValues.push(signedDataJSON.data["pigid"]);
                delete signedDataJSON.data["pigid"];
            }
            //add DID string to data for fetching additional information from database
            signedDataJSON.data.did = didString;
            scData.push(signedDataJSON.data);
        }
    }
    return true;
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

//helper routes used for development purposes
router.get('/deleteStakeholderTable', function(req, res) {
    dropStakeholderInfoTable();
    res.sendStatus(200);
});

router.get('/deleteCertificateTable', function(req, res) {
    dropCertificateTable();
    res.sendStatus(200);
});

router.post('/addStakeholder', function(req, res){
    addStakeholderInfo(req.body.cvr, req.body.did);
    res.sendStatus(200);
})

router.post('/deleteStakeholder', function(req, res){
    deleteStakeholderInfo(req.body.did);
    res.sendStatus(200);
})

router.get('/stakeholders', function(req, res) {
    getAllStakeholderInfo();
    res.sendStatus(200);
});
router.post('/updateStakeholder', function(req, res){
    updateStakeholderInfo("CVR_Number", req.body.cvr, "DID", req.body.did);
    res.sendStatus(200);
})

router.post('/addCertificate', function(req, res) {
    addCertificate(req.body.cvr, req.body.date, req.body.category, req.body.issuedTime, req.body.issuedPlace, req.body.validity, req.body.issuer);
    res.sendStatus(200);
})

router.get('/certificates', function(req, res){
    getAllCertificates();
    res.sendStatus(200);
})

module.exports = router;