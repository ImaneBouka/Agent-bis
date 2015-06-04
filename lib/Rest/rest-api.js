/**
 * Created by u6028908 on 17/04/2015.
 */
'use strict';

var http = require("http");
var url = require("url");
var fs = require('fs');
var q = require("q");
var path = require("path");
var util= require("util");

var express    = require('express');
var app = express();
var bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var exec = require("child_process").exec;
var logger = global.logger;

var g_brokerConnector = null;

function commonParameters(inputStatus, statusPayload) {
    if (inputStatus.categories) {
        statusPayload.categories = inputStatus.categories.split(',');
        delete inputStatus.categories;
    }

    if (inputStatus.attachment) {
        statusPayload.attachment = inputStatus.attachment;
        delete inputStatus.attachment;
    }

    if (inputStatus.build) {
        statusPayload.build = inputStatus.build;
        delete inputStatus.build;
    }

    var properties = Object.keys(inputStatus);
    if (properties.length > 0) {
        var custom = {};
        properties.forEach(function (key) {
            var value = inputStatus[key];
            if (value.indexOf(",") > -1) value = value.split(',');
            custom[key] = value;
        });
        statusPayload.custom = custom;
    }
};

var getTestStatus = function(req, res) {
    testStatus(req, res, req.params);
};

var postTestStatus = function(req, res) {
    testStatus(req, res, req.body);
};

var testStatus = function(req, res, testStatus) {
    global.lastEvent = new Date();

    if ('status' in testStatus) {
        var status = testStatus.status;

        if (status) {
            status = status.toLowerCase().trim();

            switch (status) {
                case 'ok':
                    status = 'OK';
                    break;
                case 'inconclusive':
                    status = 'Inconclusive';
                    break;
                case 'partial':
                    status = 'Partial';
                    break;
                default:
                    status = 'Failed';
            }

            testStatus['testStatus'] = status;

            delete testStatus.status;
        }
    }

    if ('id' in testStatus) {
        testStatus['testID'] = testStatus.id;
        delete testStatus.id;
    }

    if ('description' in testStatus) {
        testStatus['testDescription'] = testStatus.description;
        delete testStatus.description;
    }

    if ('message' in testStatus) {
        testStatus['testMessage'] = testStatus.message;
        delete testStatus.message;
    }

    logger.debug("testStatus(status : "+testStatus.testStatus+", message : "+testStatus.testMessage+", testID : "+testStatus.testID+", testDescription : "+testStatus.testDescription+")");

    if (testStatus.testStatus && testStatus.testID) {
        var statusPayload = {
            testID : testStatus.testID,
            testStatus: testStatus.testStatus,
            testMessage: testStatus.testMessage,
            testDescription: testStatus.testDescription,
            kind: 'Test',
            status: testStatus.testStatus
        };

        delete testStatus.testID;
        delete testStatus.testStatus;
        delete testStatus.testDescription;
        delete testStatus.testMessage;

        var noScreenshot = false;
        if ("screenshot" in testStatus) noScreenshot = (testStatus.screenshot === 'false') || !(testStatus.screenshot);
        //delete testStatus.screenshot;

        if ("screenshot" in testStatus && !noScreenshot) {
            statusPayload.screenshot = (testStatus.screenshot === true)?true:testStatus.screenshot;
        }
        else {
            statusPayload.screenshot = (!noScreenshot && process.platform === 'win32');
        }
        delete testStatus.screenshot;


        commonParameters(testStatus, statusPayload);
        var message = g_brokerConnector.sendStatus(statusPayload);

        var answer = function() {
            res.header("Cache-Control", "no-cache, no-store, must-revalidate");
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(message?"OK":"KO");
        };

        if (message && !noScreenshot && statusPayload.testStatus.toLowerCase() != "ok") {
            g_brokerConnector.takeScreenshot(message.screenshot).finally(answer);
        } else {
            answer();
        }
    }
    else {
        var message = "";
        if (testStatus.testStatus == null) message+=",mandatory status parameter is missing";
        if (testStatus.testID == null) message+=",mandatory id parameter is missing";
        message = message.substring(1);

        var htmlMessage = '<p style="color:red">HTTP error 400 :<br />'+message.replace(/,/g, "<br />")+"</p>";
        htmlMessage += '<p>status : <span style="color:red">[mandatory]</span> status of a test (expected \"OK\" else is seen as a failure (\"KO\"))</p>';
        htmlMessage += '<p>id : <span style="color:red">[mandatory]</span> ID of test</p>';
        htmlMessage += '<p>description : test description (1 line summary)</p>';
        htmlMessage += '<p>message : test message (summary)</p>';

        res.header("Cache-Control", "no-cache, no-store, must-revalidate");
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(htmlMessage);

        g_brokerConnector.sendStatus(
            {
                logMessage: message,
                logTitle: "incorrect usage of testStatus",
                logLevel: "ERROR"// TODO, provide back sendStatus sendStepStatus
            }
        );
    }
};

