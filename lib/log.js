exports = module.exports = {}
var fs = require('fs')
var readline = require('readline');
var moment = require('moment')

const accessLogFile = __dirname + '/../access.log'
const output = fs.createWriteStream(accessLogFile, {'flags': 'a'});
const dateFormat = "YYYY-MM-DD HH:mm"

// Get client IP address from request object ----------------------
_getClientAddress = function (req) {
  var addr =  (req.headers['x-forwarded-for'] || '').split(',')[0] || req.connection.remoteAddress;
  addr = addr.replace(/::ffff:/, '')
  console.log(addr)
  return addr
};

function _addLog(req_log) {
  fs.appendFile(accessLogFile, '\n' + req_log, function (err) {
    if (err) {
      console.log(err)
    } else {
      console.log('Added \"' + req_log + '\" to ' + accessLogFile)
    }
  });

  var today = new Date()
  function isLessThan3DaysOld(log) {
    var time = log.split(' ').slice(0,5)
    var datetime = new Date(time)
    if (datetime == 'Invalid Date') {
      time = log.split(' ').slice(0,1)
      datetime = moment(time, dateFormat).toDate()
    }
    return datetime.getTime() > (today - 3 * 86400 * 1000)
  }

  fs.readFile(accessLogFile, function(err, data) { // read file to memory
    if (!err) {
        data = data.toString(); // stringify buffer
        var accessLogs = data.split('\n')
        var recentAccessLogs = accessLogs.filter(isLessThan3DaysOld)
        if (accessLogs.length == recentAccessLogs.length) {
          return
        }
        var newLog = recentAccessLogs.join('\n')
        fs.writeFile(accessLogFile, newLog, function(err) { // write file
            if (err) { // if error, report
              console.log(err);
            }
        });
    } else {
        console.log(err);
    }
  });
}

function addAccessLog(req, tab_id) {
  var user_agent = req.headers['user-agent']
  var version = user_agent.match(/[0-9]*_[0-9]*_[0-9]*/)
  console.log("user_agent:" + user_agent)
  user_agent = user_agent.replace(/;.*/, "")
  user_agent = user_agent.replace(/.*\(/, "")
  user_agent = user_agent + ' ' + version

  var now = moment().format(dateFormat)
  var req_log = now + ' ' + String(tab_id) + ' ' + _getClientAddress(req) + ' ' + user_agent
  _addLog(req_log)
}

exports.addAccessLog = addAccessLog
