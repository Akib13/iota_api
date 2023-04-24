require('dotenv').config();
var express = require('express');

var indexRouter = require('./routes/index');

var app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/api', indexRouter);

app.listen(3000, () => {
    console.log("Server started at 3000");
});

module.exports = app;