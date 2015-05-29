var g_q = require("q");

//var TopicListener = require("./listeners/topic");
//var ExecutionListener = require("./listeners/execution");
var HttpSender = require("./httpSender");

// global variables
var logger = global.logger;

var Connection = function (server, heartbeat) {
    this.end = function () {
    };

    this.createTopicListener = function(topic, queue, pattern) {
        return null;
    };

    this.createExecutionListener = function() {
        return null;
    };

    this.createSender = function(queue) {
        return new HttpSender(server, queue);
    };

    var start = this.start = function () {
        var l_deferredReturn = g_q.defer();
        logger.info('Connecting');
        l_deferredReturn.resolve();
        return l_deferredReturn.promise;
    };
};

var staticConnection;

module.exports = function(server, heartbeat) {
    if (staticConnection) return staticConnection;
    staticConnection = new Connection(server, heartbeat)
    return staticConnection;
};