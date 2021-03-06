/**
 * Created by JF on 12/10/13.
 */
"use strict";

var os=require('os');
var g_q = require("q");
g_q.longStackSupport = true;
var child_process = require('child_process');
var azure = require('azure');

var isGateway = (global.mode  === 'gateway');
var Connection = isGateway ? require('./Http').Connection : require('./Rabbitmq').Connection;
var executor = require('./executor');


var server = global.mqServer;
var heartbeats = global.heartbeats || 60;

var logger = global.logger;

var g_topicExchange = [global.applicationName,'topic'].join('.');
var g_topicQueue = [global.applicationName,global.agentHost].join('.');
var g_topicPattern = [global.applicationName,global.agentHost,'#'].join('.');

var g_statusQueue = 'etap.status';
var g_reportQueue = 'etap.report';



exports.BrokerConnector = function()
{
    this.getCurrentExecutionID = function (){
        if (m_executionMessage == null) {
            logger.debug("There is no current execution, unable to provide data");
            return null;
        }
        return m_executionMessage.executionID;
    };

    this.sendStatus = function(p_message)
    {
        logger.debug("sendStatus("+JSON.stringify(p_message)+")");
        p_message.hostName = global.agentHost;
        p_message.ip = m_agentIP;

        if (m_executionMessage == null) {
            logger.debug("There is no current execution, skipping sending status : "+JSON.stringify(p_message));
            return;
        }

        if (m_executionMessage.isDone) {
            // forcing every status to be log messages once execution is done.
            if (!("logMessage" in p_message)) {
                p_message.logMessage = "Message received after execution ended";
                p_message.logTitle = "Censored";
                p_message.logLevel = "INFO";
            }
        }

        if(!p_message.agentStatus)
        {
            p_message.agentStatus = "Running";
        }
        logger.debug("before populateStatusMessage", typeof m_executionMessage.populateStatusMessage);
        if (typeof m_executionMessage.populateStatusMessage === 'function')
            m_executionMessage.populateStatusMessage(p_message);

        logger.debug("before sendMessage",p_message);
        m_statusChannelWrapper.sendMessage(p_message);
        return p_message;
    };

    this.getStatusChannel = function() {
        return m_statusChannelWrapper;
    };

    this.takeScreenshot = function(screenshotName) {
        var l_deferredReturn = g_q.defer();

        if (m_executionMessage == undefined) {
            l_deferredReturn.reject("Unable to take screenshot : no running execution");
            return l_deferredReturn.promise;
        }

        if (m_executionMessage.directory == undefined) {
            l_deferredReturn.reject("Unable to take screenshot : no available execution directory");
            return l_deferredReturn.promise;
        }

        var screenshotCmd = {
            "scripts" : {},
            "directory" : m_executionMessage.directory
        };

        if (process.platform === 'win32') {
            screenshotCmd.scripts.run = __dirname + '\\..\\libs\\screenshot-cmd.exe -o "%ETAP_EXECUTION_DIR%\\screenshot-' + global.agentHost + '-' + screenshotName + '.png"';
        }
        else {
            //var l_deferredReturn = g_q.defer();
            l_deferredReturn.reject("Unable to take screenshot : no screenshot utility on UNIX(-like) systems is configured");
            return l_deferredReturn.promise;
        }

        executor.executeWithPreparatoryStep(function() {
            executor.executeWithETAPEnvironment(screenshotCmd).then(function onSuccess() {
                l_deferredReturn.resolve();
            }, function onFailure() {
                l_deferredReturn.reject();
            })
        });

        return l_deferredReturn.promise;
    };

    this.getStatus = function() {
        if (m_executionMessage == null) {
            return "Pending";
        }
        else {
            return "Executing " + m_executionMessage.executionID;
        }
    };

    this.updateInstanceInformation = function(p_chocolateyInstalledSoftwarePackages) {
        child_process.exec('reg.exe QUERY "HKLM\\SOFTWARE\\Microsoft\\Windows Azure\\BGInfo" /v PublicIp', function(error, stdout, stderr){
            if (!error) {
                var t = stdout.split(' ');
                m_agentIP = t[t.length - 1].trim();
                console.log('public ip: ['+ m_agentIP + ']');
            }
            /*
             azure.RoleEnvironment.isAvailable(function(error, available) {
             console.log('available' , available);
             if (available) {
             azure.RoleEnvironment.getConfigurationSettings(function(error, settings) {
             if (!error) {
             console.log('Azure settings', settings);
             }
             });
             }
             });
             */
            logger.debug("updateInstanceInformation("+JSON.stringify(p_chocolateyInstalledSoftwarePackages)+")");
            var instanceInformationMessage = {'hostName': global.agentHost, 'ip': m_agentIP, 'softs': p_chocolateyInstalledSoftwarePackages};
            m_reportChannelWrapper.sendMessage(instanceInformationMessage);
        });

    };

    this.execute = function(jobPayload){
        return executor.executeWithETAPEnvironment(jobPayload);
    };

    this.end = function()
    {
        m_connection.end();
    };

    this.start = function()
    {
        var l_deferredReturn = g_q.defer();

        m_connection.start().then(function() {
            //require("./utils/chocolatey/chocolatey-util.js").listPackages().then(function(listOfPackages) {
            self.updateInstanceInformation([] /*listOfPackages*/);
            l_deferredReturn.resolve();
            //});
        });

        return l_deferredReturn.promise;
    };

    var hacky;

    exports.hackyBackup = function() {
        hacky = m_executionMessage;
    };
    exports.hackyRestore = function(){
        m_executionMessage = hacky;
    };

    exports.sendExecutionStatus = function(p_message, p_executionMessage) {
        m_executionMessage = p_executionMessage;
        if (m_executionMessage) self.sendStatus(p_message);
    };

    this.getConnection = function() {
        return m_connection;
    };

    // constructor
    var m_connection = Connection(isGateway ? global.gatewayServer : global.mqServer, heartbeats),

        m_executionMessage = null,
    // New communication
        m_topicChannelWrapper = m_connection.createTopicListener(g_topicExchange, g_topicQueue,g_topicPattern),

        m_statusChannelWrapper = m_connection.createSender(g_statusQueue),
        m_reportChannelWrapper = m_connection.createSender(g_reportQueue),
        self = this,
        interfaces=os.networkInterfaces(),
        m_agentIP =  (function(){

            for (var interfaceIndex in interfaces) {
                for(var detailsIndex = 0; detailsIndex < interfaces[interfaceIndex].length; detailsIndex++ )
                {
                    var details = interfaces[interfaceIndex][detailsIndex];
                    if (details.family === 'IPv4' && details.address !== "127.0.0.1") {
                        return details.address;
                    }
                }
            }
        })();
    // end of constructor
};