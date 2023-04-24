Backend instructions
==========

Structure
---------
The backend is built using Node.js and the Node.js binding from IOTA client.

Usage
------
To start the backend server, copy the code to a folder of your choice and in that folder run the command `node app.js`. This will automatically start the server at http://localhost:3000/.

To retrieve and record information, there are different api routes available. These can be found from _routes/index.js_.
For example, running `GET http://localhost:3000/api/data` will return information about the node the system connects to in the tangle. These requests can be executed for example using the "Postman" application.

Problem solving
----------------
Running with an Andrdoid emulator: If connections from the app to the backend don't work, try running `adb reverse tcp:3000 tcp:3000` in the terminal to fix port issues with the emulator.