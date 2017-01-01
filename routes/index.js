var express = require('express');
var router = express.Router();
var dateUtil = require('../lib/dateUtil')
var cities = require('../lib/cities')
var weather = require('../lib/weather')
var addAccessLog = require('../lib/log').addAccessLog
var forecast_io = require('../lib/forecast_io')
var openweathermap = require('../lib/openweathermap')
var error_prefix = '对不起，出错了，请重试。如果一直不好，需要等亮来修。'

function datetimeInChinese(datetime, offset) {
  return dateUtil.datetimeInChinese(datetime, offset, false)
}

function render(forecasts, daily, cityIndex, res) {
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
  res.render('index', {forecasts:forecasts, daily:daily, update_time:update_time, currentURL:"/" + cityIndex, titles:titles, source:source});
}

function didGetForecasts(forecasts, daily, cityIndex, res, err) {
  if (err) {
    console.log(err)
    res.send(error_prefix + err);
    return
  } else {
    console.log("cityIndex:" + cityIndex)
    render(forecasts, daily, cityIndex, res)
  }
}

function getCityInfoByIndex(index) {
  return cities[index]
}

function router_get_forecast(cityIndex, req, res) {
  addAccessLog(req, cityIndex)

  var cityInfo = getCityInfoByIndex(cityIndex)
  if (cityInfo.source == 1) {
    forecast_io.router_get_forecast(cityIndex, req, res, didGetForecasts)
    return
  }
  openweathermap.getForecast(cityIndex, req, res, didGetForecasts)
}
/* GET home page. */
router.get('/', function(req, res, next) {
  router_get_forecast(0, req, res)
});

router.get('/:index', function(req, res, next) {
  router_get_forecast(req.params.index, req, res)
});

module.exports = router;
