/* @noflow */
import React, { PureComponent as Component } from "react";
import { format as dateFormat } from "date-fns";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import get from "lodash.get";
import type { RankGraph } from "./types";
import { Spinner } from "../common";

type Props = {
  graph: ?RankGraph,
};

const formatYAxis = (value) => {
  let label = value < 0 ? "k" : "d";
  let rank = Math.abs(value / 100);
  // Because there's no rank between 1 kyu and 1 dan, dan ranks
  // need to be bumped up by one
  if (label === "d") {
    rank += 1;
  }

  let formattedRank = Number(rank.toFixed(1));

  if ((rank <= 9 && label === "d") || (rank <= 30 && label === "k")) {
    return `${formattedRank}${label}`;
  }
  return "";
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    if (data.rank === null || data.rank === undefined) {
      return null;
    }
    return (
      <div className="RankGraph-tooltip">
        <div className="RankGraph-tooltip-date">
          {dateFormat(new Date(data.date), "MMM d, yyyy")}
        </div>
        <div className="RankGraph-tooltip-rank">
          Rank: <strong>{formatYAxis(data.rank)}</strong>
        </div>
      </div>
    );
  }
  return null;
};

export default class UserRankGraph extends Component<Props> {
  _formatXAxis = (tickItem) => {
    const d = new Date(tickItem);
    return dateFormat(d, "MMM d");
  };

  _formatYAxis = (value) => {
    return formatYAxis(value);
  };

  _renderGraph() {
    const series = get(this.props.graph, "data.series[0]", []);
    const yValues = series.map((point) => point.y).filter((y) => y !== null);

    if (!series.length || !yValues.length) {
      return (
        <div className="UserDetailsModal-no-rank-graph">
          No rank graph available.
        </div>
      );
    }

    const min = Math.min.apply(null, yValues);
    const max = Math.max.apply(null, yValues);

    const yMin = Math.floor(min / 100) * 100;
    const yMax = Math.ceil(max / 100) * 100;

    const yTicks = [];
    for (let i = yMin; i <= yMax; i += 100) {
      yTicks.push(i);
    }

    const chartData = series.map((point) => ({
      date:
        point.x instanceof Date
          ? point.x.getTime()
          : new Date(point.x).getTime(),
      rank: point.y,
    }));

    return (
      <div className="RankGraph-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 15, left: -20, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="var(--graph-grid, rgba(0, 0, 0, 0.05))"
            />
            <XAxis
              dataKey="date"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={this._formatXAxis}
              stroke="var(--graph-axis, rgba(0, 0, 0, 0.4))"
              tick={{ fontSize: 11 }}
            />
            <YAxis
              domain={[yMin, yMax]}
              ticks={yTicks}
              tickFormatter={this._formatYAxis}
              stroke="var(--graph-axis, rgba(0, 0, 0, 0.4))"
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{
                stroke: "var(--graph-cursor, rgba(0, 0, 0, 0.15))",
                strokeWidth: 1,
              }}
            />
            <Line
              type="monotone"
              dataKey="rank"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, fill: "var(--accent)", strokeWidth: 0 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  render() {
    return <div>{this.props.graph ? this._renderGraph() : <Spinner />}</div>;
  }
}