var getStepStatus = function(req, res) {
    stepStatus(req, res, req.params);
};

var postStepStatus = function(req, res) {
    stepStatus(req, res, req.body);
};

var stepStatus = function(req, res, stepStatus) {
    // TODO continue like with test status

    global.lastEvent = new Date();
    logger.debug("stepStatus being called");

    if ('status' in stepStatus) {
        var status = stepStatus.status;

        if (status) {
            status = status.toLowerCase().trim();

            switch (status) {
                case 'ok':
                    status = 'Pass';
                    break;
                case 'info':
                    status = 'Info';
                    break;
                case 'error':
                    status = 'Error';
                    break;
                case 'fail':
                    status = 'Fail';
                    break;
                case 'warning':
                    status = 'Warning';
                    break;
                default:
                    status = 'Info';
            }

            stepStatus['stepStatus'] = status;

            delete stepStatus.status;
        }
    }

    if ('id' in stepStatus) {
        stepStatus['testID'] = stepStatus.id;
        delete stepStatus.id;
    }

    if ('stepid' in stepStatus) {
        stepStatus['stepID'] = stepStatus.stepid;
        delete stepStatus.stepid;
    }

    if ('message' in stepStatus) {
        stepStatus['stepMessage'] = stepStatus.message;
        delete stepStatus.message;
    }

    logger.debug("stepStatus(testID : " + stepStatus.testID +  " stepID : " + stepStatus.stepID + "status : " + stepStatus.status + ", message : " + stepStatus.message + ")");

    if (stepStatus.stepStatus && stepStatus.testID && stepStatus.stepID) {
        var statusPayload = {
            testID : stepStatus.testID,
            stepStatus: stepStatus.stepStatus,
            stepMessage: stepStatus.stepMessage,
            stepID: stepStatus.stepID,
            kind: 'Step',
            status: testStatus.stepStatus
        };

        delete stepStatus.testID;
        delete stepStatus.stepStatus;
        delete stepStatus.stepMessage;
        delete stepStatus.stepID;

        var noScreenshot = false;
        if ("screenshot" in stepStatus) noScreenshot = (stepStatus.screenshot === 'false') || !(stepStatus.screenshot);
        //delete stepStatus.screenshot;

        if ("screenshot" in stepStatus && !noScreenshot) {
            statusPayload.screenshot = (stepStatus.screenshot === true)?true:stepStatus.screenshot;
        }
        else {
            statusPayload.screenshot = (!noScreenshot && process.platform === 'win32');
        }
        delete stepStatus.screenshot;

        commonParameters(stepStatus, statusPayload);
        var message = g_brokerConnector.sendStatus(statusPayload);

        var answer = function() {
            res.header("Cache-Control", "no-cache, no-store, must-revalidate");
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end("OK");
        };

        if (message && !noScreenshot && statusPayload.stepStatus.toLowerCase() == "error") {
            g_brokerConnector.takeScreenshot(message.screenshot).finally(answer);
        } else {
            answer();
        }
    }
    else {
        message = "";
        if (stepStatus.stepStatus == null) message+=",mandatory status parameter is missing";
        if (stepStatus.testID == null) message+=",mandatory id parameter is missing";
        if (stepStatus.stepID == null) message+=",mandatory stepid parameter is missing";
        message = message.substring(1);

        var htmlMessage = '<p style="color:red">HTTP error 400 :<br />'+message.replace(/,/g, "<br />")+"</p>";
        htmlMessage += '<p>status : <span style="color:red">[mandatory]</span> status of a test (expected \"OK\" else is seen as a failure (\"KO\"))</p>';
        htmlMessage += '<p>id : <span style="color:red">[mandatory]</span> ID of test</p>';
        htmlMessage += '<p>stepid : <span style="color:red">[mandatory]</span> ID of step</p>';
        htmlMessage += '<p>message : step message</p>';

        res.header("Cache-Control", "no-cache, no-store, must-revalidate");
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(htmlMessage);

        g_brokerConnector.sendStatus(
            {
                logMessage: message,
                logTitle: "incorrect usage of stepStatus",
                logLevel: "ERROR"// TODO, provide back sendStatus sendStepStatus
            }
        );
    }
};

