const express = require('express');
const helloRoute = require('./routes/helloRoute');

const app = express();
app.disable("x-powered-by");

app.use(express.json());

app.use('/api/hello', helloRoute);

module.exports = app;
