rackspace-monitoring-gui
========================

Tiny webapp for MaaS

The point of this is to provide CK users a graphical interface for MaaS in the easiest way possible.

We have 2 options:

1) Use something like https://github.com/paperlesspost/graphiti use MaaS. (I have no idea if this is feasable or not)
2) Make our own little standalone app that uses the MaaS API.

We should investigate #1.

I've started something simple for option 2 already, based on bottle (https://github.com/defnull/bottle)

It currently doesn't do much, but it's currrently set up and uses a pretty simple cookie based session store.

Ideally we save the auth token and MaaS url in a cookie and talk to the API via CORS. Unfortunately we have to do the login and set the cookie server side because the auth API can't do CORS.

./run.py starts the magic



