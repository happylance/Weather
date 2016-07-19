var express = require('express');
var router = express.Router();
var fs = require('fs')
var readline = require('readline');
var path = require('path');
var beaufort = require('beaufort')
var request = require("request")

var options = {unit: 'mps', getName: false};
var error_prefix = '对不起，出错了，请重试。如果一直不好，需要等亮来修。'
var wind_directions = ['北', '东北偏北', '东北','东北偏东',
    '东', '东南偏东','东南', '东南偏南',
    '南','西南偏南', '西南', '西南偏西',
    '西', '西北偏西', '西北', '西北偏北']
function getWindDirectionName(windBearing) {
  var windIndex = (Math.floor((windBearing + 11.25) / 22.5) % 16)
  return wind_directions[windIndex] + '风'
}

function getEDTTimezoneOffset() {
  var datetime = new Date()
  return -datetime.getTimezoneOffset() / 60 // EDT
}
function getCNTimezoneOffset() {
  return 8
}
var cities = [{id:"41.059204,121.6055323",name:"巧女",source:1,timezoneOffset:getCNTimezoneOffset},
    {id:"41.095317,121.3422523",name:"凌海1",source:1,timezoneOffset:getCNTimezoneOffset},
    {id:"41.312864,122.3147513",name:"盘山1",source:1,timezoneOffset:getCNTimezoneOffset},
    {id:2037913,name:"凌海",source:0,timezoneOffset:getCNTimezoneOffset},
    {id:2035513,name:"盘山",source:0,timezoneOffset:getCNTimezoneOffset},
    {id:4758390,name:"FC",source:0,timezoneOffset:getEDTTimezoneOffset},
    {id:"38.91607726,-77.20676137",name:"CD",source:1,timezoneOffset:getEDTTimezoneOffset}]

var days_cn = ["日","一","二","三","四","五","六"]
function dayInChinese(day) {
  return days_cn[day]
}

var forecast_summary = {'Overcast':"阴",
    'Drizzle':"细雨",
    'Overcast':"阴",
    'Light Rain':"小雨",
    'Clear':"晴",
    'Partly Cloudy':"少云",
    'Mostly Cloudy':"多云",
    'Rain':"中雨",
    'Heavy Rain':"大雨",
    'Light Sleet':"小雨夹雪",
    'Sleet':"雨夹雪",
    'Heavy Sleet':"大雨夹雪",
    'Foggy':"雾",
    'Light Snow':"小雪",
    'Snow':"中雪",
    'Heavy Snow':"大雪"
  }

var source_url_prefix_1 = ""
var source_url_key_1 = ""
fs.readFile(process.env['HOME'] + '/.forecast_io', 'utf8', function (err, data) {
  if (err) {
    console.log(err)
    res.send(error_prefix + err);
    return
  }
  source_url_key_1 = data.split('\n')[0];
  source_url_prefix_1 = "https://api.forecast.io/forecast/" + source_url_key_1 + "/"
})

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
  var time_cn = String(hour) + ":" + pad(datetime.getMinutes(), 2)
  if (datetime.getMinutes() == 0) {
    time_cn = padLeadingSpace(hour, 2) + "点"
  }
  return {date:date_cn, time_prefix:time_prefix_cn, time:time_cn}
}

function datetimeInEnglish(datetime) {
  var date_en = datetime.toDateString()
  var time_en = datetime.toLocaleTimeString()
  var datetime_en = date_en + ' ' + time_en
  return datetime_en
}

function getForecastItem(forecast, previousDate, previousTimePrefix, timezoneOffset){
  var datetime = new Date(forecast.dt * 1000)
  var datetime_cn = datetimeInChinese(datetime, timezoneOffset)
  var temp_cn = ""
  if ('temp' in forecast) {
    temp_cn = Math.round(forecast.temp) + "°C"
  }

  var wind_cn = ""
  if ('wind_s' in forecast && 'wind_d' in forecast) {
    var level = beaufort(forecast.wind_s, options)
    if (level > 2) {
      wind_cn = level + "级" + getWindDirectionName(forecast.wind_d)
    }
  }

  var date_cn = (datetime_cn.date == previousDate) ? "" : datetime_cn.date
  var time_prefix_cn = (datetime_cn.time_prefix == previousTimePrefix) ? "" : datetime_cn.time_prefix
  var simple_datetime = {date:date_cn, time_prefix:time_prefix_cn, time:datetime_cn.time}
  return {simple_datetime:simple_datetime, datetime:datetime_cn, temp:temp_cn, info:forecast.info, wind:wind_cn}
}

