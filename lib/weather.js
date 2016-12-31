exports = module.exports = {}
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

  exports.getWindDirectionName = getWindDirectionName
  exports.forecast_summary = forecast_summary
