/**
 * Created by u0150986 on 8/5/2014.
 */
var executeMultipleCMD = require('./cmd-util').executeMultipleCMD;
var q = require('q');

var checkMachineHealth = function() {
    var cmdArray, sharedDrive;
    var q_defer = q.defer();

    sharedDrive = global.sharedDrive || 'f:';

    cmdArray = [
        {name: 'agentstatus', cmd: sharedDrive + '\\install\\curl.exe http://localhost:3000/testframework/agentstatus'},
        {name: 'vmtools', cmd: 'sc query "vmtools" | find "RUNNING"'},
        {name: 'tvnserver', cmd: 'sc query "tvnserver" | find "RUNNING"'},
        {name: 'vpnagent', cmd: 'sc query "vpnagent" | find "RUNNING"'}
    ]

    executeMultipleCMD(cmdArray).then(function(results) {
        results.forEach(function(result) {
            result.status = (!result.message) ? false : true;
        });
        q_defer.resolve({MachineHealth: results});
    })
    return q_defer.promise;
}

module.exports = checkMachineHealth;

checkMachineHealth().then(function(results) {
    console.log(results);
});