var screenshot = function(req, res) {
    global.lastEvent = new Date();

    var name = req.param('name');

    logger.debug('screenshot("'+name+'")');

    g_brokerConnector.takeScreenshot(name).then(function onScreenshot() {
        res.header("Cache-Control", "no-cache, no-store, must-revalidate");
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("OK");
    }, function onFailedScreenshot(reason) {
        res.header("Cache-Control", "no-cache, no-store, must-revalidate");
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(reason);
    });
};

function secondsToTimeSpan(seconds) {
    seconds = Math.round(seconds);
    var res = '';
    var minutes = Math.floor(seconds / 60);
    seconds = seconds - minutes * 60;
    var hours = Math.floor(minutes / 60)
    minutes = minutes - hours * 60;
    if (hours < 10)
        res += '0';
    res += hours;
    res += ':';
    if (minutes < 10)
        res += '0';
    res += minutes;
    res += ':';
    if (seconds < 10)
        res += '0';
    res += seconds;
    return res;
}

fs.stat(__dirname, function(err, stats) {
    if (err) {
        global.stat = 'notime';
    }
    else {
        global.stat = stats.mtime;
    }
});
global.lastEvent = null;

var agentStatus = function(req, res) {
    logger.debug("agentStatus()");
    res.header("Cache-Control", "no-cache, no-store, must-revalidate");
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.write(process.title + '#' + global.version + ' is running\n');
    res.write('status: running\n');
    res.write('date: ' + (new Date()).toISOString() + "\n");
    res.write('host: ' + global.agentHost + "\n");
    res.write('mqServer: ' + global.mqServer + "\n");
    res.write('uptime: ' + secondsToTimeSpan(process.uptime()) + "\n");
    if (g_brokerConnector) {
        res.write('operation: ' + g_brokerConnector.getStatus() + '\n');
    }
    else {
        res.write('operation: -\n');
    }
    if (global.lastEvent != null) {
        res.write('lastEvent: ' + global.lastEvent.toISOString() + "\n");
    }
    else {
        res.write('lastEvent:\n');
    }

    res.write('version: ' + global.version + "\n");
    res.write('modified: ' + global.stat.toISOString() + "\n");
    res.end();
}

var eikonVersion = function(req, res) {
    var evu = require("./../utils/eikon/eikon-version-util");
    evu.getEIKONVersion().then(function versionFound(currVersion)
    {
        var eikonversion = {};
        eikonversion.name = "EIKON";
        eikonversion.version = currVersion
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.write(JSON.stringify(eikonversion));
        res.end();
    });
};

var getTestData = function(request, response) {

    var executionID = g_brokerConnector.getCurrentExecutionID();

    if (executionID) {

        var start = Date.now();
        var request = {
            agent: false,
            hostname: global.apiServer,
            port: global.apiPort,
            path: request.url + (request.url.indexOf('?') > 0 ? '&' : '?') + 'executionID=' + executionID,
            method: request.method,
            headers: request.headers
        };
        var proxyRequest = http.request(request, function (proxyResponse) {
            proxyResponse.on('end', function () {
                var end = Date.now();
                logger.debug(request.method + " " + request.path+ " " + (end - start) + "ms " + (new Date().toISOString()));
                proxyResponse.destroy();
            });
            response.writeHead(proxyResponse.statusCode, proxyResponse.headers);
            proxyResponse.pipe(response);
        });
        proxyRequest.on('error', function (err) {
            logger.error('Http request error on ' + request.url + ' : ', err);
        });
        proxyRequest.end();
    } else {
        response.writeHead(400, { "Content-Type": "text/plain" });
        response.write("No current execution, it's impossible to provide any data");
        response.end();
    }

};

