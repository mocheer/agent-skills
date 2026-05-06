---
name: rainfall-report
description: 生成今日降雨站点简报 / 查询当前全省降雨情况 / 播报降雨超阈值站点信息。Dynamically scrapes rainfall real-time data from Fujian water resources platform via curl and generates structured rainfall situation reports in Chinese.
read_when:
  - 生成今日降雨站点简报
  - 查询当前全省降雨情况
  - 播报降雨超阈值站点信息
metadata: {"clawdbot":{"emoji":"🌧️","requires":{"bins":["node","npm"]}}}
allowed-tools: Bash(agent-browser:*)
---

# 降雨站点简报生成

## 技能描述
使用 curl 动态访问福建省水利信息平台的降雨监测页面，自动提取指定时间段内的全省降雨站点统计、超阈值县数、最大降雨点及最大小时雨量信息，并严格按照固定模板生成降雨简报。所有数值均来自实时采集的页面数据，杜绝人工填入或虚假生成。

## 触发意图
当用户要求"生成今日降雨站点简报""查询当前全省降雨情况""播报降雨超阈值站点信息"等，或直接要求使用本技能动态获取数据并输出简报时调用。

## 数据采集流程

### 1. 确定时间范围
- 若用户提供了明确的统计开始时间和结束时间，则使用用户指定的时间（格式 `YYYY-MM-DD HH:MM`）。
- 否则默认统计**当日**，开始时间为 `当日上午 06:00`，结束时间为 `当前系统小时数`（24 小时制，整点），确保简报反映从当日 6 时到最近整点的降雨状况。

### 2. 打开目标页面
- 使用curl访问以下URL（需根据时间格式化参数）：
  ```
  http://27.156.118.74:18800/rain?no_data_visible=false&hour_duration=24&time=%5B{start_time}T{start_hour}%3A00%3A00%2C{end_time}T{end_hour}%3A00%3A00%5D

  ```
参数范例

start_time: 2026-05-06
end_time: 2026-05-06
start_hour: 06
end_hour: 17


### 3. 数据提取与映射

根据雨量数据分析总结，提取以下字段：

| 技能参数 | 页面来源与提取说明 |
|----------|-------------------|
| `total_stations` | 页面中"站点总数"或"降雨站点数"后的数字（个），如"全省共 484 个站点降雨"中提取 484 |
| `counties_above_50` | 页面中"超过 50 毫米的县（市、区）数"对应的数字，提取为整数 |
| `counties_above_100` | 页面中"超过 100 毫米的县（市、区）数"对应的数字，提取为整数 |
| `max_rainfall_location` | 页面中"最大降雨点"或"最大降雨量地点"对应的文本，通常包含县、镇、村及具体灾害点名称，完整提取 |
| `max_rainfall_value` | 页面中"最大降雨量"对应的数值，单位毫米，提取为浮点数（如 23.9） |
| `max_hourly_rainfall_location` | 页面中"最大小时雨量地点"对应的文本，同样包含详细位置 |
| `max_hourly_rainfall_value` | 页面中"最大小时雨量"对应的数值，单位毫米，提取为浮点数（如 5.8） |

### 4. 数据校验
- `total_stations` 为正整数，一般在 0~2000 之间。
- `counties_above_50`、`counties_above_100` 为非负整数，且 `counties_above_100` ≤ `counties_above_50`。
- `max_rainfall_value` > 0，`max_hourly_rainfall_value` ≥ 0。
- 所有地点字段不能为空字符串，至少包含县级及以上行政区划名称。
- 若关键数据缺失（返回 null、0 或 NaN），注明"数据获取不完整"并停止输出，提示用户稍后重试。

## 输出模板
严格按照以下格式输出，其中 `{}` 内的占位符替换为实际采集数据。

```
{start_day}日{start_hour}时~{end_hour}时，全省共{total_stations}个站点降雨
共有{counties_above_50}个县超过50毫米，其中{counties_above_100}个县超过100毫米，以{max_rainfall_location}{max_rainfall_value}毫米为最大;最大小时雨量为{max_hourly_rainfall_location}{max_hourly_rainfall_value}毫米。
```

### 占位符计算规则
- `{start_day}`：`start_time` 中的日期数字（不加前导零，如 `28`）。
- `{start_hour}`：`start_time` 中的小时数（24 小时制，不加前导零）。
- `{end_hour}`：`end_time` 中的小时数（24 小时制，不加前导零）。
- `{total_stations}`：输出提取的整数。
- `{counties_above_50}`、`counties_above_100}`：输出提取的整数。
- `{max_rainfall_location}`：输出完整的地点描述（如"罗源县梅花村亭下程平琪等屋后滑坡"）。
- `{max_rainfall_value}`：保留一位小数（如 23.9）。
- `{max_hourly_rainfall_location}`：输出完整的地点描述（如"屏南县甘棠乡甘棠乡下山登村陈宗安等房后滑坡"）。
- `{max_hourly_rainfall_value}`：保留一位小数（如 5.8）。

## 示例输出
```
28日6时~18时，全省共484个站点降雨
共有0个县超过50毫米，其中0个县超过100毫米，以罗源县梅花村亭下程平琪等屋后滑坡23.9毫米为最大;最大小时雨量为屏南县甘棠乡甘棠乡下山登村陈宗安等房后滑坡5.8毫米。
```

## 异常处理与质量保障
1. **页面无法访问**：尝试重试一次（间隔 3 秒）；若仍失败，回复"当前降雨页面暂时无法访问，请稍后重试"。
2. **数据不完整**：若提取到的总站点数为 0 或 NaN，提示"页面关键数据缺失，无法生成简报"。
3. **时间格式异常**：若用户指定的时间解析失败，默认使用当日 6 时~当前小时。
4. **无超过阈值县**：`counties_above_50` 和 `counties_above_100` 均为 0 时，仍正常输出"共有0个县超过50毫米，其中0个县超过100毫米"。
5. **数据一致性**：若 `counties_above_100` > `counties_above_50`，则修正为 `counties_above_50` 的值，并在简报末尾附加"(注：数据已自动校验修正)"。

## 注意事项
- 采集和简报中所有数值直接使用提取结果，禁止四舍五入或改变精度（仅保留格式要求的一位小数）。
- 日期和小时不补零，保持与模板示例一致。
- 输出结尾不加多余标点、空行，注意模板中"降雨"后换行，"毫米;"后无空格。
- 如果用户提供了数据（如 JSON）作为补充，优先使用动态采集结果，用户数据仅用于交叉验证。
