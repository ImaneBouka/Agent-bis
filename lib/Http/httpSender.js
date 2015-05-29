/**
 * Created by u6028908 on 09/04/2015.
 */


var request = require('request');

var httpSender = function(server, queue) {
    var m_connection;

// -------------------------------------------------------------------
// Public functions
// -------------------------------------------------------------------
    this.setConnection = function (p_connection) {
        m_connection = p_connection;
    };

    this.close = function () {
        logger.debug("SendingChannelWrapper::close");
    };

    this.ack = function() {

    };

    this.sendMessage = function (p_message) {
        /*   if (silo) {
         silo.addJob(p_message);
         return;
         } */

        logger.debug('2SendingChannelWrapper::doSendMessage(', queue, ',', p_message, ')');

        var options = {
            url: server + '/' + queue,
            method: 'POST',
            json: true,
            body: p_message
        };

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


    };
};
module.exports = httpSender;