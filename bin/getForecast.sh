#/bin/sh
set -u
script=$(readlink -f "$0")
DIR=$(dirname "$script")
[ -d "$DIR/../data" ] || mkdir "$DIR/../data"
forecast_log="$DIR/../data/forecast.log"
. "$HOME/.weatherrc"

curl -s "http://api.openweathermap.org/data/2.5/forecast?id=2037913&lang=zh&units=metric&appid=$api_key" |  jq '.list[]|{"dt":.dt, "temp":.main.temp, "info":.weather[].description,"wind_s":.wind.speed,"wind_d":.wind.deg}' | paste -sd '      \n' - > "$forecast_log"
