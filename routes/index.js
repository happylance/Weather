var express = require('express');
var router = express.Router();
var fs = require('fs')
var readline = require('readline');
var path = require('path');

function pad(num, size) {
    var s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
}

function dayInChinese(day) {
  switch(day){
    case 0:
        return "日";
    case 1:
        return "一";
    case 2:
        return "二";
    case 3:
        return "三";
    case 4:
        return "四";
    case 5:
        return "五";
    case 6:
        return "六";
    default:
        return "";
  }
}

function datetimeInChinese(datetime) {
  datetime = new Date(datetime.getTime() + (datetime.getTimezoneOffset() + 8 * 60) * 60 * 1000)
  var date_cn = "周" + dayInChinese(datetime.getDay())
  var hour = datetime.getHours()
  var time_prefix_cn = hour < 12 ? "上午" : "下午"
  if (hour < 8) time_prefix_cn = "早上"
  if (hour < 4) time_prefix_cn = "凌晨"
  if (hour > 17) time_prefix_cn = "晚上"
  hour = hour > 12 ? hour - 12 : hour
  hour = hour == 0 ? hour = 12 : hour
  var time_cn = time_prefix_cn + String(hour) + ":" + pad(datetime.getMinutes(), 2)
  var datetime_cn = date_cn + time_cn
  return datetime_cn
}

function datetimeInEnglish(datetime) {
  var date_en = datetime.toDateString()
  var time_en = datetime.toLocaleTimeString()
  var datetime_en = date_en + ' ' + time_en
  return datetime_en
}

function getForecasts(logFile, onClose) {
  var forecasts = [];
  readline.createInterface({
    input: fs.createReadStream(logFile),
    terminal: false
  }).on('line', function(line) {
    var forecast = JSON.parse(line)
    var datetime = new Date(forecast.dt * 1000)
    var datetime_cn = datetimeInChinese(datetime)
    var temp_cn = "气温" + forecast.temp + "°C"
    console.log(datetime_cn + temp_cn)
    forecasts.push({time:datetime_cn, temp:temp_cn, info:forecast.info})
  }).on('close', function(){
    onClose(forecasts)
  });
};

// Get client IP address from request object ----------------------
getClientAddress = function (req) {
        return (req.headers['x-forwarded-for'] || '').split(',')[0]
          || req.connection.remoteAddress;
};

function addLogToFile(req_log, accessLogFile) {
  fs.appendFile(accessLogFile, '\n' + req_log, function (err) {
    if (err) {
      console.log(err)
    }
  });

  var today = new Date()
  function isLessThan3DaysOld(log) {
    var time = log.split(' ').slice(0,5)
    var datetime = new Date(time)
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
                console.log (err);
            }
        });
    } else {
        console.log(err);
    }
  });
}

function requestForecast(done) {
  const exec = require('child_process').exec;
  var script = path.join(__dirname, '../bin', 'getForecast.sh');

  exec(`${script}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return;
    }
    if (stdout) {
      console.log(`stdout: ${stdout}`);
    }
    if (stderr){
      console.log(`stderr: ${stderr}`);
    }
    done()
 });
}

function router_get(req, res) {
  var weatherLogFile = 'data/forecast.log'
  var accessLogFile = './access.log'
  var today = new Date()
  var req_log = datetimeInEnglish(today) + ' ' +
    getClientAddress(req) + ' ' + req.headers['user-agent']
  console.log(req_log)
  addLogToFile(req_log, accessLogFile)

  getForecasts(weatherLogFile, function(forecasts) {
      var now_cn = datetimeInChinese(new Date())
      var update_time = "更新于北京时间" + now_cn
      var today_day = today.getDay()
      var tab_count = 7
      var titles = []
      for (var i = 0; i < tab_count; i++) {
          var day = today_day - i
          if (day < 0) day += 7
          var day_cn = "周" + dayInChinese(day)
          titles.push(day_cn)
      }
      console.log(update_time)
      res.render('index', {forecasts:forecasts, update_time:update_time});
    });
}

/* GET home page. */
router.get('/', function(req, res, next) {
  requestForecast(function(){
    router_get(req, res)
  })
});

module.exports = router;
