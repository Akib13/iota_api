require('dotenv').config();
var express = require('express');
const mysql = require('mysql');
const {createStakeholderInfoTable, createCertificateTable} = require('./db');

var con = mysql.createConnection({
    user: "testuser",
    password: "accesskey4!Database",
  });
  
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