import { DataFrame, FieldType } from '@grafana/data';
import { HeatmapValue } from '../types';
import { formatDate } from './dateHelpers';

type Aggregation = 'sum' | 'count' | 'avg' | 'max' | 'min' | 'last' | 'first';

interface TimestampedValue {
  timestamp: number;
  value: number;
}

export function processTimeSeriesData(
  series: DataFrame[],
  aggregation: Aggregation,
  timeZone?: string,
  labelField?: string,
  categoryField?: string
): HeatmapValue[] {
  const dailyData = new Map<string, TimestampedValue[]>();
  const dailyLabels = new Map<string, Set<string>>();
  const dailyCategory = new Map<string, string>();

  for (const frame of series) {
    const timeField = frame.fields.find((f) => f.type === FieldType.time);
    const valueField = frame.fields.find((f) => f.type === FieldType.number && f.name !== 'Time');
    const labelFieldData = labelField ? frame.fields.find((f) => f.name === labelField) : undefined;
    const categoryFieldData = categoryField ? frame.fields.find((f) => f.name === categoryField) : undefined;

    if (!timeField || !valueField) {
      continue;
    }

    for (let i = 0; i < frame.length; i++) {
      const timestamp = timeField.values[i];
      const value = valueField.values[i];

      if (value === null || value === undefined || isNaN(value)) {
        continue;
      }

      // Important: format dates using Grafana's timezone to ensure correct bucketing
      const date = formatDate(new Date(timestamp), timeZone);

      if (!dailyData.has(date)) {
        dailyData.set(date, []);
      }
      dailyData.get(date)!.push({ timestamp, value });

      if (labelFieldData) {
        const labelValue = labelFieldData.values[i];
        if (labelValue !== null && labelValue !== undefined && String(labelValue).trim() !== '') {
          if (!dailyLabels.has(date)) {
            dailyLabels.set(date, new Set());
          }
          dailyLabels.get(date)!.add(String(labelValue));
        }
      }

      if (categoryFieldData && !dailyCategory.has(date)) {
        const catValue = categoryFieldData.values[i];
        if (catValue !== null && catValue !== undefined && String(catValue).trim() !== '') {
          dailyCategory.set(date, String(catValue));
        }
      }
    }
  }

  const result: HeatmapValue[] = [];
  dailyData.forEach((values, date) => {
    const count = aggregate(values, aggregation);
    const labelSet = dailyLabels.get(date);
    const label = labelSet && labelSet.size > 0 ? Array.from(labelSet).join(', ') : undefined;
    const category = dailyCategory.get(date);
    result.push({ date, originalDate: date, count: Math.round(count * 100) / 100, label, category });
  });

  result.sort((a, b) => a.date.localeCompare(b.date));
  return result;
}

function aggregate(values: TimestampedValue[], method: Aggregation): number {
  if (values.length === 0) {
    return 0;
  }

  switch (method) {
    case 'sum':
      return values.reduce((a, b) => a + b.value, 0);
    case 'count':
      return values.length;
    case 'avg':
      return values.reduce((a, b) => a + b.value, 0) / values.length;
    case 'max':
      return Math.max(...values.map((v) => v.value));
    case 'min':
      return Math.min(...values.map((v) => v.value));
    case 'last':
      return values.reduce((latest, cur) => (cur.timestamp > latest.timestamp ? cur : latest)).value;
    case 'first':
      return values.reduce((earliest, cur) => (cur.timestamp < earliest.timestamp ? cur : earliest)).value;
    default:
      return values[0].value;
  }
}
