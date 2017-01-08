exports = module.exports = {}
var beaufort = require('beaufort')
var options = {unit: 'mps', getName: false};

var wind_directions = ['北', '东北偏北', '东北','东北偏东',
    '东', '东南偏东','东南', '东南偏南',
    '南','西南偏南', '西南', '西南偏西',
    '西', '西北偏西', '西北', '西北偏北']
function getWindDirectionName(windBearing) {
  var windIndex = (Math.floor((windBearing + 11.25) / 22.5) % 16)
  return wind_directions[windIndex] + '风'
}

var forecast_summary = {'多云转阴':"阴",
    '毛毛雨':"细雨",
    'Light Rain':"小雨",
    '晴朗':"晴",
    '局部多云':"少云",
    'Mostly Cloudy':"多云",
    '降雨':"中雨",
    '倾盆大雨':"大雨",
    '轻微的雨夹雪':"小雨夹雪",
    'Sleet':"雨夹雪",
    '较强的雨夹雪':"大雨夹雪",
    '有雾':"雾",
    'Light Snow':"小雪",
    '降雪':"中雪",
    '鹅毛大雪':"大雪"
  }

  function getSimpleSummary(summary) {
    return (summary in forecast_summary) ? forecast_summary[summary] : summary
  }

  function getWind(speed, direction) {
    var wind_cn = ""
    if (typeof(speed) == "number") {
      var level = beaufort(speed, options)
      if (level > 2) {
        if (typeof(direction) == "number") {
          wind_cn = level + "级" + getWindDirectionName(direction)
        } else {
          wind_cn = level + "级风"
        }
      }
    }
    return wind_cn
  }

  exports.getSimpleSummary = getSimpleSummary
  exports.getWind = getWind