var getInternalMessages = function(request, response)
{
    try {
        var pm = require("./../process-message");
        var internalMessages = pm.getInternalQueue();
        var syslowMessages = [];
        var execMessages = [];

        internalMessages.syslowMessages.forEach(function (msg) {
            var msgDetail = {};
            msgDetail.fields = msg.payload.fields;
            msgDetail.properties = msg.payload.properties;
            msgDetail.payload = JSON.parse(msg.payload.content.toString());
            syslowMessages.push(msgDetail);
        });
        internalMessages.execMessages.forEach(function (msg) {
            var msgDetail = {};
            msgDetail.fields = msg.payload.fields;
            msgDetail.properties = msg.payload.properties;
            msgDetail.payload = JSON.parse(msg.payload.content.toString());
            execMessages.push(msgDetail);
        });
        response.writeHead(200, { "Content-Type": "application/json" });
        response.write(JSON.stringify({application: global.applicationName , hostName: global.agentHost, total: syslowMessages.length + execMessages.length, systemlowpriorityTotal : syslowMessages.length, jobsTotal : execMessages.length  , "systemlowpriority": syslowMessages, "jobs": execMessages}));
    }
    catch(e) {
        response.writeHead(500 , { "Content-Type": "text/plain" });
        logger.debug(e)
    }
    finally {
        response.end();
    }
}

var removeMessage = function(req, res) {
    var removedMessage = null;
    var execution = req.params;
    var pm = require("./../process-message");
    var executionID = execution['executionID'] || execution['executionId'] || execution['executionid'];
    try {
        if (executionID) {
            if (Array.isArray(executionID)) executionID = executionID[0];
            removedMessage = pm.removeMessage(executionID)
        }
        res.writeHead(200, {"Content-Type": "application/json"});
        res.write(JSON.stringify({execution: {id: removedMessage ? removedMessage.executionID : null}}));
    }
    catch(e) {
        res.writeHead(500 , { "Content-Type": "text/plain" });
        logger.debug(e)
    }
    finally {
        res.end();
    }
}

var clearMessage = function(req, res) {
    var pm = require("./../process-message");
    var executionIds = [];
    var queue = req.params['queue'];
    //var queueName = queue['queue'];
    var clearMessage = [];
    var hasParam = Object.keys(req.params).length;
    try {
        if (!hasParam) {
            clearMessage = pm.clearMessage();
        }
        else if (queue) {
            if (!Array.isArray(queue)) {
                if (['jobs', 'systemlowpriority'].indexOf(queue.toLowerCase()) > -1)
                    clearMessage = pm.clearMessage(queue.toLowerCase());
                else throw "Invalid queue name: " + queue;
            }
            else throw "Invalid queue name: " + queue;
        }
        else throw "Invalid parameter: " + Object.keys(req.params);

        clearMessage.forEach(function (msg) {
            executionIds.push(msg.executionID)
        })
        res.writeHead(200, {"Content-Type": "application/json"});
        res.write(JSON.stringify({execution: {ids: executionIds}}));
    }
    catch(e) {
        res.writeHead(500, {"Content-Type": "text/plain"});
        res.write(e);
        logger.debug('clearMessage: ' + e)
    }
    finally {
        res.end();
    }
}
var staticFiles = function(request, response, rootDir) {

    var uri = request.pathname
        , filename = path.join(__dirname, "../../"+rootDir, uri);

    var contentTypesByExtension = {
        '.html': "text/html",
        '.css':  "text/css",
        '.js':   "text/javascript"
    };


    path.exists(filename, function(exists) {
        if(!exists) {
            response.writeHead(404, {"Content-Type": "text/plain"});
            response.write("404 Not Found\n");
            response.end();
            return;
        }

        if (fs.statSync(filename).isDirectory()) filename += '/index.html';

        fs.readFile(filename, "binary", function(err, file) {
            if(err) {
                response.writeHead(500, {"Content-Type": "text/plain"});
                response.write(err + "\n");
                response.end();
                return;
            }

            var headers = {};
            var contentType = contentTypesByExtension[path.extname(filename)];
            if (contentType) headers["Content-Type"] = contentType;
            response.writeHead(200, headers);
            response.write(file, "binary");
            response.end();
        });
    });
};

var routeHandler = express.Router();
var g_messageHandler = require('../process-message');

