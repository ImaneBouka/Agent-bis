/**
 * Created by u6028908 on 09/04/2015.
 */

var fs = require('fs');
var request = require('request');
var body = require('../Http/httpSender');


var httpSender = function(p_queue) {
    this.qq = p_queue;
    var m_channel = null,
        m_connection,
        m_queue = p_queue;

    var options = {
        url: 'http://164.57.193.11:5671/report',
        method: 'POST',
        json: true,
        body: {titi: 1}
    };
// -------------------------------------------------------------------
// Private functions
// -------------------------------------------------------------------

    request(options, function (error, response, body) {
        if (error)
            console.error(error);
        else {
            console.log(response.statusCode);
            if (response.statusCode == 200) {
                console.log(body)
            }
        }
    });

    var createChannel = function()
    {
        logger.debug("SendingChannelWrapper::createChannelAndSendMessage("+m_queue+")");
        if (m_connection) {
            m_connection.createConfirmChannel().then(function finalizeChannelCreation(p_channel){

                p_channel.on("close", function(){
                    logger.info("closed the channel : " + m_queue);
                    m_channel = null;
                    createChannel();
                });

                p_channel.on("error", function(err){
                    logger.error("Error on the channel : " + m_queue + " " + err);
                });

                p_channel.assertQueue(m_queue, {durable: true})
                    .then(function() {
                        m_channel = p_channel;

                        body.sendMessage();
                    });
            });
        }
    };

    var closeChannel = function() {
        if (m_channel != null)
            try {
                m_channel.close();
                m_channel = null;
            } catch (e)
            {
                logger.error("caught error while closing channel: "+ e.stack);
            }
        else logger.error("tried to close null channel !!!");
    };
// -------------------------------------------------------------------
// Public functions
// -------------------------------------------------------------------
    this.setConnection = function (p_connection) {
        m_connection = p_connection;

        closeChannel();

        createChannel(m_queue);
    };

    this.close = function () {
        logger.debug("SendingChannelWrapper::close");
        if (m_channel) {
            try {
                logger.debug("SendingChannelWrapper::m_channel.close()");
                m_channel.close();
            } catch (e) {
                logger.error("caught error while closing channel: " + e.stack);
            }
            m_channel = null;
        }
    };

    this.sendMessage = function (p_message) {
        /*   if (silo) {
         silo.addJob(p_message);
         return;
         } */
        var p_message = body;
        var str_message = JSON.stringify(p_message);

        logger.debug("2SendingChannelWrapper::doSendMessage(" + m_queue + "," + str_message + ")");

        var p_channel = m_channel;

        if (p_channel) {

            logger.debug("2Sending message : " + str_message);
            p_channel.on('drain', function () {
                logger.error("2drain : could not send message : " + str_message);
            });
            if (p_channel.sendToQueue(m_queue, new Buffer(str_message), {
                    persistent: true,
                    contentType: 'application/json'
                }))
                logger.debug("2sent successfully " + str_message);

        } else logger.debug("2Ignoring message : " + str_message); // TODO SILO !!!

    };
};
module.exports = httpSender;