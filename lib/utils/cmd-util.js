/**
 * Created by u0150986 on 8/5/2014.
 */
var exec = require('child_process').exec;
var q    = require('q');

var executeCMD = function(cmd) {
    var q_defer = q.defer();
    var command;
    var output = [];

    command = exec(cmd);

    command.stdout.on('data', function(out) {
        output.push(out);
    })

    command.on('error', function(err) {
        q_defer.reject('');
    })

    command.on('exit', function(code) {
        if (output.length == 0)
            q_defer.resolve('');
        else
            q_defer.resolve(output.join('\r\n'));
    })

    return q_defer.promise;
}

var executeMultipleCMD = function(cmdMap) {
    /* Input:  [{name: '', cmd: ''}, ...]
       Output: [{name: '', cmd: '', message: ''}, ...] */
    var q_defer = q.defer();
    var execArray = [];
    var outputArray = [];
    var i;

    for (i = 0; i < cmdMap.length; i++) {
        execArray.push(executeCMD(cmdMap[i].cmd));
    }

    q.all(execArray).then(function(results) {
        for (i = 0; i < results.length; i++) {
            outputArray.push({name: cmdMap[i].name, cmd: cmdMap[i].cmd, message: results[i]});
        }
        q_defer.resolve(outputArray);
    });

    return q_defer.promise;
}

module.exports = {
    executeCMD: executeCMD,
    executeMultipleCMD: executeMultipleCMD
};
