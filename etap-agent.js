'use strict';

require('./lib/utils/logs');
require('./lib/utils/config');


process.title = global.applicationName + "-agent - " + "[" + global.agentHost +"]";

var g_brokerConnectorNS = require("./lib/broker-connector");
var shutdown = require("./lib/utils/shutdown");
var restAPI = require("./lib/Rest/rest-api.js");

/**
 * Default configuration
 */
global.mqServer = global.mqServer || "etaprabbit.int.thomsonreuters.com";
global.agentPort = global.agentPort || 3000;

/**
 * Connect to broker
 */
var g_brokerConnector = new g_brokerConnectorNS.BrokerConnector();
restAPI.start(g_brokerConnector).then(function startBroker() {
    /**
     * Load and start the rest-api
     */
    g_brokerConnector.start();
}, function stopAgent() {
    process.exit(-1);
});

/**
 * Shutdown sequence
 */
shutdown(function terminateNicely(){
    logger.info("graceful shutting down.");
    g_brokerConnector.end();
    process.exit();
});