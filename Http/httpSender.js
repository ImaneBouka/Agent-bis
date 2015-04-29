/**
 * Created by u6028908 on 09/04/2015.
 */

var fs = require('fs');
var request = require('request');

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
        var p_message = options.body;
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