function getForecasts(forecastLogFile, sun, timezoneOffset, onClose) {
  var forecasts = [];
  var previousDate = ""
  var previousTimePrefix = ""
  var currentSunIndex=0

  function pushForecast(forecast) {
    forecastItem = getForecastItem(forecast, previousDate, previousTimePrefix, timezoneOffset)
    forecasts.push(forecastItem)
    previousDate = forecastItem.datetime.date
    previousTimePrefix = forecastItem.datetime.time_prefix
  }

  readline.createInterface({
    input: fs.createReadStream(forecastLogFile),
    terminal: false
  }).on('line', function(line) {
    var forecast = JSON.parse(line)
    while (currentSunIndex < 2 && sun[currentSunIndex].dt < forecast.dt) {
      pushForecast(sun[currentSunIndex])
      ++currentSunIndex
    }
    pushForecast(forecast)
  }).on('close', function(){
    onClose(forecasts)
  });
};

function getSunriseAndSunset(logFile, timezoneOffset, res, onClose) {
  var sun = []
  fs.readFile(logFile, 'utf8', function (err, data) {
    if (err) {
      console.log(err)
      res.send(error_prefix + err);
      return
    }
    var weather = JSON.parse(data)
    if (! ('sys' in weather)) {
      var err = 'Cannot find sys in weather.' + data
      console.log(err)
      res.send(error_prefix + err);
      return
    }
    sun.push({dt:weather.sys.sunrise, info:"日出"})
    sun.push({dt:weather.sys.sunset, info:"日落"})
    onClose(sun)
  });
};

// Get client IP address from request object ----------------------
getClientAddress = function (req) {
  var addr =  (req.headers['x-forwarded-for'] || '').split(',')[0] || req.connection.remoteAddress;
  addr = addr.replace(/::ffff:/, '')
  console.log(addr)
  return addr
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
  var timezoneOffset = cityInfo.timezoneOffset()
  getSunriseAndSunset(weatherLogFile, timezoneOffset, res, function(sun){
    getForecasts(forecastLogFile, sun, timezoneOffset, function(forecasts) {
        render(forecasts, cityIndex, res)
    });
  })

}

function render(forecasts, cityIndex, res) {
  var cityInfo = getCityInfoByIndex(cityIndex)
  var timezoneOffset = cityInfo.timezoneOffset()
  console.log(timezoneOffset);
  var now_cn = datetimeInChinese(new Date(), timezoneOffset)
  var update_time = "更新于" + cityInfo.name + "时间" + now_cn.date + now_cn.time
  console.log(update_time)

  var tab_count = cities.length
  var titles = []
  for (var i = 0; i < tab_count; i++) {
      titles.push(getCityInfoByIndex(String(i)).name)
  }
  var source = cityInfo.source
  res.render('index', {forecasts:forecasts, update_time:update_time, currentURL:"/" + cityIndex, titles:titles, source:source});
}

