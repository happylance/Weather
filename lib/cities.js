
function getEDTTimezoneOffset() {
  var datetime = new Date()
  return -datetime.getTimezoneOffset() / 60 // EDT
}
function getCNTimezoneOffset() {
  return 8
}
module.exports = [{id:"41.059204,121.6055323",name:"巧女",source:1,timezoneOffset:getCNTimezoneOffset},
    {id:"41.095317,121.3422523",name:"凌海1",source:1,timezoneOffset:getCNTimezoneOffset},
    {id:"41.312864,122.3147513",name:"盘山1",source:1,timezoneOffset:getCNTimezoneOffset},
    {id:2037913,name:"凌海",source:0,timezoneOffset:getCNTimezoneOffset},
    {id:2035513,name:"盘山",source:0,timezoneOffset:getCNTimezoneOffset},
    {id:"38.91607726,-77.20676137",name:"CD",source:1,timezoneOffset:getEDTTimezoneOffset}]
