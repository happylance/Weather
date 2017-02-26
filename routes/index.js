var express = require('express');
var router = express.Router();
var dateUtil = require('../lib/dateUtil')
var cities = require('../lib/cities')
var weather = require('../lib/weather')
var addAccessLog = require('../lib/log').addAccessLog
var forecast_io = require('../lib/forecast_io')
var error_prefix = '对不起，出错了，请重试。如果一直不好，需要等亮来修。'

function datetimeInChinese(datetime, offset) {
  return dateUtil.datetimeInChinese(datetime, offset, false)
}

function render(data, cityIndex, res) {
  var cityInfo = getCityInfoByIndex(cityIndex)
  var timezoneOffset = data.offset
  console.log(timezoneOffset);
  var now_cn = datetimeInChinese(new Date(), timezoneOffset)
  var update_time = "更新于" + cityInfo.name + "时间" + now_cn.date + now_cn.time_prefix + now_cn.time
  console.log(update_time)

  var tab_count = cities.length
  var titles = []
  for (var i = 0; i < tab_count; i++) {
      titles.push(getCityInfoByIndex(String(i)).name)
  }
  res.render('index', {forecasts:data.forecasts, daily:data.daily, update_time:update_time, currentURL:"/" + cityIndex, titles:titles});
}

function getCityInfoByIndex(index) {
  return cities[index]
}

function router_get_forecast(cityIndex, req, res) {
  addAccessLog(req, cityIndex)

  var cityInfo = getCityInfoByIndex(cityIndex)
  var getForecast = forecast_io.router_get_forecast
  getForecast(cityIndex, function(err, data) {
    if (err) {
      console.log(err)
      res.send(error_prefix + err);
    } else {
      console.log("cityIndex:" + cityIndex)
      render(data, cityIndex, res)
    }
  })
}
/* GET home page. */
router.get('/', function(req, res, next) {
  router_get_forecast(0, req, res)
});

router.get('/:index', function(req, res, next) {
  var index = req.params.index
  if (index >= cities.length) {
    index = cities.length - 1
  }
  router_get_forecast(index, req, res)
});

module.exports = router;
