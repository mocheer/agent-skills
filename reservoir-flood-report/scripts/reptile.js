import { URL } from "url";

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
  // http://27.156.118.74:18800/water?no_data_visible=false&time=%5B2026-05-06T06%3A00%3A00%2C2026-05-06T17%3A00%3A00%5D
  // http://27.156.118.74:18800/water?no_data_visible=false&time=%5B2026-05-05T16%3A46%3A45%2C2026-05-06T16%3A46%3A45%5D
  // 验证日期格式简单检查
  const timeValue = `[${start},${end}]`;
  const baseUrl = "http://27.156.118.74:18800/water";
  const urlObj = new URL(baseUrl);
  urlObj.searchParams.set("no_data_visible", "false");
  urlObj.searchParams.set("time", timeValue);
  const requestUrl = urlObj.toString();
  return fetch(requestUrl)
    .then((r) => r.json())
    .then((parsedData) => {
      try {
        if (stnm) {
          let st = parsedData.data.find(
            (item) => item.name && item.name.includes(stnm),
          );
          if (st) {
            detail_stcd_report(st.id);
          }
          return;
        }
        let data = parsedData.data.filter((item) => item.type); //过滤没有测站类型的测站
        console.log("total_st:", data.length);
        console.log(
          "reservoirs:",
          data.filter((item) => item.type === "RR").length,
        );
        console.log(
          "river_sids:",
          data.filter((item) => item.type !== "RR").length,
        );
        // console.log(data.filter((item) => item.type !== "RR"))
        // console.log(data)
        // 超汛限或者超警戒水位的测站
        let data_over = data
          .filter((item) => item.is_over)
          .map((item) => ({
            id: item.id,
            name: item.name,
            type: item.type,
            val: item.val,
            is_over: item.is_over,
            area_name: item.area_name,
            测站类型: item.type === "RR" ? "水库" : "河道",
          }));
        // 水库超汛限水位的测站
        let data_rr = data_over.filter((item) => item.type === "RR");
        console.log("超汛限水位的测站:", data_rr);
        // 超警戒水位的测站
        // ZZ
        let data_hd = data_over.filter((item) => item.type !== "RR");
        console.log("超警戒水位的测站:", data_hd);
      } catch (e) {
        // 不是JSON，直接输出原始文本
        console.log(e);
      }
    })
    .catch((err) => {
      console.error(`Request failed: ${err.message}`);
    });
}

function detail_stcd_report(id) {
  id = id || stcd;
  // console.log("详细测站数据报告");
  const timeValue = `[${start},${end}]`;
  const baseUrl = "http://27.156.118.74:18800/water/details";
  const urlObj = new URL(baseUrl);
  urlObj.searchParams.set("id", id);
  urlObj.searchParams.set("time", timeValue);
  const requestUrl = urlObj.toString();
  return fetch(requestUrl)
    .then((r) => r.json())
    .then((parsedData) => {
      try {
        console.log(
          `站点: ${stnm}[id:${id}]的水位过程数据:`,
          JSON.stringify(parsedData.data, null, 2),
        );
      } catch (e) {
        // 不是JSON，直接输出原始文本
        console.log(e);
      }
    })
    .catch((err) => {
      console.error(`Request failed: ${err.message}`);
    });
}

if (stcd) {
  await detail_stcd_report();
} else {
  await report();
}
