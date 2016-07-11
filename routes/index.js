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

function padLeadingSpace(num, size) {
    var s = num+"";
    while (s.length < size) s = ' ' + s;
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

function datetimeInChinese(datetime, offset) {
  datetime = new Date(datetime.getTime() + (datetime.getTimezoneOffset() + offset * 60) * 60 * 1000)
  var date_cn = "周" + dayInChinese(datetime.getDay())
  var hour = datetime.getHours()
  var time_prefix_cn = hour < 12 ? "上午" : "下午"
  if (hour < 8) time_prefix_cn = "早上"
  if (hour < 4) time_prefix_cn = "凌晨"
  if (hour > 17) time_prefix_cn = "晚上"
  hour = hour > 12 ? hour - 12 : hour
  hour = hour == 0 ? hour = 12 : hour
  var time_cn = time_prefix_cn + String(hour) + ":" + pad(datetime.getMinutes(), 2)
  if (datetime.getMinutes() == 0) {
    time_cn = time_prefix_cn + padLeadingSpace(hour, 2) + "点"
  }
  return {date:date_cn, time:time_cn}
}

function datetimeInEnglish(datetime) {
  var date_en = datetime.toDateString()
  var time_en = datetime.toLocaleTimeString()
  var datetime_en = date_en + ' ' + time_en
  return datetime_en
}

function getForecastItem(forecast, previousDate, timezoneOffset){
  var datetime = new Date(forecast.dt * 1000)
  var datetime_cn = datetimeInChinese(datetime, timezoneOffset)
  var temp_cn = ""
  if ('temp' in forecast) {
    temp_cn = Math.round(forecast.temp) + "°C"
  }
  var date_cn = (datetime_cn.date == previousDate) ? "" : datetime_cn.date
  return {date:date_cn, date_cn:datetime_cn.date, time:datetime_cn.time, temp:temp_cn, info:forecast.info}
}

function getForecasts(forecastLogFile, sun, timezoneOffset, onClose) {
  var forecasts = [];
  var previousDate = "";
  var currentSunIndex=0

  function pushForecast(forecast) {
    forecastItem = getForecastItem(forecast, previousDate, timezoneOffset)
    forecasts.push(forecastItem)
    previousDate = forecastItem.date_cn
  }

  readline.createInterface({
    input: fs.createReadStream(forecastLogFile),
    terminal: false
  }).on('line', function(line) {
    var forecast = JSON.parse(line)
    if (currentSunIndex < 2 && sun[currentSunIndex].dt < forecast.dt) {
      pushForecast(sun[currentSunIndex])
      ++currentSunIndex
    }
    pushForecast(forecast)
  }).on('close', function(){
    onClose(forecasts)
  });
};

function getSunriseAndSunset(logFile, timezoneOffset, onClose) {
  var sun = []
  fs.readFile(logFile, 'utf8', function (err, data) {
    if (err) {
      console.log(error)
      return
    }
    var weather = JSON.parse(data)
    sun.push({dt:weather.sys.sunrise, info:"日出"})
    sun.push({dt:weather.sys.sunset, info:"日落"})
    onClose(sun)
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

function requestForecast(city_id, done) {
  const exec = require('child_process').exec;
  var script = path.join(__dirname, '../bin', 'getForecast.sh');

  exec(`${script} ${city_id}`, (error, stdout, stderr) => {
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

function router_get(cityIndex, req, res) {
  var cityInfo = getCityInfoByIndex(cityIndex)
  var forecastLogFile = 'data/forecast' + cityInfo.id + '.log'
  var weatherLogFile = 'data/weather' + cityInfo.id + '.log'
  var accessLogFile = './access.log'
  var today = new Date()
  var req_log = datetimeInEnglish(today) + ' ' +
    getClientAddress(req) + ' ' + req.headers['user-agent']
  console.log(req_log)
  addLogToFile(req_log, accessLogFile)

  var timezoneOffset = cityInfo.timezoneOffset
  getSunriseAndSunset(weatherLogFile, timezoneOffset, function(sun){
    getForecasts(forecastLogFile, sun, timezoneOffset, function(forecasts) {
        var now_cn = datetimeInChinese(new Date(), timezoneOffset)
        var update_time = "更新于" + cityInfo.name + "时间" + now_cn.date + now_cn.time
        console.log(update_time)
        res.render('index', {forecasts:forecasts, update_time:update_time});
    });
  })

}

function timezoneOffsetByCityIndex(index) {
  var defaultOffset = 8 // Linghai
  switch (index) {
    case '0':
      return defaultOffset
    case '1':
      var datetime = new Date()
      return -datetime.getTimezoneOffset() / 60 // EDT
    default:
      return defaultOffset
  }
}
function getCityInfoByIndex(index) {
  var id = 2037913 // Linghai
  var timezoneOffset = 8
  var name = "凌海"
  switch (index) {
    case '0':
      break
    case '1':
      id = 4758390 // Falls Church
      var datetime = new Date()
      timezoneOffset = -datetime.getTimezoneOffset() / 60 // EDT
      name = "Falls Church"
    default:
      break
  }
  return {id:id, timezoneOffset:timezoneOffset, name:name}
}

function router_get_forecast(cityIndex, req, res) {
  var cityInfo = getCityInfoByIndex(cityIndex)
  requestForecast(cityInfo.id, function(){
    router_get(cityIndex, req, res)
  })
}
/* GET home page. */
router.get('/', function(req, res, next) {
  router_get_forecast(0, req, res)
});

router.get('/:index', function(req, res, next) {
  router_get_forecast(req.params.index, req, res)
});

module.exports = router;
