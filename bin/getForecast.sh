#/bin/sh
set -u
script=$(readlink -f "$0")
DIR=$(dirname "$script")
[ -d "$DIR/../data" ] || mkdir "$DIR/../data"
. "$HOME/.weatherrc"

id="$1"
forecast_log="$DIR/../data/forecast${id}.log"
weather_log="$DIR/../data/weather${id}.log"
url_prefix="http://api.openweathermap.org/data/2.5/"
params="id=$id&lang=zh&units=metric&appid=$api_key"
json_format='{"dt":.dt, "temp":.main.temp, "info":.weather[].description,"wind_s":.wind.speed,"wind_d":.wind.deg}'
curl -s "${url_prefix}weather?$params" |  jq '.' > "$weather_log"
cat "$weather_log" | jq "$json_format" | paste -sd '      \n' - > "$forecast_log"
curl -s "${url_prefix}forecast?$params" |  jq ".list[]|$json_format" | paste -sd '      \n' - >> "$forecast_log"
