exports = module.exports = {}
var moment = require('moment-timezone')

var days_cn = ["日","一","二","三","四","五","六"]
function _dayInChinese(day) {
  return days_cn[day]
}

function _pad(num, size) {
    var s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
}

function datetimeInChinese(unix_time, timezone, simple) {
  var date = moment.tz(unix_time * 1000, timezone)
  var datetime = moment.tz(unix_time * 1000, timezone).format("e k m").split(" ")
  var date_cn = "周" + _dayInChinese(datetime[0])
  var hour = datetime[1]
  var time_prefix_cn = hour < 12 ? "上午" : "下午"
  if (hour < 8) time_prefix_cn = simple ? "早" : "早上"
  if (hour < 4) time_prefix_cn = "凌晨"
  if (hour > 17) time_prefix_cn = simple ? "晚" : "晚上"
  hour = hour > 12 ? hour - 12 : hour
  hour = hour == 0 ? hour = 12 : hour
  var time_cn = String(hour) + ":" + _pad(datetime[2], 2)
  if (datetime[2] == 0) {
    time_cn = hour + "点"
  }
  return {date:date_cn, time_prefix:time_prefix_cn, time:time_cn}
}
exports.datetimeInChinese = datetimeInChinese
