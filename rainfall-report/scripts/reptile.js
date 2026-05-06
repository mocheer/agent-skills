const http = require("http");
const { URL } = require("url");
const fs = require("fs");

// http://27.156.118.74:18800/rain?no_data_visible=false&hour_duration=24&time=[2026-05-06T06:00:00,2026-05-06T17:00:00]
// 解析命令行参数
function parseArguments() {
  const args = process.argv.slice(2);
  let start = null;
  let end = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--start" && i + 1 < args.length) {
      start = args[i + 1];
      i++;
    } else if (args[i] === "--end" && i + 1 < args.length) {
      end = args[i + 1];
      i++;
    }
  }
  return { start, end };
}

function formatLocalISODate(date) {
  const pad = (n) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function getDefaultStartEnd() {
  var now = new Date();
  var end = now;
  end.setHours(end.getHours() + 1, 0, 0, 0);
  var start = new Date(end);
  if (end.getHours() < 6) {
    start.setDate(end.getDate() - 1);
  }
  start.setHours(6, 0, 0, 0);

  return {
    start: formatLocalISODate(start),
    end: formatLocalISODate(end),
  };
}

function main() {
  let { start, end } = parseArguments();
  if (!start || !end) {
    const defaults = getDefaultStartEnd();
    if (!start) start = defaults.start;
    if (!end) end = defaults.end;
    // console.log(`No start/end provided, using default: start=${start}, end=${end}`);
  }
// http://27.156.118.74:18800/rain?no_data_visible=false&hour_duration=24&time=%5B2026-05-06T06%3A00%3A00%2C2026-05-06T17%3A00%3A00%5D
// http://27.156.118.74:18800/rain?no_data_visible=false&hour_duration=24&time=%5B2026-05-05T16%3A46%3A45%2C2026-05-06T16%3A46%3A45%5D
  // 验证日期格式简单检查
  const timeValue = `[${start},${end}]`;
  //   console.log(`Encoding time: ${encodedTime}`,timeValue);

  const baseUrl = "http://27.156.118.74:18800/rain";
  const urlObj = new URL(baseUrl);
  urlObj.searchParams.set("no_data_visible", "false");
  urlObj.searchParams.set("hour_duration", "24");
  urlObj.searchParams.set("time", timeValue);
  //自动 encodeURIComponent
  const requestUrl = urlObj.toString();
//   console.log(`Requesting URL: ${requestUrl}`);

  const req = http.get(requestUrl, (res) => {
    // console.log(`Response Status: ${res.statusCode} ${res.statusMessage}`);
    let rawData = "";
    res.setEncoding("utf8");
    res.on("data", (chunk) => {
      rawData += chunk;
    });
    res.on("end", () => {
      if (res.statusCode === 200) {
        try {
          // 尝试解析JSON
          const parsedData = JSON.parse(rawData);
 
          //   write to file
          //   fs.writeFileSync("./rainfall.json", JSON.stringify(parsedData, null, 2));
          parsedData.data = parsedData.data.filter((item) => item.val > 0);
          let total_stations = parsedData.data.length;
          // 过滤掉没有名称的站点
          parsedData.data = parsedData.data.filter((item) => item.name);
          let counties_above_50 = parsedData.data.filter((item) => item.val > 50).length;
          let counties_above_100 = parsedData.data.filter((item) => item.val > 100).length;
          let max_rainfall_location = parsedData.data.reduce((max, item) => (item.val > max.val ? item : max), parsedData.data[0]);
          let max_rainfall_value = max_rainfall_location.val;
          let max_hourly_rainfall_location = parsedData.data.reduce((max, item) => (item.val > max.val ? item : max), parsedData.data[0]);
          let max_hourly_rainfall_value = max_hourly_rainfall_location.val;
          console.log("total_stations:", total_stations);
          console.log("counties_above_50:", counties_above_50);
          console.log("counties_above_100:", counties_above_100);
          console.log("max_rainfall_location:", max_rainfall_location.name);
          console.log("max_rainfall_value:", max_rainfall_value);
          console.log("max_hourly_rainfall_location:", max_hourly_rainfall_location.name);
          console.log("max_hourly_rainfall_value:", max_hourly_rainfall_value);



          //   console.log(JSON.stringify(parsedData, null, 2));
        } catch (e) {
          // 不是JSON，直接输出原始文本
          console.log(e);
        }
      } else {
        console.error(`Error ${res.statusCode}: ${rawData}`);
      }
    });
  });

  req.on("error", (err) => {
    console.error(`Request failed: ${err.message}`);
  });

  req.setTimeout(10000, () => {
    req.destroy();
    console.error("Request timeout after 10 seconds");
  });

  req.end();
}

main();
