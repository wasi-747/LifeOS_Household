import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Utensils,
  Users as UsersIcon,
  Search,
  Bell,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  UserCheck,
  Loader2,
  AlertCircle,
  Cpu
} from 'lucide-react';
import api from '../services/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie
} from 'recharts';

interface UserStanding {
  userId: string;
  name: string;
  email: string;
  role: string;
  userTotalMeals: number;
  usageHours: number;
  usagePercent: number;
  mealCostPortion: number;
  utilityPortion: number;
  rentPortion: number;
  totalDeposits: number;
  finalDue: number;
}

interface SummaryData {
  monthId: string;
  totalMealCost: number;
  totalMeals: number;
  mealRate: number;
  hasTelemetryUtility: boolean;
  userStandings: UserStanding[];
}

interface DeviceInfo {
  deviceId: string;
  owner: {
    name: string;
    email: string;
    role: string;
  } | null;
}

interface TelemetryRecord {
  _id: string;
  deviceId: string;
  timestamp: string;
  cpuUsage: number;
  ramUsage: number;
  uptime: number;
  activityBreakdown: {
    Coding: number;
    Gaming: number;
    Browsing: number;
    Other: number;
  };
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'standings' | 'hardware'>('dashboard');
  const [monthId, setMonthId] = useState<string>('July-2026');
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Telemetry States
  const [devicesList, setDevicesList] = useState<DeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('jashore-laptop');
  const [telemetryData, setTelemetryData] = useState<TelemetryRecord[] | null>(null);
  const [telemetryLoading, setTelemetryLoading] = useState<boolean>(false);
  const [telemetryError, setTelemetryError] = useState<string | null>(null);

