exports = module.exports = {}
var fs = require('fs')
var readline = require('readline');
var path = require('path');
var request = require("request")
var dateUtil = require('../lib/dateUtil')
var cities = require('../lib/cities')
var weather = require('../lib/weather')

const urlPrefix = "https://api.darksky.net/forecast/"

function getKey() {
  var data = fs.readFileSync(process.env['HOME'] + '/.forecast_io', 'utf8')
  return data.split('\n')[0];
}

function getUrlPrefixWithKey() {
  var key = getKey()
  if (key.length > 0) {
    return urlPrefix + key + "/"
  }
  return ""
}

var urlPrefixWithKey = getUrlPrefixWithKey()

function datetimeInChinese(unix_time, timezone) {
  return dateUtil.datetimeInChinese(unix_time, timezone, false)
}

function getTemperatureInC(temperature) {
  return Math.round((temperature - 32) * 5 / 9)
}

function getWind(forecast) {
  var wind_cn = ""
  if ('windSpeed' in forecast) {
    speed = forecast.windSpeed * 1.6 / 3.6
    direction = ('windBearing' in forecast) ? forecast.windBearing : ""
    wind_cn = weather.getWind(speed, direction)
  }
  return wind_cn
}

function getSummary(forecast) {
  return ('summary' in forecast) ? weather.getSimpleSummary(forecast.summary) : ""
}

function getTemperature(forecast) {
  return ('temperature' in forecast) ?
    getTemperatureInC(forecast.temperature) + "°C" : ""
}

function getForecastItem(forecast, previousDate, previousTimePrefix, timezoneOffset, timezone){
  var datetime_cn = datetimeInChinese(forecast.time, timezone)
  var temp_cn = getTemperature(forecast)
  if (temp_cn.length > 0 && timezoneOffset <= -4) {
    temp_cn = temp_cn + Math.round(forecast.temperature) + "°F"
  }

  var info_cn = getSummary(forecast)

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
  var wind_cn = getWind(forecast)
  var date_cn = (datetime_cn.date == previousDate) ? "" : datetime_cn.date
  var time_prefix_cn = (datetime_cn.time_prefix == previousTimePrefix) ? "" : datetime_cn.time_prefix
  var simple_datetime = {date:date_cn, time_prefix:time_prefix_cn, time:datetime_cn.time}
  return {simple_datetime:simple_datetime, datetime:datetime_cn, temp:temp_cn, info:info_cn, wind:wind_cn}
}

function getForecastItemDaily(forecast, previousDate, previousTimePrefix, timezoneOffset, timezone){
  var datetime_cn = datetimeInChinese(forecast.time, timezone)

  var info_cn = getSummary(forecast)

  var temp_cn = ""
  if ('temperatureMin' in forecast && 'temperatureMax' in forecast) {
    var temp_min = getTemperatureInC(forecast.temperatureMin)
    var temp_max = getTemperatureInC(forecast.temperatureMax)
    temp_cn = temp_min + '～' + temp_max + "°C"
  }

  var additional_info = ""
  if ('precipProbability' in forecast) {
    var precipProbability = Math.round(forecast.precipProbability*100)
    if (precipProbability >= 20) {
      additional_info = additional_info + precipProbability + '%'
      if ('precipIntensityMax' in forecast && 'precipIntensityMaxTime' in forecast) {
        var precipIntensity = Math.round(forecast.precipIntensityMax*25.4)
        if (precipIntensity > 0) {
          var maxTime = dateUtil.datetimeInChinese(forecast.precipIntensityMaxTime, timezone, true)
          additional_info = additional_info + maxTime.time_prefix + maxTime.time + '最大' + precipIntensity + 'mm'
        }
      }
    }
  }
  var wind_cn = getWind(forecast)
  if (wind_cn.length > 0) {
    if (additional_info == "") {
      additional_info = wind_cn
    } else {
      additional_info = additional_info + ' ' + wind_cn
    }
  }

  var sun_info = ""
  if ('sunriseTime' in forecast && 'sunsetTime' in forecast) {
    var sunriseTime = dateUtil.datetimeInChinese(forecast.sunriseTime, timezone, true)
    var sunsetTime = dateUtil.datetimeInChinese(forecast.sunsetTime, timezone, true)
    sun_info = '🌅' + sunriseTime.time + ' 🌆' + sunsetTime.time
  }

  var simple_datetime = {date:datetime_cn.date}
  return {simple_datetime:simple_datetime, datetime:datetime_cn, temp:temp_cn,
    info:info_cn, additional_info:additional_info, sun_info:sun_info}
}


function renderJson(data, cityIndex, handleResult) {
  var forecasts = []
  var dailyForecasts = []
  var previousDate = "";
  var previousTimePrefix = ""

  var weather = data
  if (! ('offset' in weather)) {
    var err = 'Cannot find timezone offset in server response.' + data
    handleResult(err, "")
    return
  }
  var timezoneOffset = weather.offset
  var timezone = weather.timezone

  function pushForecast(forecast) {
    forecastItem = getForecastItem(forecast, previousDate, previousTimePrefix, timezoneOffset, timezone)
    forecasts.push(forecastItem)
    previousDate = forecastItem.datetime.date
    previousTimePrefix = forecastItem.datetime.time_prefix
  }

  function pushDailyForecast(forecast) {
    forecastItem = getForecastItemDaily(forecast, previousDate, previousTimePrefix, timezoneOffset, timezone)
    dailyForecasts.push(forecastItem)
    previousDate = forecastItem.datetime.date
    previousTimePrefix = forecastItem.datetime.time_prefix
  }

  if (! ('hourly' in weather)) {
    var err = 'Cannot find hourly in weather.' + data
    handleResult(err, "")
    return
  }
  if (! ('data' in weather.hourly)) {
    var err = 'Cannot find data in weather.hourly.'
    handleResult(err, "")
    return
  }

  var data = weather.hourly.data
  for (var i = 0; i < data.length; i++) {
    var forecast = data[i]
    pushForecast(forecast)
  }

  if (('daily' in weather) && ('data' in weather.daily)) {
    var data = weather.daily.data
    for (var i = 0; i < data.length; i++) {
      var forecast = data[i]
      pushDailyForecast(forecast)
    }
  }

  handleResult("", {forecasts:forecasts, daily:dailyForecasts, offset:timezoneOffset, timezone: timezone})
}
function router_get_forecast(cityIndex, handleResult) {
  var cityInfo = getCityInfoByIndex(cityIndex)

  request({
    url: urlPrefixWithKey + cityInfo.id + '?lang=zh',
    json: true
  }, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      renderJson(body, cityIndex, handleResult)
    } else {
      error = error + response
      handleResult(error, "")
    }
  })
}

function getCityInfoByIndex(index) {
  return cities[index]
}

exports.router_get_forecast = router_get_forecast
