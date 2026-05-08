const http = require("http");
const { URL } = require("url");
const fs = require("fs");

// http://27.156.118.74:18800/rain?no_data_visible=false&hour_duration=24&time=[2026-05-06T06:00:00,2026-05-06T17:00:00]
// 解析命令行参数
function parseArguments() {
  const args = process.argv.slice(2);
  let start = null;
  let end = null;
  let stcd = null;
  let stnm = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--start" && i + 1 < args.length) {
      start = args[i + 1];
      i++;
    } else if (args[i] === "--end" && i + 1 < args.length) {
      end = args[i + 1];
      i++;
    } else if (args[i] === "--stcd" && i + 1 < args.length) {
      stcd = args[i + 1];
      i++;
    } else if (args[i] === "--stnm" && i + 1 < args.length) {
      stnm = args[i + 1];
      i++;
    }
  }
  if (!start || !end) {
    const defaults = getDefaultStartEnd();
    if (!start) start = defaults.start;
    if (!end) end = defaults.end;
    // console.log(`No start/end provided, using default: start=${start}, end=${end}`);
  }
  return { start, end, stcd, stnm };
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
const { start, end, stcd, stnm } = parseArguments();

function report() {
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
          if (stnm) {
            let st = parsedData.data.find((item) => item.name && item.name.includes(stnm));
            if (st) {
              detail_stcd_report(st.id);
            }
            return;
          }
          //   write to file
          //   fs.writeFileSync("./rainfall.json", JSON.stringify(parsedData, null, 2));
          let data = parsedData.data.filter((item) => item.val > 0);
          let total_stations = data.length;
          // 过滤掉没有名称的站点
          data = data.filter((item) => item.name);
          let counties_above_0 = data
            .filter((item) => item.val > 0)
            .map((item) => ({
              area_name: item.area_name,
              name: item.name,
              val: item.val,
            }));
          let counties_above_0_10 = counties_above_0.filter(
            (item) => item.val <= 10,
          );
          let counties_above_10 = counties_above_0.filter(
            (item) => item.val > 25,
          );
          let counties_above_10_25 = counties_above_10.filter(
            (item) => item.val <= 25,
          );
          let counties_above_25 = counties_above_10.filter(
            (item) => item.val > 25,
          );
          let counties_above_25_50 = counties_above_25.filter(
            (item) => item.val <= 50,
          );
          let counties_above_50 = counties_above_25.filter(
            (item) => item.val > 50,
          );
          let counties_above_50_100 = counties_above_50.filter(
            (item) => item.val <= 100,
          );
          let counties_above_100 = counties_above_50.filter(
            (item) => item.val > 100,
          );
          let counties_above_100_250 = counties_above_100.filter(
            (item) => item.val <= 250,
          );
          let counties_above_250 = counties_above_100_250.filter(
            (item) => item.val > 250,
          );
          let max_rainfall_location = data.reduce(
            (max, item) => (item.val > max.val ? item : max),
            parsedData.data[0],
          );
          let max_rainfall_value = max_rainfall_location.val;
          let max_hourly_rainfall_location = data.reduce(
            (max, item) => (item.val > max.val ? item : max),
            parsedData.data[0],
          );
          let max_hourly_rainfall_value = max_hourly_rainfall_location.val;
          console.log("total_stations:", total_stations);
          console.log("counties_above_50:", counties_above_50.length);
          console.log("counties_above_100:", counties_above_100.length);
          console.log("max_rainfall_location:", max_rainfall_location.name);
          console.log("max_rainfall_value:", max_rainfall_value);
          console.log(
            "max_hourly_rainfall_location:",
            max_hourly_rainfall_location.name,
          );
          console.log("max_hourly_rainfall_value:", max_hourly_rainfall_value);
          // 各县最大雨量对应的测站和雨量值
          let max_rainfall_by_area_name = {};
          data.forEach((item) => {
            if (!max_rainfall_by_area_name[item.area_name]) {
              max_rainfall_by_area_name[item.area_name] = {
                name: item.name,
                val: item.val,
              };
            }
            if (item.val > max_rainfall_by_area_name[item.area_name].val) {
              max_rainfall_by_area_name[item.area_name] = {
                name: item.name,
                val: item.val,
              };
            }
          });
          console.log("降雨量级在250mm以上的测站数据:", counties_above_250);
          console.log(
            "降雨量级在250-250mm以上的测站数据:",
            counties_above_100_250,
          );
          console.log("降雨量级在50-100mm的测站数据:", counties_above_50_100);
          console.log("降雨量级在25-50mm的测站数据:", counties_above_25_50);
          console.log("降雨量级在10-25mm的测站数据:", counties_above_10_25);
          console.log("降雨量级在0-10mm的测站数据:", counties_above_0_10);

          console.log("各县最大降雨：", max_rainfall_by_area_name);

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

function detail_stcd_report(id) {
  id = id || stcd;
  // console.log("详细测站数据报告");
  // http://27.156.118.74:18800/rain/details?id=71411358&interval=1h&time=%5B2026-05-07T06%3A00%3A00%2C2026-05-07T19%3A00%3A00%5D
  const timeValue = `[${start},${end}]`;
  const baseUrl = "http://27.156.118.74:18800/rain/details";
  const urlObj = new URL(baseUrl);
  urlObj.searchParams.set("id", id);
  urlObj.searchParams.set("interval", "1h");
  urlObj.searchParams.set("time", timeValue);
  const requestUrl = urlObj.toString();
  const req = http.get(requestUrl, (res) => {
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
          console.log(
            `站点: ${stnm}[id:${id}]的降雨数据:`,
            JSON.stringify(parsedData.data, null, 2),
          );
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

if (stcd) {
  detail_stcd_report();
} else {
  report();
}