  // Fetch summary calculations
  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get<SummaryData>(`/summary/${monthId}`);
        setSummaryData(response.data);
      } catch (err: any) {
        console.error('Error fetching summary data:', err);
        setError(err.message || 'Failed to fetch summary data from the server.');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [monthId]);

  // Fetch list of unique devices in household
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const response = await api.get<DeviceInfo[]>('/telemetry/info/devices');
        setDevicesList(response.data);
        if (response.data.length > 0) {
          // Default to the first found device ID
          setSelectedDeviceId(response.data[0].deviceId);
        }
      } catch (err) {
        console.error('Error fetching devices list:', err);
      }
    };

    fetchDevices();
  }, []);

  // Fetch telemetry logs for active device
  useEffect(() => {
    if (activeTab !== 'hardware' || !selectedDeviceId) return;

    const fetchTelemetry = async () => {
      setTelemetryLoading(true);
      setTelemetryError(null);
      try {
        const response = await api.get<TelemetryRecord[]>(`/telemetry/${selectedDeviceId}`);
        const sortedData = [...response.data].reverse();
        setTelemetryData(sortedData);
      } catch (err: any) {
        console.error('Error fetching telemetry:', err);
        setTelemetryError(err.message || 'Failed to fetch telemetry logs.');
      } finally {
        setTelemetryLoading(false);
      }
    };

    fetchTelemetry();
  }, [activeTab, selectedDeviceId]);

  // Process data for the activity breakdown PieChart
  const getPieData = () => {
    if (!telemetryData || telemetryData.length === 0) return [];
    let coding = 0, gaming = 0, browsing = 0, other = 0;
    telemetryData.forEach(item => {
      coding += item.activityBreakdown?.Coding || 0;
      gaming += item.activityBreakdown?.Gaming || 0;
      browsing += item.activityBreakdown?.Browsing || 0;
      other += item.activityBreakdown?.Other || 0;
    });
    return [
      { name: 'Coding', value: coding },
      { name: 'Gaming', value: gaming },
      { name: 'Browsing', value: browsing },
      { name: 'Other', value: other }
    ].filter(item => item.value > 0);
  };

  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  };

  const pieData = getPieData();
  const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#64748b'];

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo */}
          <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-lg shadow-indigo-500/30">
              <LayoutDashboard size={20} />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none tracking-wide text-white">LifeOS</h1>
              <span className="text-xs text-indigo-400 font-semibold tracking-wider uppercase">Platform</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600/15 text-indigo-400 border-l-4 border-indigo-500'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard size={18} />
              <span>Overview</span>
            </button>
            <button
              onClick={() => setActiveTab('standings')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === 'standings'
                  ? 'bg-indigo-600/15 text-indigo-400 border-l-4 border-indigo-500'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <UsersIcon size={18} />
              <span>Financial Ledger</span>
            </button>
            <button
              onClick={() => setActiveTab('hardware')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === 'hardware'
                  ? 'bg-indigo-600/15 text-indigo-400 border-l-4 border-indigo-500'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Cpu size={18} />
              <span>Hardware & Network</span>
            </button>
          </nav>
        </div>

        {/* Current Session User */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-800/40">
            <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-white shadow-inner">
              SA
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate text-white">Shakil Ahmed</p>
              <span className="text-xs text-emerald-400 font-medium">Active (Admin)</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/40 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-4 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700 w-80">
            <Search size={16} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search platform..."
              className="bg-transparent border-none text-xs text-slate-200 focus:outline-none w-full"
            />
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-slate-300">
              <Calendar size={16} className="text-indigo-400" />
              <select
                value={monthId}
                onChange={(e) => setMonthId(e.target.value)}
                disabled={activeTab === 'hardware'}
                className="bg-slate-800 text-xs font-semibold text-slate-200 focus:outline-none border border-slate-700 rounded px-2 py-1 uppercase tracking-wider cursor-pointer disabled:opacity-50"
              >
                <option value="July-2026">July 2026</option>
                <option value="June-2026">June 2026</option>
              </select>
            </div>

            <button className="relative p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-all">
              <Bell size={16} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-indigo-500 rounded-full"></span>
            </button>
          </div>
        </header>

        {/* Content Container */}
        <div className="p-8 space-y-8 flex-1">
          
          {/* Hardware & Telemetry View */}
          {activeTab === 'hardware' && (
            <div className="space-y-8">
              {/* Heading and Device Selector */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Telemetry Hub</h2>
                  <p className="text-slate-400 text-sm">Monitoring health stats and active usage for household PC units.</p>
                </div>
                
                <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5">
                  <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Select Device:</span>
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    className="bg-slate-800 text-xs font-bold text-indigo-400 focus:outline-none border border-slate-700 rounded px-2.5 py-1.5 cursor-pointer uppercase tracking-widest"
                  >
                    {devicesList.map(dev => (
                      <option key={dev.deviceId} value={dev.deviceId}>
                        {dev.deviceId} {dev.owner ? `(${dev.owner.name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {telemetryLoading ? (
                <div className="flex flex-col items-center justify-center h-96 gap-4">
                  <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
                  <p className="text-slate-400 text-sm">Loading telemetry metrics...</p>
                </div>
              ) : telemetryError ? (
                <div className="flex flex-col items-center justify-center h-96 gap-4 bg-slate-900/40 border border-slate-800 rounded-2xl p-8">
                  <AlertCircle className="h-12 w-12 text-rose-500" />
                  <h3 className="text-lg font-bold text-white">Telemetry Database Offline</h3>
                  <p className="text-slate-400 text-sm text-center max-w-md">{telemetryError}</p>
                  <button 
                    onClick={() => setSelectedDeviceId(selectedDeviceId)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold mt-2 transition-all"
                  >
                    Refresh Logs
                  </button>
                </div>
              ) : telemetryData && telemetryData.length > 0 ? (
                <>
                  {/* Uptime and Status Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden shadow-xl">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Device Uptime</span>
                      <h3 className="text-2xl font-extrabold mt-2 text-emerald-400">
                        {formatUptime(telemetryData[telemetryData.length - 1].uptime)}
                      </h3>
                      <p className="text-[10px] text-slate-500 mt-2">Active boot duration</p>
                    </div>

                    <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden shadow-xl">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Current CPU Load</span>
                      <h3 className="text-2xl font-extrabold mt-2 text-rose-400">
                        {telemetryData[telemetryData.length - 1].cpuUsage.toFixed(1)}%
                      </h3>
                      <p className="text-[10px] text-slate-500 mt-2">Latest telemetry snapshot</p>
                    </div>

                    <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden shadow-xl">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Current RAM Load</span>
                      <h3 className="text-2xl font-extrabold mt-2 text-indigo-400">
                        {telemetryData[telemetryData.length - 1].ramUsage.toFixed(1)}%
                      </h3>
                      <p className="text-[10px] text-slate-500 mt-2">Latest telemetry snapshot</p>
                    </div>

                    <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden shadow-xl">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">System State</span>
                      <h3 className="text-2xl font-extrabold mt-2 text-emerald-400">ONLINE</h3>
                      <p className="text-[10px] text-slate-500 mt-2">Receiving telemetry logs</p>
                    </div>
                  </div>

                  {/* Two-Column Graphs */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Line Chart */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:col-span-2 shadow-xl space-y-6">
                      <div>
                        <h3 className="font-bold text-lg text-white">System Utilization Over Time</h3>
                        <p className="text-xs text-slate-400">Real-time load statistics tracking CPU vs memory usage cycles.</p>
                      </div>

                      <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={telemetryData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis 
                              dataKey="timestamp" 
                              stroke="#94a3b8" 
                              fontSize={10} 
                              tickLine={false}
                              tickFormatter={(tick) => new Date(tick).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            />
                            <YAxis stroke="#94a3b8" fontSize={10} domain={[0, 100]} tickLine={false} axisLine={false} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                              labelFormatter={(label) => new Date(label).toLocaleString()}
                            />
                            <Legend verticalAlign="top" height={36} />
                            <Line 
                              type="monotone" 
                              dataKey="cpuUsage" 
                              name="CPU Usage (%)" 
                              stroke="#f43f5e" 
                              strokeWidth={2} 
                              dot={false} 
                              activeDot={{ r: 6 }} 
                            />
                            <Line 
                              type="monotone" 
                              dataKey="ramUsage" 
                              name="RAM Usage (%)" 
                              stroke="#6366f1" 
                              strokeWidth={2} 
                              dot={false} 
                              activeDot={{ r: 6 }} 
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Pie Chart & Comparative Hours */}
                    <div className="space-y-8 flex flex-col justify-between">
                      {/* Pie Chart */}
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex-1 space-y-4 flex flex-col justify-between">
                        <div>
                          <h3 className="font-bold text-sm text-white">Device Application Share</h3>
                          <span className="text-[10px] text-slate-500 block">Active window category share</span>
                        </div>

                        {pieData.length > 0 ? (
                          <div className="h-44 w-full relative">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={pieData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={45}
                                  outerRadius={65}
                                  paddingAngle={5}
                                  dataKey="value"
                                >
                                  {pieData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip 
                                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                                  formatter={(value) => [`${value} logs`, 'Duration']}
                                />
                                <Legend layout="horizontal" align="center" verticalAlign="bottom" />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
                            No application logs found.
                          </div>
                        )}
                      </div>

                      {/* Roommate Comparative list */}
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                        <div>
                          <h3 className="font-bold text-sm text-white">Uptime Share Ledger</h3>
                          <span className="text-[10px] text-slate-500 block">Transparent PC hours for monthly utility splits</span>
                        </div>

                        <div className="space-y-3">
                          {summaryData?.userStandings.map(user => (
                            <div key={user.userId} className="flex justify-between items-center bg-slate-800/35 p-3 rounded-xl border border-slate-800/50">
                              <div>
                                <span className="font-semibold text-xs text-white block">{user.name}</span>
                                <span className="text-[10px] text-slate-500 capitalize">{user.role}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-bold text-indigo-400 block">{user.usageHours.toFixed(1)} hrs</span>
                                <span className="text-[10px] text-slate-500">{user.usagePercent.toFixed(1)}% share</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-96 gap-4 bg-slate-900/40 border border-slate-800 rounded-2xl p-8">
                  <AlertCircle className="h-12 w-12 text-amber-500" />
                  <h3 className="text-lg font-bold text-white">No Telemetry Ingested</h3>
                  <p className="text-slate-400 text-sm text-center max-w-sm">No telemetry records exist for selected device. Start the python telemetry agent to feed health snapshots.</p>
                </div>
              )}
            </div>
          )}

          {/* Roommate calculations tab details */}
          {activeTab !== 'hardware' && (
            loading ? (
              <div className="flex flex-col items-center justify-center h-96 gap-4">
                <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
                <p className="text-slate-400 text-sm">Fetching household calculations...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-96 gap-4 bg-slate-900/40 border border-slate-800 rounded-2xl p-8">
                <AlertCircle className="h-12 w-12 text-rose-500" />
                <h3 className="text-lg font-bold text-white">Connection Error</h3>
                <p className="text-slate-400 text-sm text-center max-w-md">{error}</p>
                <button 
                  onClick={() => setMonthId(monthId)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold mt-2 transition-all"
                >
                  Retry Request
                </button>
              </div>
            ) : summaryData ? (
              <>
                {/* Overview Sub-view */}
                {activeTab === 'dashboard' && (
                  <>
                    {/* Heading */}
                    <div>
                      <h2 className="text-2xl font-bold text-white tracking-tight">Household Summary</h2>
                      <p className="text-slate-400 text-sm">Real-time status overview of shared expenses and balances.</p>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-3 text-indigo-500/10"><DollarSign size={80} /></div>
                        <span className="text-xs font-semibold text-slate-400 uppercase">Total Bazar Costs</span>
                        <h3 className="text-2xl font-bold mt-2">${summaryData.totalMealCost.toFixed(2)}</h3>
                        <div className="flex items-center gap-1.5 text-xs text-indigo-400 mt-2 font-medium">
                          <TrendingUp size={14} />
                          <span>Includes groceries</span>
                        </div>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-3 text-emerald-500/10"><Utensils size={80} /></div>
                        <span className="text-xs font-semibold text-slate-400 uppercase">Total Meals Consumed</span>
                        <h3 className="text-2xl font-bold mt-2">{summaryData.totalMeals.toFixed(1)}</h3>
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400 mt-2 font-medium">
                          <UserCheck size={14} />
                          <span>Calculated with guest meals</span>
                        </div>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-3 text-amber-500/10"><TrendingUp size={80} /></div>
                        <span className="text-xs font-semibold text-slate-400 uppercase">Current Meal Rate</span>
                        <h3 className="text-2xl font-bold mt-2 text-amber-400">
                          ${summaryData.mealRate.toFixed(2)} <span className="text-xs text-slate-500 font-normal">/ meal</span>
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-amber-500 mt-2 font-medium">
                          <TrendingDown size={14} />
                          <span>Bazar cost divided by meals</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Ledger Standings Sub-view or visual compare */}
                <div className="grid grid-cols-1 gap-8">
                  {/* Ledger Table */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                    <div>
                      <h3 className="font-bold text-lg text-white">Roommate Standing Statement</h3>
                      <p className="text-xs text-slate-400">Detailed list of calculations used to determine final standings.</p>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-800">
                      <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                          <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                            <th className="py-4 px-6">Roommate Name</th>
                            <th className="py-4 px-6 text-center">Total Meals</th>
                            <th className="py-4 px-6 text-right">Meal Cost</th>
                            <th className="py-4 px-6 text-right">Utility Portion</th>
                            <th className="py-4 px-6 text-right">Rent Portion</th>
                            <th className="py-4 px-6 text-right">Total Deposits</th>
                            <th className="py-4 px-6 text-right">Final Standing</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80">
                          {summaryData.userStandings.map((user) => {
                            const isOwed = user.finalDue < 0;
                            const formattedStanding = isOwed
                              ? `+$${Math.abs(user.finalDue).toFixed(2)} (Owed)`
                              : `$${user.finalDue.toFixed(2)} (Owes)`;

                            return (
                              <tr key={user.userId} className="hover:bg-slate-800/25 text-slate-200 text-sm transition-all border-b border-slate-800/40">
                                <td className="py-4 px-6 font-semibold text-white">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xs">
                                      {user.name.split(' ').map(n => n[0]).join('')}
                                    </div>
                                    <div>
                                      <p>{user.name}</p>
                                      <span className="text-[10px] text-slate-500 capitalize">{user.role}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-4 px-6 text-center font-medium text-slate-300">
                                  {user.userTotalMeals.toFixed(1)}
                                </td>
                                <td className="py-4 px-6 text-right font-medium text-slate-300">
                                  ${user.mealCostPortion.toFixed(2)}
                                </td>
                                <td className="py-4 px-6 text-right font-medium text-slate-300">
                                  <div>${user.utilityPortion.toFixed(2)}</div>
                                  {summaryData.hasTelemetryUtility && user.usageHours > 0 && (
                                    <span className="inline-block mt-1 px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded text-[9px] font-bold">
                                      {user.usageHours.toFixed(1)} hrs active
                                    </span>
                                  )}
                                </td>
                                <td className="py-4 px-6 text-right font-medium text-slate-300">
                                  ${user.rentPortion.toFixed(2)}
                                </td>
                                <td className="py-4 px-6 text-right font-semibold text-indigo-300">
                                  ${user.totalDeposits.toFixed(2)}
                                </td>
                                <td className={`py-4 px-6 text-right font-bold transition-colors ${
                                  isOwed ? 'text-emerald-400' : 'text-rose-400'
                                }`}>
                                  {formattedStanding}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Visual Chart */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                    <div>
                      <h3 className="font-bold text-lg text-white">Deficit & Surplus Visual Chart</h3>
                      <p className="text-xs text-slate-400">Comparing final standing balances. Positive bars represent money owed, negative bars represent surplus / money to be refunded.</p>
                    </div>

                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={summaryData.userStandings}
                          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                          <YAxis 
                            stroke="#94a3b8" 
                            fontSize={12} 
                            tickLine={false}
                            axisLine={false}
                            label={{ value: 'Standing Amount ($)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12, offset: 0 }}
                          />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                            formatter={(value: any) => {
                              const val = Number(value);
                              if (val < 0) {
                                return [`+$${Math.abs(val).toFixed(2)} (Refund)`, 'Surplus'];
                              }
                              return [`$${val.toFixed(2)} (Owes)`, 'Deficit'];
                            }}
                          />
                          <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
                          <Bar dataKey="finalDue" radius={[4, 4, 0, 0]}>
                            {summaryData.userStandings.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.finalDue >= 0 ? 'rgba(239, 68, 68, 0.85)' : 'rgba(16, 185, 129, 0.85)'} 
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-96 text-slate-400">
                No summary data available.
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}
