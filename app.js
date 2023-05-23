require('dotenv').config();
var express = require('express');
const mysql = require('mysql');
const {createStakeholderInfoTable, createCertificateTable} = require('./db');

//use username and password defined in .env to access database
var con = mysql.createConnection({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});
//create database if it doesn't yet exist
con.connect(function(err) {
    if (err) throw err;
    console.log("Connected!");
    con.query("CREATE DATABASE IF NOT EXISTS mydb", function (err, result) {
        if (err) throw err;
        console.log("Database exists or created");
        createStakeholderInfoTable();
        createCertificateTable();
    });
});

var indexRouter = require('./routes/index');

var app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/api', indexRouter);

app.listen(3000, () => {
    console.log("Server started at 3000");
});

module.exports = app;