function getForecastItem2(forecast, previousDate, previousTimePrefix, timezoneOffset){
  var datetime = new Date(forecast.time * 1000)
  var datetime_cn = datetimeInChinese(datetime, timezoneOffset)
  var temp_cn = ""
  if ('temperature' in forecast) {
    temp_cn = Math.round((forecast.temperature - 32) * 5 / 9) + "°C"
    if (timezoneOffset == -4) {
      temp_cn = Math.round(forecast.temperature) + "°F" + temp_cn
    }
  }

  var info_cn = ""
  if ('summary' in forecast) {
    var summary = forecast.summary
    if (summary in forecast_summary) {
      info_cn = forecast_summary[summary]
    } else {
      console.log(forecast.summary)
    }
  }

  if ('precipProbability' in forecast) {
    var precipProbability = Math.round(forecast.precipProbability*100)
    if (precipProbability >= 20) {
      info_cn = info_cn + precipProbability + '%'
      if ('precipIntensity' in forecast) {
        var precipIntensity = Math.round(forecast.precipIntensity*25.4)
        if (precipIntensity > 0) {
          info_cn = info_cn + precipIntensity + 'mm'
        }
      }
    }
  }
  var wind_cn = ""
  if ('windSpeed' in forecast) {
    var level = beaufort(forecast.windSpeed * 1.6 / 3.6, options)
    if (level > 2) {
      if ('windBearing' in forecast) {
        wind_cn = level + "级" + getWindDirectionName(forecast.windBearing)
      } else {
        wind_cn = level + "级风"
      }
    }
  }
  var date_cn = (datetime_cn.date == previousDate) ? "" : datetime_cn.date
  var time_prefix_cn = (datetime_cn.time_prefix == previousTimePrefix) ? "" : datetime_cn.time_prefix
  var simple_datetime = {date:date_cn, time_prefix:time_prefix_cn, time:datetime_cn.time}
  return {simple_datetime:simple_datetime, datetime:datetime_cn, temp:temp_cn, info:info_cn, wind:wind_cn}
}

function renderJson2(data, cityIndex, res) {
  var forecasts = []
  var previousDate = "";
  var previousTimePrefix = ""
  var timezoneOffset = getCityInfoByIndex(cityIndex).timezoneOffset()

  function pushForecast(forecast) {
    forecastItem = getForecastItem2(forecast, previousDate, previousTimePrefix, timezoneOffset)
    forecasts.push(forecastItem)
    previousDate = forecastItem.datetime.date
    previousTimePrefix = forecastItem.datetime.time_prefix
  }

  var weather = data
  if (! ('hourly' in weather)) {
    var err = 'Cannot find hourly in weather.' + data
    console.log(err)
    res.send(error_prefix + err);
    return
  }
  if (! ('data' in weather.hourly)) {
    var err = 'Cannot find data in weather.hourly.'
    console.log(err)
    res.send(error_prefix + err);
    return
  }

  var data = weather.hourly.data
  for (var i = 0; i < data.length; i++) {
    var forecast = data[i]
    pushForecast(forecast)
  }

  render(forecasts, cityIndex, res)
}
function router_get_forecast2(cityIndex, req, res) {
  var cityInfo = getCityInfoByIndex(cityIndex)

  request({
    url: source_url_prefix_1 + cityInfo.id,
    json: true
  }, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      renderJson2(body, cityIndex, res)
    } else {
      console.log(error)
      res.send(error_prefix + error + response.statusCode);
    }
  })

  return

  var logFile = (+cityIndex == 0) ? 'data/qn.log' : 'data/fc.log'
  fs.readFile(logFile, 'utf8', function (err, data) {
    if (err) {
      console.log(err)
      res.send(error_prefix + err);
      return
    }
    renderJson2(data, cityIndex, res)
  });
}

function getCityInfoByIndex(index) {
  return cities[index]
}

function router_get_forecast(cityIndex, req, res) {
  var cityInfo = getCityInfoByIndex(cityIndex)
  var accessLogFile = './access.log'
  var today = new Date()
  var user_agent = req.headers['user-agent']
  user_agent = user_agent.replace(/Mozilla\/5\.0 \(/, "")
  user_agent = user_agent.replace(/like Mac OS X\) AppleWebKit\/601\.1\.46 \(KHTML, like Gecko\) Mobile\/13F69/, "")
  user_agent = user_agent.replace(/; CPU.*OS/, "")
  var req_log = datetimeInEnglish(today) + ' ' + cityIndex + ' ' + getClientAddress(req) + ' ' + user_agent
  console.log(req_log)
  addLogToFile(req_log, accessLogFile)

  var cityInfo = getCityInfoByIndex(cityIndex)
  if (cityInfo.source == 1) {
    router_get_forecast2(cityIndex, req, res)
    return
  }
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
