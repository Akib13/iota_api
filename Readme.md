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
Running the server in a virtual machine, Expo Go application in a physical device: try using _localtunnel_ to access the port from the internet. This can be set up using the following command: `lt --port 3000 --subdomain qr-code-server-2 --local-host 192.168.109.131`