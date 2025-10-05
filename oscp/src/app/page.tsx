"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useEffect, useMemo, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { motion } from "framer-motion";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Button } from "@/components/ui/button";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip as ChartTooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ChartTooltip,
  Legend
);

type BusinessParams = {
  satelliteCount: number;
  missionYears: number;
  expectedRevenuePerSatellite: number; // $M over mission
  costPerSatellite: number; // $M (capex)
  annualOpexPerSatellite: number; // $M/year
};

type DebrisParams = {
  satelliteCount: number;
  lifetimeYears: number;
  eolStrategy: "deorbit" | "graveyard" | "none";
};

function computeBusiness(params: BusinessParams) {
  const { satelliteCount, missionYears, expectedRevenuePerSatellite, costPerSatellite, annualOpexPerSatellite } = params;
  const capex = satelliteCount * costPerSatellite;
  const opex = satelliteCount * annualOpexPerSatellite * missionYears;
  const tco = capex + opex;
  const revenue = satelliteCount * expectedRevenuePerSatellite;
  const roi = tco === 0 ? 0 : (revenue - tco) / tco;
  return { capex, opex, tco, revenue, roi };
}

function computeDebrisRisk(params: DebrisParams) {
  const { satelliteCount, lifetimeYears, eolStrategy } = params;
  // Placeholder heuristic inspired by ODPO notions: more sats + longer life + no EOL => higher risk
  const baseRisk = Math.min(1, (satelliteCount / 200) * 0.5 + (lifetimeYears / 15) * 0.5);
  const strategyFactor = eolStrategy === "deorbit" ? 0.4 : eolStrategy === "graveyard" ? 0.7 : 1.0;
  const collisionRisk = Math.min(1, baseRisk * strategyFactor);
  // Projected debris metric as a simple function
  const projectedDebrisIndex = Math.round(100 * (satelliteCount / 300) * (lifetimeYears / 10) * (eolStrategy === "none" ? 1.2 : 0.7));
  return { collisionRisk, projectedDebrisIndex };
}

