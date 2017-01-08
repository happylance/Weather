exports = module.exports = {}

var fs = require('fs')
var readline = require('readline');
var path = require('path');
var dateUtil = require('../lib/dateUtil')
var cities = require('../lib/cities')
var weather = require('../lib/weather')
var addAccessLog = require('../lib/log').addAccessLog
var forecast_io = require('../lib/forecast_io')

function datetimeInChinese(datetime, offset) {
  return dateUtil.datetimeInChinese(datetime, offset, false)
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
    wind_cn = weather.getWind(forecast.wind_s, forecast.wind_d)
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

function getSunriseAndSunset(logFile, timezoneOffset, handleResult, onClose) {
  var sun = []
  fs.readFile(logFile, 'utf8', function (err, data) {
    if (err) {
      handleResult(err, "")
      return
    }
    var weather = JSON.parse(data)
    if (! ('sys' in weather)) {
      var err = 'Cannot find sys in weather.' + data
      handleResult(err, "")
      return
    }
    sun.push({dt:weather.sys.sunrise, info:"日出"})
    sun.push({dt:weather.sys.sunset, info:"日落"})
    onClose(sun)
  });
};

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

function router_get(cityIndex, handleResult) {
  var cityInfo = getCityInfoByIndex(cityIndex)
  var forecastLogFile = 'data/forecast' + cityInfo.id + '.log'
  var weatherLogFile = 'data/weather' + cityInfo.id + '.log'
  var timezoneOffset = cityInfo.timezoneOffset()
  getSunriseAndSunset(weatherLogFile, timezoneOffset, handleResult, function(sun){
    getForecasts(forecastLogFile, sun, timezoneOffset, function(forecasts) {
      handleResult("", {forecasts:forecasts, daily:""})
    });
  })

}

function getTemperatureInC(temperature) {
  return Math.round((temperature - 32) * 5 / 9)
}

function getCityInfoByIndex(index) {
  return cities[index]
}

function getForecast(cityIndex, handleResult) {
  var cityInfo = getCityInfoByIndex(cityIndex)
  requestForecast(cityInfo.id, function(){
    router_get(cityIndex, handleResult)
  })
}

exports.getForecast = getForecast
