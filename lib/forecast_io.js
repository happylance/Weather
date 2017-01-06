exports = module.exports = {}
var fs = require('fs')
var readline = require('readline');
var path = require('path');
var beaufort = require('beaufort')
var request = require("request")
var dateUtil = require('../lib/dateUtil')
var cities = require('../lib/cities')
var weather = require('../lib/weather')

var forecast_summary = weather.forecast_summary
var getWindDirectionName = weather.getWindDirectionName
var options = {unit: 'mps', getName: false};

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

function datetimeInChinese(datetime, offset) {
  return dateUtil.datetimeInChinese(datetime, offset, false)
}

function getTemperatureInC(temperature) {
  return Math.round((temperature - 32) * 5 / 9)
}

function getForecastItem(forecast, previousDate, previousTimePrefix, timezoneOffset){
  var datetime = new Date(forecast.time * 1000)
  var datetime_cn = datetimeInChinese(datetime, timezoneOffset)
  var temp_cn = ""
  if ('temperature' in forecast) {
    temp_cn = getTemperatureInC(forecast.temperature) + "°C"
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
      info_cn = summary
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

function getForecastItemDaily(forecast, previousDate, previousTimePrefix, timezoneOffset){
  var datetime = new Date(forecast.time * 1000)
  var datetime_cn = datetimeInChinese(datetime, timezoneOffset)

  var info_cn = ""
  if ('summary' in forecast) {
    var summary = forecast.summary
    if (summary in forecast_summary) {
      info_cn = forecast_summary[summary]
    } else {
      info_cn = summary
    }
  }

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
          var precipIntensityMaxTimeDatetime = new Date(forecast.precipIntensityMaxTime * 1000)
          var maxTime = dateUtil.datetimeInChinese(precipIntensityMaxTimeDatetime, timezoneOffset, true)
          additional_info = additional_info + maxTime.time_prefix + maxTime.time + '最大' + precipIntensity + 'mm'
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
      if (additional_info == "") {
        additional_info = wind_cn
      } else {
        additional_info = additional_info + ' ' + wind_cn
      }
    }
  }

  var sun_info = ""
  if ('sunriseTime' in forecast && 'sunsetTime' in forecast) {
    var sunriseDateTime = new Date(forecast.sunriseTime * 1000)
    var sunsetDateTime = new Date(forecast.sunsetTime * 1000)
    var sunriseTime = dateUtil.datetimeInChinese(sunriseDateTime, timezoneOffset, true)
    var sunsetTime = dateUtil.datetimeInChinese(sunsetDateTime, timezoneOffset, true)
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
  var timezoneOffset = getCityInfoByIndex(cityIndex).timezoneOffset()

  function pushForecast(forecast) {
    forecastItem = getForecastItem(forecast, previousDate, previousTimePrefix, timezoneOffset)
    forecasts.push(forecastItem)
    previousDate = forecastItem.datetime.date
    previousTimePrefix = forecastItem.datetime.time_prefix
  }

  function pushDailyForecast(forecast) {
    forecastItem = getForecastItemDaily(forecast, previousDate, previousTimePrefix, timezoneOffset)
    dailyForecasts.push(forecastItem)
    previousDate = forecastItem.datetime.date
    previousTimePrefix = forecastItem.datetime.time_prefix
  }

  var weather = data
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

  handleResult("", {forecasts:forecasts, daily:dailyForecasts})
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
      error = error + response.statusCode
      handleResult(error, "")
    }
  })
}

function getCityInfoByIndex(index) {
  return cities[index]
}

exports.router_get_forecast = router_get_forecast