function computeSustainabilityIndex(debris: ReturnType<typeof computeDebrisRisk>, business: ReturnType<typeof computeBusiness>) {
  // Simple index blending ROI positivity and inverse of risk
  const roiScore = Math.max(0, Math.min(1, (business.roi + 0.5))); // roi -0.5..0.5 → 0..1
  const riskScore = 1 - debris.collisionRisk; // lower risk is better
  const sustainability = Math.max(0, Math.min(1, 0.4 * roiScore + 0.6 * riskScore));
  let color: "green" | "yellow" | "red" = "green";
  if (sustainability < 0.4) color = "red";
  else if (sustainability < 0.7) color = "yellow";
  return { score: sustainability, color };
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("business");
  const businessTabRef = useRef<HTMLButtonElement>(null);
  const toursTabRef = useRef<HTMLButtonElement>(null);
  const orbitTabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const refs: Record<string, React.RefObject<HTMLButtonElement>> = {
      business: businessTabRef,
      tours: toursTabRef,
      orbit: orbitTabRef,
    } as const;
    const ref = refs[activeTab];
    if (ref?.current) {
      // Defer to ensure the tab has rendered
      setTimeout(() => ref.current?.focus(), 0);
    }
  }, [activeTab]);
  const [satelliteCount, setSatelliteCount] = useState(60);
  const [missionYears, setMissionYears] = useState(5);
  const [expectedRevenuePerSatellite, setExpectedRevenuePerSatellite] = useState(8); // $M
  const [costPerSatellite, setCostPerSatellite] = useState(5); // $M
  const [annualOpexPerSatellite, setAnnualOpexPerSatellite] = useState(0.8); // $M/yr

  const [lifetimeYears, setLifetimeYears] = useState(7);
  const [eolStrategy, setEolStrategy] = useState<"deorbit" | "graveyard" | "none">("deorbit");
  const [hotelClass, setHotelClass] = useState<"budget" | "luxury" | "research">("budget");

  const business = useMemo(() =>
    computeBusiness({ satelliteCount, missionYears, expectedRevenuePerSatellite, costPerSatellite, annualOpexPerSatellite }),
  [satelliteCount, missionYears, expectedRevenuePerSatellite, costPerSatellite, annualOpexPerSatellite]);

  const debris = useMemo(() =>
    computeDebrisRisk({ satelliteCount, lifetimeYears, eolStrategy }),
  [satelliteCount, lifetimeYears, eolStrategy]);

  const sustainability = useMemo(() => computeSustainabilityIndex(debris, business), [debris, business]);

  const roiPct = Math.round(business.roi * 100);

  const costVsRevenueData = {
    labels: ["CAPEX", "OPEX", "Revenue"],
    datasets: [
      {
        label: "$M",
        data: [business.capex, business.opex, business.revenue],
        backgroundColor: ["#60a5fa", "#34d399", "#fbbf24"],
      },
    ],
  };

  const riskTrendData = {
    labels: Array.from({ length: missionYears }, (_, i) => `Y${i + 1}`),
    datasets: [
      {
        label: "Risk",
        data: Array.from({ length: missionYears }, () => (debris.collisionRisk * 100).toFixed(2)),
        borderColor: "#ef4444",
        backgroundColor: "rgba(239,68,68,0.2)",
      },
    ],
  };

  const sustainabilityData = {
    labels: ["Sustainability", "Risk"],
    datasets: [
      {
        data: [Math.round(sustainability.score * 100), Math.round((1 - sustainability.score) * 100)],
        backgroundColor: ["#10b981", "#f87171"],
      },
    ],
  };

  function applyScenario(s: "lowcost" | "luxury" | "research") {
    if (s === "lowcost") {
      setSatelliteCount(80);
      setMissionYears(4);
      setExpectedRevenuePerSatellite(6);
      setCostPerSatellite(3.5);
      setAnnualOpexPerSatellite(0.6);
      setLifetimeYears(5);
      setEolStrategy("deorbit");
    } else if (s === "luxury") {
      setSatelliteCount(30);
      setMissionYears(6);
      setExpectedRevenuePerSatellite(18);
      setCostPerSatellite(9);
      setAnnualOpexPerSatellite(1.5);
      setLifetimeYears(8);
      setEolStrategy("graveyard");
    } else {
      setSatelliteCount(50);
      setMissionYears(5);
      setExpectedRevenuePerSatellite(10);
      setCostPerSatellite(6);
      setAnnualOpexPerSatellite(1.0);
      setLifetimeYears(7);
      setEolStrategy("deorbit");
    }
  }

  return (
    <div className="min-h-screen p-6 md:p-10 bg-[radial-gradient(1200px_800px_at_80%_-10%,rgba(59,130,246,0.25),transparent),radial-gradient(1000px_600px_at_-10%_10%,rgba(16,185,129,0.25),transparent)]">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Orbital Sustainability & Commerce Platform</h1>
          <p className="text-sm text-muted-foreground">LEO mission planning: commercial viability, debris mitigation, and sustainability.</p>
        </div>
        <ThemeToggle />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-8">
        <Card className="backdrop-blur bg-card/80 border-white/10 overflow-hidden">
          <CardContent className="p-6 md:p-8 grid md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-xl md:text-2xl font-semibold mb-2">Experience Space Commerce & Tourism in LEO</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Low Earth Orbit is transforming into a thriving marketplace. Plan sustainable constellations, assess debris risk, simulate profitability, and preview tourism scenarios with interactive charts and 3D orbit visuals.
              </p>
              <div className="flex flex-wrap gap-2">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                  <Button className="bg-blue-600 hover:bg-blue-500" onClick={() => setActiveTab("tours")}>
                    Plan Your Trip
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab("business")}
                    onMouseDown={() => {
                      // Indicate focus visually as soon as pressed
                      setTimeout(() => businessTabRef.current?.focus(), 0);
                    }}
                  >
                    Run Business Sim
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab("orbit")}
                    onMouseDown={() => setTimeout(() => orbitTabRef.current?.focus(), 0)}
                  >
                    View Orbit 3D
                  </Button>
                </motion.div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded border bg-background/40">
                <div className="font-semibold">Sustainability</div>
                <div className="text-muted-foreground">Green/Yellow/Red indicators using placeholder ODPO-inspired logic.</div>
              </div>
              <div className="p-3 rounded border bg-background/40">
                <div className="font-semibold">Debris Risk</div>
                <div className="text-muted-foreground">Adjust lifetimes and EOL strategy to reduce risk.</div>
              </div>
              <div className="p-3 rounded border bg-background/40">
                <div className="font-semibold">Profitability</div>
                <div className="text-muted-foreground">TCO vs revenue and ROI visualizations.</div>
              </div>
              <div className="p-3 rounded border bg-background/40">
                <div className="font-semibold">Tourism</div>
                <div className="text-muted-foreground">Trip planning, hotel classes, and mission timelines.</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-8 gap-2 w-full md:w-auto">
          <TabsTrigger ref={businessTabRef} value="business">Business</TabsTrigger>
          <TabsTrigger value="debris">Debris</TabsTrigger>
          <TabsTrigger value="sustainability">Sustainability</TabsTrigger>
          <TabsTrigger value="plan">Plan</TabsTrigger>
          <TabsTrigger ref={toursTabRef} value="tours">Tours</TabsTrigger>
          <TabsTrigger ref={orbitTabRef} value="orbit">Orbit</TabsTrigger>
          <TabsTrigger value="planner">Planner</TabsTrigger>
          <TabsTrigger value="safety">Safety</TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="space-y-4">
          <Card className="backdrop-blur bg-card/80 border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.15)]">
            <CardHeader>
              <CardTitle>Business Simulation</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <Label>Scenarios</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button variant="outline" onClick={() => applyScenario("lowcost")}>LEO Low-cost</Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button variant="outline" onClick={() => applyScenario("luxury")}>Luxury Orbit</Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button variant="outline" onClick={() => applyScenario("research")}>Research+Tourism</Button>
                    </motion.div>
                  </div>
                </div>
                <div>
                  <Label>Satellites: {satelliteCount}</Label>
                  <Slider value={[satelliteCount]} min={1} max={300} step={1} onValueChange={([v]) => setSatelliteCount(v)} />
                </div>
                <div>
                  <Label>Mission duration (years): {missionYears}</Label>
                  <Slider value={[missionYears]} min={1} max={15} step={1} onValueChange={([v]) => setMissionYears(v)} />
                </div>
                <div>
                  <Label>Expected revenue per sat ($M):</Label>
                  <Input type="number" value={expectedRevenuePerSatellite} onChange={(e) => setExpectedRevenuePerSatellite(Number(e.target.value))} />
                </div>
                <div>
                  <Label>CAPEX per sat ($M):</Label>
                  <Input type="number" value={costPerSatellite} onChange={(e) => setCostPerSatellite(Number(e.target.value))} />
                </div>
                <div>
                  <Label>OPEX per sat per year ($M):</Label>
                  <Input type="number" value={annualOpexPerSatellite} onChange={(e) => setAnnualOpexPerSatellite(Number(e.target.value))} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">TCO</Badge>
                  <div className="text-xl font-semibold">${business.tco.toFixed(1)}M</div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">Revenue</Badge>
                  <div className="text-xl font-semibold">${business.revenue.toFixed(1)}M</div>
                </div>
                <div>
                  <Label>ROI: {roiPct}%</Label>
                  <Progress value={Math.max(0, Math.min(100, roiPct + 50))} />
                </div>
                <Line data={riskTrendData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
              </div>
            </CardContent>
          </Card>

          <Card className="backdrop-blur bg-card/80 border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.15)]">
            <CardHeader>
              <CardTitle>Costs vs Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <Bar data={costVsRevenueData} options={{ responsive: true }} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tours" className="space-y-4">
          <Card className="backdrop-blur bg-card/80 border-white/10">
            <CardHeader>
              <CardTitle>Space Tourism Dashboard</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <Label>Passengers: {satelliteCount}</Label>
                  <Slider value={[satelliteCount]} min={1} max={400} step={1} onValueChange={([v]) => setSatelliteCount(v)} />
                </div>
                <div>
                  <Label>Trip duration (days): {missionYears * 3}</Label>
                  <Slider value={[missionYears]} min={1} max={20} step={1} onValueChange={([v]) => setMissionYears(v)} />
                </div>
                <div>
                  <Label>Hotel class</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button variant={hotelClass === "budget" ? "default" : "outline"} onClick={() => setHotelClass("budget")}>
                        LEO Budget
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button variant={hotelClass === "luxury" ? "default" : "outline"} onClick={() => setHotelClass("luxury")}>
                        Luxury Orbit
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button variant={hotelClass === "research" ? "default" : "outline"} onClick={() => setHotelClass("research")}>
                        Research+Tourism
                      </Button>
                    </motion.div>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">Cost / Trip</Badge>
                  <div className="text-xl font-semibold">${(business.tco / Math.max(1, satelliteCount)).toFixed(2)}M</div>
                </div>
                <Bar data={costVsRevenueData} options={{ responsive: true }} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orbit" className="space-y-4">
          <Card className="backdrop-blur bg-card/80 border-white/10">
            <CardHeader>
              <CardTitle>Orbit Visualization (Preview)</CardTitle>
            </CardHeader>
            <CardContent className="h-[400px]">
              <Canvas camera={{ position: [0, 0, 6], fov: 60 }}>
                <ambientLight intensity={0.6} />
                <pointLight position={[10, 10, 10]} />
                <mesh rotation={[0.4, 0.2, 0]}>
                  <sphereGeometry args={[1.5, 32, 32]} />
                  <meshStandardMaterial color="#3b82f6" wireframe />
                </mesh>
                <mesh rotation={[0, 0.3, 0]} position={[0, 0, 0]}>
                  <torusGeometry args={[3, 0.02, 16, 200]} />
                  <meshStandardMaterial color="#10b981" />
                </mesh>
                <OrbitControls />
              </Canvas>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="planner" className="space-y-4">
          <Card className="backdrop-blur bg-card/80 border-white/10">
            <CardHeader>
              <CardTitle>Mission Planner</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Badge>Launch</Badge>
                  <div className="flex-1 h-2 bg-muted rounded">
                    <div className="h-2 bg-blue-500 rounded w-1/3 animate-pulse" />
                  </div>
                  <Badge variant="secondary">Dock</Badge>
                  <div className="flex-1 h-2 bg-muted rounded">
                    <div className="h-2 bg-emerald-500 rounded w-1/4" />
                  </div>
                  <Badge variant="secondary">Return</Badge>
                </div>
                <p className="text-sm text-muted-foreground">Exportable roadmap (placeholder). Add milestones, windows, and cost/sustainability per leg.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="safety" className="space-y-4">
          <Card className="backdrop-blur bg-card/80 border-white/10">
            <CardHeader>
              <CardTitle>Safety & Sustainability</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-3">
              <div>
                <Label>Passenger Safety</Label>
                <Progress value={Math.max(20, 100 - Math.round(debris.collisionRisk * 100))} />
              </div>
              <div>
                <Label>Debris Mitigation</Label>
                <Progress value={Math.round((1 - debris.collisionRisk) * 100)} />
              </div>
              <div>
                <Label>Hotel Eco-Rating</Label>
                <Progress value={Math.round(sustainability.score * 100)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="debris" className="space-y-4">
          <Card className="backdrop-blur bg-card/80 border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.15)]">
            <CardHeader>
              <CardTitle>Debris Risk Simulator</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <Label>Lifetime (years): {lifetimeYears}</Label>
                  <Slider value={[lifetimeYears]} min={1} max={15} step={1} onValueChange={([v]) => setLifetimeYears(v)} />
                </div>
                <div>
                  <Label>End-of-life strategy</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button variant={eolStrategy === "deorbit" ? "default" : "outline"} onClick={() => setEolStrategy("deorbit")}>Deorbit</Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button variant={eolStrategy === "graveyard" ? "default" : "outline"} onClick={() => setEolStrategy("graveyard")}>Graveyard</Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button variant={eolStrategy === "none" ? "default" : "outline"} onClick={() => setEolStrategy("none")}>None</Button>
                    </motion.div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">Collision Risk</Badge>
                  <div className="text-xl font-semibold">{Math.round(debris.collisionRisk * 100)}%</div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">Projected Debris Index</Badge>
                  <div className="text-xl font-semibold">{debris.projectedDebrisIndex}</div>
                </div>
                <Doughnut data={sustainabilityData} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sustainability" className="space-y-4">
          <Card className="backdrop-blur bg-card/80 border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.15)]">
            <CardHeader>
              <CardTitle>Sustainability Index</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Badge className={`${sustainability.color === "green" ? "bg-green-600" : sustainability.color === "yellow" ? "bg-yellow-500" : "bg-red-600"}`}>Status</Badge>
                  <div className="text-xl font-semibold capitalize">{sustainability.color}</div>
                </div>
                <div>
                  <Label>Composite score</Label>
                  <Progress value={Math.round(sustainability.score * 100)} />
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Placeholder logic approximates ODPO considerations. Integrate ORDEM/DAS for realism. Improve sustainability by reducing lifetime, increasing deorbit compliance, or optimizing satellite counts and economics.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plan" className="space-y-4">
          <Card className="backdrop-blur bg-card/80 border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.15)]">
            <CardHeader>
              <CardTitle>Business Plan – Executive Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
              <p>
                Low Earth Orbit (LEO) is evolving into a dynamic commercial arena. Launch economics and private investment enable diverse ventures: advanced satellite services, in-space manufacturing, cutting-edge research, and sustainable tourism.
              </p>
              <p>
                With opportunity comes responsibility: resilient infrastructure, cost-effective operations, debris mitigation, and a proactive regulatory strategy are essential. OSCP helps teams quantify ROI, risk, and sustainability.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-foreground">Value Proposition</h3>
                  <ul className="list-disc pl-5">
                    <li>Optimize constellation size and lifetime for profitability.</li>
                    <li>Quantify debris risk and sustainability impact.</li>
                    <li>AI-ready: future integration for predictive insights.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Target Markets</h3>
                  <ul className="list-disc pl-5">
                    <li>Next-gen Earth observation and communications.</li>
                    <li>Microgravity R&D and in-space manufacturing.</li>
                    <li>Emerging sustainable tourism operations.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Operations & Cost</h3>
                  <ul className="list-disc pl-5">
                    <li>Transparent CAPEX/OPEX breakdowns and TCO.</li>
                    <li>Lifecyle planning with EOL compliance options.</li>
                    <li>Scalable architecture with modular upgrades.</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Sustainability & Regulation</h3>
                  <ul className="list-disc pl-5">
                    <li>Placeholder ODPO-inspired metrics (ORDEM/DAS).</li>
                    <li>Policy-aware planning; supports reporting needs.</li>
                    <li>Green/Yellow/Red indicators for quick reviews.</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
