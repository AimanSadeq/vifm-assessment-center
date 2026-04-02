"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import type { BiasMetric } from "@/lib/scoring/bias-detection";

type Props = {
  engagementCount: number;
  candidateCount: number;
  totalRatings: number;
  iccScore: number | null;
  iccInterpretation: { label: string; color: string } | null;
  biasMetrics: BiasMetric[];
  scoreDistribution: number[];
  competencyAverages: { name: string; average: number; count: number }[];
};

export function AnalyticsDashboard({
  engagementCount,
  candidateCount,
  totalRatings,
  iccScore,
  iccInterpretation,
  biasMetrics,
  scoreDistribution,
  competencyAverages,
}: Props) {
  const distributionData = [
    { score: "1 - Sig. Dev. Needed", count: scoreDistribution[0] },
    { score: "2 - Dev. Needed", count: scoreDistribution[1] },
    { score: "3 - Competent", count: scoreDistribution[2] },
    { score: "4 - Strength", count: scoreDistribution[3] },
    { score: "5 - Sig. Strength", count: scoreDistribution[4] },
  ];

  const radarData = competencyAverages.map((c) => ({
    competency: c.name.length > 18 ? c.name.slice(0, 18) + "..." : c.name,
    average: c.average,
    fullMark: 5,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          System-wide analytics: ICC scores, bias detection, engagement metrics.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{engagementCount}</p>
            <p className="text-sm text-muted-foreground">Engagements</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{candidateCount}</p>
            <p className="text-sm text-muted-foreground">Candidates</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{totalRatings}</p>
            <p className="text-sm text-muted-foreground">Total Ratings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">
                {iccScore !== null ? iccScore.toFixed(3) : "—"}
              </p>
              {iccInterpretation && (
                <Badge
                  variant="outline"
                  className={iccInterpretation.color}
                >
                  {iccInterpretation.label}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              ICC (Inter-Rater Reliability)
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Score Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">BARS Score Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={distributionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="score" fontSize={10} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#010131" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Competency Radar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Competency Average Scores
            </CardTitle>
          </CardHeader>
          <CardContent>
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="competency" fontSize={9} />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 5]}
                    fontSize={9}
                  />
                  <Radar
                    name="Average"
                    dataKey="average"
                    stroke="#5391D5"
                    fill="#5391D5"
                    fillOpacity={0.3}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No rating data available yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assessor Bias Detection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assessor Bias Detection</CardTitle>
          <p className="text-sm text-muted-foreground">
            Identifies potential rating biases across assessors. Values outside
            normal ranges are flagged.
          </p>
        </CardHeader>
        <CardContent>
          {biasMetrics.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No assessor data available.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assessor</TableHead>
                  <TableHead className="text-center">Ratings</TableHead>
                  <TableHead className="text-center">Mean</TableHead>
                  <TableHead className="text-center">SD</TableHead>
                  <TableHead className="text-center">Leniency</TableHead>
                  <TableHead className="text-center">
                    Central Tendency
                  </TableHead>
                  <TableHead className="text-center">Halo Effect</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {biasMetrics.map((m) => (
                  <TableRow key={m.assessorId}>
                    <TableCell className="font-medium">
                      {m.assessorName}
                    </TableCell>
                    <TableCell className="text-center">
                      {m.ratingCount}
                    </TableCell>
                    <TableCell className="text-center">
                      {m.meanRating.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      {m.standardDeviation.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={
                          Math.abs(m.leniencyBias) > 0.5
                            ? "text-red-600 border-red-300 bg-red-50"
                            : ""
                        }
                      >
                        {m.leniencyBias > 0 ? "+" : ""}
                        {m.leniencyBias.toFixed(2)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={
                          m.centralTendencyBias > 0.6
                            ? "text-amber-700 border-amber-300 bg-amber-50"
                            : ""
                        }
                      >
                        {(m.centralTendencyBias * 100).toFixed(0)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={
                          m.haloEffect > 0.6
                            ? "text-orange-600 border-orange-300 bg-orange-50"
                            : ""
                        }
                      >
                        {(m.haloEffect * 100).toFixed(0)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
