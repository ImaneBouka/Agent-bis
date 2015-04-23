/**
 * Created by u6028908 on 09/04/2015.
 */

var fs = require('fs');
var request = require('request');
var options = {
    url: 'http://164.57.193.11:5671/api',
    method: 'POST',
    json: true,
    body: {titi: 1}
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

