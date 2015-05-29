/**
 * Created by Natthakorn on 12/03/14.
 */
var exec = require('child_process').exec;
var q = require('q');
var os = require('os');

exports.listPackages = function() {
    var defer = q.defer();
    var packages = [];

    var command = exec('chocolatey list -lo', function(error, stdout, stderr) {
        /*
        console.log('#stdout[' + (typeof stdout) + ']="' + stdout + '"');
        console.log('#stderr[' + (typeof stderr) + ']="' + stderr + '"');
        if (error !== null) {
            onsole.log('#error[' + (typeof error) + ']="' + error + '"');
        }
        */
    });
    command.stdin.end();

    command.stdout.on('data', function(data) {
        var lines = data.trim(os.EOL).split(os.EOL);
        lines.forEach(function(line) {
            line = line.trim(os.EOL);
            var e = /^\s*([A-Za-z0-9\.\-_]+)\s+(\d+(\.\d+)+)\s*$/;
            var match = line.match(e);
            if (match && (match.length >= 3)) {
                packages.push({name: match[1], kind: 'software-chocolatey', version: match[2]});
            }
        });
    });

    command.on('error', function(err) {
        defer.resolve(packages);
    });

    command.on('exit', function(code) {
        defer.resolve(packages);
    });

    return defer.promise;
};