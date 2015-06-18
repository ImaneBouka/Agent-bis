// SystemHandler object
var SystemHandler = function(broker, executor, channel, logger) {
    //private member
    var m_broker = broker;
    var m_logger = logger;
    var m_executor = executor;
    var m_channel = channel;

    //private function
    function setChannel(channel) {
        m_channel = channel;
    }

    //private function
    function onMessage(p_payload) {
        m_logger.info('[s]system handler executing', p_payload.content);
        m_executor.executeWithPreparatoryStep(doOnMessage, p_payload);
    };

    //private function
    function doOnMessage(p_payload) {
        m_logger.info('[s]system handler doOnMessage', p_payload.content);
        var l_executionMessage = p_payload.content;
        if (l_executionMessage.scripts.runNewAgent) {
            l_executionMessage.scripts.run = l_executionMessage.scripts.runNewAgent;
        }
        var l_executionAcknowledgmentMessage = {
            executionID: l_executionMessage.executionID,
            agentStatus: 'Cancelled',
            deliveryTag: l_executionMessage._tag
        };
        if (m_broker) {
            m_logger.info('[s]system handler sending Cancelled status');
            m_broker.sendExecutionStatus(l_executionAcknowledgmentMessage, l_executionMessage);
        }

        m_logger.info('[s]system handler executeWithETAPEnvironment', l_executionMessage);
        m_executor.executeWithETAPEnvironment(l_executionMessage)
            .then(function onSuccess() {
                m_logger.info('[s]system handler executeWithETAPEnvironment done');
            }, function onError() // We should do something specific onError later
            {
                m_logger.error("Error inside doOnMessageSystemQueue");
            }).then(null, function (error) {
                m_logger.error("Error inside doOnMessageSystemQueue : " + error.stack);
            });
    }


    // public function
    return {
        onMessage : onMessage,
        setChannel : setChannel
    }
}
//public constructor
module.exports = SystemHandler;