routeHandler.post('/proxy/:task?' , function(req, res) {
    var task = req.params['task'] || 'jobs';
    logger.debug("Request for " + req.pathname + " received.");
    var payload = {
        content: util._extend({}, req.body),
        task: task};
    console.log(payload);
    if (g_messageHandler) {

        g_messageHandler.onMessage(payload, g_brokerConnector.getStatusChannel(), g_brokerConnector.getConnection(), 0);
        console.log("onMessage done!!");
      /*  g_brokerConnector.execute(payload);
        console.log("execution done!!");  */
        res.status(200).json({ message: 'sent to agent' });
    }
    else {
        res.status(500).json({ message: 'no agent' });
    }
});
routeHandler.post('/testframework/teststatus' , function(req, res) {
    return postTestStatus(req, res);
});
routeHandler.post('/testframework/stepstatus' , function(req, res) {
    return postStepStatus(req, res);
});
routeHandler.post('/testframework/testlist' , function(req, res) {
    return postStepStatus(req, res);
});
routeHandler.post('/testframework/stepstatus' , function(req, res) {
    return postStepStatus(req, res);
});



routeHandler.get('/testframework/teststatus', function(req, res) {
    return getTestStatus(req, res);
});
routeHandler.get('/testframework/stepstatus', function(req, res) {
    return getStepStatus(req, res);
});
routeHandler.get('/testframework/agentstatus', function(req, res) {
    return agentStatus(req, res);
});
routeHandler.get('/testframework/eikonversion', function(req, res) {
    return eikonVersion(req, res);
});
routeHandler.get('/testframework/screenshot', function(req, res) {
    return screenshot(req, res);
});
routeHandler.get('/testframework/testlist', function(req, res) {
    return getTestList(req, res);
});
routeHandler.get('/testdata/testuser', function(req, res) {
    return getTestData(req, res);
});
routeHandler.get('/mq/internalmessages', function(req, res) {
    return getInternalMessages(req, res);
});
routeHandler.get('/mq/internalmessage', function(req, res) {
    return getInternalMessages(req, res);
});
routeHandler.get('/mq/removemessage', function(req, res) {
    return removeMessage(req, res);
});
routeHandler.get('/mq/clearmessages', function(req, res) {
    return clearMessage(req, res);
});
routeHandler.get('/mq/clearmessage', function(req, res) {
    return clearMessage(req, res);
});


var testList = function(req, res, params) {
    var sep = ',';

    if ('ids' in params) {
        var ids = params.ids;
        if (ids) {
            var testLists = Array.isArray(ids) ? ids : ids.split(sep);
            testLists.forEach(function(test) {
                g_brokerConnector.sendStatus({
                    'testID': test, 'kind': 'Test', 'testMessage': '', 'testDescription': '', 'testStatus': 'Initial', status: 'Initial'
                });
            });
        }
    }
}

var getTestList = function(req, res) {
    testList(req, res, req.params);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(req.params));
}

var postTestList = function(req, res) {
    testList(req, res, req.body);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(req.body));
}

var m_retrialNB = 0;

var tryToStartAgain = function()
{
    m_retrialNB++;
    logger.debug("Restarting REST-API server : attempt#"+m_retrialNB);
    setTimeout(function(){
        start(g_brokerConnector);
    }, 1000 * m_retrialNB);
};

var error = function(text) {
    logger.error(text);
}

var l_deferredReturn = q.defer();

var start = function(brokerConnector) {
    var defer = q.defer();
    if (brokerConnector == null) {
        logger.error("Please provide a broker connector before starting the rest api.")
        return defer.reject();
    }
    else {
        g_brokerConnector = brokerConnector;
    }
    app.use('/', routeHandler);
    app.on('error', function(e) {
        if (e.code === "EADDRINUSE") { error("An other application is using the agent REST-API on port #"+global.agentPort+" !\nPerhaps another ETAPAgent is already running ?"); }
        else error("The ETAPAgent encountered the following error on its REST-API server : "+ e.message);

        try { app.close(); } catch(e){};
        tryToStartAgain();
    });

    app.listen(global.agentPort, function(err){
        if (err) return defer.reject();
        m_retrialNB = 0;
        logger.info('Express server [' + process.title + ':' + global.version + '] listening on port ' + global.agentPort);
        defer.resolve();
    });

    return defer.promise;
};

exports.start = start;
